-- 0003_create_accounts.sql
-- A promoted lead. The snapshot of identity fields is intentional: an account
-- is a point-in-time record of who was called, independent of later lead edits.

CREATE TABLE IF NOT EXISTS accounts (
    id            TEXT        PRIMARY KEY,
    lead_id       TEXT        NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
    company       TEXT        NOT NULL,
    contact       TEXT        NOT NULL,
    role          TEXT        NOT NULL,
    location      TEXT        NOT NULL,
    industry      TEXT        NOT NULL,
    employees     TEXT        NOT NULL,
    initials      TEXT        NOT NULL,
    hue           INTEGER     NOT NULL,
    call_duration TEXT        NOT NULL,          -- "2m 47s"
    summary       TEXT,
    promoted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Accounts list shows newest first.
CREATE INDEX IF NOT EXISTS idx_accounts_promoted_at ON accounts (promoted_at DESC);
