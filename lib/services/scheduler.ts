import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationJobs, taskOccurrences, tasks } from "@/lib/db/schema";
import { notificationQueue } from "@/lib/queue/notification-queue";
import {
  generateOccurrencesForAllUsers,
  markMissedOccurrencesForAllUsers,
} from "./occurrences";

/** How far past a due reminder time we'll still enqueue it (covers scheduler downtime). */
const CATCH_UP_WINDOW_MS = 15 * 60_000;
/** How far ahead we scan for occurrences that might have a reminder due soon. */
const LOOKAHEAD_MS = 60 * 60_000;

/**
 * One scheduler tick: materializes upcoming occurrences, finds any reminder
 * that has come due (scheduledAt - remindBeforeMinutes <= now) and hasn't
 * been queued yet, and enqueues a notification job for it. Idempotency is
 * enforced by the (task_occurrence_id, notification_type) unique index —
 * concurrent/duplicate ticks simply no-op on the insert.
 */
export async function runSchedulerTick() {
  await generateOccurrencesForAllUsers();

  const now = new Date();
  const windowStart = new Date(now.getTime() - CATCH_UP_WINDOW_MS);
  const windowEnd = new Date(now.getTime() + LOOKAHEAD_MS);

  const dueOccurrences = await db
    .select({
      occurrenceId: taskOccurrences.id,
      scheduledAt: taskOccurrences.scheduledAt,
      notificationPreferences: tasks.notificationPreferences,
    })
    .from(taskOccurrences)
    .innerJoin(tasks, eq(taskOccurrences.taskId, tasks.id))
    .where(
      and(
        eq(taskOccurrences.status, "PENDING"),
        gte(taskOccurrences.scheduledAt, windowStart),
        lte(taskOccurrences.scheduledAt, windowEnd)
      )
    );

  let enqueued = 0;

  for (const occurrence of dueOccurrences) {
    for (const minutesBefore of occurrence.notificationPreferences
      .remindBeforeMinutes) {
      const notifyAt = new Date(
        occurrence.scheduledAt.getTime() - minutesBefore * 60_000
      );
      if (notifyAt > now || notifyAt < windowStart) continue;

      const notificationType = `REMINDER_${minutesBefore}`;

      const [job] = await db
        .insert(notificationJobs)
        .values({
          taskOccurrenceId: occurrence.occurrenceId,
          channel: "TELEGRAM",
          notificationType,
          scheduledAt: notifyAt,
          status: "CREATED",
        })
        .onConflictDoNothing({
          target: [
            notificationJobs.taskOccurrenceId,
            notificationJobs.notificationType,
          ],
        })
        .returning({ id: notificationJobs.id });

      if (!job) continue;

      await notificationQueue.add(
        "send-reminder",
        { notificationJobId: job.id },
        { jobId: job.id }
      );
      await db
        .update(notificationJobs)
        .set({ status: "QUEUED", updatedAt: new Date() })
        .where(eq(notificationJobs.id, job.id));

      enqueued += 1;
    }
  }

  await markMissedOccurrencesForAllUsers();

  return { enqueued };
}
