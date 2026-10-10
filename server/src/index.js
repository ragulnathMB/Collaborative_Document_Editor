import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { migrate } from './db.js';
import authRoutes from './routes/auth.js';
import docRoutes from './routes/documents.js';
import { attachCollab } from './collab.js';

const PORT = Number(process.env.PORT) || 4000;
const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/documents', docRoutes);

// Optional: serve the built client (set STATIC_DIR to an absolute path)
if (process.env.STATIC_DIR) {
  app.use(express.static(process.env.STATIC_DIR));
  app.get('*', (_req, res) => res.sendFile(path.join(process.env.STATIC_DIR, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[http]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);
attachCollab(server);

await migrate();
server.listen(PORT, () => console.log(`[server] http+ws listening on :${PORT}`));
