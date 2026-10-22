ALTER TABLE "pages" ADD COLUMN "analyzed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD COLUMN "cursor" text;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD COLUMN "total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD COLUMN "processed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD COLUMN "failed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD COLUMN "finished_at" timestamp with time zone;