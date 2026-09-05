# NOTES

## Setup (verify on a clean checkout)

```
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Then open http://localhost:3000 and use the dev user-switcher to sign in as
one of the seeded users.

`pnpm test` requires no other setup - it spins up and tears down its own
throwaway Postgres.

## Deploying (e.g. Vercel)

**Done:** live at https://case-five-psi.vercel.app (Vercel + Neon
Postgres), migrated and seeded. Steps below are what was actually run.

1. Set env vars: `DATABASE_URL` (pooled connection string from your Postgres
   provider, e.g. Vercel Postgres/Neon - `sslmode=require` required),
   `SESSION_SECRET` (a real random value, e.g. `openssl rand -hex 32`). Leave
   `USE_EMBEDDED_PG` unset - it must never be `"true"` outside local dev,
   since it spawns a real Postgres process that a serverless environment
   can't run.
2. Run migrations once against the **unpooled** connection string (same
   provider, e.g. `DATABASE_URL_UNPOOLED`/`POSTGRES_URL_NON_POOLING`) before
   or right after the first deploy - it isn't wired into the Vercel build:
   `DATABASE_URL="<unpooled url>" pnpm db:migrate`.
3. `pnpm db:seed` optionally, the same way, for demo data.

See `.env.example` for the full annotated list.

## Assumptions

- **No Docker/Postgres available in this dev environment.** `docker` and
  `psql`/`pg_ctl` are not installed and there's no admin/interactive path to
  install Docker Desktop here. Substituted `embedded-postgres` (an npm
  package that downloads and runs a real Postgres binary, no Docker/admin
  rights needed) for both local dev and tests, in place of the
  `docker-compose.yml` PLAN.md suggests:
  - Dev: `USE_EMBEDDED_PG=true` in `.env` makes `src/server/db/client.ts`
    lazily start a persistent embedded cluster (data dir `.pgdata/`, port
    54329) the first time the app touches the DB. A real deployment sets
    `USE_EMBEDDED_PG=false` and points `DATABASE_URL` at a real Postgres
    instead - `embedded-postgres` is a devDependency, never imported by a
    code path that runs without that flag.
  - Tests: Vitest's `globalSetup` (`tests/setup/global-setup.ts`) starts a
    separate, non-persistent embedded cluster (data dir `.pgdata-test/`,
    port 54330) once per test run, runs migrations, and tears it down
    (deleting the data dir) after. This is a real Postgres with real
    transactions, per TESTING.md's requirement for the concurrency/ingest
    tests - not mocked.
  - `next.config.ts` marks `embedded-postgres` as a `serverExternalPackage`:
    it dynamically `import()`s a package per OS/arch, and Next's webpack
    server bundler otherwise tries to statically resolve every branch
    (including platforms we didn't install), which fails the build.
  - `initdb` is forced to `--locale=C --encoding=UTF8` (see
    `src/server/db/embedded-shared.ts`). The host OS locale is Turkish, and
    initdb rejects non-ASCII locale names outright; C locale + UTF8 encoding
    sidesteps that while still storing arbitrary Unicode text.
  - The test cluster uses `persistent: true` even though it's throwaway data:
    `persistent: false` makes the library `fs.rm` the data dir immediately
    after killing the Postgres process, which raced Windows still holding
    file handles open (`EBUSY`) and failed `pnpm test`'s exit code even
    though every test had passed. `global-setup.ts` instead `rmSync`s the
    directory at the *start* of the next run, once the prior process has
    fully exited.
  - On Windows, `embedded-postgres` stops the server via `taskkill /f`
    (there's no SIGINT), so you'll see a "database system was interrupted"
    / crash-recovery log line every time a script's Postgres instance shuts
    down. This is expected and harmless (WAL replay makes it consistent);
    it isn't evidence of a real crash.
- **`gen_random_uuid()` needs no extension.** It's been a core Postgres
  built-in (not requiring `pgcrypto`) since PG13; the embedded cluster runs
  PG17.
- **`campaigns.platforms` is a Postgres array of the platform enum**, not a
  join table. A campaign's platform set is small and fixed-cardinality, and
  nothing queries it relationally (no "campaigns sharing a platform with
  X"), so the array avoids a needless join table.
- **Title search uses `ilike`**, not `pg_trgm`, since the take-home doesn't
  need fuzzy/ranked search - `ilike '%term%'` is enough and needs no
  extension.
- **Foreign keys are `onDelete: 'restrict'` everywhere** (SCHEMA.md
  default); nothing in SPEC.md calls for cascading deletes.
- **`rejection_reason` required-when-rejected is enforced by both a Postgres
  `CHECK` constraint and app-level Zod validation** on the reject procedure,
  per SCHEMA.md's "app-level + optionally CHECK constraint" note.
- shadcn/ui's interactive CLI (`shadcn init`) wasn't run; instead a couple of
  hand-written primitives (`src/components/ui/button.tsx`) follow the exact
  same pattern shadcn generates (`cva` + `tailwind-merge` + a `cn` helper),
  since SPEC.md explicitly doesn't grade visual/design polish and the CLI's
  interactive prompts don't work well in a non-interactive shell.
- **No `campaigns.delete` procedure.** SPEC.md's Admin section only lists
  "create/edit campaign," never delete; TESTING.md #4 says "creator cannot
  edit/delete a campaign" but that reads as describing the class of
  admin-only campaign-mutation endpoints generically, tested against
  whichever exist. Built `create` + `update` only and tested creator access
  against both.
- Submission ownership checks return `NOT_FOUND` (not `FORBIDDEN`) when a
  creator requests another creator's submission by id, so a hand-crafted id
  can't be used to distinguish "doesn't exist" from "exists but isn't
  yours."
- No `superjson` transformer on the tRPC client/server: all data crossing
  the wire is either plain JSON-safe types or dates represented as
  `YYYY-MM-DD` strings in Zod schemas, so the default JSON serialization is
  enough and avoids an extra dependency.

## Budget/concurrency approach

Implemented exactly as BUDGET_CONCURRENCY.md specifies, no alternative
approach: `submissions.approve` (`src/server/trpc/routers/submissions.ts`)
runs inside a single `db.transaction`, using `tx` for every query. Inside
that transaction:

1. `SELECT ... FOR UPDATE` on the campaign row. This is the actual fix - a
   second concurrent `approve` call on the same campaign blocks here until
   the first transaction commits or rolls back, so it never reads a stale
   budget figure.
2. Spend-so-far is computed *after* acquiring the lock: latest metric row
   per `approved`/`paid` submission in the campaign (Postgres `DISTINCT ON`),
   reduced through the same `earnings()` used by the unit tests, so the
   aggregate and the per-submission math can't drift apart.
3. If `spendSoFar + thisPayout > totalBudget`, throw a typed `CONFLICT` with
   `cause.reason = 'BUDGET_EXCEEDED'` (rolls back the transaction).
4. Otherwise `UPDATE submissions SET status = 'approved' ... WHERE status =
   'pending'` - the `WHERE` guard is the belt-and-suspenders check for two
   clicks on the *same* submission; 0 rows updated throws
   `ALREADY_REVIEWED`.
5. If the approval brings remaining budget to exactly 0, the campaign is
   flipped to `completed` in the same transaction, same statement block -
   not a follow-up write.

Didn't try and reject an alternative first - `FOR UPDATE` was the plan from
the start, since BUDGET_CONCURRENCY.md rules out an app-level mutex and a
decremented `budget_remaining` column, and optimistic concurrency (version
column + retry) is strictly more moving parts for the same single-hot-row
problem.

**Typed error contract:** `src/server/trpc/approval-error.ts` wraps
`TRPCError` with `cause: { reason }`; `initTRPC.create({ errorFormatter })`
in `src/server/trpc/trpc.ts` re-exposes `reason` on the serialized error's
`data`, so an HTTP/React Query client can branch on `error.data.reason`
without parsing message strings. Server-side tests assert on `error.cause`
directly (calling procedures in-process via `appRouter.createCaller`,
bypassing HTTP, so the formatter never runs).

**How the concurrency test proves it**
(`tests/integration/concurrent-approvals.test.ts`): two pending submissions
of equal cost, budget covers exactly one; both `approve` calls started via
`Promise.allSettled` (not awaited one-at-a-time); asserts exactly one
`fulfilled` and one `rejected` with `BUDGET_EXCEEDED`, exactly one
`approved` row in the DB, total approved spend `<=` budget, and the
campaign auto-completed. Repeated for 8 iterations in a loop inside the
same test (fresh fixtures each time via `resetDb()`), per PLAN.md's "run
5-10x to shake out flakiness" - passed all 8/8 on every local run so far.

## What was cut

- **Custom visual design.** SPEC.md explicitly grades this at zero, so the
  UI is Tailwind utility classes + a handful of hand-written shadcn-style
  primitives, no theming/branding pass.
- **`campaigns.delete`** - see Assumptions above.
- **URL persistence for list filters/pagination.** The admin campaign list's
  search/status/page state lives in component state, not the URL - the
  graded part (server-side pagination via LIMIT/OFFSET in the tRPC
  procedure) works either way; only "back button restores your filter"
  UX was cut for time.
- **Client-side pagination/virtualization on "my submissions" and the
  review queue.** Both are scoped to one creator or one campaign's pending
  items, which stays small; server-side pagination there wasn't asked for
  and would be premature.
- Not actually cut, just noting where it ended up: **deploying and
  pushing the repo public** (PLAN.md Phase 8) needed the user's own
  GitHub/Vercel accounts (no credentials for either exist in this dev
  environment). Done collaboratively: repo pushed to
  `https://github.com/bzenes/case`, deployed to Vercel
  (`https://case-five-psi.vercel.app`) with a Neon Postgres database,
  migrations + seed run against production, and the full approve/
  reject/ingest/budget flow re-verified against the live URL after.

