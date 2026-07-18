import { Operation } from "./operation.types";
import { applyOperation, transform } from "./ot";
import { persistDocumentState } from "../document/document.service";

// One DocumentSession = one authoritative in-memory copy of a document
// plus its history of applied operations, used to transform late-arriving
// concurrent client ops. This is the core of the "central OT server" model.
export class DocumentSession {
  readonly documentId: string;
  private content: string;
  private version: number;
  private history: Operation[] = [];
  private readonly maxHistory = 200;
  private persistTimer: NodeJS.Timeout | null = null;

  constructor(documentId: string, content: string, version: number) {
    this.documentId = documentId;
    this.content = content;
    this.version = version;
  }

  getState() {
    return { content: this.content, version: this.version };
  }

  // Transform an incoming client operation against every operation that
  // happened after the client's baseVersion, then apply it.
  receiveOperation(op: Operation): { applied: Operation; newVersion: number } {
    let transformed = op;

    const concurrentOps = this.history.filter(
      (_historical, idx) => this.version - this.history.length + idx + 1 > op.baseVersion
    );

    for (const concurrent of concurrentOps) {
      transformed = transform(transformed, concurrent);
    }

    this.content = applyOperation(this.content, transformed);
    this.version += 1;
    this.history.push(transformed);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.schedulePersist();

    return { applied: transformed, newVersion: this.version };
  }

  private schedulePersist() {
    if (this.persistTimer) return;
    // Debounce writes to Postgres — autosave every 2s of activity rather
    // than on every keystroke operation.
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      persistDocumentState(this.documentId, this.content, this.version).catch((err) =>
        console.error(`Persist failed for document ${this.documentId}:`, err)
      );
    }, 2000);
  }
}
