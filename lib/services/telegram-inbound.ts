import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationJobs, tasks, users } from "@/lib/db/schema";
import { notificationQueue } from "@/lib/queue/notification-queue";
import { CATEGORIES } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { asciiProgressBar, categoryLabel, formatTimeInTz } from "@/lib/utils/format";
import { getDailyProgress, getStreaks, getTodayOccurrences } from "./progress";
import {
  completeOccurrenceById,
  completeTaskOccurrence,
  skipOccurrenceById,
  skipTaskOccurrence,
} from "./completion";
import { createTask } from "./tasks";
import { generateOccurrencesForTask } from "./occurrences";
import type { RecurrenceInput } from "./recurrence";

const HELP_TEXT = [
  "Commands (with or without a leading /):",
  "",
  "TODAY — full schedule for today",
  "STATUS — today's progress % and streak",
  "NEXT — your next pending task",
  "DONE — mark your next pending task done",
  "SKIP — skip your next pending task",
  "SNOOZE <minutes> — delay the next reminder (default 10)",
  "TASKS — list your active recurring tasks",
  "NEWTASK <title> | <HH:MM> | <minutes> | <CATEGORY> | <RECURRENCE>",
  "  e.g. NEWTASK Evening Walk | 18:30 | 20 | PERSONAL | DAILY",
  "  RECURRENCE: DAILY, WEEKDAYS, WEEKENDS, DAYS:0,2,4, or WEEKLY:3",
  "HELP — show this message",
  "",
  `Categories: ${CATEGORIES.join(", ")}`,
  "",
  "Reminders also come with Done / Skip / Snooze buttons — tap instead of typing.",
].join("\n");

async function getUserByChatId(chatId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.telegramChatId, chatId))
    .limit(1);
  return user ?? null;
}

function statusMark(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "✓";
    case "SKIPPED":
      return "⏭";
    case "MISSED":
      return "✗";
    case "CANCELLED":
      return "—";
    default:
      return "○";
  }
}

async function formatToday(userId: string, timezone: string): Promise<string> {
  const { occurrences } = await getTodayOccurrences(userId);
  if (occurrences.length === 0) return "No tasks scheduled for today.";

  const lines = occurrences.map(
    (o) => `${formatTimeInTz(o.scheduledAt, timezone)}  ${statusMark(o.status)} ${o.title}`
  );
  return ["Today's Schedule", "", ...lines].join("\n");
}

async function formatStatus(userId: string): Promise<string> {
  const progress = await getDailyProgress(userId);
  const streaks = await getStreaks(userId);
  return [
    `Today: ${progress.completed}/${progress.total} done (${progress.completionRate}%)`,
    asciiProgressBar(progress.completionRate),
    `🔥 Current streak: ${streaks.currentStreak} day${streaks.currentStreak === 1 ? "" : "s"} (longest: ${streaks.longestStreak})`,
  ].join("\n");
}

async function formatNext(userId: string, timezone: string): Promise<string> {
  const { occurrences } = await getTodayOccurrences(userId);
  const next = occurrences.find((o) => o.status === "PENDING");
  if (!next) return "Nothing left today — you're done! 🎉";
  return [
    `⏰ ${next.title}`,
    `Scheduled: ${formatTimeInTz(next.scheduledAt, timezone)}`,
    `Duration: ${next.durationMinutes} minutes`,
    `Category: ${categoryLabel(next.category)}`,
  ].join("\n");
}

async function formatTasks(userId: string): Promise<string> {
  const rows = await db.select().from(tasks).where(eq(tasks.userId, userId));
  const active = rows.filter((t) => t.isActive);
  if (active.length === 0) return "You have no active tasks.";

  const lines = active
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    .map((t) => `${t.scheduledTime.slice(0, 5)}  ${t.title} (${categoryLabel(t.category)})`);
  return ["Active Tasks", "", ...lines].join("\n");
}

async function handleDone(userId: string): Promise<string> {
  const { occurrences } = await getTodayOccurrences(userId);
  const next = occurrences.find((o) => o.status === "PENDING");
  if (!next) return "Nothing pending to mark done right now.";

  await completeTaskOccurrence(userId, next.taskId, next.id);
  const progress = await getDailyProgress(userId);
  return `✅ Marked done: ${next.title}\n${progress.completed}/${progress.total} completed today.`;
}

async function handleSkip(userId: string): Promise<string> {
  const { occurrences } = await getTodayOccurrences(userId);
  const next = occurrences.find((o) => o.status === "PENDING");
  if (!next) return "Nothing pending to skip right now.";

  await skipTaskOccurrence(userId, next.taskId, next.id);
  const progress = await getDailyProgress(userId);
  return `⏭ Skipped: ${next.title}\n${progress.completed}/${progress.total} completed today.`;
}

