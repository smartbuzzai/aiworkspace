-- Migration 0005: Add project_id to files so files can be linked to projects
ALTER TABLE files ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS files_project_id_idx ON files (project_id);

-- Allow portal_reader to see the project_id column (already has SELECT on files)
