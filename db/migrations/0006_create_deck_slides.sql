-- 0006_create_deck_slides.sql
-- The generated pitch deck, one row per slide. `bullets` is JSONB because a
-- slide may carry an ordered list or none at all.

CREATE TABLE IF NOT EXISTS deck_slides (
    id         BIGSERIAL PRIMARY KEY,
    account_id TEXT      NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    ord        INTEGER   NOT NULL,
    kind       TEXT      NOT NULL
        CHECK (kind IN ('cover', 'situation', 'leverage', 'approach', 'engagement', 'investment')),
    eyebrow    TEXT      NOT NULL,
    title      TEXT      NOT NULL,
    body       TEXT,
    bullets    JSONB,
    quote      TEXT,
    UNIQUE (account_id, ord)
);

CREATE INDEX IF NOT EXISTS idx_deck_slides_account ON deck_slides (account_id, ord);
