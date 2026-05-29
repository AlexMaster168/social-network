CREATE TYPE "public"."relationship" AS ENUM('single', 'in_relationship', 'engaged', 'married', 'complicated');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "birthday" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "relationship" "relationship";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cover_photo_id" uuid;