## What I'd fix next

- The admin campaign list's filters resetting on navigation (see above).
- `campaigns.overview`'s daily-views chart sums each day's own
  `submission_metrics.views` value literally (zero-filling missing days
  per SPEC.md), rather than treating it as a running cumulative total -
  reasonable given the schema doesn't distinguish delta-vs-cumulative, but
  worth confirming against whatever the grader actually expects, since a
  cumulative read would look different (monotonically rising, never
  dipping to zero on a gap day).
- No monitoring/alerting on the ingest script's reported failures beyond
  its own exit code and stderr - fine for a manually-run `pnpm ingest`,
  not fine unattended.

## Bugs found by actually clicking through the UI

- **Duplicate-submission conflict wasn't being caught.**
  `isUniqueViolation` checked `err.code === '23505'` on the caught error
  directly, but Drizzle wraps the driver's pg error in a
  `DrizzleQueryError` - the real Postgres error (with `.code`) lives at
  `err.cause`, not on `err` itself. The unique-URL test only exercised the
  DB constraint, never the catch branch, so it passed while the actual API
  call returned a raw 500 with a leaked SQL query in the message. Found by
  hitting the endpoint over real HTTP after the UI was built, not by
  reading the code. Fixed in `src/server/db/errors.ts` and added
  `tests/integration/submissions-create.test.ts` to cover it going
  forward.

