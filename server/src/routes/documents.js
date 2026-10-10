import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, wrap } from '../auth.js';
import { getAccess } from '../access.js';
import { closeDoc, disconnectUser } from '../collab.js';

const router = Router();
router.use(requireAuth);

const cleanTitle = (t) => String(t ?? '').trim().slice(0, 200) || 'Untitled document';

// List documents the user owns or has been shared
router.get(
  '/',
  wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.updated_at, d.created_at, u.name AS owner_name,
              CASE WHEN d.owner_id = $1 THEN 'owner' ELSE m.role END AS role
         FROM documents d
         JOIN users u ON u.id = d.owner_id
         LEFT JOIN document_members m ON m.document_id = d.id AND m.user_id = $1
        WHERE d.owner_id = $1 OR m.user_id IS NOT NULL
        ORDER BY d.updated_at DESC`,
      [req.user.id]
    );
    res.json({ documents: rows });
  })
);

router.post(
  '/',
  wrap(async (req, res) => {
    const { rows } = await pool.query(
      'INSERT INTO documents(title, owner_id) VALUES($1,$2) RETURNING id, title, created_at, updated_at',
      [cleanTitle(req.body?.title), req.user.id]
    );
    res.status(201).json({ document: { ...rows[0], role: 'owner' } });
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    const doc = await getAccess(req.params.id, req.user.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    let members = [];
    if (doc.role === 'owner') {
      const r = await pool.query(
        `SELECT u.id, u.name, u.email, m.role FROM document_members m
           JOIN users u ON u.id = m.user_id WHERE m.document_id = $1 ORDER BY u.name`,
        [doc.id]
      );
      members = r.rows;
    }
    res.json({ document: doc, members });
  })
);

router.patch(
  '/:id',
  wrap(async (req, res) => {
    const doc = await getAccess(req.params.id, req.user.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.role === 'viewer') return res.status(403).json({ error: 'Read-only access' });
    const { rows } = await pool.query(
      'UPDATE documents SET title=$2, updated_at=now() WHERE id=$1 RETURNING id, title',
      [doc.id, cleanTitle(req.body?.title)]
    );
    res.json({ document: rows[0] });
  })
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    const doc = await getAccess(req.params.id, req.user.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.role !== 'owner') return res.status(403).json({ error: 'Only the owner can delete' });
    closeDoc(doc.id);
    await pool.query('DELETE FROM documents WHERE id=$1', [doc.id]);
    res.status(204).end();
  })
);

// ---- Sharing (owner only) ----
router.post(
  '/:id/members',
  wrap(async (req, res) => {
    const doc = await getAccess(req.params.id, req.user.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.role !== 'owner') return res.status(403).json({ error: 'Only the owner can share' });

    const email = String(req.body?.email || '').toLowerCase().trim();
    const role = req.body?.role === 'viewer' ? 'viewer' : 'editor';
    const { rows } = await pool.query('SELECT id, name, email FROM users WHERE email=$1', [email]);
    const target = rows[0];
    if (!target) return res.status(404).json({ error: 'No user with that email' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'You already own this document' });

    await pool.query(
      `INSERT INTO document_members(document_id, user_id, role) VALUES($1,$2,$3)
       ON CONFLICT (document_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [doc.id, target.id, role]
    );
    disconnectUser(doc.id, target.id, 4001, 'Permissions changed');
    res.status(201).json({ member: { ...target, role } });
  })
);

router.delete(
  '/:id/members/:userId',
  wrap(async (req, res) => {
    const doc = await getAccess(req.params.id, req.user.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.role !== 'owner') return res.status(403).json({ error: 'Only the owner can unshare' });
    const uid = Number(req.params.userId);
    await pool.query('DELETE FROM document_members WHERE document_id=$1 AND user_id=$2', [doc.id, uid]);
    disconnectUser(doc.id, uid, 4403, 'Access revoked');
    res.status(204).end();
  })
);

export default router;
