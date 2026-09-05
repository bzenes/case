# PLAN — build order

Work phase by phase. Don't start a phase's UI before its data/logic layer has
passing tests. Commit at the end of each phase.

## Phase 0 — scaffold
- Next.js 15 App Router + TypeScript strict, Tailwind, shadcn/ui installed.
- `docker-compose.yml` (or `supabase/` config) for local Postgres.
- Drizzle configured, `drizzle-kit` wired to `pnpm db:generate` / `pnpm db:migrate`.
- Vitest configured, a trivial test passing, `pnpm test` works on a clean
  checkout.
- Signed-cookie session helper + dev user-switcher (seed 2-3 creators + 1
  admin).

**Exit criteria:** `pnpm install && pnpm db:migrate && pnpm dev` works from
scratch per your own NOTES.md instructions.

## Phase 1 — schema
- Implement `SCHEMA.md` exactly. Generate migration via `drizzle-kit`, commit
  it.
- Seed script with realistic fixture data (a handful of campaigns in
  different statuses, submissions in different statuses, a few days of
  metrics).

**Exit criteria:** migration runs clean on an empty DB; seed script populates
it; you can inspect the data with `drizzle-kit studio` or equivalent.

## Phase 2 — money logic (no UI yet)
- Pure `earnings()` function + unit tests (TESTING.md #1).
- tRPC procedure for approve/reject implementing BUDGET_CONCURRENCY.md
  exactly, with the typed error.
- Integration tests: budget ceiling (#2) and concurrent approvals (#3).

**Exit criteria:** the concurrency test in TESTING.md #3 passes reliably
across multiple runs (run it 5-10x locally to shake out flakiness before
moving on — this is the part they'll poke at hardest).

## Phase 3 — access control
- Every tRPC procedure wired with role/ownership checks per SPEC.md.
- Tests from TESTING.md #4.

**Exit criteria:** a creator cannot reach another creator's data by any
procedure, proven by tests, not just by UI omission.

## Phase 4 — ingest script
- `pnpm ingest` implementing SPEC.md §4.5: one row per approved submission
  per day, monotonic views, idempotent upsert on `(submission_id,
  captured_at)`, isolated per-submission failure handling.
- Tests from TESTING.md #5 and #6.

## Phase 5 — admin UI
- Campaign list: server-paginated, searchable, filterable.
- Create/edit campaign form (RHF + Zod, shared schema from SPEC.md/tRPC
  input).
- Campaign detail: review queue (approve/reject with required rejection
  reason, wired to the Phase 2 procedure and its typed error surfaced
  legibly).
- Campaign detail: overview stats + daily views chart, including zero-filled
  days across the campaign period.

## Phase 6 — creator UI
- Browse active campaigns.
- Submit clip form (URL validation per SPEC.md's platform heuristic, shared
  Zod schema, server-side duplicate-URL rejection surfaced clearly).
- My submissions list: status, current views, estimated earnings.

## Phase 7 — polish pass
- Loading/empty/error states across the above — this is explicitly graded,
  don't skip it, but don't over-invest in visual design either (SPEC.md says
  design work earns nothing).
- Accessibility pass: form labels, focus states, keyboard nav on
  approve/reject actions.
- Final NOTES.md pass: setup steps verified on a genuinely clean checkout,
  concurrency write-up, what was cut, what you'd fix next, AI-tooling notes
  reviewed for accuracy (not just copied from a template).

## Phase 8 — final check
- `pnpm test` green on a clean checkout following only the documented setup.
- Deploy (any host, default subdomain fine), confirm the live URL actually
  works end to end (switch users, submit, approve, see it reflected).
- Push repo public (or zip), confirm `NOTES.md` is present and accurate.
