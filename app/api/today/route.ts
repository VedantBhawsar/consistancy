import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  generateOccurrencesForUser,
  markMissedOccurrences,
} from "@/lib/services/occurrences";
import { getDailyProgress, getTodayOccurrences } from "@/lib/services/progress";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  await generateOccurrencesForUser(userId);
  await markMissedOccurrences(userId);

  const { date, occurrences } = await getTodayOccurrences(userId);
  const progress = await getDailyProgress(userId);

  return NextResponse.json({ date, occurrences, progress });
}
