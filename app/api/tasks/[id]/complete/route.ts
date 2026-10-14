import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { tasks, users } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { completeTaskOccurrence } from "@/lib/services/completion";
import { getDailyProgress, getStreaks } from "@/lib/services/progress";
import { sendTelegramText } from "@/lib/notifications/telegram-bot";

type Params = { params: Promise<{ id: string }> };

const COMMENDATIONS = [
  "Great job! Consistency is the key to mastery. 🔥",
  "Task crushed! Keep this momentum going. 💪",
  "Done and dusted! Another step closer to your routine goals. ✨",
  "Way to go! You're making progress every single day. 🎯",
  "Awesome work! Routine habit locked in. 🚀",
];

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const occurrenceId =
    typeof body?.occurrenceId === "string" ? body.occurrenceId : undefined;

  try {
    const occurrence = await completeTaskOccurrence(
      session.user.id,
      id,
      occurrenceId
    );

    const progress = await getDailyProgress(session.user.id);
    const streaks = await getStreaks(session.user.id);
    const commendation =
      COMMENDATIONS[Math.floor(Math.random() * COMMENDATIONS.length)];

    // Fetch user details for Telegram notification and task title
    const [user] = await db
      .select({ telegramChatId: users.telegramChatId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const [task] = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    const taskTitle = task?.title || "Routine Task";

    if (user?.telegramChatId) {
      const tgMessage = [
        `🎉 *Task Completed*: ${taskTitle}`,
        `${commendation}`,
        "",
        `Today: ${progress.completed}/${progress.total} completed (${progress.completionRate}%)`,
        `🔥 Current streak: ${streaks.currentStreak} day${streaks.currentStreak === 1 ? "" : "s"}`,
      ].join("\n");

      // Fire and forget telegram feedback message
      sendTelegramText(user.telegramChatId, tgMessage).catch((err) => {
        console.error("Failed to send completion feedback to Telegram", err);
      });
    }

    return NextResponse.json({
      occurrence,
      taskTitle,
      commendation,
      progress,
      streaks,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
