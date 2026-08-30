import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const priorityEnum = pgEnum("priority", ["LOW", "MEDIUM", "HIGH"]);

export const recurrenceTypeEnum = pgEnum("recurrence_type", [
  "DAILY",
  "WEEKDAYS",
  "WEEKENDS",
  "SPECIFIC_DAYS",
  "WEEKLY",
  "CUSTOM",
]);

export const taskOccurrenceStatusEnum = pgEnum("task_occurrence_status", [
  "PENDING",
  "COMPLETED",
  "MISSED",
  "SKIPPED",
  "CANCELLED",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "TELEGRAM",
]);

export const notificationJobStatusEnum = pgEnum("notification_job_status", [
  "CREATED",
  "QUEUED",
  "PROCESSING",
  "SENT",
  "FAILED",
  "RETRYING",
  "DEAD_LETTER",
]);

export const notificationLogStatusEnum = pgEnum("notification_log_status", [
  "SENT",
  "FAILED",
]);

export type RecurrenceRule = {
  type: (typeof recurrenceTypeEnum.enumValues)[number];
  /** 0 = Sunday .. 6 = Saturday. Source of truth for occurrence generation. */
  daysOfWeek: number[];
};

export type NotificationPreferences = {
  channel: "TELEGRAM";
  /** Minutes before scheduled time to remind. 0 = at scheduled time. */
  remindBeforeMinutes: number[];
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  telegramChatId: text("telegram_chat_id"),
  notificationPreferences: jsonb("notification_preferences")
    .$type<NotificationPreferences>()
    .notNull()
    .default({ channel: "TELEGRAM", remindBeforeMinutes: [0] }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  priority: priorityEnum("priority").notNull().default("MEDIUM"),
  scheduledTime: time("scheduled_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  recurrenceRule: jsonb("recurrence_rule").$type<RecurrenceRule>().notNull(),
  notificationPreferences: jsonb("notification_preferences")
    .$type<NotificationPreferences>()
    .notNull()
    .default({ channel: "TELEGRAM", remindBeforeMinutes: [0] }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const taskOccurrences = pgTable(
  "task_occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: taskOccurrenceStatusEnum("status").notNull().default("PENDING"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("task_occurrences_task_id_scheduled_at_idx").on(
      table.taskId,
      table.scheduledAt
    ),
  ]
);

export const notificationJobs = pgTable(
  "notification_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskOccurrenceId: uuid("task_occurrence_id")
      .notNull()
      .references(() => taskOccurrences.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull().default("TELEGRAM"),
    /** e.g. "REMINDER_0", "REMINDER_10" — minutes-before encoded for idempotency. */
    notificationType: text("notification_type").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: notificationJobStatusEnum("status").notNull().default("CREATED"),
    attempts: integer("attempts").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("notification_jobs_occurrence_type_idx").on(
      table.taskOccurrenceId,
      table.notificationType
    ),
  ]
);

export const notificationLogs = pgTable("notification_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  taskOccurrenceId: uuid("task_occurrence_id")
    .notNull()
    .references(() => taskOccurrences.id, { onDelete: "cascade" }),
  channel: notificationChannelEnum("channel").notNull().default("TELEGRAM"),
  providerMessageId: text("provider_message_id"),
  status: notificationLogStatusEnum("status").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
  taskOccurrences: many(taskOccurrences),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  occurrences: many(taskOccurrences),
}));

export const taskOccurrencesRelations = relations(
  taskOccurrences,
  ({ one, many }) => ({
    task: one(tasks, {
      fields: [taskOccurrences.taskId],
      references: [tasks.id],
    }),
    user: one(users, {
      fields: [taskOccurrences.userId],
      references: [users.id],
    }),
    notificationJobs: many(notificationJobs),
  })
);

export const notificationJobsRelations = relations(
  notificationJobs,
  ({ one }) => ({
    taskOccurrence: one(taskOccurrences, {
      fields: [notificationJobs.taskOccurrenceId],
      references: [taskOccurrences.id],
    }),
  })
);

export const notificationLogsRelations = relations(
  notificationLogs,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationLogs.userId],
      references: [users.id],
    }),
    taskOccurrence: one(taskOccurrences, {
      fields: [notificationLogs.taskOccurrenceId],
      references: [taskOccurrences.id],
    }),
  })
);
