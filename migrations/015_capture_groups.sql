CREATE TABLE IF NOT EXISTS capture_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notes ADD COLUMN IF NOT EXISTS capture_group_id UUID
  REFERENCES capture_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notes_capture_group_id ON notes(capture_group_id);
CREATE INDEX IF NOT EXISTS idx_capture_groups_project_id ON capture_groups(project_id);
