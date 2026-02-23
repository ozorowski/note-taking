-- Research Summary Report: store AI-generated executive summary on projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS executive_summary TEXT,
  ADD COLUMN IF NOT EXISTS executive_summary_generated_at TIMESTAMPTZ;
