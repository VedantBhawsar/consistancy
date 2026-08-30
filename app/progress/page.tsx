import { auth } from "@/auth";
import { AppNav } from "@/components/app-nav";
import { markMissedOccurrences } from "@/lib/services/occurrences";
import {
  getAllTimeCounts,
  getStreaks,
  getWeeklyProgress,
} from "@/lib/services/progress";
import { categoryLabel } from "@/lib/utils/format";

export default async function ProgressPage() {
  const session = await auth();
  const userId = session!.user.id;

  await markMissedOccurrences(userId);

  const [weekly, streaks, allTime] = await Promise.all([
    getWeeklyProgress(userId),
    getStreaks(userId),
    getAllTimeCounts(userId),
  ]);

  return (
    <div className="min-h-full">
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight">
          Progress
        </h1>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Current streak" value={`${streaks.currentStreak}d`} />
          <StatTile label="Longest streak" value={`${streaks.longestStreak}d`} />
          <StatTile label="Completed" value={String(allTime.completed)} />
          <StatTile label="Missed" value={String(allTime.missed)} />
        </div>

        {weekly && (
          <section className="mt-10">
            <h2 className="text-sm font-medium text-[var(--ink-muted)]">
              This week · {weekly.weeklyCompletionRate}% avg
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {weekly.days.map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm">{day.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--rule)]">
                    {day.hasOccurred && day.total > 0 && (
                      <div
                        className="h-full rounded-full bg-[var(--brass)]"
                        style={{ width: `${day.completionRate}%` }}
                      />
                    )}
                  </div>
                  <span className="w-12 shrink-0 text-right font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--ink-muted)]">
                    {day.hasOccurred && day.total > 0 ? `${day.completionRate}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {weekly && weekly.categoryBreakdown.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-medium text-[var(--ink-muted)]">
              By category this week
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {weekly.categoryBreakdown.map((c) => (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm">
                    {categoryLabel(c.category)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--rule)]">
                    <div
                      className="h-full rounded-full bg-[var(--success)]"
                      style={{ width: `${c.completionRate}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-[var(--ink-muted)]">
                    {c.completed}/{c.total}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--rule)] bg-[var(--bg-elevated)] p-4">
      <p className="font-[family-name:var(--font-mono)] text-2xl tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">{label}</p>
    </div>
  );
}
