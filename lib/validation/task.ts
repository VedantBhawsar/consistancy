import { z } from "zod";
import { CATEGORIES } from "@/lib/constants";

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const recurrenceTypeSchema = z.enum([
  "DAILY",
  "WEEKDAYS",
  "WEEKENDS",
  "SPECIFIC_DAYS",
  "WEEKLY",
  "CUSTOM",
]);

export const recurrenceInputSchema = z.object({
  type: recurrenceTypeSchema,
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
});

export const notificationPreferencesSchema = z.object({
  channel: z.literal("TELEGRAM"),
  remindBeforeMinutes: z.array(z.number().int().min(0).max(180)).min(1),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.enum([...CATEGORIES]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  scheduledTime: z
    .string()
    .regex(TIME_REGEX, "Use 24-hour HH:mm format, e.g. 08:30"),
  durationMinutes: z.number().int().min(5).max(1440).default(30),
  recurrence: recurrenceInputSchema,
  notificationPreferences: notificationPreferencesSchema.default({
    channel: "TELEGRAM",
    remindBeforeMinutes: [0],
  }),
  isActive: z.boolean().default(true),
});

export const updateTaskSchema = createTaskSchema.partial();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
