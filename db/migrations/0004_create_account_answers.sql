-- 0004_create_account_answers.sql
-- What the caller actually said, one row per discovery question. The `tag`
-- links an answer to the slide / activity line that quotes it.

CREATE TABLE IF NOT EXISTS account_answers (
    id         BIGSERIAL PRIMARY KEY,
    account_id TEXT      NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    ord        INTEGER   NOT NULL,        -- question order, 0-based
    q          TEXT      NOT NULL,        -- the question prompt
    a          TEXT      NOT NULL,        -- the caller's answer
    tag        TEXT      NOT NULL,
    UNIQUE (account_id, ord)
);

CREATE INDEX IF NOT EXISTS idx_account_answers_account ON account_answers (account_id, ord);
