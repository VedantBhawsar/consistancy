import { auth } from "@/auth";
import { AppNav } from "@/components/app-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Progress
        </h1>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Current streak" value={`${streaks.currentStreak}d`} />
          <StatTile label="Longest streak" value={`${streaks.longestStreak}d`} />
          <StatTile label="Completed" value={String(allTime.completed)} />
          <StatTile label="Missed" value={String(allTime.missed)} />
        </div>

        {weekly && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Weekly Overview
              </CardTitle>
              <CardDescription>
                This week &middot; {weekly.weeklyCompletionRate}% completion average
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {weekly.days.map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm font-medium text-foreground">
                    {day.label}
                  </span>
                  <div className="flex-1">
                    <Progress
                      value={day.hasOccurred && day.total > 0 ? day.completionRate : 0}
                      className="h-2"
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {day.hasOccurred && day.total > 0 ? `${day.completionRate}%` : "—"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {weekly && weekly.categoryBreakdown.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                By Category This Week
              </CardTitle>
              <CardDescription>
                Breakdown of task completions across categories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {weekly.categoryBreakdown.map((c) => (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm font-medium text-foreground">
                    {categoryLabel(c.category)}
                  </span>
                  <div className="flex-1">
                    <Progress value={c.completionRate} className="h-2" />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground">
                    {c.completed}/{c.total}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="font-mono text-2xl font-bold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
