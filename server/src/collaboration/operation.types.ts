// A single atomic edit operation. We model text edits as a sequence of
// components applied left-to-right over the document string.
export type OpComponent =
  | { type: "retain"; count: number }
  | { type: "insert"; text: string }
  | { type: "delete"; count: number };

export interface Operation {
  ops: OpComponent[];
  // Revision number this operation was created against (client's known version)
  baseVersion: number;
  userId: string;
  clientId: string;
}

export interface AckMessage {
  type: "ack";
  version: number;
  clientId: string;
}

export interface BroadcastMessage {
  type: "operation";
  operation: Operation;
  version: number; // version AFTER applying this op
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export interface SyncMessage {
  type: "sync";
  content: string;
  version: number;
}
