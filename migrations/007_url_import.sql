-- Add URL import source tracking to notes
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'interview'
    CHECK (source_type IN ('interview', 'url_import')),
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_author TEXT;

CREATE INDEX IF NOT EXISTS idx_notes_source_type ON notes(source_type);
