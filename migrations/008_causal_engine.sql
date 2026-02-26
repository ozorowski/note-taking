-- Add root_cause and IQS score to insights for the Causal Discipline Engine
ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS root_cause TEXT,
  ADD COLUMN IF NOT EXISTS iqs_score  SMALLINT;
