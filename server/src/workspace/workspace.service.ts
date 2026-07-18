import * as repo from "./workspace.repository";

export class WorkspaceAccessError extends Error {}
export class WorkspaceNotFoundError extends Error {}

export async function createNewWorkspace(name: string, ownerId: string) {
  const workspace = await repo.createWorkspace(name, ownerId);
  return toDTO(workspace, "OWNER", 1);
}

export async function listUserWorkspaces(userId: string) {
  const workspaces = await repo.listWorkspacesForUser(userId);
  return workspaces.map((w: (typeof workspaces)[number]) =>
    toDTO(w, w.ownerId === userId ? "OWNER" : "MEMBER", w._count.members)
  );
}

// Any route that creates or reads resources scoped to a workspace should
// call this first so non-members can't act on workspaces they don't belong to.
export async function assertMember(workspaceId: string, userId: string) {
  const membership = await repo.getMembership(workspaceId, userId);
  if (!membership) {
    throw new WorkspaceAccessError("Not a member of this workspace");
  }
  return membership;
}

export async function listWorkspaceMemberIds(workspaceId: string) {
  return repo.listMemberUserIds(workspaceId);
}

export async function listWorkspaceMembers(workspaceId: string, userId: string) {
  await assertMember(workspaceId, userId);
  const members = await repo.listMembers(workspaceId);
  return members.map((m: (typeof members)[number]) => ({
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    role: m.role,
  }));
}

export async function inviteMember(
  workspaceId: string,
  requesterId: string,
  targetEmail: string
) {
  const requesterMembership = await repo.getMembership(workspaceId, requesterId);
  if (!requesterMembership || requesterMembership.role !== "OWNER") {
    throw new WorkspaceAccessError("Only the workspace owner can invite members");
  }

  const targetUser = await repo.findUserByEmail(targetEmail);
  if (!targetUser) {
    throw new WorkspaceNotFoundError("No user found with that email");
  }

  await repo.addMember(workspaceId, targetUser.id);
  return { userId: targetUser.id, email: targetUser.email, name: targetUser.name, role: "MEMBER" as const };
}

function toDTO(
  workspace: { id: string; name: string; ownerId: string; createdAt: Date },
  role: "OWNER" | "MEMBER",
  memberCount: number
) {
  return {
    id: workspace.id,
    name: workspace.name,
    ownerId: workspace.ownerId,
    role,
    memberCount,
    createdAt: workspace.createdAt.toISOString(),
  };
}
