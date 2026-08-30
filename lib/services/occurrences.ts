import { fromZonedTime } from "date-fns-tz";
import { and, eq, gt, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, taskOccurrences, users } from "@/lib/db/schema";
import {
  MISSED_GRACE_PERIOD_MINUTES,
  OCCURRENCE_GENERATION_WINDOW_DAYS,
} from "@/lib/constants";
import { addDaysToDateStr, dayOfWeekForDateStr, todayInTz } from "@/lib/utils/tz";

type TaskRow = typeof tasks.$inferSelect;

/**
 * Materializes task_occurrences for the given tasks over a rolling window of
 * days, starting today in the user's local timezone. Idempotent: relies on
 * the (task_id, scheduled_at) unique index to skip duplicates.
 */
async function generateOccurrences(
  userId: string,
  timezone: string,
  activeTasks: TaskRow[],
  windowDays: number
) {
  if (activeTasks.length === 0) return;

  const today = todayInTz(timezone);
  const rows: (typeof taskOccurrences.$inferInsert)[] = [];

  for (let i = 0; i < windowDays; i++) {
    const dateStr = addDaysToDateStr(today, i);
    const dow = dayOfWeekForDateStr(dateStr);

    for (const task of activeTasks) {
      if (!task.recurrenceRule.daysOfWeek.includes(dow)) continue;
      const scheduledAt = fromZonedTime(
        `${dateStr}T${task.scheduledTime}`,
        timezone
      );
      rows.push({
        taskId: task.id,
        userId,
        scheduledAt,
        status: "PENDING",
      });
    }
  }

  if (rows.length === 0) return;

  await db
    .insert(taskOccurrences)
    .values(rows)
    .onConflictDoNothing({
      target: [taskOccurrences.taskId, taskOccurrences.scheduledAt],
    });
}

export async function generateOccurrencesForUser(
  userId: string,
  windowDays = OCCURRENCE_GENERATION_WINDOW_DAYS
) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return;

  const activeTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.isActive, true)));

  await generateOccurrences(userId, user.timezone, activeTasks, windowDays);
}

/** Regenerates the occurrence window for a single task right after create/update. */
export async function generateOccurrencesForTask(
  userId: string,
  taskId: string,
  windowDays = OCCURRENCE_GENERATION_WINDOW_DAYS
) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return;

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  if (!task || !task.isActive) return;

  await generateOccurrences(userId, user.timezone, [task], windowDays);
}

/**
 * Drops not-yet-happened, still-pending occurrences for a task so a schedule
 * or recurrence change doesn't leave stale future occurrences behind.
 * Past/completed/skipped/cancelled occurrences are left untouched.
 */
export async function resetFutureOccurrencesForTask(
  userId: string,
  taskId: string
) {
  await db
    .delete(taskOccurrences)
    .where(
      and(
        eq(taskOccurrences.taskId, taskId),
        eq(taskOccurrences.userId, userId),
        eq(taskOccurrences.status, "PENDING"),
        gt(taskOccurrences.scheduledAt, new Date())
      )
    );
}

export async function generateOccurrencesForAllUsers(
  windowDays = OCCURRENCE_GENERATION_WINDOW_DAYS
) {
  const allUsers = await db.select().from(users);
  for (const user of allUsers) {
    const activeTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, user.id), eq(tasks.isActive, true)));
    await generateOccurrences(user.id, user.timezone, activeTasks, windowDays);
  }
}

/** Flips PENDING occurrences whose scheduled time + grace period has elapsed to MISSED. */
export async function markMissedOccurrences(userId: string) {
  const cutoff = new Date(Date.now() - MISSED_GRACE_PERIOD_MINUTES * 60_000);
  await db
    .update(taskOccurrences)
    .set({ status: "MISSED", updatedAt: new Date() })
    .where(
      and(
        eq(taskOccurrences.userId, userId),
        eq(taskOccurrences.status, "PENDING"),
        lte(taskOccurrences.scheduledAt, cutoff)
      )
    );
}

export async function markMissedOccurrencesForAllUsers() {
  const cutoff = new Date(Date.now() - MISSED_GRACE_PERIOD_MINUTES * 60_000);
  await db
    .update(taskOccurrences)
    .set({ status: "MISSED", updatedAt: new Date() })
    .where(
      and(
        eq(taskOccurrences.status, "PENDING"),
        lte(taskOccurrences.scheduledAt, cutoff)
      )
    );
}
