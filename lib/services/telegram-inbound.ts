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
import type { InlineKeyboard, ReplyKeyboard } from "@/lib/notifications/telegram-bot";

export type InboundResponse = {
  text: string;
  inlineKeyboard?: InlineKeyboard;
  replyKeyboard?: ReplyKeyboard;
};

export const DEFAULT_REPLY_KEYBOARD: ReplyKeyboard = [
  [{ text: "✅ Done" }, { text: "❌ Reject" }],
  [{ text: "📋 Today" }, { text: "⏰ Next" }, { text: "🔥 Status" }],
];

const HELP_TEXT = [
  "Commands (with or without a leading /):",
  "",
  "DONE — mark your current task done (or tap ✅ Done)",
  "REJECT / SKIP — reject or skip your current task (or tap ❌ Reject)",
  "NEXT — your next pending task with Done/Reject options",
  "TODAY — full schedule for today",
  "STATUS — today's progress % and streak",
  "SNOOZE <minutes> — delay the next reminder (default 10)",
  "TASKS — list your active recurring tasks",
  "NEWTASK <title> | <HH:MM> | <minutes> | <CATEGORY> | <RECURRENCE>",
  "  e.g. NEWTASK Evening Walk | 18:30 | 20 | PERSONAL | DAILY",
  "  RECURRENCE: DAILY, WEEKDAYS, WEEKENDS, DAYS:0,2,4, or WEEKLY:3",
  "HELP — show this message",
  "",
  `Categories: ${CATEGORIES.join(", ")}`,
  "",
  "You can also tap the interactive buttons below instead of typing.",
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
      return "✗";
    case "MISSED":
      return "✗";
    case "CANCELLED":
      return "—";
    default:
      return "○";
  }
}

function buildTaskInlineButtons(occurrenceId: string): InlineKeyboard {
  return [
    [
      { text: "✅ Done", callback_data: `done:${occurrenceId}` },
      { text: "❌ Reject", callback_data: `reject:${occurrenceId}` },
      { text: "⏰ Snooze 10m", callback_data: `snooze:${occurrenceId}` },
    ],
  ];
}

async function formatToday(userId: string, timezone: string): Promise<InboundResponse> {
  const { occurrences } = await getTodayOccurrences(userId);
  if (occurrences.length === 0) {
    return {
      text: "No tasks scheduled for today. Build your routine on the web dashboard to see them here.",
      replyKeyboard: DEFAULT_REPLY_KEYBOARD,
    };
  }

  const lines = occurrences.map(
    (o) => `${formatTimeInTz(o.scheduledAt, timezone)}  ${statusMark(o.status)} ${o.title}`
  );

  const nextPending = occurrences.find((o) => o.status === "PENDING");
  let inlineKeyboard: InlineKeyboard | undefined;

  if (nextPending) {
    inlineKeyboard = buildTaskInlineButtons(nextPending.id);
  }

  return {
    text: ["Today's Schedule", "", ...lines].join("\n"),
    inlineKeyboard,
    replyKeyboard: DEFAULT_REPLY_KEYBOARD,
  };
}

async function formatStatus(userId: string): Promise<InboundResponse> {
  const progress = await getDailyProgress(userId);
  const streaks = await getStreaks(userId);
  const { occurrences } = await getTodayOccurrences(userId);
  const nextPending = occurrences.find((o) => o.status === "PENDING");

  const text = [
    `Today: ${progress.completed}/${progress.total} done (${progress.completionRate}%)`,
    asciiProgressBar(progress.completionRate),
    `🔥 Current streak: ${streaks.currentStreak} day${streaks.currentStreak === 1 ? "" : "s"} (longest: ${streaks.longestStreak})`,
  ].join("\n");

  return {
    text,
    inlineKeyboard: nextPending ? buildTaskInlineButtons(nextPending.id) : undefined,
    replyKeyboard: DEFAULT_REPLY_KEYBOARD,
  };
}

async function formatNext(userId: string, timezone: string): Promise<InboundResponse> {
  const { occurrences } = await getTodayOccurrences(userId);
  const next = occurrences.find((o) => o.status === "PENDING");
  if (!next) {
    return {
      text: "Nothing left pending today — you're all done! 🎉",
      replyKeyboard: DEFAULT_REPLY_KEYBOARD,
    };
  }

  return {
    text: [
      `⏰ ${next.title}`,
      `Scheduled: ${formatTimeInTz(next.scheduledAt, timezone)}`,
      `Duration: ${next.durationMinutes} minutes`,
      `Category: ${categoryLabel(next.category)}`,
      "",
      "Choose an option below:",
    ].join("\n"),
    inlineKeyboard: buildTaskInlineButtons(next.id),
    replyKeyboard: DEFAULT_REPLY_KEYBOARD,
  };
}

