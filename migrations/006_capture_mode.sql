-- Add Capture phase to project phase progression
ALTER TABLE projects DROP CONSTRAINT projects_current_phase_check;
ALTER TABLE projects ADD CONSTRAINT projects_current_phase_check
  CHECK (current_phase IN ('interviews','capture','notes','themes','insights','recommendations','complete'));

-- Add evidence_type and visibility to notes
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS evidence_type VARCHAR(20)
    CHECK (evidence_type IN ('quote','observation','pain_point','need')),
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) DEFAULT 'shared'
    CHECK (visibility IN ('private','shared'));

CREATE INDEX IF NOT EXISTS idx_notes_visibility ON notes(visibility);
CREATE INDEX IF NOT EXISTS idx_notes_created_by_capture ON notes(created_by, visibility);
