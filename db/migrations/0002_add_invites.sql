-- Add invites table for gated signup
CREATE TABLE IF NOT EXISTS invites (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code            TEXT NOT NULL UNIQUE,
  label           TEXT,
  email           TEXT,
  max_uses        INT NOT NULL DEFAULT 1,
  use_count       INT NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON invites (code);
CREATE INDEX ON invites (created_by);
