# Project Guidelines

## Architecture

- This is a private admin app built with Next.js 16 App Router, React, TypeScript, and Tailwind
  CSS. Routes live in `src/app`, shared UI in `src/components`, and domain logic in `src/lib`.
- PostgreSQL is hosted on Neon and accessed through Drizzle ORM. The schema is
  `src/lib/db/schema.ts`; migrations are generated into `drizzle/`.
- Authentication uses Auth.js Credentials for one administrator account. Preserve the existing
  server-side authorization checks for protected operations.
- Background workflows use Inngest. Follow the existing patterns in `src/lib/jobs` and the
  `src/app/api/inngest` endpoint.
- Interface translations live in `src/lib/i18n/messages/cs.ts` and
  `src/lib/i18n/messages/en.ts`. Keep both catalogs aligned with their shared type. Update both
  catalogs when changing UI copy; scraped page text and AI-generated content are not translated.

## Development

- Use the `pnpm` scripts. `pnpm dev` starts the Next.js app; do not use `vp dev`, which starts
  Vite's built-in server. Vite+ is used by the project's formatting and test scripts.
- `pnpm check` runs formatting checks, linting, type-checking, and tests. Prefer focused tests
  while iterating, then run the full check when appropriate.
- Use a Neon development branch for local work. Use `pnpm db:generate` for schema migrations and
  `pnpm db:migrate` to apply them.
- Before changing Next.js code, read the relevant documentation for the installed version under
  `node_modules/next/dist/docs/`.
- See `README.md` for setup, feature workflows, and current limitations; keep it up to date when
  changing documented commands or user-facing behavior.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
