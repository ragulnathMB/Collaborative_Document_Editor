import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { signToken, requireAuth, wrap } from '../auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post(
  '/register',
  wrap(async (req, res) => {
    const { email, name, password } = req.body || {};
    if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'Valid email required' });
    if (!name || name.trim().length < 1 || name.length > 60)
      return res.status(400).json({ error: 'Name required (max 60 chars)' });
    if (!password || password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const hash = await bcrypt.hash(password, 10);
    try {
      const { rows } = await pool.query(
        'INSERT INTO users(email, name, password_hash) VALUES($1,$2,$3) RETURNING id, email, name',
        [email.toLowerCase().trim(), name.trim(), hash]
      );
      res.status(201).json({ user: rows[0], token: signToken(rows[0]) });
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
      throw e;
    }
  })
);

router.post(
  '/login',
  wrap(async (req, res) => {
    const { email, password } = req.body || {};
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [
      String(email || '').toLowerCase().trim(),
    ]);
    const u = rows[0];
    if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash)))
      return res.status(401).json({ error: 'Invalid email or password' });
    const user = { id: u.id, email: u.email, name: u.name };
    res.json({ user, token: signToken(user) });
  })
);

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
