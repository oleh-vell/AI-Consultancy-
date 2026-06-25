-- 0005_create_transcript_lines.sql
-- The full call transcript, in order, rendered on the account Activity tab.

CREATE TABLE IF NOT EXISTS transcript_lines (
    id         BIGSERIAL PRIMARY KEY,
    account_id TEXT      NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    ord        INTEGER   NOT NULL,
    speaker    TEXT      NOT NULL CHECK (speaker IN ('agent', 'client')),
    text       TEXT      NOT NULL,
    UNIQUE (account_id, ord)
);

CREATE INDEX IF NOT EXISTS idx_transcript_lines_account ON transcript_lines (account_id, ord);
