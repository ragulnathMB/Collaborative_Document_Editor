import { DocumentSession } from "./documentSession";
import { findDocumentById } from "../document/document.repository";

// Keeps at most one live DocumentSession per document in memory across all
// connected WebSocket clients. This is the piece that would need Redis
// pub/sub to fan out across multiple server instances (Phase: Scaling).
class SessionManager {
  private sessions = new Map<string, DocumentSession>();
  private refCounts = new Map<string, number>();

  async acquire(documentId: string): Promise<DocumentSession> {
    let session = this.sessions.get(documentId);

    if (!session) {
      const doc = await findDocumentById(documentId);
      if (!doc) throw new Error("Document not found");
      session = new DocumentSession(documentId, doc.content, doc.version);
      this.sessions.set(documentId, session);
      this.refCounts.set(documentId, 0);
    }

    this.refCounts.set(documentId, (this.refCounts.get(documentId) ?? 0) + 1);
    return session;
  }

  release(documentId: string) {
    const count = (this.refCounts.get(documentId) ?? 1) - 1;
    this.refCounts.set(documentId, count);

    if (count <= 0) {
      // Grace period before evicting from memory in case of quick reconnects
      setTimeout(() => {
        if ((this.refCounts.get(documentId) ?? 0) <= 0) {
          this.sessions.delete(documentId);
          this.refCounts.delete(documentId);
        }
      }, 30_000);
    }
  }
}

export const sessionManager = new SessionManager();
