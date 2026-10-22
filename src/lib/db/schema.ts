import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { ProjectSelectors } from "@/lib/projects/selectors";

export const feedFormatEnum = pgEnum("feed_format", ["sitemap", "heureka", "zbozi"]);
export const pageKindEnum = pgEnum("page_kind", ["product", "page", "unknown"]);
export const scrapeStatusEnum = pgEnum("scrape_status", [
	"pending",
	"scraping",
	"scraped",
	"failed",
	"blocked",
	"skipped",
]);
export const fieldExtractionEnum = pgEnum("field_extraction", ["found", "missing", "uncertain"]);
export const proposalStatusEnum = pgEnum("proposal_status", ["pending", "approved", "rejected"]);
export const jobKindEnum = pgEnum("job_kind", ["scrape", "analyze", "generate", "import"]);
export const jobStatusEnum = pgEnum("job_status", [
	"queued",
	"running",
	"done",
	"failed",
	"waiting_quota",
	"cancelled",
]);
export const providerEnum = pgEnum("ai_provider", ["openai", "anthropic", "gemini", "openrouter"]);
export const aiAnalysisRunStatusEnum = pgEnum("ai_analysis_run_status", ["running", "completed", "failed"]);
export const aiAnalysisStageEnum = pgEnum("ai_analysis_stage", [
	"input_preparation",
	"provider_setup",
	"model_evaluation",
	"response_validation",
	"result_persistence",
	"proposal_decision",
]);
export const aiAnalysisEventStatusEnum = pgEnum("ai_analysis_event_status", ["started", "completed", "failed"]);

const timestamps = {
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const projects = pgTable("projects", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	language: text("language").notNull().default("cs"),
	audience: text("audience").notNull().default(""),
	tone: text("tone").notNull().default(""),
	rules: text("rules").notNull().default(""),
	allowedHosts: text("allowed_hosts").array().notNull().default([]),
	qualityThreshold: integer("quality_threshold").notNull().default(70),
	provider: providerEnum("provider"),
	model: text("model"),
	selectors: jsonb("selectors").$type<ProjectSelectors>().notNull().default({}),
	...timestamps,
});

export const appSettings = pgTable("app_settings", {
	key: text("key").primaryKey(),
	value: jsonb("value").$type<Record<string, unknown>>().notNull(),
	...timestamps,
});

export const providerCredentials = pgTable("provider_credentials", {
	provider: providerEnum("provider").primaryKey(),
	ciphertext: text("ciphertext").notNull(),
	...timestamps,
});

export const feedSources = pgTable(
	"feed_sources",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		format: feedFormatEnum("format").notNull(),
		sourceUrl: text("source_url"),
		fileName: text("file_name"),
		report: jsonb("report").$type<Record<string, number>>().notNull().default({}),
		...timestamps,
	},
	(table) => [index("feed_sources_project_idx").on(table.projectId)],
);

export const pages = pgTable(
	"pages",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		url: text("url").notNull(),
		kind: pageKindEnum("kind").notNull().default("unknown"),
		scrapeStatus: scrapeStatusEnum("scrape_status").notNull().default("pending"),
		httpStatus: integer("http_status"),
		finalUrl: text("final_url"),
		errorMessage: text("error_message"),
		scrapedAt: timestamp("scraped_at", { withTimezone: true }),
		analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
		sourceFeedId: uuid("source_feed_id").references(() => feedSources.id, { onDelete: "set null" }),
		...timestamps,
	},
	(table) => [
		uniqueIndex("pages_project_url_idx").on(table.projectId, table.url),
		index("pages_project_status_idx").on(table.projectId, table.scrapeStatus),
	],
);

export const pageFields = pgTable(
	"page_fields",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		pageId: uuid("page_id")
			.notNull()
			.references(() => pages.id, { onDelete: "cascade" }),
		field: text("field").notNull(),
		sourceText: text("source_text").notNull().default(""),
		sourceHash: text("source_hash").notNull().default(""),
		extraction: fieldExtractionEnum("extraction").notNull().default("missing"),
		extractionNote: text("extraction_note"),
		...timestamps,
	},
	(table) => [uniqueIndex("page_fields_page_field_idx").on(table.pageId, table.field)],
);

export const aiAnalysisRuns = pgTable(
	"ai_analysis_runs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		pageId: uuid("page_id")
			.notNull()
			.references(() => pages.id, { onDelete: "cascade" }),
		status: aiAnalysisRunStatusEnum("status").notNull().default("running"),
		provider: providerEnum("provider"),
		model: text("model"),
		promptVersion: text("prompt_version").notNull(),
		assessed: integer("assessed").notNull().default(0),
		proposed: integer("proposed").notNull().default(0),
		errorMessage: text("error_message"),
		startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
		finishedAt: timestamp("finished_at", { withTimezone: true }),
	},
	(table) => [
		index("ai_analysis_runs_project_started_idx").on(table.projectId, table.startedAt),
		index("ai_analysis_runs_page_started_idx").on(table.pageId, table.startedAt),
		index("ai_analysis_runs_status_started_idx").on(table.status, table.startedAt),
	],
);