## AI tooling

Built with Claude Code (Sonnet 5), working phase-by-phase from PLAN.md.

- Phase 0 (scaffold): generated wholesale - package.json dependency list,
  tsconfig/tailwind/postcss/eslint configs, Drizzle schema matching
  SCHEMA.md, tRPC server/client wiring, session cookie helper, dev
  user-switcher UI, seed script.
- Had to debug and correct two real environment issues, not just
  hallucinated code: (1) `initdb` failing on the Turkish Windows locale, and
  (2) Next's webpack bundler statically resolving `embedded-postgres`'s
  per-platform dynamic imports and failing the build. Both root-caused by
  actually running the dev server / migration and reading the error, then
  fixed rather than worked around.
- Phases 2-4 (budget/concurrency, access control, ingest): generated
  wholesale from BUDGET_CONCURRENCY.md/SPEC.md/TESTING.md, but the
  `= ANY(${array})` interpolation bug in `latestViewsForSubmissions`
  (produces a Postgres row-list, not an array - see the Phase 3 commit)
  was a genuine generation mistake, not a transcription slip, caught only
  because the test suite actually executed the query against a real
  Postgres instead of a mock.
- Phases 5-6 (admin/creator UI): generated wholesale, then manually
  exercised every page and mutation over real HTTP against the seeded dev
  DB (not just "it compiles"). That's what caught the
  `isUniqueViolation`/`err.cause` bug above - the existing DB-level test
  proved the constraint fired, but nothing had actually called the tRPC
  procedure through the real error-wrapping path until the UI did.
- Reviewed every AI-drafted NOTES.md section above for accuracy against
  the actual code before finishing, rather than trusting the draft
  wording from when each phase was written.
