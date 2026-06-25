-- 0007_create_invoices.sql
-- One invoice per account (the loop-closing artifact). Amounts are stored in
-- whole pounds as integers to avoid float rounding on VAT.

CREATE TABLE IF NOT EXISTS invoices (
    id         BIGSERIAL   PRIMARY KEY,
    account_id TEXT        NOT NULL UNIQUE REFERENCES accounts (id) ON DELETE CASCADE,
    number     TEXT        NOT NULL,            -- "ACL-2026-001"
    issued     TEXT        NOT NULL,            -- "25 Jun 2026"
    due        TEXT        NOT NULL,
    subtotal   INTEGER     NOT NULL,
    vat        INTEGER     NOT NULL,
    total      INTEGER     NOT NULL,
    currency   TEXT        NOT NULL DEFAULT '£',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
