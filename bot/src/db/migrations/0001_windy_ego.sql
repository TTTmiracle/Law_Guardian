ALTER TABLE "users" ALTER COLUMN "telegram_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "web_session_id" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_web_session_id_unique" UNIQUE("web_session_id");