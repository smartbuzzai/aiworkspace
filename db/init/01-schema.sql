-- ═══════════════════════════════════════════════════════════════
--  AI Workspace — Initial Postgres Schema
--  Runs on first container boot from /docker-entrypoint-initdb.d
-- ═══════════════════════════════════════════════════════════════

-- ─── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Separate database for n8n (Docker will create on first connect)
SELECT 'CREATE DATABASE n8n'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n')\gexec

-- ═══════════════════════════════════════════════════════════════
--  USERS + AUTH
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  avatar_url    TEXT,
  timezone      TEXT DEFAULT 'America/Chicago',
  settings      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE magic_links (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON magic_links (token_hash);
CREATE INDEX ON magic_links (expires_at);

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  user_agent    TEXT,
  ip            INET,
  expires_at    TIMESTAMPTZ NOT NULL,
  last_seen_at  TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON sessions (user_id);
CREATE INDEX ON sessions (token_hash);

CREATE TABLE passkeys (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key    BYTEA NOT NULL,
  counter       BIGINT DEFAULT 0,
  transports    TEXT[],
  device_name   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
--  EMAIL ACCOUNTS (IMAP/SMTP credentials per user)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE email_accounts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,                 -- "Work", "Personal"
  email_address     TEXT NOT NULL,
  imap_host         TEXT NOT NULL,
  imap_port         INT  NOT NULL DEFAULT 993,
  imap_user         TEXT NOT NULL,
  imap_pass_enc     BYTEA NOT NULL,                -- encrypted with per-user key
  smtp_host         TEXT NOT NULL,
  smtp_port         INT  NOT NULL DEFAULT 465,
  smtp_user         TEXT NOT NULL,
  smtp_pass_enc     BYTEA NOT NULL,
  last_sync_at      TIMESTAMPTZ,
  last_uid          BIGINT DEFAULT 0,
  sync_status       TEXT DEFAULT 'idle',           -- idle | syncing | error
  sync_error        TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, email_address)
);
CREATE INDEX ON email_accounts (user_id);

-- ═══════════════════════════════════════════════════════════════
--  CONTACTS (CRM)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE contacts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  company         TEXT,
  role            TEXT,
  tags            TEXT[] DEFAULT '{}',
  score           INT DEFAULT 50,                  -- 0-100 lead score
  status          TEXT DEFAULT 'active',           -- hot | active | nurture | cold
  notes           TEXT,
  last_touch_at   TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON contacts (user_id);
CREATE INDEX ON contacts (email);
CREATE INDEX ON contacts USING GIN (tags);
CREATE INDEX ON contacts USING GIN (name gin_trgm_ops);

CREATE TABLE contact_interactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id    UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,                    -- email | call | meeting | note
  summary       TEXT,
  ref_type      TEXT,                              -- email | event | manual
  ref_id        UUID,
  occurred_at   TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON contact_interactions (contact_id, occurred_at DESC);

-- ═══════════════════════════════════════════════════════════════
--  EMAIL THREADS + MESSAGES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE email_threads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  subject         TEXT,
  participants    TEXT[] DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  unread_count    INT DEFAULT 0,
  is_starred      BOOLEAN DEFAULT FALSE,
  is_archived     BOOLEAN DEFAULT FALSE,
  ai_summary      TEXT,
  ai_priority     TEXT,                             -- high | medium | low
  labels          TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON email_threads (user_id, last_message_at DESC);
CREATE INDEX ON email_threads (account_id);

