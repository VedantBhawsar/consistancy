import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { normalizeRecurrenceRule } from "./recurrence";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation/task";

export async function listTasks(userId: string) {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(asc(tasks.scheduledTime));
}

export async function getTaskById(userId: string, taskId: string) {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  return task ?? null;
}

export async function createTask(userId: string, input: CreateTaskInput) {
  const recurrenceRule = normalizeRecurrenceRule(input.recurrence);

  const [task] = await db
    .insert(tasks)
    .values({
      userId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      priority: input.priority,
      scheduledTime: `${input.scheduledTime}:00`,
      durationMinutes: input.durationMinutes,
      recurrenceRule,
      notificationPreferences: input.notificationPreferences,
      isActive: input.isActive,
    })
    .returning();

  return task;
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput
) {
  const recurrenceRule = input.recurrence
    ? normalizeRecurrenceRule(input.recurrence)
    : undefined;

  const [task] = await db
    .update(tasks)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.scheduledTime !== undefined && {
        scheduledTime: `${input.scheduledTime}:00`,
      }),
      ...(input.durationMinutes !== undefined && {
        durationMinutes: input.durationMinutes,
      }),
      ...(recurrenceRule !== undefined && { recurrenceRule }),
      ...(input.notificationPreferences !== undefined && {
        notificationPreferences: input.notificationPreferences,
      }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning();

  return task ?? null;
}

export async function deleteTask(userId: string, taskId: string) {
  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });
  return deleted ?? null;
}
