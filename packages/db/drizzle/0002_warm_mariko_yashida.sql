CREATE TYPE "public"."message_type" AS ENUM('text', 'voice');--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "content" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "type" "message_type" DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "audio_url" text;