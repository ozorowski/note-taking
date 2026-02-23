-- Magic link tokens for passwordless email auth
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS magic_link_tokens_token_idx ON magic_link_tokens (token);

-- Shareable project invite links
CREATE TABLE IF NOT EXISTS project_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  role TEXT NOT NULL DEFAULT 'editor',
  created_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ,
  used_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flag guests vs real accounts
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT TRUE;

-- Partial unique index: real emails must be unique; guests (NULL email) are unconstrained
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email) WHERE is_guest = FALSE;
