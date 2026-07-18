import { prisma } from "../db/prismaClient";

export async function createWorkspace(name: string, ownerId: string) {
  return prisma.workspace.create({
    data: {
      name,
      ownerId,
      members: {
        create: { userId: ownerId, role: "OWNER" },
      },
    },
  });
}

export async function listWorkspacesForUser(userId: string) {
  return prisma.workspace.findMany({
    where: { members: { some: { userId } } },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getWorkspaceById(workspaceId: string) {
  return prisma.workspace.findUnique({ where: { id: workspaceId } });
}

export async function getMembership(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

export async function listMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function listMemberUserIds(workspaceId: string) {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    select: { userId: true },
  });
  return members.map((m: { userId: string }) => m.userId);
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function addMember(workspaceId: string, userId: string) {
  return prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    update: {},
    create: { workspaceId, userId, role: "MEMBER" },
  });
}
