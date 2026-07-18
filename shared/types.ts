// Types shared conceptually between client and server (kept duplicated,
// not imported cross-package, to avoid a monorepo build-tooling detour —
// this is a deliberate simplicity trade-off for a single-developer project).

export type OpComponent =
  | { type: "retain"; count: number }
  | { type: "insert"; text: string }
  | { type: "delete"; count: number };

export interface Operation {
  ops: OpComponent[];
  baseVersion: number;
  userId: string;
  clientId: string;
}

export interface PresenceUser {
  userId: string;
  clientId: string;
  name: string;
  color: string;
  cursor: number | null;
  lastSeen: number;
}

export interface DocumentDTO {
  id: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  status: "idle" | "loading" | "authenticated" | "error";
  error: string | null;
}

export interface DocumentsState {
  items: Record<string, DocumentDTO>;
  order: string[];
  status: "idle" | "loading" | "error";
  error: string | null;
}

// A workspace groups documents and members. `role` reflects the
// requesting user's membership role on that workspace.
export interface WorkspaceDTO {
  id: string;
  name: string;
  ownerId: string;
  role: "OWNER" | "MEMBER";
  memberCount: number;
  createdAt: string;
}

export interface WorkspaceMemberDTO {
  userId: string;
  email: string;
  name: string;
  role: "OWNER" | "MEMBER";
}

export interface WorkspacesState {
  items: Record<string, WorkspaceDTO>;
  order: string[];
  status: "idle" | "loading" | "error";
  error: string | null;
}

export interface EditorState {
  documentId: string | null;
  content: string;
  version: number;
  connectionStatus: "disconnected" | "connecting" | "connected";
  pendingOp: Operation | null;
  queuedOps: Operation[];
}

export interface PresenceState {
  usersByDocument: Record<string, PresenceUser[]>;
}

export type ServerMessage =
  | { type: "sync"; content: string; version: number }
  | { type: "ack"; version: number; clientId: string }
  | { type: "operation"; operation: Operation; version: number }
  | { type: "presence"; users: PresenceUser[] }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "join"; documentId: string }
  | { type: "operation"; operation: Operation }
  | { type: "cursor"; cursor: number }
  | { type: "heartbeat" };