CREATE TABLE emails (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id       UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_id      TEXT UNIQUE,                      -- RFC 822 Message-ID
  in_reply_to     TEXT,
  from_address    TEXT NOT NULL,
  from_name       TEXT,
  to_addresses    TEXT[] DEFAULT '{}',
  cc_addresses    TEXT[] DEFAULT '{}',
  subject         TEXT,
  body_text       TEXT,
  body_html       TEXT,
  is_read         BOOLEAN DEFAULT FALSE,
  is_sent         BOOLEAN DEFAULT FALSE,
  received_at     TIMESTAMPTZ,
  raw_uid         BIGINT,                           -- IMAP UID
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON emails (thread_id, received_at DESC);
CREATE INDEX ON emails (account_id, raw_uid);
CREATE INDEX ON emails USING GIN (body_text gin_trgm_ops);

CREATE TABLE email_attachments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id      UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  content_type  TEXT,
  size_bytes    BIGINT,
  s3_key        TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
--  CALENDAR
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE calendars (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  color           TEXT DEFAULT '#3b82f6',
  caldav_url      TEXT,                             -- Radicale path
  is_default      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calendar_id     UUID REFERENCES calendars(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  location        TEXT,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  all_day         BOOLEAN DEFAULT FALSE,
  event_type      TEXT DEFAULT 'meeting',           -- meeting | call | focus | task | personal
  attendees       JSONB DEFAULT '[]'::jsonb,        -- [{email, name, status}]
  recurrence_rule TEXT,                              -- RRULE string
  caldav_uid      TEXT,                              -- sync back to Radicale
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON events (user_id, starts_at);
CREATE INDEX ON events (calendar_id);

-- ═══════════════════════════════════════════════════════════════
--  PROJECTS + TASKS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  stage           TEXT DEFAULT 'backlog',           -- backlog | discovery | in_progress | review | done
  owner           TEXT,
  due_date        DATE,
  progress        INT DEFAULT 0,                    -- 0-100
  color           TEXT DEFAULT '#3b82f6',
  is_archived     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON projects (user_id);

CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  parent_task_id  UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  priority        TEXT DEFAULT 'medium',            -- high | medium | low
  status          TEXT DEFAULT 'open',              -- open | in_progress | done | cancelled
  due_at          TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  assigned_to     UUID REFERENCES users(id),
  source          TEXT,                              -- manual | ai | email | meeting
  source_ref      UUID,
  tags            TEXT[] DEFAULT '{}',
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON tasks (user_id, status, due_at);
CREATE INDEX ON tasks (project_id);

-- ═══════════════════════════════════════════════════════════════
--  DOCUMENTS + MEDIA LIBRARY
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE folders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES folders(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  path            TEXT NOT NULL,                    -- materialized path "/Clients/Harrison"
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON folders (user_id, path);
CREATE INDEX ON folders (parent_id);

CREATE TABLE files (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id       UUID REFERENCES folders(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL,                    -- pdf | doc | image | audio | video | sheet | slides | other
  mime_type       TEXT,
  size_bytes      BIGINT NOT NULL,
  s3_key          TEXT NOT NULL UNIQUE,
  s3_bucket       TEXT NOT NULL DEFAULT 'workspace',
  checksum_sha256 TEXT,
  extracted_text  TEXT,                              -- OCR / PDF extraction
  metadata        JSONB DEFAULT '{}'::jsonb,
  is_starred      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON files (user_id, created_at DESC);
CREATE INDEX ON files (folder_id);
CREATE INDEX ON files USING GIN (extracted_text gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════════
--  AI ASSISTANT
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE ai_threads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT,
  pinned          BOOLEAN DEFAULT FALSE,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON ai_threads (user_id, last_message_at DESC);

CREATE TABLE ai_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id       UUID NOT NULL REFERENCES ai_threads(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,                    -- user | assistant | tool | system
  content         TEXT NOT NULL,
  tool_calls      JSONB,                             -- array of tool invocations
  tool_call_id    TEXT,
  model           TEXT,
  tokens_in       INT,
  tokens_out      INT,
  duration_ms     INT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON ai_messages (thread_id, created_at);

-- ─── Vector store for semantic retrieval ──────────────────────
-- 768 dims matches nomic-embed-text (default with Ollama)
CREATE TABLE embeddings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type     TEXT NOT NULL,                    -- email | contact | file | task | event | note
  source_id       UUID NOT NULL,
  chunk_index     INT DEFAULT 0,
  content         TEXT NOT NULL,
  embedding       vector(768) NOT NULL,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON embeddings (user_id, source_type);
CREATE INDEX ON embeddings (source_type, source_id);
-- HNSW for fast cosine similarity at scale
CREATE INDEX embeddings_vector_idx ON embeddings
  USING hnsw (embedding vector_cosine_ops);

-- ═══════════════════════════════════════════════════════════════
--  NOTIFICATIONS (web push + in-app)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE push_subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL UNIQUE,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,                    -- email | task | event | ai | system
  title           TEXT NOT NULL,
  body            TEXT,
  link            TEXT,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON notifications (user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
--  AUDIT LOG
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  ip              INET,
  user_agent      TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON audit_log (user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
--  TRIGGERS — auto-update updated_at
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'users','email_accounts','contacts','projects','tasks',
      'files','events'
    ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',
      t, t
    );
  END LOOP;
END $$;
