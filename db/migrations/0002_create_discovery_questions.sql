-- 0002_create_discovery_questions.sql
-- The discovery script the agent runs on the call. Driving this from the DB
-- (instead of a hardcoded array) is what lets the deck/activity weave answers
-- back in by `tag` without any literal questions baked into the app.

CREATE TABLE IF NOT EXISTS discovery_questions (
    id          TEXT     PRIMARY KEY,
    ord         INTEGER  NOT NULL,            -- ask order, 0-based
    prompt      TEXT     NOT NULL,
    placeholder TEXT     NOT NULL,
    tag         TEXT     NOT NULL,            -- echoed in deck / activity
    suggestion  TEXT     NOT NULL,            -- one-tap demo answer
    UNIQUE (ord)
);
