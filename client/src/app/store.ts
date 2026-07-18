import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import documentsReducer from "../features/documents/documentsSlice";
import editorReducer from "../features/editor/editorSlice";
import presenceReducer from "../features/presence/presenceSlice";
import workspacesReducer from "../features/workspaces/workspacesSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    documents: documentsReducer,
    editor: editorReducer,
    presence: presenceReducer,
    workspaces: workspacesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
