import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { EditorState, Operation } from "../../types";
import { applyOperation } from "./ot";

const initialState: EditorState = {
  documentId: null,
  content: "",
  version: 0,
  connectionStatus: "disconnected",
  pendingOp: null,
  queuedOps: [],
};

// Editor state follows the classic client-side OT flow:
// 1. User types -> local op applied optimistically, sent as "pendingOp"
// 2. Further keystrokes while waiting for ack get buffered in "queuedOps"
// 3. Server ack arrives -> pendingOp resolved, first queued op becomes pending
// 4. Remote ops from other clients get transformed against pendingOp/queuedOps
//    before being applied, so local optimistic edits are never clobbered.
const editorSlice = createSlice({
  name: "editor",
  initialState,
  reducers: {
    documentOpened(state, action: PayloadAction<{ documentId: string }>) {
      state.documentId = action.payload.documentId;
      state.content = "";
      state.version = 0;
      state.pendingOp = null;
      state.queuedOps = [];
      state.connectionStatus = "connecting";
    },
    synced(state, action: PayloadAction<{ content: string; version: number }>) {
      state.content = action.payload.content;
      state.version = action.payload.version;
      state.connectionStatus = "connected";
    },
    connectionStatusChanged(state, action: PayloadAction<EditorState["connectionStatus"]>) {
      state.connectionStatus = action.payload;
    },
    localEditMade(state, action: PayloadAction<{ content: string; op: Operation }>) {
      state.content = action.payload.content;
      if (state.pendingOp) {
        state.queuedOps.push(action.payload.op);
      } else {
        state.pendingOp = action.payload.op;
      }
    },
    operationAcked(state, action: PayloadAction<{ version: number }>) {
      state.version = action.payload.version;
      state.pendingOp = state.queuedOps.shift() ?? null;
    },
    remoteOperationApplied(state, action: PayloadAction<{ operation: Operation; version: number }>) {
      state.content = applyOperation(state.content, action.payload.operation);
      state.version = action.payload.version;
    },
    editorReset(state) {
      Object.assign(state, initialState);
    },
  },
});

export const {
  documentOpened,
  synced,
  connectionStatusChanged,
  localEditMade,
  operationAcked,
  remoteOperationApplied,
  editorReset,
} = editorSlice.actions;

export default editorSlice.reducer;
