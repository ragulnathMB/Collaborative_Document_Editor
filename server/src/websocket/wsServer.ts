import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import url from "url";
import { handleConnection, registerBroadcaster } from "./wsHandlers";

interface RoomEntry {
  ws: WebSocket;
  documentId: string;
}

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Set<RoomEntry>();

  // Every connected client is tracked here so we can fan out operation
  // and presence broadcasts to everyone else viewing the same document.
  // In a multi-instance deployment this Set would be replaced by a
  // Redis pub/sub channel keyed by documentId (see Phase: Scaling).
  registerBroadcaster((self, documentId, data) => {
    for (const entry of clients) {
      if (entry.ws !== self && entry.documentId === documentId && entry.ws.readyState === WebSocket.OPEN) {
        entry.ws.send(data);
      }
    }
  });

  wss.on("connection", (ws, req) => {
    const { query } = url.parse(req.url ?? "", true);
    const token = String(query.token ?? "");
    const name = String(query.name ?? "Anonymous");

    const entry: RoomEntry = { ws, documentId: "" };
    clients.add(entry);

    // Patch documentId onto the shared entry once the client sends "join".
    ws.on("message", (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed.type === "join") {
          entry.documentId = parsed.documentId;
        }
      } catch {
        /* handled downstream in wsHandlers */
      }
    });

    ws.on("close", () => clients.delete(entry));

    handleConnection(ws, token, name);
  });

  return wss;
}