async function formatTasks(userId: string): Promise<InboundResponse> {
  const rows = await db.select().from(tasks).where(eq(tasks.userId, userId));
  const active = rows.filter((t) => t.isActive);
  if (active.length === 0) {
    return {
      text: "You have no active tasks in your routine.",
      replyKeyboard: DEFAULT_REPLY_KEYBOARD,
    };
  }

  const lines = active
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    .map((t) => `${t.scheduledTime.slice(0, 5)}  ${t.title} (${categoryLabel(t.category)})`);

  return {
    text: ["Active Tasks", "", ...lines].join("\n"),
    replyKeyboard: DEFAULT_REPLY_KEYBOARD,
  };
}

async function handleDone(userId: string): Promise<InboundResponse> {
  const { occurrences } = await getTodayOccurrences(userId);
  // Find pending first, or missed (if user completed it late)
  const target = occurrences.find((o) => o.status === "PENDING") || occurrences.find((o) => o.status === "MISSED");
  if (!target) {
    return {
      text: "Nothing pending to mark done right now.",
      replyKeyboard: DEFAULT_REPLY_KEYBOARD,
    };
  }

  await completeTaskOccurrence(userId, target.taskId, target.id);
  const progress = await getDailyProgress(userId);
  const streaks = await getStreaks(userId);

  const commendations = [
    "Consistency is the key to mastery! 🔥",
    "Keep this incredible momentum going! 💪",
    "Another step closer to your routine goals! ✨",
    "Making progress every single day! 🎯",
    "Habit locked in! 🚀",
  ];
  const commendation = commendations[Math.floor(Math.random() * commendations.length)];

  // Look for remaining pending occurrences
  const remainingOccurrences = (await getTodayOccurrences(userId)).occurrences;
  const nextPending = remainingOccurrences.find((o) => o.status === "PENDING");

  const lines = [
    `✅ Marked done: ${target.title}`,
    `${commendation}`,
    "",
    `Today: ${progress.completed}/${progress.total} completed (${progress.completionRate}%)`,
    asciiProgressBar(progress.completionRate),
    `🔥 Current streak: ${streaks.currentStreak} day${streaks.currentStreak === 1 ? "" : "s"}`,
  ];

  let inlineKeyboard: InlineKeyboard | undefined;
  if (nextPending) {
    lines.push("");
    lines.push(`Next up: ⏰ ${nextPending.title} (${nextPending.durationMinutes} min)`);
    inlineKeyboard = buildTaskInlineButtons(nextPending.id);
  }

  return {
    text: lines.join("\n"),
    inlineKeyboard,
    replyKeyboard: DEFAULT_REPLY_KEYBOARD,
  };
}

async function handleReject(userId: string): Promise<InboundResponse> {
  const { occurrences } = await getTodayOccurrences(userId);
  const target = occurrences.find((o) => o.status === "PENDING") || occurrences.find((o) => o.status === "MISSED");
  if (!target) {
    return {
      text: "Nothing pending to reject or skip right now.",
      replyKeyboard: DEFAULT_REPLY_KEYBOARD,
    };
  }

  await skipTaskOccurrence(userId, target.taskId, target.id);
  const progress = await getDailyProgress(userId);

  const remainingOccurrences = (await getTodayOccurrences(userId)).occurrences;
  const nextPending = remainingOccurrences.find((o) => o.status === "PENDING");

  const lines = [
    `❌ Rejected / Skipped: ${target.title}`,
    `${progress.completed}/${progress.total} completed today.`,
  ];

  let inlineKeyboard: InlineKeyboard | undefined;
  if (nextPending) {
    lines.push("");
    lines.push(`Next up: ⏰ ${nextPending.title} (${nextPending.durationMinutes} min)`);
    inlineKeyboard = buildTaskInlineButtons(nextPending.id);
  }

  return {
    text: lines.join("\n"),
    inlineKeyboard,
    replyKeyboard: DEFAULT_REPLY_KEYBOARD,
  };
}

