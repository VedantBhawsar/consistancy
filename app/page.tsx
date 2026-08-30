import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { AppNav } from "@/components/app-nav";
import { TodayList } from "@/components/today-list";
import {
  generateOccurrencesForUser,
  markMissedOccurrences,
} from "@/lib/services/occurrences";
import { getDailyProgress, getTodayOccurrences } from "@/lib/services/progress";
import { asciiProgressBar, greetingForHour } from "@/lib/utils/format";

export default async function TodayPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [user] = await db
    .select({ name: users.name, timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  await generateOccurrencesForUser(userId);
  await markMissedOccurrences(userId);

  const [{ occurrences }, progress] = await Promise.all([
    getTodayOccurrences(userId),
    getDailyProgress(userId),
  ]);

  const hourNow = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: user?.timezone ?? "UTC",
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );

  return (
    <div className="min-h-full">
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight sm:text-4xl">
          {greetingForHour(hourNow)}, {user?.name?.split(" ")[0] ?? "there"}
        </h1>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span className="font-[family-name:var(--font-mono)] text-sm tracking-tight text-[var(--brass)]">
            {asciiProgressBar(progress.completionRate)}
          </span>
          <span className="text-sm text-[var(--ink-muted)]">
            {progress.completed}/{progress.total} done · {progress.completionRate}%
          </span>
        </div>

        <div className="mt-10">
          <TodayList occurrences={occurrences} timezone={user?.timezone ?? "UTC"} />
        </div>
      </main>
    </div>
  );
}
