import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { markMissedOccurrences } from "@/lib/services/occurrences";
import {
  getAllTimeCounts,
  getDailyProgress,
  getStreaks,
  getWeeklyProgress,
} from "@/lib/services/progress";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  await markMissedOccurrences(userId);

  const [daily, weekly, streaks, allTime] = await Promise.all([
    getDailyProgress(userId),
    getWeeklyProgress(userId),
    getStreaks(userId),
    getAllTimeCounts(userId),
  ]);

  return NextResponse.json({ daily, weekly, streaks, allTime });
}
