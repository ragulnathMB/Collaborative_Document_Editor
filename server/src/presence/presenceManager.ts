// Tracks who is currently viewing/editing each document, plus cursor
// position, for broadcasting presence updates to all connected clients.
export interface PresenceInfo {
  userId: string;
  clientId: string;
  name: string;
  color: string;
  cursor: number | null;
  lastSeen: number;
}

class PresenceManager {
  // documentId -> clientId -> PresenceInfo
  private rooms = new Map<string, Map<string, PresenceInfo>>();

  join(documentId: string, info: PresenceInfo) {
    if (!this.rooms.has(documentId)) {
      this.rooms.set(documentId, new Map());
    }
    this.rooms.get(documentId)!.set(info.clientId, info);
  }

  updateCursor(documentId: string, clientId: string, cursor: number) {
    const room = this.rooms.get(documentId);
    const entry = room?.get(clientId);
    if (entry) {
      entry.cursor = cursor;
      entry.lastSeen = Date.now();
    }
  }

  leave(documentId: string, clientId: string) {
    const room = this.rooms.get(documentId);
    room?.delete(clientId);
    if (room && room.size === 0) {
      this.rooms.delete(documentId);
    }
  }

  list(documentId: string): PresenceInfo[] {
    return Array.from(this.rooms.get(documentId)?.values() ?? []);
  }

  listDocumentIds(): string[] {
    return Array.from(this.rooms.keys());
  }

  // Drop stale entries whose client didn't send a heartbeat in time —
  // guards against ungraceful disconnects (closed laptop lid, lost network).
  pruneStale(documentId: string, maxAgeMs = 30_000) {
    const room = this.rooms.get(documentId);
    if (!room) return;
    const now = Date.now();
    for (const [clientId, info] of room) {
      if (now - info.lastSeen > maxAgeMs) {
        room.delete(clientId);
      }
    }
  }
}

export const presenceManager = new PresenceManager();
