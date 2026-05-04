ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS documents_folder_id_idx ON documents (folder_id);
