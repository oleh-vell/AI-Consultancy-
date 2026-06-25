-- 0010_add_logo.sql
-- Optional brand logo for the avatar tile. NULL falls back to initials.

ALTER TABLE leads    ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS logo TEXT;
