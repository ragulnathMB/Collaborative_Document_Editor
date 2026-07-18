import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../auth/auth.middleware";
import * as docService from "./document.service";
import { DocumentAccessError } from "./document.service";
import { WorkspaceAccessError } from "../workspace/workspace.service";

const createSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().min(1),
});

const shareSchema = z.object({
  targetUserId: z.string().uuid(),
  role: z.enum(["EDITOR", "VIEWER"]),
});

export async function createDocument(req: AuthenticatedRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const doc = await docService.createNewDocument(
      parsed.data.workspaceId,
      req.user!.userId,
      parsed.data.title
    );
    return res.status(201).json(doc);
  } catch (err) {
    if (err instanceof WorkspaceAccessError) {
      return res.status(403).json({ error: err.message });
    }
    throw err;
  }
}

export async function getDocument(req: AuthenticatedRequest, res: Response) {
  try {
    const doc = await docService.getDocumentForUser(req.params.id, req.user!.userId);
    return res.status(200).json(doc);
  } catch (err) {
    if (err instanceof DocumentAccessError) {
      return res.status(403).json({ error: err.message });
    }
    throw err;
  }
}

export async function listDocuments(req: AuthenticatedRequest, res: Response) {
  const docs = await docService.listUserDocuments(req.user!.userId);
  return res.status(200).json(docs);
}

export async function shareDocument(req: AuthenticatedRequest, res: Response) {
  const parsed = shareSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const permission = await docService.shareDocument(
      req.params.id,
      req.user!.userId,
      parsed.data.targetUserId,
      parsed.data.role
    );
    return res.status(200).json(permission);
  } catch (err) {
    if (err instanceof DocumentAccessError) {
      return res.status(403).json({ error: err.message });
    }
    throw err;
  }
}

export async function getHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const snapshots = await docService.getSnapshotHistory(req.params.id, req.user!.userId);
    return res.status(200).json(snapshots);
  } catch (err) {
    if (err instanceof DocumentAccessError) {
      return res.status(403).json({ error: err.message });
    }
    throw err;
  }
}
