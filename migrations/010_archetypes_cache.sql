-- Caches AI-generated user archetypes & emerging needs on the project
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS archetypes_data JSONB,
  ADD COLUMN IF NOT EXISTS archetypes_generated_at TIMESTAMPTZ;
