import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { WorkspacesState } from "../../types";
import {
  fetchWorkspaces,
  createWorkspace as createWorkspaceApi,
} from "../../api/workspaceApi";

const initialState: WorkspacesState = {
  items: {},
  order: [],
  status: "idle",
  error: null,
};

export const loadWorkspaces = createAsyncThunk("workspaces/load", async () => {
  return await fetchWorkspaces();
});

export const createNewWorkspace = createAsyncThunk(
  "workspaces/create",
  async ({ name }: { name: string }) => {
    return await createWorkspaceApi(name);
  }
);

const workspacesSlice = createSlice({
  name: "workspaces",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadWorkspaces.pending, (state) => {
        state.status = "loading";
      })
      .addCase(loadWorkspaces.fulfilled, (state, action) => {
        state.status = "idle";
        state.items = {};
        state.order = [];
        for (const ws of action.payload) {
          state.items[ws.id] = ws;
          state.order.push(ws.id);
        }
      })
      .addCase(loadWorkspaces.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Failed to load workspaces";
      })
      .addCase(createNewWorkspace.fulfilled, (state, action) => {
        state.items[action.payload.id] = action.payload;
        state.order.push(action.payload.id);
      });
  },
});

export default workspacesSlice.reducer;

export const selectAllWorkspaces = (state: { workspaces: WorkspacesState }) =>
  state.workspaces.order.map((id) => state.workspaces.items[id]);

export const selectWorkspaceById = (id: string) => (state: { workspaces: WorkspacesState }) =>
  state.workspaces.items[id];
