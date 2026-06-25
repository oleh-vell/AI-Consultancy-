-- external-setup.sql
-- Complete, self-contained schema + reference seed for an external Postgres
-- (Supabase / Neon / RDS, etc.). Run this ONCE against a fresh database to make
-- the deployed app work end to end.
--
-- Why this exists: seeding only the `leads` table leaves /api/accounts and
-- /api/discovery throwing "relation does not exist". The client hydrates all
-- three in one Promise.all, so a single failure blanks the whole Leads page.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + ON CONFLICT upserts — safe to re-run.

-- ===========================================================================
-- Schema
-- ===========================================================================

CREATE TABLE IF NOT EXISTS leads (
    id          TEXT        PRIMARY KEY,
    company     TEXT        NOT NULL,
    contact     TEXT        NOT NULL,
    role        TEXT        NOT NULL,
    location    TEXT        NOT NULL,
    industry    TEXT        NOT NULL,
    employees   TEXT        NOT NULL,
    phone       TEXT        NOT NULL,
    call_at     TEXT        NOT NULL,
    initials    TEXT        NOT NULL,
    hue         INTEGER     NOT NULL,
    logo        TEXT,
    status      TEXT        NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'calling', 'completed', 'promoted')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_call_at ON leads (call_at, created_at);

CREATE TABLE IF NOT EXISTS discovery_questions (
    id          TEXT     PRIMARY KEY,
    ord         INTEGER  NOT NULL,
    prompt      TEXT     NOT NULL,
    placeholder TEXT     NOT NULL,
    tag         TEXT     NOT NULL,
    suggestion  TEXT     NOT NULL,
    UNIQUE (ord)
);

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
    logo          TEXT,
    call_duration TEXT        NOT NULL,
    summary       TEXT,
    promoted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accounts_promoted_at ON accounts (promoted_at DESC);

CREATE TABLE IF NOT EXISTS account_answers (
    id         BIGSERIAL PRIMARY KEY,
    account_id TEXT      NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    ord        INTEGER   NOT NULL,
    q          TEXT      NOT NULL,
    a          TEXT      NOT NULL,
    tag        TEXT      NOT NULL,
    UNIQUE (account_id, ord)
);
CREATE INDEX IF NOT EXISTS idx_account_answers_account ON account_answers (account_id, ord);

CREATE TABLE IF NOT EXISTS transcript_lines (
    id         BIGSERIAL PRIMARY KEY,
    account_id TEXT      NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    ord        INTEGER   NOT NULL,
    speaker    TEXT      NOT NULL CHECK (speaker IN ('agent', 'client')),
    text       TEXT      NOT NULL,
    UNIQUE (account_id, ord)
);
CREATE INDEX IF NOT EXISTS idx_transcript_lines_account ON transcript_lines (account_id, ord);

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

