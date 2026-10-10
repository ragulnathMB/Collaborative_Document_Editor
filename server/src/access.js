import { pool } from './db.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s) => typeof s === 'string' && UUID_RE.test(s);

/** Returns { id, title, owner_id, role: 'owner'|'editor'|'viewer' } or null. */
export async function getAccess(docId, userId) {
  if (!isUuid(docId)) return null;
  const { rows } = await pool.query(
    `SELECT d.id, d.title, d.owner_id, d.updated_at,
            CASE WHEN d.owner_id = $2 THEN 'owner' ELSE m.role END AS role
       FROM documents d
       LEFT JOIN document_members m ON m.document_id = d.id AND m.user_id = $2
      WHERE d.id = $1 AND (d.owner_id = $2 OR m.user_id IS NOT NULL)`,
    [docId, userId]
  );
  return rows[0] || null;
}
