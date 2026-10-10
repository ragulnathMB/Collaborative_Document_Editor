# CollabDocs

Real-time collaborative document editing built with React, Quill, Yjs, and a Node.js backend.

A lightweight, CRDT-powered editor that lets multiple users collaborate on the same document with shared presence, role-based permissions, and automatic sync.

## Tech stack

- Frontend: React + Vite
- Editor: Quill + Yjs + `y-quill`
- Backend: Node.js + Express
- Real-time sync: WebSockets (`ws`)
- Database: PostgreSQL
- Auth: JWT + bcrypt

## Highlights

- Real-time multi-user rich-text editing with CRDT convergence
- Live cursors and presence avatars
- User accounts and secure authentication
- Document ownership, sharing, and role-based access control
- Editor / viewer permissions enforced on the server
- Offline edit sync after reconnect
- Persistent document updates in PostgreSQL
- Automatic websocket reconnection with backoff

## Project structure

```text
client/    Frontend React app
server/    Express API and WebSocket collaboration server
```

## Quick start

### 1) Start PostgreSQL

```bash
docker compose up -d
```

> If you are using your own PostgreSQL instance, update the connection variables in `server/.env` accordingly.

### 2) Start the backend

```bash
cd server
npm install
cp .env.example .env     # skip if .env already exists
npm run dev
```

The server runs on `http://localhost:4000` and also sets up the WebSocket collaboration layer.

### 3) Start the frontend

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` in the browser.

## Typical workflow

1. Open two browser windows or one incognito tab, and create two accounts.
2. Sign in with each user.
3. Share a document with the other user by email.
4. Collaborate in real time and verify live presence and sync behavior.

## Smoke test

Verify the backend end-to-end while the server is running:

```bash
cd server && npm run smoke
```

## Production build

```bash
cd client && npm run build
```

Then configure the server runtime values in `server/.env`:

```env
STATIC_DIR=/absolute/path/to/client/dist
JWT_SECRET=<long-random-secret>
```

Start the production server:

```bash
cd server && npm start
```

## Architecture overview

```text
Browser (React + Quill + Y.Doc)
        |-- ws /ws?doc&token --> Node.js server
        |-- REST /api --> auth, documents, sharing
                                |
                                v
                          PostgreSQL

Users, documents, document_members, document_updates
```

Key implementation areas:

- `server/src/collab.js` — room lifecycle, sync protocol, awareness, role enforcement, persistence, compaction
- `client/src/provider.js` — WebSocket provider with reconnect and presence logic
- `client/src/pages/Editor.jsx` — Quill + Yjs binding and collaboration UI

## Future ideas

- Version history and document snapshots
- Comments and mentions
- Redis pub/sub for multi-instance scaling
- Image uploads
- Export to PDF or Markdown