CREATE TABLE IF NOT EXISTS invoices (
    id         BIGSERIAL   PRIMARY KEY,
    account_id TEXT        NOT NULL UNIQUE REFERENCES accounts (id) ON DELETE CASCADE,
    number     TEXT        NOT NULL,
    issued     TEXT        NOT NULL,
    due        TEXT        NOT NULL,
    subtotal   INTEGER     NOT NULL,
    vat        INTEGER     NOT NULL,
    total      INTEGER     NOT NULL,
    currency   TEXT        NOT NULL DEFAULT '£',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_lines (
    id         BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT    NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    ord        INTEGER   NOT NULL,
    label      TEXT      NOT NULL,
    detail     TEXT      NOT NULL,
    amount     INTEGER   NOT NULL,
    UNIQUE (invoice_id, ord)
);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines (invoice_id, ord);

CREATE TABLE IF NOT EXISTS invoice_line_templates (
    id     TEXT    PRIMARY KEY,
    ord    INTEGER NOT NULL,
    label  TEXT    NOT NULL,
    detail TEXT    NOT NULL,
    amount INTEGER NOT NULL,
    UNIQUE (ord)
);

-- ===========================================================================
-- Reference seed data
-- ===========================================================================

INSERT INTO leads (id, company, contact, role, location, industry, employees, phone, call_at, initials, hue, status, logo) VALUES
    ('ld_agicorp',   'AGI Corp',           'Oleh Velychko',      'CEO',                 'London, UK',          'Artificial intelligence', '12',  '+44 7477 212611',  '14:00', 'AGI', 222, 'queued', NULL),
    ('ld_dragonfly', 'Dragonfly',          'Sven Sabas',         'Co-Founder / Co-CEO', 'London, UK',          'AI / automation',         '35',  '+44 20 7946 0421', '14:20', 'DF',  202, 'queued', 'https://www.google.com/s2/favicons?domain=askdragonfly.com&sz=128'),
    ('ld_downing',   '10 Downing Street',  'David Gelberg',      'AI Innovation Fellow','Westminster, London', 'Government',              '500', '+44 20 7946 1180', '14:45', '10',  158, 'queued', 'https://www.google.com/s2/favicons?domain=gov.uk&sz=128'),
    ('ld_wassist',   'Wassist',            'Josh Warwick',       'Founder',             'London, UK',          'AI assistants',           '8',   '+44 20 7946 2255', '15:10', 'WA',   73, 'queued', 'https://icons.duckduckgo.com/ip3/wassist.ai.ico'),
    ('ld_elyos',     'Elyos AI',           'Panos Stravopodis',  'Founder & CTO',       'London, UK',          'AI / energy',             '15',  '+44 161 496 0330', '15:40', 'EL',   27, 'queued', 'https://www.google.com/s2/favicons?domain=elyos.ai&sz=128'),
    ('ld_bluewire',  'Blue Wire Capital',  'Jai Taylor',         'Principal',           'London, UK',          'Investment',              '40',  '+44 131 496 0712', '16:05', 'BW',  264, 'queued', 'https://www.google.com/s2/favicons?domain=bluewirecapital.com&sz=128')
ON CONFLICT (id) DO UPDATE SET
    company = EXCLUDED.company, contact = EXCLUDED.contact, role = EXCLUDED.role,
    location = EXCLUDED.location, industry = EXCLUDED.industry, employees = EXCLUDED.employees,
    phone = EXCLUDED.phone, call_at = EXCLUDED.call_at, initials = EXCLUDED.initials,
    hue = EXCLUDED.hue, logo = EXCLUDED.logo, status = EXCLUDED.status;

INSERT INTO discovery_questions (id, ord, prompt, placeholder, tag, suggestion) VALUES
    ('bottleneck', 0,
     'To start — what''s the single biggest operational bottleneck your team is hitting right now?',
     'e.g. quotes take three days to turn around…',
     'bottleneck',
     'Our quoting process is manual — every client quote takes our ops team about three days to turn around.'),
    ('leverage', 1,
     'Got it. And if one part of that were fully automated tomorrow, which part would move the needle most?',
     'e.g. pulling pricing from past contracts…',
     'leverage',
     'Pulling pricing and terms from our past contracts automatically — that''s where the days go.'),
    ('timeline', 2,
     'Last one — what''s your rough timeline and budget for getting this solved?',
     'e.g. live this quarter, mid five figures…',
     'timeline',
     'We''d want something live this quarter, and we''ve ring-fenced a mid five-figure budget for it.')
ON CONFLICT (id) DO UPDATE SET
    ord = EXCLUDED.ord, prompt = EXCLUDED.prompt, placeholder = EXCLUDED.placeholder,
    tag = EXCLUDED.tag, suggestion = EXCLUDED.suggestion;

INSERT INTO invoice_line_templates (id, ord, label, detail, amount) VALUES
    ('discovery',  0, 'Discovery & process mapping',    'Workflow shadowing, cost quantification, scope definition', 8500),
    ('build',      1, 'Agent build & integration',      'Custom automation for {company}''s named bottleneck',       24000),
    ('deployment', 2, 'Deployment, training & support', 'Production rollout, team enablement, 30-day support window', 6500)
ON CONFLICT (id) DO UPDATE SET
    ord = EXCLUDED.ord, label = EXCLUDED.label, detail = EXCLUDED.detail, amount = EXCLUDED.amount;
