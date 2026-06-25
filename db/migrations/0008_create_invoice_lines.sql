-- 0008_create_invoice_lines.sql
-- Line items for an invoice, in display order.

CREATE TABLE IF NOT EXISTS invoice_lines (
    id         BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT    NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    ord        INTEGER   NOT NULL,
    label      TEXT      NOT NULL,
    detail     TEXT      NOT NULL,
    amount     INTEGER   NOT NULL,        -- whole pounds
    UNIQUE (invoice_id, ord)
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines (invoice_id, ord);
