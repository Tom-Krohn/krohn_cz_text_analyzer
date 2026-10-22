# Krohn Labs Text Analyzer

Private admin app for importing URLs from XML feeds and sitemaps, scraping public pages, and
running AI analyses with text suggestions.

## Technology

- Next.js 16 (App Router), React, TypeScript, and Tailwind CSS
- Neon PostgreSQL through Drizzle ORM and `@neondatabase/serverless`
- Auth.js Credentials for a single administrator account
- Vite+ (`vp`) for formatting and tests; `pnpm` for package scripts
- Vercel hosting and Inngest background jobs (production integration is not yet complete)

## Local setup

1. Install dependencies: `pnpm install`.
2. Copy `.env.example` to `.env.local` and fill in the values. Generate
   `ADMIN_PASSWORD_HASH` with `pnpm hash-password`. Its format is
   `scrypt:N:r:p:salt:hash`; it contains no `$` character, so it does not need quotes.
3. Apply database migrations: `pnpm db:migrate`. This uses `DATABASE_URL_UNPOOLED`, falling back
   to `DATABASE_URL`.
4. Start the development server: `pnpm dev` (runs `next dev` with Turbopack). Do not use `vp dev`:
   that starts Vite's built-in server, which is not used by this app.

## Development database (Neon DEV)

The project uses Neon only. Local PostgreSQL and the WebSocket bridge are no longer part of the
project.

1. Create a Neon development branch or a separate project, then set `DATABASE_URL` (pooled) and
   `DATABASE_URL_UNPOOLED` (direct connection for migrations) in `.env.local`.
2. Apply migrations: `pnpm db:migrate`.
3. Start the development server with `pnpm dev` (port 3000). If the port is occupied, run
   `pnpm exec next dev -p 3100` and update the `jobs:dev` script to use that port.
4. Start the job queue with `pnpm jobs:dev` (Inngest dev server on port 8288, with its UI at
   `http://localhost:8288`). Set `INNGEST_DEV=1` in `.env.local`, and do not set empty
   `INNGEST_*_KEY` variables.

## First run

The **Projects** page has a non-blocking checklist for creating a project, importing URLs, loading
page content, and running AI analysis. Its progress is based on saved data. You can hide the
checklist and reopen it later.

## Extraction selectors

In the left navigation, open **Imports & Jobs** and select a project. This page lets you import a
feed from a URL or file and configure the main content root, short and long description selectors,
and elements to exclude. Enter exclusion selectors one per line; they apply only inside the
selected root. Short and long descriptions are also searched for only within that root.

You can test a preview against one of the currently displayed URLs; use the list filter to find
other pages first. The preview uses the same allowed-domain check as scraping. If no root is
configured and no semantic `<main>`, `<article>`, or `[role=main]` element is found, the page body
is marked as uncertain and will not be automatically analyzed as a substitute for the full
content.

Changing selectors marks previously loaded URLs for scraping again and invalidates their analysis
status. Saving does not fetch any pages; run **Scrape all pending** and then rerun AI analysis if
needed. Selectors cannot be changed while a bulk job is running or a page is being loaded.

## Bulk processing

On a project page, **Scrape all pending** and **Analyze all loaded** enqueue jobs in Inngest. Jobs
process URLs in batches (scraping in batches of 10, AI analysis one URL at a time). Project details
show only active jobs and refresh their progress automatically. See **Imports & Jobs** for all job
statuses and history across projects, grouped by project.

- After the first URL finishes, a running job shows an approximate remaining time based on its
  progress so far.
- Scraping is limited to 6 batches per minute per project (about 60 URLs per minute) to avoid
  overloading the target site.
- AI analysis is limited to 8 requests per minute, matching the free Gemini tier limits. The job
  stops with an error message for HTTP status codes 401, 402, 403, or 429.
- Jobs continue running after you close the browser, as long as the Inngest dev server is running.

## AI audit

The **AI audit** navigation shows the history of individual runs across projects. A page's detail
view includes a timeline of input preparation, provider and model selection, scoring, response
validation, saving results, and decisions about suggestions. Records store the timestamp, status,
model, prompt version, number of results, and any error. Full prompts and hidden internal
chain-of-thought are not stored. The workflow represents one actual model call, not several
separate agents.

## Languages and appearance

You can change the interface language and light or dark theme in the administrator account
settings. Preferences are stored in the existing `app_settings` table for the account and loaded
on the server, so they apply across devices. The root layout is rendered per request to prevent
personal preferences from leaking into shared static HTML.

Interface strings live in `src/lib/i18n/messages/cs.ts` and
`src/lib/i18n/messages/en.ts`. A shared type derived from the Czech catalog checks their structure.
To add a language, add its catalog, register it in `src/lib/i18n/messages/index.ts`, and add its
code and label in `src/lib/i18n/types.ts`. Scraped page text and AI-generated content are
intentionally not translated.

## Deleting projects

A project can be permanently deleted from its detail page. Clicking **Delete project** always
requires confirmation. Deletion also removes its feeds, URLs, jobs, and analysis data, and cannot
be undone. Deletion is rejected while a bulk job is running or pending, or while a page is loading.

## Checks

- `pnpm check` runs formatting checks, linting, type-checking, and tests.
- `pnpm test` runs the test suite through `vp test`.

## First-release limitations

- A project can contain at most 10,000 unique URLs. Excess URLs are skipped and listed in the
  import report.
- File uploads are limited to 4 MB; larger feeds must be fetched from a URL.
- Scraping handles public HTML pages only; it does not use a headless browser or bypass
  authentication or access restrictions.
- Domains are checked at the project level. URLs outside the allowed-domain list are not
  processed.
- Scraped descriptions are stored as plain text. Metadata with double-encoded entities and emoji
  is not normalized yet.

## Not yet complete

- Shared provider quotas across projects and waiting for quota capacity to become available.
- End-to-end AI analysis on a large sample; so far, it has been verified on only a few pages.
- Selecting a model for each project in the admin interface.
- Storing source text from Zboží `PRODUCT` feed entries as input for analysis.

## Licenses

The project source code is licensed under MIT; see [LICENSE](./LICENSE). The bundled Nunito font
is licensed separately under the SIL Open Font License 1.1; see [OFL-Nunito.txt](./OFL-Nunito.txt).
