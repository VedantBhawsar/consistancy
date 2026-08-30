ALTER TABLE "users" ADD COLUMN "digests_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "morning_digest_time" text DEFAULT '08:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "evening_digest_time" text DEFAULT '21:30' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_morning_digest_date" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_evening_digest_date" text;