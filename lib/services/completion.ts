import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { taskOccurrences } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { getTodayOccurrences } from "./progress";

async function resolveOccurrenceId(
  userId: string,
  taskId: string,
  occurrenceId?: string
) {
  if (occurrenceId) return occurrenceId;

  const { occurrences } = await getTodayOccurrences(userId);
  const match = occurrences.find((o) => o.taskId === taskId);
  if (!match) {
    throw new AppError(
      "No occurrence scheduled for today for this task",
      404
    );
  }
  return match.id;
}

async function getOwnedOccurrence(
  userId: string,
  taskId: string,
  occurrenceId: string
) {
  const [occurrence] = await db
    .select()
    .from(taskOccurrences)
    .where(
      and(
        eq(taskOccurrences.id, occurrenceId),
        eq(taskOccurrences.userId, userId),
        eq(taskOccurrences.taskId, taskId)
      )
    )
    .limit(1);
  if (!occurrence) throw new AppError("Occurrence not found", 404);
  return occurrence;
}

export async function completeTaskOccurrence(
  userId: string,
  taskId: string,
  occurrenceId?: string
) {
  const id = await resolveOccurrenceId(userId, taskId, occurrenceId);
  const occurrence = await getOwnedOccurrence(userId, taskId, id);

  if (occurrence.status === "CANCELLED") {
    throw new AppError("Cannot complete a cancelled task");
  }

  const [updated] = await db
    .update(taskOccurrences)
    .set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(taskOccurrences.id, id))
    .returning();

  return updated;
}

export async function skipTaskOccurrence(
  userId: string,
  taskId: string,
  occurrenceId?: string
) {
  const id = await resolveOccurrenceId(userId, taskId, occurrenceId);
  const occurrence = await getOwnedOccurrence(userId, taskId, id);

  if (occurrence.status === "COMPLETED") {
    throw new AppError("Cannot skip a completed task");
  }

  const [updated] = await db
    .update(taskOccurrences)
    .set({ status: "SKIPPED", updatedAt: new Date() })
    .where(eq(taskOccurrences.id, id))
    .returning();

  return updated;
}