async function handleSnooze(userId: string, minutesArg: string): Promise<string> {
  const parsed = parseInt(minutesArg, 10);
  const minutes = Number.isFinite(parsed) ? Math.min(180, Math.max(1, parsed)) : 10;

  const { occurrences } = await getTodayOccurrences(userId);
  const next = occurrences.find((o) => o.status === "PENDING");
  if (!next) return "Nothing pending to snooze right now.";

  await snoozeOccurrence(next.id, minutes);
  return `⏰ Snoozed "${next.title}" for ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/** Queues a one-off reminder job `minutes` from now, reusing the normal worker/provider pipeline. */
export async function snoozeOccurrence(occurrenceId: string, minutes: number): Promise<void> {
  const notifyAt = new Date(Date.now() + minutes * 60_000);
  const notificationType = `SNOOZE_${Date.now()}`;

  const [job] = await db
    .insert(notificationJobs)
    .values({
      taskOccurrenceId: occurrenceId,
      channel: "TELEGRAM",
      notificationType,
      scheduledAt: notifyAt,
      status: "CREATED",
    })
    .returning({ id: notificationJobs.id });
  if (!job) return;

  await notificationQueue.add(
    "send-reminder",
    { notificationJobId: job.id },
    { jobId: job.id, delay: minutes * 60_000 }
  );
  await db
    .update(notificationJobs)
    .set({ status: "QUEUED", updatedAt: new Date() })
    .where(eq(notificationJobs.id, job.id));
}

function parseRecurrence(raw: string): RecurrenceInput | null {
  const upper = raw.trim().toUpperCase();
  if (upper === "DAILY" || upper === "WEEKDAYS" || upper === "WEEKENDS") {
    return { type: upper };
  }
  const daysMatch = upper.match(/^DAYS:([0-6](?:,[0-6])*)$/);
  if (daysMatch) {
    return { type: "SPECIFIC_DAYS", daysOfWeek: daysMatch[1].split(",").map(Number) };
  }
  const weeklyMatch = upper.match(/^WEEKLY:([0-6])$/);
  if (weeklyMatch) {
    return { type: "WEEKLY", daysOfWeek: [Number(weeklyMatch[1])] };
  }
  return null;
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

async function handleNewTask(userId: string, rest: string): Promise<string> {
  const usage =
    'Format: NEWTASK <title> | <HH:MM> | <minutes> | <CATEGORY> | <RECURRENCE>\nExample: NEWTASK Evening Walk | 18:30 | 20 | PERSONAL | DAILY\nRECURRENCE: DAILY, WEEKDAYS, WEEKENDS, DAYS:0,2,4, or WEEKLY:3';

  const parts = rest.split("|").map((p) => p.trim());
  if (parts.length !== 5) return usage;
  const [title, time, durationStr, categoryRaw, recurrenceRaw] = parts;

  if (!title) return usage;
  if (!TIME_REGEX.test(time)) return `Invalid time "${time}" — use 24-hour HH:MM, e.g. 18:30.`;

  const durationMinutes = parseInt(durationStr, 10);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 1440) {
    return `Invalid duration "${durationStr}" — use minutes between 5 and 1440.`;
  }

  const category = categoryRaw.toUpperCase();
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return `Unknown category "${categoryRaw}". Use one of: ${CATEGORIES.join(", ")}`;
  }

  const recurrence = parseRecurrence(recurrenceRaw);
  if (!recurrence) {
    return `Unknown recurrence "${recurrenceRaw}". Use DAILY, WEEKDAYS, WEEKENDS, DAYS:0,2,4, or WEEKLY:3.`;
  }

  try {
    const task = await createTask(userId, {
      title,
      description: null,
      category: category as (typeof CATEGORIES)[number],
      priority: "MEDIUM",
      scheduledTime: time,
      durationMinutes,
      recurrence,
      notificationPreferences: { channel: "TELEGRAM", remindBeforeMinutes: [0] },
      isActive: true,
    });
    await generateOccurrencesForTask(userId, task.id);
    return `✅ Created "${title}" at ${time} (${recurrenceRaw.toUpperCase()}).`;
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Couldn't create the task.";
    return `❌ ${message}`;
  }
}

/**
 * Handles inbound Telegram text messages. Always returns a reply string —
 * every message gets feedback, including unrecognized ones — so the poller
 * can send something back rather than going silent.
 */
export async function handleInboundCommand(chatId: string, text: string): Promise<string> {
  const match = text.trim().replace(/\n/g, " ").match(/^\/?(\S+)\s*(.*)$/);
  const command = (match?.[1] ?? "").toUpperCase();
  const rest = match?.[2] ?? "";

  const user = await getUserByChatId(chatId);
  if (!user) {
    return "This Telegram chat isn't linked to a Consistancy account yet. Add this chat ID under Settings on the web dashboard.";
  }

  switch (command) {
    case "DONE":
      return handleDone(user.id);
    case "SKIP":
      return handleSkip(user.id);
    case "TODAY":
      return formatToday(user.id, user.timezone);
    case "STATUS":
      return formatStatus(user.id);
    case "NEXT":
      return formatNext(user.id, user.timezone);
    case "TASKS":
      return formatTasks(user.id);
    case "SNOOZE":
      return handleSnooze(user.id, rest.trim());
    case "NEWTASK":
      return handleNewTask(user.id, rest);
    case "HELP":
    case "START":
      return HELP_TEXT;
    default:
      return `Didn't recognize "${command}". Send HELP to see available commands.`;
  }
}

/** Parses a button press (callback_data like "done:<occurrenceId>") and returns the reply text. */
export async function handleCallbackQuery(chatId: string, data: string): Promise<string> {
  const [action, occurrenceId] = data.split(":");
  if (!occurrenceId) return "Unrecognized button.";

  const user = await getUserByChatId(chatId);
  if (!user) return "This Telegram chat isn't linked to a Consistancy account.";

  try {
    switch (action) {
      case "done": {
        await completeOccurrenceById(user.id, occurrenceId);
        const progress = await getDailyProgress(user.id);
        return `✅ Marked done via button.\n${progress.completed}/${progress.total} completed today.`;
      }
      case "skip": {
        await skipOccurrenceById(user.id, occurrenceId);
        const progress = await getDailyProgress(user.id);
        return `⏭ Skipped via button.\n${progress.completed}/${progress.total} completed today.`;
      }
      case "snooze": {
        await snoozeOccurrence(occurrenceId, 10);
        return "⏰ Snoozed for 10 minutes.";
      }
      default:
        return "Unrecognized button.";
    }
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Something went wrong.";
    return `❌ ${message}`;
  }
}
