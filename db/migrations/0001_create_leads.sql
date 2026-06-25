-- 0001_create_leads.sql
-- The CRM queue the agency dials on its own. One row per prospect.

CREATE TABLE IF NOT EXISTS leads (
    id          TEXT        PRIMARY KEY,
    company     TEXT        NOT NULL,
    contact     TEXT        NOT NULL,
    role        TEXT        NOT NULL,
    location    TEXT        NOT NULL,
    industry    TEXT        NOT NULL,
    employees   TEXT        NOT NULL,
    phone       TEXT        NOT NULL,
    call_at     TEXT        NOT NULL,                 -- "14:20"
    initials    TEXT        NOT NULL,
    hue         INTEGER     NOT NULL,                 -- avatar tint, 0-360
    status      TEXT        NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'calling', 'completed', 'promoted')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lists are rendered in call order, then by creation.
CREATE INDEX IF NOT EXISTS idx_leads_call_at ON leads (call_at, created_at);