async function handleSnooze(userId: string, minutesArg: string): Promise<InboundResponse> {
  const parsed = parseInt(minutesArg, 10);
  const minutes = Number.isFinite(parsed) ? Math.min(180, Math.max(1, parsed)) : 10;

  const { occurrences } = await getTodayOccurrences(userId);
  const next = occurrences.find((o) => o.status === "PENDING");
  if (!next) {
    return {
      text: "Nothing pending to snooze right now.",
      replyKeyboard: DEFAULT_REPLY_KEYBOARD,
    };
  }

  await snoozeOccurrence(next.id, minutes);
  return {
    text: `⏰ Snoozed "${next.title}" for ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    inlineKeyboard: buildTaskInlineButtons(next.id),
    replyKeyboard: DEFAULT_REPLY_KEYBOARD,
  };
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

async function handleNewTask(userId: string, rest: string): Promise<InboundResponse> {
  const usage =
    'Format: NEWTASK <title> | <HH:MM> | <minutes> | <CATEGORY> | <RECURRENCE>\nExample: NEWTASK Evening Walk | 18:30 | 20 | PERSONAL | DAILY\nRECURRENCE: DAILY, WEEKDAYS, WEEKENDS, DAYS:0,2,4, or WEEKLY:3';

  const parts = rest.split("|").map((p) => p.trim());
  if (parts.length !== 5) return { text: usage, replyKeyboard: DEFAULT_REPLY_KEYBOARD };
  const [title, time, durationStr, categoryRaw, recurrenceRaw] = parts;

  if (!title) return { text: usage, replyKeyboard: DEFAULT_REPLY_KEYBOARD };
  if (!TIME_REGEX.test(time)) {
    return { text: `Invalid time "${time}" — use 24-hour HH:MM, e.g. 18:30.`, replyKeyboard: DEFAULT_REPLY_KEYBOARD };
  }

  const durationMinutes = parseInt(durationStr, 10);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 1440) {
    return { text: `Invalid duration "${durationStr}" — use minutes between 5 and 1440.`, replyKeyboard: DEFAULT_REPLY_KEYBOARD };
  }

  const category = categoryRaw.toUpperCase();
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return { text: `Unknown category "${categoryRaw}". Use one of: ${CATEGORIES.join(", ")}`, replyKeyboard: DEFAULT_REPLY_KEYBOARD };
  }

  const recurrence = parseRecurrence(recurrenceRaw);
  if (!recurrence) {
    return { text: `Unknown recurrence "${recurrenceRaw}". Use DAILY, WEEKDAYS, WEEKENDS, DAYS:0,2,4, or WEEKLY:3.`, replyKeyboard: DEFAULT_REPLY_KEYBOARD };
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
    return { text: `✅ Created "${title}" at ${time} (${recurrenceRaw.toUpperCase()}).`, replyKeyboard: DEFAULT_REPLY_KEYBOARD };
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Couldn't create the task.";
    return { text: `❌ ${message}`, replyKeyboard: DEFAULT_REPLY_KEYBOARD };
  }
}

/** Parses user command or natural response intent (e.g. "done", "reject", "skip", "✅ Done") */
function parseIntent(text: string): { command: string; rest: string } {
  const cleaned = text.trim();
  // Strip common emojis like ✅, ❌, ⏰, 📋, etc.
  const withoutEmoji = cleaned
    .replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, "")
    .trim();

  const match = withoutEmoji.replace(/\n/g, " ").match(/^\/?(\S+)\s*(.*)$/);
  const rawFirstWord = (match?.[1] ?? "").toUpperCase().replace(/[!.,?]/g, "");
  const rest = match?.[2] ?? "";

  if (
    ["DONE", "COMPLETE", "COMPLETED", "YES", "FINISH", "FINISHED"].includes(rawFirstWord) ||
    /^(i'?m\s+done|task\s+done|done\s+with|marked?\s+done)/i.test(withoutEmoji)
  ) {
    return { command: "DONE", rest };
  }

  if (
    ["REJECT", "REJECTED", "SKIP", "SKIPPED", "NO", "PASS", "CANCEL"].includes(rawFirstWord) ||
    /^(reject\s+task|skip\s+task|not\s+done|can'?t\s+do)/i.test(withoutEmoji)
  ) {
    return { command: "REJECT", rest };
  }

  if (["TODAY", "SCHEDULE"].includes(rawFirstWord)) {
    return { command: "TODAY", rest };
  }

  if (["NEXT", "UPCOMING"].includes(rawFirstWord)) {
    return { command: "NEXT", rest };
  }

  if (["STATUS", "PROGRESS", "STREAK"].includes(rawFirstWord)) {
    return { command: "STATUS", rest };
  }

  return { command: rawFirstWord, rest };
}

/**
 * Handles inbound Telegram text messages. Always returns an InboundResponse with
 * reply text and interactive buttons.
 */
export async function handleInboundCommand(chatId: string, text: string): Promise<InboundResponse> {
  const user = await getUserByChatId(chatId);
  if (!user) {
    return {
      text: "This Telegram chat isn't linked to a Consistancy account yet. Add this chat ID under Settings on your web dashboard to link it.",
    };
  }

  const { command, rest } = parseIntent(text);

  switch (command) {
    case "DONE":
      return handleDone(user.id);
    case "REJECT":
    case "SKIP":
      return handleReject(user.id);
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
      return { text: HELP_TEXT, replyKeyboard: DEFAULT_REPLY_KEYBOARD };
    default:
      return {
        text: `Didn't recognize "${command}". You can use the buttons below or reply DONE / REJECT:`,
        replyKeyboard: DEFAULT_REPLY_KEYBOARD,
      };
  }
}

