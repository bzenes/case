# SCHEMA — Drizzle / Postgres conventions

Generate everything via `drizzle-kit generate`, commit the migration SQL files.
Never hand-edit a generated migration; if it's wrong, fix the schema source and
regenerate.

## Conventions

- All money columns: `integer` (cents), never `numeric`/`float`/`real`.
- All enum-like columns (`role`, `status`, `platform`) use Postgres `enum`
  types via `pgEnum`, not free-text `varchar` with app-level validation only.
- All tables get `created_at timestamptz default now()`; mutable tables also
  get `updated_at timestamptz` maintained on write.
- Primary keys: UUID (`gen_random_uuid()` default via `pgcrypto` or
  `uuid_generate_v4()` — pick one and note it in NOTES.md if `pgcrypto` isn't
  available in the target Postgres).
- Foreign keys: always `onDelete: 'restrict'` unless there's a specific reason
  to cascade — flag any cascade choice in NOTES.md.

## Tables

### `users`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| email | text, unique | |
| role | enum(`admin`,`creator`) | |
| created_at | timestamptz | |

### `campaigns`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| title | text | indexed for search (e.g. `pg_trgm` or simple `ilike`, either is fine — note choice) |
| platforms | enum[] or join table | either a Postgres array of the platform enum, or a `campaign_platforms` join table — pick one, document the tradeoff briefly in NOTES.md |
| payout_per_1k_views | integer | cents |
| total_budget | integer | cents |
| status | enum(`draft`,`active`,`paused`,`completed`) | |
| starts_at | date | |
| ends_at | date | |
| created_at / updated_at | timestamptz | |

### `submissions`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| campaign_id | uuid fk → campaigns.id | |
| creator_id | uuid fk → users.id | |
| post_url | text | |
| platform | enum | |
| status | enum(`pending`,`approved`,`rejected`,`paid`) | |
| rejection_reason | text, nullable | required (app-level + optionally CHECK constraint) when status = `rejected` |
| created_at / updated_at | timestamptz | |

**Constraint:** `unique(campaign_id, post_url)` — this is the DB-level
guarantee against duplicate submissions, not just a UI/tRPC check.

### `submission_metrics`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| submission_id | uuid fk → submissions.id | |
| captured_at | date | |
| views | integer | |
| likes | integer | |
| comments | integer | |

**Constraint:** `unique(submission_id, captured_at)` — this is what makes the
ingest script's upsert idempotent per day.

## Derived values — do NOT store as columns

- "Budget spent" and "budget remaining" for a campaign are **computed**
  (sum of payouts for `approved`/`paid` submissions using each submission's
  latest metric row), not a stored/cached column, unless you add an explicit
  reconciliation job and justify it in NOTES.md. Storing a mutable running
  total is exactly the kind of thing that causes the race condition in
  BUDGET_CONCURRENCY.md if done naively — read that file before deciding.
- "Current views" / "estimated earnings" for a submission are derived from
  the latest `submission_metrics` row by `captured_at`, not stored redundantly
  on `submissions`.
