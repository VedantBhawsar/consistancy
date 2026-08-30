import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getTodayOccurrences } from "./progress";
import { completeTaskOccurrence, skipTaskOccurrence } from "./completion";

/**
 * Handles the two-way Telegram commands (DONE / SKIP) that map directly onto
 * existing completion logic. Applies to the user's earliest still-PENDING
 * task for today. Other commands (TODAY, NEXT, STATUS, HELP) are read-only
 * reporting and are left for a later phase.
 */
export async function handleInboundCommand(chatId: string, text: string) {
  const command = text.trim().toUpperCase();
  if (command !== "DONE" && command !== "SKIP") return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.telegramChatId, chatId))
    .limit(1);
  if (!user) return null;

  const { occurrences } = await getTodayOccurrences(user.id);
  const next = occurrences.find((o) => o.status === "PENDING");
  if (!next) return null;

  if (command === "DONE") {
    await completeTaskOccurrence(user.id, next.taskId, next.id);
  } else {
    await skipTaskOccurrence(user.id, next.taskId, next.id);
  }

  return { userId: user.id, taskId: next.taskId, occurrenceId: next.id, command };
}
