import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { DocumentsState, DocumentDTO } from "../../types";
import { fetchDocuments, createDocument as createDocumentApi } from "../../api/documentApi";

const initialState: DocumentsState = {
  items: {},
  order: [],
  status: "idle",
  error: null,
};

export const loadDocuments = createAsyncThunk("documents/load", async () => {
  return await fetchDocuments();
});

export const createNewDocument = createAsyncThunk(
  "documents/create",
  async ({ workspaceId, title }: { workspaceId: string; title: string }) => {
    return await createDocumentApi(workspaceId, title);
  }
);

// Normalized state (items keyed by id + order array) avoids O(n) array scans
// on every selector call and keeps updates to a single doc O(1).
const documentsSlice = createSlice({
  name: "documents",
  initialState,
  reducers: {
    documentUpdatedLocally(state, action: { payload: { id: string; patch: Partial<DocumentDTO> } }) {
      const existing = state.items[action.payload.id];
      if (existing) {
        Object.assign(existing, action.payload.patch);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDocuments.pending, (state) => {
        state.status = "loading";
      })
      .addCase(loadDocuments.fulfilled, (state, action) => {
        state.status = "idle";
        state.items = {};
        state.order = [];
        for (const doc of action.payload) {
          state.items[doc.id] = doc;
          state.order.push(doc.id);
        }
      })
      .addCase(loadDocuments.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Failed to load documents";
      })
      .addCase(createNewDocument.fulfilled, (state, action) => {
        state.items[action.payload.id] = action.payload;
        state.order.unshift(action.payload.id);
      });
  },
});

export const { documentUpdatedLocally } = documentsSlice.actions;
export default documentsSlice.reducer;

// Selectors
export const selectAllDocuments = (state: { documents: DocumentsState }) =>
  state.documents.order.map((id) => state.documents.items[id]);
