CREATE TYPE "public"."ai_analysis_event_status" AS ENUM('started', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_analysis_run_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_analysis_stage" AS ENUM('input_preparation', 'provider_setup', 'model_evaluation', 'response_validation', 'result_persistence');--> statement-breakpoint
CREATE TABLE "ai_analysis_run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"stage" "ai_analysis_stage" NOT NULL,
	"status" "ai_analysis_event_status" NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_analysis_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"status" "ai_analysis_run_status" DEFAULT 'running' NOT NULL,
	"provider" "ai_provider",
	"model" text,
	"prompt_version" text NOT NULL,
	"assessed" integer DEFAULT 0 NOT NULL,
	"proposed" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "field_assessments" ADD COLUMN "analysis_run_id" uuid;--> statement-breakpoint
ALTER TABLE "text_proposals" ADD COLUMN "analysis_run_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_analysis_run_events" ADD CONSTRAINT "ai_analysis_run_events_run_id_ai_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_runs" ADD CONSTRAINT "ai_analysis_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_runs" ADD CONSTRAINT "ai_analysis_runs_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_analysis_run_events_sequence_idx" ON "ai_analysis_run_events" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE INDEX "ai_analysis_run_events_created_idx" ON "ai_analysis_run_events" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_analysis_runs_project_started_idx" ON "ai_analysis_runs" USING btree ("project_id","started_at");--> statement-breakpoint
CREATE INDEX "ai_analysis_runs_page_started_idx" ON "ai_analysis_runs" USING btree ("page_id","started_at");--> statement-breakpoint
CREATE INDEX "ai_analysis_runs_status_started_idx" ON "ai_analysis_runs" USING btree ("status","started_at");--> statement-breakpoint
ALTER TABLE "field_assessments" ADD CONSTRAINT "field_assessments_analysis_run_id_ai_analysis_runs_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."ai_analysis_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_proposals" ADD CONSTRAINT "text_proposals_analysis_run_id_ai_analysis_runs_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."ai_analysis_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "field_assessments_run_idx" ON "field_assessments" USING btree ("analysis_run_id");--> statement-breakpoint
CREATE INDEX "text_proposals_run_idx" ON "text_proposals" USING btree ("analysis_run_id");