export const fieldAssessments = pgTable(
	"field_assessments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		pageFieldId: uuid("page_field_id")
			.notNull()
			.references(() => pageFields.id, { onDelete: "cascade" }),
		analysisRunId: uuid("analysis_run_id").references(() => aiAnalysisRuns.id, { onDelete: "set null" }),
		sourceHash: text("source_hash").notNull(),
		score: integer("score").notNull(),
		issues: jsonb("issues").$type<string[]>().notNull().default([]),
		provider: providerEnum("provider").notNull(),
		model: text("model").notNull(),
		promptVersion: text("prompt_version").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("field_assessments_field_idx").on(table.pageFieldId, table.createdAt),
		index("field_assessments_run_idx").on(table.analysisRunId),
	],
);

export const textProposals = pgTable(
	"text_proposals",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		pageFieldId: uuid("page_field_id")
			.notNull()
			.references(() => pageFields.id, { onDelete: "cascade" }),
		analysisRunId: uuid("analysis_run_id").references(() => aiAnalysisRuns.id, { onDelete: "set null" }),
		sourceHash: text("source_hash").notNull(),
		proposedText: text("proposed_text").notNull(),
		editedText: text("edited_text"),
		reason: text("reason").notNull().default(""),
		status: proposalStatusEnum("status").notNull().default("pending"),
		provider: providerEnum("provider").notNull(),
		model: text("model").notNull(),
		promptVersion: text("prompt_version").notNull(),
		decidedAt: timestamp("decided_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("text_proposals_field_idx").on(table.pageFieldId, table.createdAt),
		index("text_proposals_run_idx").on(table.analysisRunId),
	],
);

export const aiAnalysisRunEvents = pgTable(
	"ai_analysis_run_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		runId: uuid("run_id")
			.notNull()
			.references(() => aiAnalysisRuns.id, { onDelete: "cascade" }),
		sequence: integer("sequence").notNull(),
		stage: aiAnalysisStageEnum("stage").notNull(),
		status: aiAnalysisEventStatusEnum("status").notNull(),
		summary: text("summary").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("ai_analysis_run_events_sequence_idx").on(table.runId, table.sequence),
		index("ai_analysis_run_events_created_idx").on(table.runId, table.createdAt),
	],
);

export const processingJobs = pgTable(
	"processing_jobs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		pageId: uuid("page_id").references(() => pages.id, { onDelete: "cascade" }),
		kind: jobKindEnum("kind").notNull(),
		status: jobStatusEnum("status").notNull().default("queued"),
		idempotencyKey: text("idempotency_key").notNull(),
		attempts: integer("attempts").notNull().default(0),
		lastError: text("last_error"),
		retryAfter: timestamp("retry_after", { withTimezone: true }),
		cursor: text("cursor"),
		total: integer("total").notNull().default(0),
		processed: integer("processed").notNull().default(0),
		failed: integer("failed").notNull().default(0),
		finishedAt: timestamp("finished_at", { withTimezone: true }),
		...timestamps,
	},
	(table) => [
		uniqueIndex("processing_jobs_idempotency_idx").on(table.idempotencyKey),
		index("processing_jobs_project_status_idx").on(table.projectId, table.status),
	],
);

export const loginAttempts = pgTable("login_attempts", {
	key: text("key").primaryKey(),
	failures: integer("failures").notNull().default(0),
	lockedUntil: timestamp("locked_until", { withTimezone: true }),
	...timestamps,
});

export const projectsRelations = relations(projects, ({ many }) => ({
	feedSources: many(feedSources),
	pages: many(pages),
	jobs: many(processingJobs),
	analysisRuns: many(aiAnalysisRuns),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
	project: one(projects, { fields: [pages.projectId], references: [projects.id] }),
	fields: many(pageFields),
	analysisRuns: many(aiAnalysisRuns),
}));

export const pageFieldsRelations = relations(pageFields, ({ one, many }) => ({
	page: one(pages, { fields: [pageFields.pageId], references: [pages.id] }),
	assessments: many(fieldAssessments),
	proposals: many(textProposals),
}));

export const aiAnalysisRunsRelations = relations(aiAnalysisRuns, ({ one, many }) => ({
	project: one(projects, { fields: [aiAnalysisRuns.projectId], references: [projects.id] }),
	page: one(pages, { fields: [aiAnalysisRuns.pageId], references: [pages.id] }),
	events: many(aiAnalysisRunEvents),
}));
