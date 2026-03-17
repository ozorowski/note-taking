ALTER TABLE interviews ADD COLUMN IF NOT EXISTS display_number INTEGER;

UPDATE interviews SET display_number = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) AS rn
  FROM interviews
) sub
WHERE interviews.id = sub.id AND interviews.display_number IS NULL;
