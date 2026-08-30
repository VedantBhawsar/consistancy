import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  timezone: z.string().trim().min(1).default("UTC"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  timezone: z.string().trim().min(1).optional(),
  telegramChatId: z
    .string()
    .trim()
    .regex(/^-?\d+$/, "Must be numeric — the chat ID from @userinfobot")
    .nullable()
    .optional(),
  notificationPreferences: z
    .object({
      channel: z.literal("TELEGRAM"),
      remindBeforeMinutes: z.array(z.number().int().min(0).max(1440)).min(1),
    })
    .optional(),
});
