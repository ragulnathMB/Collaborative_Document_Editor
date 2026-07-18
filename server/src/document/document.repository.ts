import { prisma } from "../db/prismaClient";

export async function createDocument(
  workspaceId: string,
  ownerId: string,
  title: string
) {
  return prisma.document.create({
    data: {
      workspaceId,
      ownerId,
      title,
      content: "",
      version: 0,
      permissions: {
        create: { userId: ownerId, role: "OWNER" },
      },
    },
  });
}

export async function findDocumentById(documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId },
    include: { permissions: true },
  });
}

export async function listDocumentsForUser(userId: string) {
  return prisma.document.findMany({
    where: { permissions: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function updateDocumentContent(
  documentId: string,
  content: string,
  version: number
) {
  return prisma.document.update({
    where: { id: documentId },
    data: { content, version },
  });
}

export async function getPermission(documentId: string, userId: string) {
  return prisma.documentPermission.findUnique({
    where: { documentId_userId: { documentId, userId } },
  });
}

export async function addPermission(
  documentId: string,
  userId: string,
  role: "EDITOR" | "VIEWER"
) {
  return prisma.documentPermission.upsert({
    where: { documentId_userId: { documentId, userId } },
    update: { role },
    create: { documentId, userId, role },
  });
}

export async function createSnapshot(
  documentId: string,
  content: string,
  version: number
) {
  return prisma.documentSnapshot.create({
    data: { documentId, content, version },
  });
}

export async function listSnapshots(documentId: string) {
  return prisma.documentSnapshot.findMany({
    where: { documentId },
    orderBy: { version: "desc" },
    take: 50,
  });
}
