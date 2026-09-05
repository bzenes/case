# SPEC — source of truth

Distilled from the original take-home brief. If something isn't listed here,
it's out of scope.

## Domain

Brands post paid clipping campaigns. Creators submit short-form clips (TikTok,
Instagram, YouTube) to campaigns. Creators are paid per 1,000 views, capped at the
campaign's total budget.

## Data model (minimum)

### `user`
- `id`, `email`, `role` (`admin` | `creator`)
- No real auth (see Auth section).

### `campaign`
- `title`
- `platforms` (one or more of: `tiktok`, `instagram`, `youtube`)
- `payout_per_1k_views` — integer cents
- `total_budget` — integer cents
- `status` — `draft` | `active` | `paused` | `completed`
- `starts_at`, `ends_at`

### `submission`
- `campaign_id`, `creator_id`
- `post_url`, `platform`
- `status` — `pending` | `approved` | `rejected` | `paid`
- `rejection_reason` (nullable, required when status = `rejected`)
- timestamps (`created_at`, `updated_at`)
- Uniqueness: same `post_url` cannot appear twice on the same `campaign_id`.

### `submission_metric`
- `submission_id`, `captured_at` (date, not datetime)
- `views`, `likes`, `comments`
- One row per `(submission_id, captured_at)`.

Money is always integer cents. Never use float for money anywhere in the stack.

## Auth (4.1)

- Signed cookie holding `userId`. Dev-only user switcher in the UI to swap
  between seeded users.
- No real auth provider, no password flow.
- Every tRPC procedure enforces role and ownership server-side:
  - A `creator` can only read/mutate their own `submission` rows — including
    against hand-crafted input (i.e. don't rely on the UI to hide other users'
    IDs; check in the resolver).
  - `admin`-only procedures (campaign CRUD, review queue, approve/reject) reject
    creators outright.

## Admin (4.2)

- Campaign list: server-side pagination, search by title, filter by status.
- Create/edit campaign: RHF + Zod, schema shared with the tRPC input.
- Campaign detail → review queue: list `pending` submissions, approve or reject.
  Rejecting requires a non-empty `rejection_reason`.
- Campaign detail → overview: total approved views, budget spent, budget
  remaining, and a chart of daily views across `[starts_at, ends_at]`. The
  period includes days with no `submission_metric` rows — those must render as
  zero, not be skipped.

## Creator (4.3)

- Browse campaigns with `status = active`.
- Submit a clip URL to a campaign:
  - URL must look like a real post URL for one of the campaign's platforms
    (see "URL validation" below).
  - Same URL can't be submitted twice to the same campaign (DB-level unique
    constraint, not just a UI check).
- "My submissions" list: status, current views (latest `submission_metric`),
  estimated earnings (see payout formula).

### URL validation (platform-specific, reasonable heuristic — not a live check)

- TikTok: hostname is `tiktok.com` / `www.tiktok.com` / `vm.tiktok.com`, path
  roughly matches `/@user/video/<id>` or a short-link shape.
- Instagram: hostname is `instagram.com` / `www.instagram.com`, path starts
  with `/reel/` or `/p/`.
- YouTube: hostname is `youtube.com`, `www.youtube.com`, or `youtu.be`, path/
  query matches a `watch?v=`, `/shorts/`, or short-link shape.
- Reject anything that doesn't match the campaign's allowed platform(s).
  Validate with a Zod refinement shared client/server, not a separate ad hoc
  check on each side.

## Budget and payout (4.4) — see BUDGET_CONCURRENCY.md for the algorithm

- `earnings = floor(views / 1000) * payout_per_1k_views`, using the most
  recent `submission_metric` row for that submission.
- A campaign never pays out more than `total_budget` in total across its
  `approved`/`paid` submissions.
- If approving a submission would push total approved payout over
  `total_budget`, the approval fails with a **typed** tRPC error (custom error
  code, e.g. `BUDGET_EXCEEDED`) that the UI can branch on and show a specific
  message for — not a generic 500/Internal error.
- Approvals are first-come-first-served: if two approvals race against a
  budget that can only cover one, exactly one succeeds and the other fails
  with `BUDGET_EXCEEDED`. This must be true under real concurrent DB
  transactions, not just "unlikely in practice."
- When remaining budget hits exactly zero, the campaign auto-transitions to
  `completed` as part of the same transaction that caused it.

## Metrics ingestion (4.5)

`pnpm ingest` runs a script (not a UI action) that simulates one day of
third-party sync:

- One `submission_metric` row per **approved** submission, per calendar day.
- Views are monotonically non-decreasing across runs (never invent a lower
  number than the existing row for that day).
- Idempotent: running it twice for the same day leaves the data identical to
  running it once (upsert on `(submission_id, captured_at)`, not insert-only).
- Partial failure isolation: if one submission's fake-update throws mid-run,
  the script continues processing the rest and reports the failure(s) at the
  end (collect errors, don't let one throw abort the whole batch).

## Tests (minimum required — see TESTING.md for detail)

- Payout math (`floor(views/1000) * payout_per_1k_views`), including edge
  cases (0 views, views below 1000, exact multiples).
- Budget ceiling enforcement on approval.
- Concurrent approvals against a shared, nearly-exhausted budget.
- Access control: creator cannot read/mutate another creator's submissions,
  including via hand-crafted tRPC input.
- Ingest run executed twice for the same day produces identical data
  (idempotency).

`pnpm test` must pass on a clean checkout using only the documented setup
steps.

## Explicitly out of scope

Custom visual design, a real auth provider (OAuth/passwords/sessions beyond
the signed cookie), any feature not listed above.
