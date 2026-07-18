# Collaborative Document Editor

A real-time collaborative text editor built from scratch, implementing a **server-authoritative Operational Transformation (OT) engine**—the same class of synchronization algorithm behind the original Google Docs collaborative editing model.

This project was built to gain a deep understanding of distributed systems concepts such as **conflict resolution, consistency, synchronization, versioning, and user presence**, rather than relying on managed real-time backends (Firebase/Supabase) or third-party CRDT libraries.

The complete synchronization pipeline—including **operation transformation, conflict resolution, session management, buffering, acknowledgements, and persistence**—is implemented from scratch.

---

## Features

### Authentication

- JWT-based authentication
- Access & Refresh token authentication
- Refresh token rotation
- Secure password hashing with bcrypt

### Workspaces & Permissions

- Workspace-based document organization
- OWNER / EDITOR / VIEWER role-based permissions
- Invite members via email
- Server-side authorization checks

### Real-Time Collaboration

- Real-time collaborative editing over WebSockets
- Custom Operational Transformation (OT) engine
- Optimistic local editing
- Pending and queued operation buffering
- Acknowledgement-based synchronization
- Automatic conflict resolution
- Live cursor presence with per-user colors

### Reliability

- Automatic reconnect with exponential backoff
- Debounced autosave
- Periodic version snapshots
- Crash recovery through persisted snapshots

---

## Architecture

```text
                 Browser A                     Browser B
                     │                             │
             WebSocket (/ws)              WebSocket (/ws)
                     │                             │
                     └──────────────┬──────────────┘
                                    │
                                    ▼
                  ┌─────────────────────────────────┐
                  │     Collaboration Server         │
                  │            (Node.js)             │
                  │                                 │
                  │  • WebSocket Server             │
                  │  • Session Manager              │
                  │  • Operational Transformation   │
                  │  • Presence Manager             │
                  └───────────────┬─────────────────┘
                                  │
               ┌──────────────────┴──────────────────┐
               │                                     │
               ▼                                     ▼
        PostgreSQL                        In-memory Session State
        (Prisma ORM)                      Active Documents
                                          Connected Clients
                                          Pending Operations
                                          Idle Session Eviction
```

The collaboration server maintains the **authoritative document state**, performs Operational Transformation, broadcasts updates, manages presence, and periodically persists document data to PostgreSQL.

---

## Synchronization Flow

When a user types:

1. The client generates an **Operation** (retain / insert / delete) representing the edit.
2. The operation is tagged with the client's current `baseVersion`.
3. The server receives the operation and transforms it against any operations applied since that version.
4. The transformed operation is applied to the authoritative in-memory document.
5. The document version is incremented.
6. The server:
   - broadcasts the transformed operation to all other connected clients.
   - sends an acknowledgement to the originating client.
7. All clients converge to the same document state.
8. The updated document is persisted to PostgreSQL after a **2-second debounce**, with a snapshot written every **20 versions**.

---

## Tech Stack

### Frontend

- React
- TypeScript
- Redux Toolkit
- React Router
- Tailwind CSS
- Vite

### Backend

- Node.js
- Express
- TypeScript
- WebSocket (`ws`)
- Prisma ORM
- PostgreSQL

### Authentication

- JWT
- Refresh Tokens
- bcrypt

---

## Design Decisions

This project intentionally avoids several common technologies to focus on implementing the synchronization layer from first principles.

### Redis

Not used.

The application currently runs as a single server instance. The abstraction between `SessionManager` and `broadcastToRoom()` is intentionally designed so Redis Pub/Sub can later be introduced for horizontal scaling.

### Firebase / Supabase

Not used.

The goal of this project is to build the synchronization layer manually instead of relying on managed real-time infrastructure.

### CRDT Libraries

Not used.

The Operational Transformation engine—including transformation, application, acknowledgements, buffering, and conflict resolution—is fully hand-written.

### Rich Text Editors

Libraries such as Lexical and ProseMirror are intentionally excluded.

Using a simple `<textarea>` keeps the focus on synchronization algorithms rather than rich-text DOM manipulation.

---

## Project Structure

```text
collab-editor/
├── client/                  # React frontend
├── server/                  # Express + WebSocket backend
├── shared/                  # Shared types/interfaces
└── docker-compose.yml
```

Core synchronization logic:

```text
server/src/collaboration/
client/src/features/editor/ot.ts
```

---

## Getting Started

### 1. Start PostgreSQL

```bash
docker-compose up -d
```

### 2. Start the Server

```bash
cd server

npm install

cp .env.example .env

npx prisma migrate dev --name init

npm run dev
```

Server runs at:

```text
http://localhost:4000
```

### 3. Start the Client

```bash
cd client

npm install

npm run dev
```

Client runs at:

```text
http://localhost:5173
```

---

## Creating a Workspace

1. Register an account.
2. Sign in.
3. Navigate to `/workspaces`.
4. Create a workspace.
5. You are automatically assigned the **OWNER** role.
6. Invite registered users by email.
7. Members can create and edit documents according to their assigned permissions.

---

## API Overview

### Workspaces

```http
POST /api/workspaces
GET  /api/workspaces
```

Create and list workspaces.

### Members

```http
GET  /api/workspaces/:id/members
POST /api/workspaces/:id/invite
```

List workspace members and invite registered users.

### Authorization

Document creation and editing are protected by server-side membership validation using `assertMember()` in `workspace.service.ts`, ensuring clients cannot spoof workspace IDs.

---

## Current Limitations

- Workspace rename is not implemented.
- Workspace deletion is not implemented.
- Member removal is not implemented.
- Single-server deployment only.
- Redis Pub/Sub is required for horizontal scaling.
- `diffToOperation()` uses a common prefix/suffix diff rather than the Myers diff algorithm.
- No automated test suite (Vitest, Supertest, Playwright) has been implemented.

---

## Future Improvements

- Redis-based distributed collaboration
- Rich text editing
- Document version history viewer
- Restore previous document versions
- Automated testing
- Improved presence indicators
- Cursor selections
- Inline comments
- Offline editing
- Shareable document links

---

## License

MIT License

This project is intended for educational purposes to demonstrate the implementation of a collaborative editor using a custom Operational Transformation engine. It is not intended for production use without additional scalability, testing, and security enhancements.