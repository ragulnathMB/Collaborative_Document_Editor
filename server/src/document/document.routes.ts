import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import {
  createDocument,
  getDocument,
  listDocuments,
  shareDocument,
  getHistory,
} from "./document.controller";

const router = Router();

router.use(requireAuth);

router.post("/", createDocument);
router.get("/", listDocuments);
router.get("/:id", getDocument);
router.post("/:id/share", shareDocument);
router.get("/:id/history", getHistory);

export default router;
