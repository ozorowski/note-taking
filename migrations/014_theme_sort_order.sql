ALTER TABLE themes ADD COLUMN IF NOT EXISTS sort_order INTEGER;

UPDATE themes SET sort_order = sub.rn FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) AS rn FROM themes
) sub WHERE themes.id = sub.id;
