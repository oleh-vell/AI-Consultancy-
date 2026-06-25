-- 0009_create_invoice_line_templates.sql
-- The priced scope the agency bills for. Kept in the DB (not hardcoded in the
-- generator) so pricing can change without a code deploy. `detail` may contain
-- a {company} placeholder, interpolated when an invoice is generated.

CREATE TABLE IF NOT EXISTS invoice_line_templates (
    id     TEXT    PRIMARY KEY,
    ord    INTEGER NOT NULL,
    label  TEXT    NOT NULL,
    detail TEXT    NOT NULL,
    amount INTEGER NOT NULL,            -- whole pounds, pre-VAT
    UNIQUE (ord)
);
