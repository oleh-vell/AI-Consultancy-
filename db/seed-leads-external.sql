-- seed-leads-external.sql
-- Self-contained seed for the lead queue on a fresh external Postgres.
-- Creates the `leads` table (if absent) and upserts the demo prospects.
-- Idempotent: safe to re-run — ON CONFLICT refreshes existing rows.

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
    logo        TEXT,                                 -- brand logo URL; NULL → initials
    status      TEXT        NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'calling', 'completed', 'promoted')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lists are rendered in call order, then by creation.
CREATE INDEX IF NOT EXISTS idx_leads_call_at ON leads (call_at, created_at);

INSERT INTO leads (id, company, contact, role, location, industry, employees, phone, call_at, initials, hue, status, logo) VALUES
    ('ld_agicorp',   'AGI Corp',           'Oleh Velychko',      'CEO',                 'London, UK',          'Artificial intelligence', '12',  '+44 7477 212611',  '14:00', 'AGI', 222, 'queued', NULL),
    ('ld_dragonfly', 'Dragonfly',          'Sven Sabas',         'Co-Founder / Co-CEO', 'London, UK',          'AI / automation',         '35',  '+44 20 7946 0421', '14:20', 'DF',  202, 'queued', 'https://www.google.com/s2/favicons?domain=askdragonfly.com&sz=128'),
    ('ld_downing',   '10 Downing Street',  'David Gelberg',      'AI Innovation Fellow','Westminster, London', 'Government',              '500', '+44 20 7946 1180', '14:45', '10',  158, 'queued', 'https://www.google.com/s2/favicons?domain=gov.uk&sz=128'),
    ('ld_wassist',   'Wassist',            'Josh Warwick',       'Founder',             'London, UK',          'AI assistants',           '8',   '+44 20 7946 2255', '15:10', 'WA',   73, 'queued', 'https://icons.duckduckgo.com/ip3/wassist.ai.ico'),
    ('ld_elyos',     'Elyos AI',           'Panos Stravopodis',  'Founder & CTO',       'London, UK',          'AI / energy',             '15',  '+44 161 496 0330', '15:40', 'EL',   27, 'queued', 'https://www.google.com/s2/favicons?domain=elyos.ai&sz=128'),
    ('ld_bluewire',  'Blue Wire Capital',  'Jai Taylor',         'Principal',           'London, UK',          'Investment',              '40',  '+44 131 496 0712', '16:05', 'BW',  264, 'queued', 'https://www.google.com/s2/favicons?domain=bluewirecapital.com&sz=128')
ON CONFLICT (id) DO UPDATE SET
    company   = EXCLUDED.company,
    contact   = EXCLUDED.contact,
    role      = EXCLUDED.role,
    location  = EXCLUDED.location,
    industry  = EXCLUDED.industry,
    employees = EXCLUDED.employees,
    phone     = EXCLUDED.phone,
    call_at   = EXCLUDED.call_at,
    initials  = EXCLUDED.initials,
    hue       = EXCLUDED.hue,
    logo      = EXCLUDED.logo,
    status    = EXCLUDED.status;
