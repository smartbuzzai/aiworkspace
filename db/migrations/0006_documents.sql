CREATE TABLE IF NOT EXISTS documents (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  UUID        REFERENCES projects(id) ON DELETE SET NULL,
  title       TEXT        NOT NULL DEFAULT 'Untitled',
  content     JSONB       NOT NULL DEFAULT '{}',
  content_html TEXT       NOT NULL DEFAULT '',
  is_archived BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents (user_id);
CREATE INDEX IF NOT EXISTS documents_project_id_idx ON documents (project_id);
