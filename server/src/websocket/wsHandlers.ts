import { WebSocket } from "ws";
import { sessionManager } from "../collaboration/sessionManager";
import { presenceManager, PresenceInfo } from "../presence/presenceManager";
import { verifyAccessToken } from "../auth/auth.service";
import { assertAccess } from "../document/document.service";
import { Operation } from "../collaboration/operation.types";
import { logger } from "../utils/logger";
import crypto from "crypto";

interface ClientContext {
  ws: WebSocket;
  userId: string;
  name: string;
  clientId: string;
  documentId: string | null;
}

const CURSOR_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f39c12", "#1abc9c"];

export async function handleConnection(ws: WebSocket, token: string, name: string) {
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
    ws.close();
    return;
  }

  const ctx: ClientContext = {
    ws,
    userId: payload.userId,
    name,
    clientId: crypto.randomUUID(),
    documentId: null,
  };

  ws.on("message", (raw) => handleMessage(ctx, raw.toString()));
  ws.on("close", () => handleClose(ctx));
}

async function handleMessage(ctx: ClientContext, raw: string) {
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return sendError(ctx.ws, "Invalid message format");
  }

  switch (msg.type) {
    case "join":
      return handleJoin(ctx, msg.documentId);
    case "operation":
      return handleOperation(ctx, msg.operation as Operation);
    case "cursor":
      return handleCursor(ctx, msg.cursor as number);
    case "heartbeat":
      return handleHeartbeat(ctx);
    default:
      return sendError(ctx.ws, `Unknown message type: ${msg.type}`);
  }
}

async function handleJoin(ctx: ClientContext, documentId: string) {
  try {
    await assertAccess(documentId, ctx.userId, "VIEWER");
  } catch {
    return sendError(ctx.ws, "Access denied to document");
  }

  ctx.documentId = documentId;
  const session = await sessionManager.acquire(documentId);
  const state = session.getState();

  ctx.ws.send(
    JSON.stringify({ type: "sync", content: state.content, version: state.version })
  );

  const presence: PresenceInfo = {
    userId: ctx.userId,
    clientId: ctx.clientId,
    name: ctx.name,
    color: CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)],
    cursor: null,
    lastSeen: Date.now(),
  };
  presenceManager.join(documentId, presence);

  broadcastPresence(ctx.ws, documentId);
}

async function handleOperation(ctx: ClientContext, op: Operation) {
  if (!ctx.documentId) return sendError(ctx.ws, "Not joined to a document");

  try {
    await assertAccess(ctx.documentId, ctx.userId, "EDITOR");
  } catch {
    return sendError(ctx.ws, "Read-only access: cannot edit");
  }

  const session = await sessionManager.acquire(ctx.documentId);
  const { applied, newVersion } = session.receiveOperation(op);

  ctx.ws.send(JSON.stringify({ type: "ack", version: newVersion, clientId: op.clientId }));

  broadcastToRoom(
    ctx.ws,
    ctx.documentId,
    JSON.stringify({ type: "operation", operation: applied, version: newVersion })
  );
}

function handleCursor(ctx: ClientContext, cursor: number) {
  if (!ctx.documentId) return;
  presenceManager.updateCursor(ctx.documentId, ctx.clientId, cursor);
  broadcastPresence(ctx.ws, ctx.documentId);
}

function handleHeartbeat(ctx: ClientContext) {
  if (!ctx.documentId) return;
  presenceManager.updateCursor(
    ctx.documentId,
    ctx.clientId,
    presenceManager.list(ctx.documentId).find((p) => p.clientId === ctx.clientId)?.cursor ?? 0
  );
}

function handleClose(ctx: ClientContext) {
  if (ctx.documentId) {
    presenceManager.leave(ctx.documentId, ctx.clientId);
    sessionManager.release(ctx.documentId);
    broadcastPresence(ctx.ws, ctx.documentId);
  }
  logger.info("Client disconnected", { clientId: ctx.clientId });
}

// Requires access to the full client registry — wired in wsServer.ts via closures.
export let broadcastToRoom: (self: WebSocket, documentId: string, data: string) => void = () => {};
export function registerBroadcaster(fn: typeof broadcastToRoom) {
  broadcastToRoom = fn;
}

function broadcastPresence(self: WebSocket, documentId: string) {
  const list = presenceManager.list(documentId);
  broadcastToRoom(self, documentId, JSON.stringify({ type: "presence", users: list }));
}

function sendError(ws: WebSocket, message: string) {
  ws.send(JSON.stringify({ type: "error", message }));
}
