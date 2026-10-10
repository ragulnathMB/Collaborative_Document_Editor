import pg from 'pg';

export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://collab:collab@localhost:5432/collab',
  max: 10,
});

pool.on('error', (err) => console.error('[pg] idle client error', err));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL DEFAULT 'Untitled document',
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_owner_idx ON documents(owner_id);

CREATE TABLE IF NOT EXISTS document_members (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  PRIMARY KEY (document_id, user_id)
);
CREATE INDEX IF NOT EXISTS document_members_user_idx ON document_members(user_id);

-- Append-only log of Yjs (CRDT) updates; periodically compacted into one row.
CREATE TABLE IF NOT EXISTS document_updates (
  id          BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  update      BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS document_updates_doc_idx ON document_updates(document_id, id);
`;

export async function migrate() {
  await pool.query(SCHEMA);
  console.log('[db] schema ready');
}
