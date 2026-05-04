-- Migration 0003: Client collaboration portal
-- Adds tables for sharing projects with external clients,
-- client comments, AI-generated project updates, and
-- a restricted Postgres role for the portal service.

-- ═══════════════════════════════════════════════════════════════
--  PROJECT SHARES — token-gated access for external clients
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE project_shares (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  client_name     TEXT,
  client_email    TEXT,
  permissions     TEXT DEFAULT 'view',          -- view | comment
  notify_on       TEXT DEFAULT 'updates',       -- updates | all | none
  is_active       BOOLEAN DEFAULT TRUE,
  last_viewed_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON project_shares (token);
CREATE INDEX ON project_shares (project_id);
CREATE INDEX ON project_shares (user_id);

-- ═══════════════════════════════════════════════════════════════
--  PROJECT COMMENTS — threaded discussion on shared items
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE project_comments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
  share_id        UUID REFERENCES project_shares(id) ON DELETE SET NULL,
  author_type     TEXT NOT NULL,                -- owner | client
  author_name     TEXT,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON project_comments (project_id, created_at);
CREATE INDEX ON project_comments (task_id);

-- ═══════════════════════════════════════════════════════════════
--  PROJECT UPDATES — AI-generated status reports
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE project_updates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT,
  body            TEXT NOT NULL,
  ai_generated    BOOLEAN DEFAULT FALSE,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON project_updates (project_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
--  ADD client_visible TO TASKS AND FILES
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS client_visible BOOLEAN DEFAULT FALSE;
ALTER TABLE files ADD COLUMN IF NOT EXISTS client_visible BOOLEAN DEFAULT FALSE;

-- ═══════════════════════════════════════════════════════════════
--  RESTRICTED PORTAL ROLE
--  The portal service connects as this role — it can only read
--  shared data and insert comments. No access to users, sessions,
--  emails, contacts, AI threads, or any other private tables.
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'portal_reader') THEN
    CREATE ROLE portal_reader LOGIN PASSWORD 'changeme';
  END IF;
END $$;

-- Read access on collaboration tables only
GRANT CONNECT ON DATABASE workspace TO portal_reader;
GRANT USAGE ON SCHEMA public TO portal_reader;
GRANT SELECT ON project_shares, projects, tasks, files, project_updates, project_comments, folders TO portal_reader;
GRANT INSERT ON project_comments TO portal_reader;
GRANT UPDATE (last_viewed_at) ON project_shares TO portal_reader;

-- Allow the portal to use uuid generation
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO portal_reader;
