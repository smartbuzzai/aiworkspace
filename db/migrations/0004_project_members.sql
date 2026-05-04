-- Migration 0004: Team member sharing for projects
-- Allows multiple workspace users to collaborate on the same project.

CREATE TABLE project_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'editor',   -- owner | editor | viewer
  added_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX ON project_members (project_id);
CREATE INDEX ON project_members (user_id);
