CREATE TYPE "public"."feed_format" AS ENUM('sitemap', 'heureka', 'zbozi');--> statement-breakpoint
CREATE TYPE "public"."field_extraction" AS ENUM('found', 'missing', 'uncertain');--> statement-breakpoint
CREATE TYPE "public"."job_kind" AS ENUM('scrape', 'analyze', 'generate', 'import');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'done', 'failed', 'waiting_quota', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."page_kind" AS ENUM('product', 'page', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('openai', 'anthropic', 'gemini', 'openrouter');--> statement-breakpoint
CREATE TYPE "public"."scrape_status" AS ENUM('pending', 'scraping', 'scraped', 'failed', 'blocked', 'skipped');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"format" "feed_format" NOT NULL,
	"source_url" text,
	"file_name" text,
	"report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_field_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"score" integer NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"field" text NOT NULL,
	"source_text" text DEFAULT '' NOT NULL,
	"source_hash" text DEFAULT '' NOT NULL,
	"extraction" "field_extraction" DEFAULT 'missing' NOT NULL,
	"extraction_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"url" text NOT NULL,
	"kind" "page_kind" DEFAULT 'unknown' NOT NULL,
	"scrape_status" "scrape_status" DEFAULT 'pending' NOT NULL,
	"http_status" integer,
	"final_url" text,
	"error_message" text,
	"scraped_at" timestamp with time zone,
	"source_feed_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"page_id" uuid,
	"kind" "job_kind" NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"idempotency_key" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"retry_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"language" text DEFAULT 'cs' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"tone" text DEFAULT '' NOT NULL,
	"rules" text DEFAULT '' NOT NULL,
	"allowed_hosts" text[] DEFAULT '{}' NOT NULL,
	"quality_threshold" integer DEFAULT 70 NOT NULL,
	"provider" "ai_provider",
	"model" text,
	"selectors" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_credentials" (
	"provider" "ai_provider" PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "text_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_field_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"proposed_text" text NOT NULL,
	"edited_text" text,
	"reason" text DEFAULT '' NOT NULL,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feed_sources" ADD CONSTRAINT "feed_sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_assessments" ADD CONSTRAINT "field_assessments_page_field_id_page_fields_id_fk" FOREIGN KEY ("page_field_id") REFERENCES "public"."page_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_fields" ADD CONSTRAINT "page_fields_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_source_feed_id_feed_sources_id_fk" FOREIGN KEY ("source_feed_id") REFERENCES "public"."feed_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_proposals" ADD CONSTRAINT "text_proposals_page_field_id_page_fields_id_fk" FOREIGN KEY ("page_field_id") REFERENCES "public"."page_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_sources_project_idx" ON "feed_sources" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "field_assessments_field_idx" ON "field_assessments" USING btree ("page_field_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "page_fields_page_field_idx" ON "page_fields" USING btree ("page_id","field");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_project_url_idx" ON "pages" USING btree ("project_id","url");--> statement-breakpoint
CREATE INDEX "pages_project_status_idx" ON "pages" USING btree ("project_id","scrape_status");--> statement-breakpoint
CREATE UNIQUE INDEX "processing_jobs_idempotency_idx" ON "processing_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "processing_jobs_project_status_idx" ON "processing_jobs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "text_proposals_field_idx" ON "text_proposals" USING btree ("page_field_id","created_at");