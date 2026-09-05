# BUDGET_CONCURRENCY — the part they actually grade

This is the highest-scrutiny piece of the whole assignment. Implement it
exactly this way unless you have a specifically better idea — and if you
deviate, explain why in NOTES.md, don't just quietly do something else.

## The problem

Two admins click "approve" on two different pending submissions in the same
campaign at nearly the same instant. The campaign has, say, $50 of budget
left. Submission A would cost $30, submission B would cost $30. Only one of
them can be approved; the other must fail with a typed `BUDGET_EXCEEDED`
error — not silently overspend, not both succeed, not both fail.

## Why the naive approach fails

```
1. read total_budget, sum(approved payouts)          -- SELECT
2. check if this submission's payout fits             -- app-level if
3. UPDATE submissions SET status = 'approved' ...     -- UPDATE
```

Between step 1 and step 3, another transaction can do the exact same read and
also decide it fits. Both commit. Budget is now oversp­ent. This is a
classic check-then-act race and it WILL reproduce under a concurrent test —
don't assume "unlikely in practice" is good enough; the test in TESTING.md
fires both approvals concurrently on purpose.

## Required approach: atomic conditional write inside a serializable-enough transaction

Use a single SQL statement that both checks and writes atomically, inside a
DB transaction, so Postgres's own row-locking does the mutual exclusion for
you instead of application code.

Recommended pattern (Drizzle + raw SQL where needed):

```sql
BEGIN;

-- Lock the campaign row so concurrent approvals on the same campaign serialize.
SELECT id, total_budget
FROM campaigns
WHERE id = $campaignId
FOR UPDATE;

-- Compute already-committed spend (approved + paid) inside the same tx,
-- now safe because the campaign row is locked and any concurrent approver
-- is blocked waiting on the same SELECT ... FOR UPDATE above.
-- (spend = sum of floor(latest_views/1000) * payout_per_1k_views over
--  submissions in this campaign with status in ('approved','paid'))

-- App-level check against the value just computed:
--   if spend_so_far + this_submission_payout > total_budget -> abort, raise BUDGET_EXCEEDED

UPDATE submissions
SET status = 'approved', updated_at = now()
WHERE id = $submissionId AND status = 'pending';

-- If remaining budget is now exactly 0, also:
UPDATE campaigns SET status = 'completed' WHERE id = $campaignId;

COMMIT;
```

Key points to implement faithfully:

1. **`SELECT ... FOR UPDATE` on the campaign row is what serializes concurrent
   approvals for the same campaign.** The second transaction blocks at that
   SELECT until the first commits or rolls back — it doesn't proceed with a
   stale budget read. This is the actual fix; everything else is bookkeeping
   around it.
2. Do the spend calculation and the `BUDGET_EXCEEDED` check **inside** the
   same transaction, after acquiring the lock, not before.
3. The `WHERE status = 'pending'` guard on the submission UPDATE is a second,
   cheap belt-and-suspenders check against double-approving the same
   submission (e.g. two clicks on the same row) — return a typed error
   (`ALREADY_REVIEWED` or fold into `BUDGET_EXCEEDED`'s sibling) if 0 rows
   updated.
4. Auto-completing the campaign when remaining budget hits exactly 0 happens
   in the same transaction as the approval that caused it — not a separate
   cron/job, so it can't race either.
5. Wrap all of this in a single Drizzle transaction (`db.transaction(async
   (tx) => {...})`) using `tx` for every query in the block, not a mix of
   `db` and `tx`.

## Typed error contract

Define a discriminated tRPC error (e.g. via `TRPCError` with a `code:
'CONFLICT'` and a structured `cause`/custom error class carrying a
`reason: 'BUDGET_EXCEEDED' | 'ALREADY_REVIEWED'`), so the client can
distinguish "budget's gone, refresh the queue" from a generic failure and
show the right message instead of a toast that just says "Something went
wrong."

## What NOT to do

- Don't solve this with an app-level mutex/lock (in-memory lock, Redis lock,
  `setTimeout` retry) — it's a single-process take-home; the DB transaction
  is the correct and simplest primitive, and it's what they say they want to
  read about in NOTES.md.
- Don't store a mutable `budget_remaining` column that you decrement — that
  just moves the same race condition onto a different column, and it's easy
  to accidentally get right in a demo and wrong under real concurrency. If
  you do choose to cache it anyway for read performance, it must still be
  written inside the same locked transaction as the approval, and you should
  say explicitly in NOTES.md why you added it.
- Don't rely on Postgres's default `READ COMMITTED` isolation alone without
  the explicit row lock — `FOR UPDATE` is doing the real work here, not the
  isolation level.

## What to write in NOTES.md about this

- The approach above (or your justified alternative).
- What you tried first and ruled out (e.g. "tried optimistic concurrency with
  a version column, switched to `FOR UPDATE` because it's simpler to reason
  about for a single hot row").
- How the concurrency test actually proves it (see TESTING.md) — e.g. "fired
  two `Promise.all` approvals against a budget that only covers one; asserted
  exactly one `approved` and one `BUDGET_EXCEEDED`."
