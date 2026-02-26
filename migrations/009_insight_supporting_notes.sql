-- Store the specific note IDs the AI cited when generating an insight.
-- TEXT[] rather than UUID[] so invalid IDs don't cause insert errors.
ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS supporting_note_ids TEXT[];