/** Parses a button press (callback_data like "done:<occurrenceId>") and returns the reply and next buttons. */
export async function handleCallbackQuery(chatId: string, data: string): Promise<InboundResponse> {
  const [action, occurrenceId] = data.split(":");
  if (!occurrenceId) {
    return { text: "Unrecognized button.", replyKeyboard: DEFAULT_REPLY_KEYBOARD };
  }

  const user = await getUserByChatId(chatId);
  if (!user) {
    return { text: "This Telegram chat isn't linked to a Consistancy account." };
  }

  try {
    switch (action) {
      case "done": {
        await completeOccurrenceById(user.id, occurrenceId);
        const progress = await getDailyProgress(user.id);
        const streaks = await getStreaks(user.id);

        const commendations = [
          "Great job! Consistency is the key to mastery. 🔥",
          "Task crushed! Keep this momentum going. 💪",
          "Way to go! Making progress every single day. 🎯",
          "Awesome work! Routine on track. 🚀",
        ];
        const commendation = commendations[Math.floor(Math.random() * commendations.length)];

        const { occurrences } = await getTodayOccurrences(user.id);
        const nextPending = occurrences.find((o) => o.status === "PENDING");

        const lines = [
          `✅ Marked done!`,
          `${commendation}`,
          "",
          `Today: ${progress.completed}/${progress.total} completed (${progress.completionRate}%)`,
          `🔥 Current streak: ${streaks.currentStreak} day${streaks.currentStreak === 1 ? "" : "s"}`,
        ];

        let inlineKeyboard: InlineKeyboard | undefined;
        if (nextPending) {
          lines.push("");
          lines.push(`Next up: ⏰ ${nextPending.title} (${nextPending.durationMinutes} min)`);
          inlineKeyboard = buildTaskInlineButtons(nextPending.id);
        }

        return {
          text: lines.join("\n"),
          inlineKeyboard,
          replyKeyboard: DEFAULT_REPLY_KEYBOARD,
        };
      }
      case "reject":
      case "skip": {
        await skipOccurrenceById(user.id, occurrenceId);
        const progress = await getDailyProgress(user.id);

        const { occurrences } = await getTodayOccurrences(user.id);
        const nextPending = occurrences.find((o) => o.status === "PENDING");

        const lines = [
          `❌ Rejected / Skipped.`,
          `${progress.completed}/${progress.total} completed today.`,
        ];

        let inlineKeyboard: InlineKeyboard | undefined;
        if (nextPending) {
          lines.push("");
          lines.push(`Next up: ⏰ ${nextPending.title} (${nextPending.durationMinutes} min)`);
          inlineKeyboard = buildTaskInlineButtons(nextPending.id);
        }

        return {
          text: lines.join("\n"),
          inlineKeyboard,
          replyKeyboard: DEFAULT_REPLY_KEYBOARD,
        };
      }
      case "snooze": {
        await snoozeOccurrence(occurrenceId, 10);
        return {
          text: "⏰ Snoozed for 10 minutes.",
          inlineKeyboard: buildTaskInlineButtons(occurrenceId),
          replyKeyboard: DEFAULT_REPLY_KEYBOARD,
        };
      }
      default:
        return { text: "Unrecognized button.", replyKeyboard: DEFAULT_REPLY_KEYBOARD };
    }
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Something went wrong.";
    return { text: `❌ ${message}`, replyKeyboard: DEFAULT_REPLY_KEYBOARD };
  }
}
