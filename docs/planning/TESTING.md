# TESTING — minimum required, with Vitest

Not chasing coverage numbers. These are the specific cases that are actually
worth writing, because each one maps to a way the app could quietly lose or
leak money, or leak data across users.

## 1. Payout math (pure function, no DB needed)

`earnings(views: number, payoutPer1k: number): number`

- `views = 0` → `0`
- `views = 999` → `0` (floor, not ceiling)
- `views = 1000` → exactly `1 * payoutPer1k`
- `views = 2500` → `2 * payoutPer1k` (not 2.5x)
- Large views (e.g. 10_000_000) don't overflow / stay integer cents.

## 2. Budget ceiling on approval (integration, real DB transaction)

- Campaign with `total_budget = 10000` cents, one pending submission whose
  computed payout is `10000` → approval succeeds, campaign becomes
  `completed`.
- Same setup, payout `10001` → approval fails with `BUDGET_EXCEEDED`,
  submission stays `pending`, campaign stays `active`.
- Approving a submission that exactly zeroes remaining budget flips
  `status` to `completed` in the same transaction (assert both changed
  together, not that completion happens on a later read).

## 3. Concurrent approvals (the one they specifically call out)

- Seed a campaign with budget that covers exactly one of two pending
  submissions of equal cost.
- Fire both approval calls concurrently (`Promise.all`, or two separate
  `db.transaction` calls started without awaiting the first before starting
  the second) against the real test database — not mocked, not sequential.
- Assert: exactly one submission ends up `approved`, the other ends up still
  `pending` with the call having thrown `BUDGET_EXCEEDED`. Assert total
  approved spend never exceeds `total_budget`.
- This test is only meaningful against a real Postgres instance with actual
  transactions — don't fake it with an in-memory store or mocked DB client.

## 4. Access control

- Creator A cannot fetch creator B's submission by ID (procedure should 404/
  FORBIDDEN, not just filter it out of a list — test the direct
  single-record fetch, that's the "hand-crafted input" case from the spec).
- Creator A cannot approve/reject any submission (admin-only procedures
  reject creator role outright, independent of ownership).
- Creator A cannot edit/delete a campaign.
- A creator calling "my submissions" only ever sees their own rows, even
  when other creators have submissions on the same campaign.

## 5. Repeated ingest run (idempotency)

- Seed one approved submission with no metrics yet.
- Run the ingest logic for "today" once → one `submission_metric` row for
  today, `views > 0`.
- Run it again for the same day → still exactly one row for
  `(submission_id, today)`, and its `views` is unchanged or only increased —
  never reset or duplicated.
- Run it a third time, assert row count for that day is still 1 across all
  approved submissions (no duplicate-row bug hiding behind a single-
  submission test).

## 6. Ingest partial-failure isolation

- Seed three approved submissions; force the fake update for the middle one
  to throw (e.g. inject a bad/malformed post URL that your metric generator
  rejects).
- Assert the other two still got their metric row written, and the run
  reports the one failure (return value or thrown aggregate — whatever your
  ingest script's contract is, just make sure it's asserted, not just
  logged to console and ignored).

## Test data setup

- Use a real test Postgres (same Docker/Supabase local setup as dev), reset
  between test files/suites — don't mock Drizzle for the concurrency and
  ingest tests, those specifically need real transaction behavior.
- A `seed`/`resetDb` test helper that truncates and re-inserts a known
  fixture set is worth writing once and reusing across the above.
