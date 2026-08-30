CREATE TYPE "public"."notification_channel" AS ENUM('TELEGRAM');--> statement-breakpoint
CREATE TYPE "public"."notification_job_status" AS ENUM('CREATED', 'QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'RETRYING', 'DEAD_LETTER');--> statement-breakpoint
CREATE TYPE "public"."notification_log_status" AS ENUM('SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."recurrence_type" AS ENUM('DAILY', 'WEEKDAYS', 'WEEKENDS', 'SPECIFIC_DAYS', 'WEEKLY', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."task_occurrence_status" AS ENUM('PENDING', 'COMPLETED', 'MISSED', 'SKIPPED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "notification_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_occurrence_id" uuid NOT NULL,
	"channel" "notification_channel" DEFAULT 'TELEGRAM' NOT NULL,
	"notification_type" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "notification_job_status" DEFAULT 'CREATED' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_occurrence_id" uuid NOT NULL,
	"channel" "notification_channel" DEFAULT 'TELEGRAM' NOT NULL,
	"provider_message_id" text,
	"status" "notification_log_status" NOT NULL,
	"sent_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "task_occurrence_status" DEFAULT 'PENDING' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"priority" "priority" DEFAULT 'MEDIUM' NOT NULL,
	"scheduled_time" time NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"recurrence_rule" jsonb NOT NULL,
	"notification_preferences" jsonb DEFAULT '{"channel":"TELEGRAM","remindBeforeMinutes":[0]}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"telegram_chat_id" text,
	"notification_preferences" jsonb DEFAULT '{"channel":"TELEGRAM","remindBeforeMinutes":[0]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_task_occurrence_id_task_occurrences_id_fk" FOREIGN KEY ("task_occurrence_id") REFERENCES "public"."task_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_task_occurrence_id_task_occurrences_id_fk" FOREIGN KEY ("task_occurrence_id") REFERENCES "public"."task_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_jobs_occurrence_type_idx" ON "notification_jobs" USING btree ("task_occurrence_id","notification_type");--> statement-breakpoint
CREATE UNIQUE INDEX "task_occurrences_task_id_scheduled_at_idx" ON "task_occurrences" USING btree ("task_id","scheduled_at");