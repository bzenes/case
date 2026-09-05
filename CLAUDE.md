# Project: Clipping Campaign Marketplace (take-home)

You are building a cut-down version of a paid clipping marketplace. Brands post
campaigns, creators submit short-form clips, creators get paid per 1,000 views up to
a budget cap. **Correctness on money math and concurrency matters more than feature
count or UI polish.**

Read these files, in this order, before writing any code:

1. `SPEC.md` — full requirements, verbatim scope. This is the source of truth. If
   anything you're about to build isn't in here, don't build it.
2. `SCHEMA.md` — required tables/columns and the Drizzle conventions to use.
3. `BUDGET_CONCURRENCY.md` — the hardest part of the assignment (approval race
   condition + payout math). Implement it exactly as specified there, don't invent
   an alternative approach without flagging it in NOTES.md.
4. `TESTING.md` — the minimum test list. These are non-negotiable; everything else
   is optional.
5. `PLAN.md` — the build order. Follow it phase by phase; don't jump to UI before
   phase 3 is green.

## Non-negotiable constraints

- Next.js 15 App Router, TypeScript strict mode, tRPC v11 for **all** app data
  (no REST route handlers for anything covered by SPEC.md).
- Drizzle ORM + Postgres. Migrations generated via `drizzle-kit`, committed to the
  repo, never hand-edited.
- react-hook-form + Zod, with **the same Zod schema** imported by both the client
  form and the tRPC procedure input — do not redeclare validation twice.
- Every tRPC procedure that touches a `submission` or `campaign` must check role
  and ownership server-side. Never trust a client-supplied `userId` for anything
  other than "which cookie is this."
- Auth is a signed cookie + dev user-switcher only. Do not add a real auth
  provider, do not add OAuth, do not add password hashing infra.
- `pnpm test` must pass on a clean checkout after only the steps documented in
  `NOTES.md`. If a step you rely on isn't documented, add it.

## Things that earn zero credit — don't spend time here

Custom visual design, a real auth provider, or extra features beyond SPEC.md.
Restraint is a graded criterion, not a shortcut.

## Working style

- Work in the phase order from `PLAN.md`. After each phase, run tests before
  moving on.
- When you hit a genuine ambiguity not resolved by SPEC.md, pick the most
  defensible interpretation, implement it, and log the assumption in `NOTES.md`
  under "Assumptions" — don't stop and ask.
- Keep a running "AI tooling" section in `NOTES.md` as you go: what you generated
  wholesale, what you had to correct, and why. This is graded — do it honestly,
  not retroactively at the end.
- Prefer small, reviewable commits over one giant commit.
