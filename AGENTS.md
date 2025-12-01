# Repository Guidelines

## Project Structure & Module Organization
This Next.js 15 app relies on the App Router inside `app/`; `app/page.tsx` is the landing view and feature pages extend through folders such as `app/layout-manager/`. API handlers live in `app/api/*/route.ts`. Shared UI sits in `components/` and `components/ui/`, while stateful logic belongs in `contexts/` and `hooks/`. Database and PDF utilities reside in `lib/`, with Jest suites in `lib/__tests__/`. Static assets stay in `public/`, global styles in `styles/`, seed helpers in `scripts/`, and product references in `vibe-spec/`.

## Build, Test, and Development Commands
- `npm run dev` — launch the dev server with hot reload at http://localhost:3000.
- `npm run build` — create an optimized production build.
- `npm start` — serve the latest build; run after `npm run build`.
- `npm run lint` — run Next.js lint (ESLint + TypeScript).
- `npx jest` — execute Jest suites; append `--watch` while iterating.

## Coding Style & Naming Conventions
TypeScript runs in `strict` mode; resolve type errors before committing. Keep components PascalCase, utilities camelCase, and align file names with exports (`album-viewer.tsx` → `AlbumViewer`). Prefer Tailwind utility classes for styling and rely on `clsx` or `tailwind-merge` when composing variants. Run `npm run lint` ahead of PRs to enforce formatting and accessibility checks.

## Testing Guidelines
Jest with `ts-jest` powers the unit tests. Co-locate suites in `__tests__` directories and name files `*.test.ts` or `*.test.tsx`. Mock external services (OAuth, PDF rendering) and reuse the in-memory SQLite approach from `lib/__tests__/database.test.ts` for database flows. Add coverage for any new API handler or database entry point, and surface remaining gaps in the PR description. Run `npx jest --coverage` when touching persistence logic or auth flows.

## Commit & Pull Request Guidelines
Write commits in the imperative mood with a conventional prefix such as `feat:`, `fix:`, or `chore:` so tooling can parse history. Reference related issues in the commit body or PR description when available. Each PR should include a summary, test evidence (commands and results), and UI screenshots or clips when visuals change. Call out environment variable or migration updates explicitly and request review from a domain owner before merging.

## Environment & Security Notes
Create `.env.local` with the Google OAuth, JWT, and database secrets described in `README.md`; never commit this file. Use the scripts in `scripts/` to seed template data only against development databases. Validate generated PDFs and uploaded assets stay within expected size limits before shipping changes.
