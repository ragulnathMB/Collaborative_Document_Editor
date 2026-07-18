import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { PresenceState, PresenceUser } from "../../types";

const initialState: PresenceState = {
  usersByDocument: {},
};

const presenceSlice = createSlice({
  name: "presence",
  initialState,
  reducers: {
    presenceUpdated(
      state,
      action: PayloadAction<{ documentId: string; users: PresenceUser[] }>
    ) {
      state.usersByDocument[action.payload.documentId] = action.payload.users;
    },
    presenceCleared(state, action: PayloadAction<{ documentId: string }>) {
      delete state.usersByDocument[action.payload.documentId];
    },
  },
});

export const { presenceUpdated, presenceCleared } = presenceSlice.actions;
export default presenceSlice.reducer;

export const selectPresenceForDocument =
  (documentId: string) => (state: { presence: PresenceState }) =>
    state.presence.usersByDocument[documentId] ?? [];
