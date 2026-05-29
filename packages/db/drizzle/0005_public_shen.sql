CREATE TYPE "public"."channel_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
ALTER TABLE "channel_subscriptions" ADD COLUMN "role" "channel_role" DEFAULT 'member' NOT NULL;