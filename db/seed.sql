-- seed.sql
-- Reference data the app needs to function: the lead queue, the discovery
-- script, and the billable scope. Idempotent — re-running only refreshes the
-- seeded rows (ON CONFLICT) and never touches live accounts. Run after migrate.

-- ---------------------------------------------------------------------------
-- Leads — the queue the agency would dial on its own.
-- ---------------------------------------------------------------------------
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
    logo      = EXCLUDED.logo;

-- ---------------------------------------------------------------------------
-- Discovery script — the 2-3 questions the agent asks on the call.
-- ---------------------------------------------------------------------------
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
    ord         = EXCLUDED.ord,
    prompt      = EXCLUDED.prompt,
    placeholder = EXCLUDED.placeholder,
    tag         = EXCLUDED.tag,
    suggestion  = EXCLUDED.suggestion;

-- ---------------------------------------------------------------------------
-- Invoice line templates — the billable scope. {company} is interpolated.
-- ---------------------------------------------------------------------------
INSERT INTO invoice_line_templates (id, ord, label, detail, amount) VALUES
    ('discovery',  0, 'Discovery & process mapping',       'Workflow shadowing, cost quantification, scope definition', 8500),
    ('build',      1, 'Agent build & integration',         'Custom automation for {company}''s named bottleneck',       24000),
    ('deployment', 2, 'Deployment, training & support',    'Production rollout, team enablement, 30-day support window', 6500)
ON CONFLICT (id) DO UPDATE SET
    ord    = EXCLUDED.ord,
    label  = EXCLUDED.label,
    detail = EXCLUDED.detail,
    amount = EXCLUDED.amount;
