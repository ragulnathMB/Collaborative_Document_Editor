import * as repo from "./document.repository";
import { assertMember, listWorkspaceMemberIds } from "../workspace/workspace.service";

export class DocumentAccessError extends Error {}

export type Role = "OWNER" | "EDITOR" | "VIEWER";

const ROLE_RANK: Record<Role, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export async function assertAccess(
  documentId: string,
  userId: string,
  minRole: Role
) {
  const permission = await repo.getPermission(documentId, userId);
  if (!permission || ROLE_RANK[permission.role as Role] < ROLE_RANK[minRole]) {
    throw new DocumentAccessError("Insufficient permissions");
  }
  return permission;
}

export async function createNewDocument(
  workspaceId: string,
  ownerId: string,
  title: string
) {
  // A user must belong to the workspace before creating a document in it —
  // assertMember throws WorkspaceAccessError otherwise, which propagates
  // to the controller same as a DocumentAccessError would.
  await assertMember(workspaceId, ownerId);
  const memberIds = await listWorkspaceMemberIds(workspaceId);
  return repo.createDocument(workspaceId, ownerId, title, memberIds);
}

export async function getDocumentForUser(documentId: string, userId: string) {
  await assertAccess(documentId, userId, "VIEWER");
  const doc = await repo.findDocumentById(documentId);
  if (!doc) throw new DocumentAccessError("Document not found");
  return doc;
}

export async function listUserDocuments(userId: string) {
  return repo.listDocumentsForUser(userId);
}

export async function shareDocument(
  documentId: string,
  requesterId: string,
  targetUserId: string,
  role: "EDITOR" | "VIEWER"
) {
  await assertAccess(documentId, requesterId, "OWNER");
  return repo.addPermission(documentId, targetUserId, role);
}

// Called by the collaboration layer after OT operations are applied in-memory.
// Persists authoritative state + periodic snapshot for recovery.
export async function persistDocumentState(
  documentId: string,
  content: string,
  version: number
) {
  const updated = await repo.updateDocumentContent(documentId, content, version);
  if (version % 20 === 0) {
    await repo.createSnapshot(documentId, content, version);
  }
  return updated;
}

export async function getSnapshotHistory(documentId: string, userId: string) {
  await assertAccess(documentId, userId, "VIEWER");
  return repo.listSnapshots(documentId);
}
