import { asciiProgressBar, formatTimeInTz, greetingForHour } from "@/lib/utils/format";
import { getDailyProgress, getStreaks, getTodayOccurrences } from "./progress";

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

export async function buildMorningDigest(
  userId: string,
  name: string,
  timezone: string
): Promise<string | null> {
  const { occurrences } = await getTodayOccurrences(userId);
  if (occurrences.length === 0) return null;

  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }).format(
      new Date()
    )
  );

  const lines = occurrences.map(
    (o) => `${formatTimeInTz(o.scheduledAt, timezone)}  ${statusMark(o.status)} ${o.title}`
  );

  return [`${greetingForHour(hour)}, ${name}`, "", "Today's Schedule", "", ...lines].join("\n");
}

export async function buildEveningDigest(userId: string, name: string): Promise<string | null> {
  const progress = await getDailyProgress(userId);
  if (progress.total === 0) return null;

  const streaks = await getStreaks(userId);

  return [
    `Evening recap, ${name}`,
    "",
    `${progress.completed}/${progress.total} tasks completed (${progress.completionRate}%)`,
    asciiProgressBar(progress.completionRate),
    progress.missed > 0 ? `${progress.missed} missed, ${progress.skipped} skipped.` : "",
    `🔥 Current streak: ${streaks.currentStreak} day${streaks.currentStreak === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join("\n");
}
