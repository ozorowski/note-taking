-- Optional structured discussion guide for interview-mode projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS has_guide BOOLEAN NOT NULL DEFAULT FALSE;

-- One set of questions per project (shared across all interviews)
CREATE TABLE IF NOT EXISTS guide_questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  stage_label  VARCHAR(100),              -- optional grouping, e.g. "Warm-up"
  order_index  SMALLINT NOT NULL DEFAULT 0,
  is_catch_all BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE for the auto-seeded "Other observation"
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_questions_project ON guide_questions(project_id);

-- Notes can optionally be assigned to a guide question
-- ON DELETE SET NULL: deleting a question orphans its notes (note survives, badge disappears)
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS guide_question_id UUID REFERENCES guide_questions(id) ON DELETE SET NULL;
