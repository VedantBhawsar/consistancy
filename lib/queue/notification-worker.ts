import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  notificationJobs,
  notificationLogs,
  taskOccurrences,
  tasks,
  users,
} from "@/lib/db/schema";
import { getNotificationProvider } from "@/lib/notifications";
import { redisConnection } from "./redis";
import { NOTIFICATION_QUEUE_NAME, type NotificationJobData } from "./notification-queue";

const provider = getNotificationProvider();

async function processNotificationJob(job: Job<NotificationJobData>) {
  const { notificationJobId } = job.data;

  const [row] = await db
    .select({
      taskOccurrenceId: notificationJobs.taskOccurrenceId,
      occurrenceStatus: taskOccurrences.status,
      scheduledAt: taskOccurrences.scheduledAt,
      taskTitle: tasks.title,
      durationMinutes: tasks.durationMinutes,
      userId: users.id,
      telegramChatId: users.telegramChatId,
      timezone: users.timezone,
    })
    .from(notificationJobs)
    .innerJoin(
      taskOccurrences,
      eq(notificationJobs.taskOccurrenceId, taskOccurrences.id)
    )
    .innerJoin(tasks, eq(taskOccurrences.taskId, tasks.id))
    .innerJoin(users, eq(taskOccurrences.userId, users.id))
    .where(eq(notificationJobs.id, notificationJobId))
    .limit(1);

  if (!row) {
    throw new Error(`Notification job ${notificationJobId} not found`);
  }

  // Occurrence already resolved by the user before the reminder fired — nothing to send.
  if (row.occurrenceStatus === "COMPLETED" || row.occurrenceStatus === "SKIPPED" || row.occurrenceStatus === "CANCELLED") {
    await db
      .update(notificationJobs)
      .set({ status: "SENT", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(notificationJobs.id, notificationJobId));
    return;
  }

  if (!row.telegramChatId) {
    throw new Error("User has no Telegram chat ID configured");
  }

  await db
    .update(notificationJobs)
    .set({
      status: "PROCESSING",
      attempts: job.attemptsMade + 1,
      updatedAt: new Date(),
    })
    .where(eq(notificationJobs.id, notificationJobId));

  const scheduledTimeLocal = new Intl.DateTimeFormat("en-GB", {
    timeZone: row.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(row.scheduledAt);

  try {
    const result = await provider.send({
      to: row.telegramChatId,
      templateData: {
        taskTitle: row.taskTitle,
        durationMinutes: row.durationMinutes,
        scheduledTime: scheduledTimeLocal,
      },
    });

    await db
      .update(notificationJobs)
      .set({ status: "SENT", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(notificationJobs.id, notificationJobId));

    await db.insert(notificationLogs).values({
      userId: row.userId,
      taskOccurrenceId: row.taskOccurrenceId,
      channel: "TELEGRAM",
      providerMessageId: result.providerMessageId,
      status: "SENT",
      sentAt: new Date(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(notificationJobs)
      .set({
        status: "RETRYING",
        failedAt: new Date(),
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(notificationJobs.id, notificationJobId));
    throw err; // rethrow so BullMQ applies the retry/backoff policy
  }
}

export function startNotificationWorker() {
  const worker = new Worker<NotificationJobData>(
    NOTIFICATION_QUEUE_NAME,
    processNotificationJob,
    {
      connection: redisConnection,
      concurrency: 5,
      settings: {
        // Matches spec section 18: attempt 1 -> wait 30s -> attempt 2 -> wait 2min -> attempt 3.
        backoffStrategy: (attemptsMade: number) =>
          attemptsMade <= 1 ? 30_000 : 120_000,
      },
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const attemptsMax = job.opts.attempts ?? 1;
    if (job.attemptsMade < attemptsMax) return; // will be retried, not dead yet

    const { notificationJobId } = job.data;
    const message = err instanceof Error ? err.message : String(err);

    const [jobRow] = await db
      .select({ taskOccurrenceId: notificationJobs.taskOccurrenceId })
      .from(notificationJobs)
      .where(eq(notificationJobs.id, notificationJobId))
      .limit(1);
    if (!jobRow) return;

    await db
      .update(notificationJobs)
      .set({
        status: "DEAD_LETTER",
        failedAt: new Date(),
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(notificationJobs.id, notificationJobId));

    const [occurrence] = await db
      .select({ userId: taskOccurrences.userId })
      .from(taskOccurrences)
      .where(eq(taskOccurrences.id, jobRow.taskOccurrenceId))
      .limit(1);
    if (!occurrence) return;

    await db.insert(notificationLogs).values({
      userId: occurrence.userId,
      taskOccurrenceId: jobRow.taskOccurrenceId,
      channel: "TELEGRAM",
      status: "FAILED",
      errorMessage: message,
    });
  });

  return worker;
}
