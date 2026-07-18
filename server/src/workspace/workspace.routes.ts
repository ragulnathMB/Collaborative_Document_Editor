import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import {
  createWorkspace,
  listWorkspaces,
  listMembers,
  inviteMember,
} from "./workspace.controller";

const router = Router();

router.use(requireAuth);

router.post("/", createWorkspace);
router.get("/", listWorkspaces);
router.get("/:id/members", listMembers);
router.post("/:id/invite", inviteMember);

export default router;
