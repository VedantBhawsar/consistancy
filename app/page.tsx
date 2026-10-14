import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { AppNav } from "@/components/app-nav";
import { TodayList } from "@/components/today-list";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  generateOccurrencesForUser,
  markMissedOccurrences,
} from "@/lib/services/occurrences";
import { getDailyProgress, getTodayOccurrences } from "@/lib/services/progress";
import { greetingForHour } from "@/lib/utils/format";

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
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {greetingForHour(hourNow)}, {user?.name?.split(" ")[0] ?? "there"}
        </h1>

        <Card className="mt-6 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Today&apos;s Progress</span>
            <span className="text-xs text-muted-foreground">
              {progress.completed}/{progress.total} completed ({progress.completionRate}%)
            </span>
          </div>
          <Progress value={progress.completionRate} className="mt-3 h-2" />
        </Card>

        <div className="mt-10">
          <TodayList occurrences={occurrences} timezone={user?.timezone ?? "UTC"} />
        </div>
      </main>
    </div>
  );
}
