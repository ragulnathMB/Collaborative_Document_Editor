import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../auth/auth.middleware";
import * as workspaceService from "./workspace.service";
import { WorkspaceAccessError, WorkspaceNotFoundError } from "./workspace.service";

const createSchema = z.object({
  name: z.string().min(1),
});

const inviteSchema = z.object({
  email: z.string().email(),
});

export async function createWorkspace(req: AuthenticatedRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const workspace = await workspaceService.createNewWorkspace(parsed.data.name, req.user!.userId);
  return res.status(201).json(workspace);
}

export async function listWorkspaces(req: AuthenticatedRequest, res: Response) {
  const workspaces = await workspaceService.listUserWorkspaces(req.user!.userId);
  return res.status(200).json(workspaces);
}

export async function listMembers(req: AuthenticatedRequest, res: Response) {
  try {
    const members = await workspaceService.listWorkspaceMembers(req.params.id, req.user!.userId);
    return res.status(200).json(members);
  } catch (err) {
    if (err instanceof WorkspaceAccessError) {
      return res.status(403).json({ error: err.message });
    }
    throw err;
  }
}

export async function inviteMember(req: AuthenticatedRequest, res: Response) {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const member = await workspaceService.inviteMember(
      req.params.id,
      req.user!.userId,
      parsed.data.email
    );
    return res.status(200).json(member);
  } catch (err) {
    if (err instanceof WorkspaceAccessError) {
      return res.status(403).json({ error: err.message });
    }
    if (err instanceof WorkspaceNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    throw err;
  }
}
