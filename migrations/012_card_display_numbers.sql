ALTER TABLE notes ADD COLUMN IF NOT EXISTS display_number INTEGER;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS display_number INTEGER;
ALTER TABLE insights ADD COLUMN IF NOT EXISTS display_number INTEGER;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS display_number INTEGER;

-- Backfill existing rows: stable sequential numbers per project, ordered by created_at
UPDATE notes SET display_number = sub.rn FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) AS rn FROM notes
) sub WHERE notes.id = sub.id AND notes.display_number IS NULL;

UPDATE themes SET display_number = sub.rn FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) AS rn FROM themes
) sub WHERE themes.id = sub.id AND themes.display_number IS NULL;

UPDATE insights SET display_number = sub.rn FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) AS rn FROM insights
) sub WHERE insights.id = sub.id AND insights.display_number IS NULL;

UPDATE recommendations SET display_number = sub.rn FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) AS rn FROM recommendations
) sub WHERE recommendations.id = sub.id AND recommendations.display_number IS NULL;
