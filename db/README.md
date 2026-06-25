# Database

Local Postgres (Docker) is the single source of truth for the app. Nothing is
hardcoded in the application code — the lead queue, the discovery script, and
the billable scope all live in the database and are loaded over the API.

## Layout

```
db/
  migrations/   numbered SQL, one file per table — applied in order, once each
  seed.sql      reference rows (leads, discovery questions, invoice scope)
scripts/
  db.mjs        shared: .env loader + retrying pg connection
  migrate.mjs   migration runner (tracks applied files in schema_migrations)
  seed.mjs      runs seed.sql (idempotent upserts)
```

## Migrations

Each migration is an idempotent `CREATE TABLE IF NOT EXISTS …` plus its indexes.
They run inside a transaction and are recorded in `schema_migrations` so each
file applies exactly once. To add a schema change, drop a new file in
`db/migrations` with the next number (e.g. `0010_add_lead_email.sql`) and run
`npm run db:migrate` — never edit an already-applied file.

| File | Table | Purpose |
| ---- | ----- | ------- |
| `0001_create_leads.sql` | `leads` | CRM queue the agency dials |
| `0002_create_discovery_questions.sql` | `discovery_questions` | The 2–3 questions the agent asks |
| `0003_create_accounts.sql` | `accounts` | A promoted lead |
| `0004_create_account_answers.sql` | `account_answers` | What the caller said, per question |
| `0005_create_transcript_lines.sql` | `transcript_lines` | Full call transcript |
| `0006_create_deck_slides.sql` | `deck_slides` | Generated pitch deck |
| `0007_create_invoices.sql` | `invoices` | One invoice per account |
| `0008_create_invoice_lines.sql` | `invoice_lines` | Invoice line items |
| `0009_create_invoice_line_templates.sql` | `invoice_line_templates` | Billable scope used to generate invoices |

## Data flow

```
Browser (Zustand store, lib/store.ts)
  │  fetch
  ▼
API routes (app/api/**)            ← thin HTTP layer
  │  call
  ▼
Repository (lib/repo.ts)           ← all SQL, server-only
  │  uses
  ▼
Generators (lib/data.ts)           ← pure: transcript / deck / invoice from inputs
  │
  ▼
Postgres (lib/db.ts pool)
```

- **Leads / discovery** are read straight from their tables.
- **Promotion** (`POST /api/accounts`) loads the lead from the DB, generates the
  transcript and deck from the caller's answers, and writes the account plus its
  answers/transcript/slides in one transaction.
- **Invoices** (`POST /api/accounts/:id/invoice`) are built from
  `invoice_line_templates` (with `{company}` interpolated) and persisted.
- **Reset** (`POST /api/reset`) deletes all accounts (children cascade) and
  returns every lead to `queued`. Seed rows are untouched.
