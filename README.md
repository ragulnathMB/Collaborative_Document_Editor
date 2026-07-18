# Collaborative Document Editor

A real-time collaborative text editor built from scratch, implementing a
server-authoritative Operational Transformation (OT) engine — the same
class of algorithm behind Google Docs' original synchronization model.

This project was built to deeply understand distributed systems concepts
(conflict resolution, consistency, presence) rather than to depend on a
managed real-time backend (Firebase/Supabase) or an off-the-shelf CRDT
library. The synchronization logic — transform, apply, session management —
is fully hand-written.

## Features

- JWT-based authentication with access + refresh token rotation
- Workspace-scoped documents with OWNER / EDITOR / VIEWER permissions
- Real-time collaborative editing over WebSockets
- Custom Operational Transformation engine (retain/insert/delete model)
- Live cursor presence with per-user colors
- Optimistic local edits with pending/queued operation buffering
- Debounced autosave with periodic version snapshots for history/recovery
- Reconnect logic with exponential backoff

## Architecture
Browser A                          Browser B
|                                  |
|  WebSocket (/ws)                 |  WebSocket (/ws)
v                                  v
Collaboration Server (Node.js)
+------------------------------------+
|  wsServer -> wsHandlers             |
|  SessionManager -> DocumentSession   |
|  OT engine (transform/apply)          |
|  PresenceManager                      |
+------------------------------------+
|                  |
v                  v
PostgreSQL          (in-memory
(Prisma: users,        session state,
documents,            evicted after
permissions,          30s idle)
snapshots)

**How a keystroke flows:**
1. Client generates an `Operation` (diff of old vs new text) tagged with its
   `baseVersion` (last version it has seen).
2. Server's `DocumentSession` transforms the incoming op against any ops
   applied concurrently since that `baseVersion`, guaranteeing convergence.
3. Transformed op is applied to the authoritative in-memory copy, version
   incremented, and broadcast to every other connected client in that
   document's room.
4. Originating client gets an `ack`; other clients get the transformed
   `operation` message and apply it locally.
5. Content + version are persisted to Postgres on a 2s debounce, with a
   snapshot row written every 20 versions for recovery/history.

## Tech Stack

**Client:** React, TypeScript, Redux Toolkit, React Router, TailwindCSS, Vite
**Server:** Node.js, TypeScript, Express, `ws` (WebSocket), Prisma, PostgreSQL
**Auth:** JWT (access + refresh tokens), bcrypt password hashing

Deliberately excluded: Redis (single-instance session manager for now — the
`SessionManager`/`broadcastToRoom` seam is where Redis pub/sub would plug in
for horizontal scaling), Lexical/ProseMirror (flat-text `<textarea>` keeps
focus on OT mechanics rather than rich-text DOM complexity), Firebase/Supabase
(the whole point was implementing sync ourselves).

## Project Structure
collab-editor/
├── client/    # React + Redux Toolkit frontend
├── server/    # Express + WebSocket + Prisma backend
├── shared/    # Types shared conceptually between client/server
└── docker-compose.yml

See in-code comments in `server/src/collaboration/` and
`client/src/features/editor/ot.ts` for the OT algorithm details.

## Setup

### 1. Start PostgreSQL
```bash
docker-compose up -d
```

### 2. Server
```bash
cd server
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run dev
```
Server runs on `http://localhost:4000`.

### 3. Client
```bash
cd client
npm install
npm run dev
```
Client runs on `http://localhost:5173`.

### 4. Create a workspace

Register/sign in, then visit `/workspaces` (the default landing page after
login). Create a workspace from there — you're added as its `OWNER`
automatically — then open it to start creating documents. As the owner you
can invite other registered users into the workspace by email from the same
page; invited users get `MEMBER` access and can create/edit documents inside
it once they sign in.

## Features (workspace UI)

- `POST /api/workspaces` / `GET /api/workspaces` — create and list the
  current user's workspaces (`server/src/workspace/`)
- `GET /api/workspaces/:id/members` / `POST /api/workspaces/:id/invite` —
  list members and invite an existing user by email (owner-only)
- Document creation now checks workspace membership server-side
  (`assertMember` in `workspace.service.ts`) instead of trusting any
  `workspaceId` sent by the client
- Client: `/workspaces` (list + create + invite) and
  `/workspaces/:workspaceId/documents` (documents scoped to that workspace)

## Known Gaps / Next Steps

- No workspace deletion, renaming, or member removal yet — only
  create/list/invite are implemented.
- Single-instance only: `SessionManager` and the client broadcast set live
  in one process's memory. Scaling to multiple server instances requires
  replacing the in-memory `Set<RoomEntry>` broadcast in `wsServer.ts` with
  Redis pub/sub keyed by `documentId`.
- `diffToOperation` uses a common-prefix/suffix diff, which is correct for
  typed/pasted edits but not a full Myers diff — fine for a `<textarea>`,
  would need revisiting for a rich-text tree editor.
- No automated test suite yet (Vitest/Supertest/Playwright were scoped in
  planning but not implemented in this pass).

## License

MIT — educational project, not a commercial product.
