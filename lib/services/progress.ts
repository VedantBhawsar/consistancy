import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { taskOccurrences, tasks, users } from "@/lib/db/schema";
import {
  addDaysToDateStr,
  dayRangeInTz,
  todayInTz,
} from "@/lib/utils/tz";

const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

type OccurrenceRow = {
  id: string;
  taskId: string;
  scheduledAt: Date;
  status: string;
  completedAt: Date | null;
  title: string;
  category: string;
  priority: string;
  durationMinutes: number;
};

export async function getTodayOccurrences(
  userId: string
): Promise<{ date: string | null; occurrences: OccurrenceRow[] }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { date: null, occurrences: [] };

  const dateStr = todayInTz(user.timezone);
  const { start, end } = dayRangeInTz(dateStr, user.timezone);

  const rows = await db
    .select({
      id: taskOccurrences.id,
      taskId: taskOccurrences.taskId,
      scheduledAt: taskOccurrences.scheduledAt,
      status: taskOccurrences.status,
      completedAt: taskOccurrences.completedAt,
      title: tasks.title,
      category: tasks.category,
      priority: tasks.priority,
      durationMinutes: tasks.durationMinutes,
    })
    .from(taskOccurrences)
    .innerJoin(tasks, eq(taskOccurrences.taskId, tasks.id))
    .where(
      and(
        eq(taskOccurrences.userId, userId),
        gte(taskOccurrences.scheduledAt, start),
        lt(taskOccurrences.scheduledAt, end)
      )
    )
    .orderBy(taskOccurrences.scheduledAt);

  return { date: dateStr, occurrences: rows };
}

function completionStats(rows: { status: string }[]) {
  const total = rows.length;
  const completed = rows.filter((r) => r.status === "COMPLETED").length;
  const missed = rows.filter((r) => r.status === "MISSED").length;
  const skipped = rows.filter((r) => r.status === "SKIPPED").length;
  const cancelled = rows.filter((r) => r.status === "CANCELLED").length;
  const completionRate =
    total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, missed, skipped, cancelled, completionRate };
}

export async function getDailyProgress(userId: string) {
  const { date, occurrences } = await getTodayOccurrences(userId);
  return { date, ...completionStats(occurrences) };
}

/** Monday of the week containing `dateStr` (dow: 0=Sun..6=Sat). */
function weekStart(dateStr: string, dow: number): string {
  const daysSinceMonday = (dow + 6) % 7;
  return addDaysToDateStr(dateStr, -daysSinceMonday);
}

export async function getWeeklyProgress(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const todayStr = todayInTz(user.timezone);
  const todayDow = new Date(`${todayStr}T12:00:00Z`).getUTCDay();
  const monday = weekStart(todayStr, todayDow);
  const sunday = addDaysToDateStr(monday, 6);

  const { start } = dayRangeInTz(monday, user.timezone);
  const { end } = dayRangeInTz(sunday, user.timezone);

  const weekRows = await db
    .select({
      scheduledAt: taskOccurrences.scheduledAt,
      status: taskOccurrences.status,
      category: tasks.category,
    })
    .from(taskOccurrences)
    .innerJoin(tasks, eq(taskOccurrences.taskId, tasks.id))
    .where(
      and(
        eq(taskOccurrences.userId, userId),
        gte(taskOccurrences.scheduledAt, start),
        lt(taskOccurrences.scheduledAt, end)
      )
    );

  const days = [] as {
    date: string;
    label: string;
    total: number;
    completed: number;
    completionRate: number;
    hasOccurred: boolean;
  }[];

  for (let i = 0; i < 7; i++) {
    const dateStr = addDaysToDateStr(monday, i);
    const dayRows = weekRows.filter(
      (r) => todayInTz(user.timezone, r.scheduledAt) === dateStr
    );
    const stats = completionStats(dayRows);
    days.push({
      date: dateStr,
      label: WEEKDAY_LABELS[i],
      total: stats.total,
      completed: stats.completed,
      completionRate: stats.completionRate,
      hasOccurred: dateStr <= todayStr,
    });
  }

  const occurredDays = days.filter((d) => d.hasOccurred && d.total > 0);
  const weeklyCompletionRate =
    occurredDays.length === 0
      ? 0
      : Math.round(
          occurredDays.reduce((sum, d) => sum + d.completionRate, 0) /
            occurredDays.length
        );

  const categoryMap = new Map<string, { total: number; completed: number }>();
  for (const row of weekRows) {
    const entry = categoryMap.get(row.category) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (row.status === "COMPLETED") entry.completed += 1;
    categoryMap.set(row.category, entry);
  }
  const categoryBreakdown = Array.from(categoryMap.entries()).map(
    ([category, { total, completed }]) => ({
      category,
      total,
      completed,
      completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
    })
  );

  return {
    weekStart: monday,
    weekEnd: sunday,
    days,
    weeklyCompletionRate,
    categoryBreakdown,
  };
}

/** Consecutive-day streaks, based on days where every scheduled task was completed. */
export async function getStreaks(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { currentStreak: 0, longestStreak: 0 };

  const rows = await db
    .select({
      scheduledAt: taskOccurrences.scheduledAt,
      status: taskOccurrences.status,
    })
    .from(taskOccurrences)
    .where(eq(taskOccurrences.userId, userId));

  const todayStr = todayInTz(user.timezone);

  const byDay = new Map<string, { total: number; completed: number }>();
  for (const row of rows) {
    const dateStr = todayInTz(user.timezone, row.scheduledAt);
    if (dateStr > todayStr) continue; // ignore not-yet-happened occurrences
    const entry = byDay.get(dateStr) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (row.status === "COMPLETED") entry.completed += 1;
    byDay.set(dateStr, entry);
  }

  const sortedDays = Array.from(byDay.entries())
    .filter(([, v]) => v.total > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  let longestStreak = 0;
  let runningStreak = 0;
  for (const [, stats] of sortedDays) {
    if (stats.completed === stats.total) {
      runningStreak += 1;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
  }

  let currentStreak = 0;
  for (let i = sortedDays.length - 1; i >= 0; i--) {
    const [, stats] = sortedDays[i];
    if (stats.completed === stats.total) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
}

export async function getAllTimeCounts(userId: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      completed: sql<number>`count(*) filter (where ${taskOccurrences.status} = 'COMPLETED')`.mapWith(
        Number
      ),
      missed: sql<number>`count(*) filter (where ${taskOccurrences.status} = 'MISSED')`.mapWith(
        Number
      ),
      skipped: sql<number>`count(*) filter (where ${taskOccurrences.status} = 'SKIPPED')`.mapWith(
        Number
      ),
    })
    .from(taskOccurrences)
    .where(eq(taskOccurrences.userId, userId));

  return row ?? { total: 0, completed: 0, missed: 0, skipped: 0 };
}
