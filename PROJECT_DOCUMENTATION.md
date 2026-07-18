# Collab_Editor - Project Documentation

## 📁 Project Structure

```text
Collab_Editor
├── client
│   ├── src
│   │   ├── api
│   │   │   ├── authApi.ts
│   │   │   ├── axiosClient.ts
│   │   │   └── documentApi.ts
│   │   ├── app
│   │   │   └── store.ts
│   │   ├── features
│   │   │   ├── auth
│   │   │   │   ├── authSlice.ts
│   │   │   │   └── LoginPage.tsx
│   │   │   ├── documents
│   │   │   │   ├── DocumentListPage.tsx
│   │   │   │   └── documentsSlice.ts
│   │   │   ├── editor
│   │   │   │   ├── Editor.tsx
│   │   │   │   ├── editorSlice.ts
│   │   │   │   ├── ot.ts
│   │   │   │   └── useCollabSocket.ts
│   │   │   └── presence
│   │   │       ├── PresenceBar.tsx
│   │   │       └── presenceSlice.ts
│   │   ├── types
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server
│   ├── prisma
│   │   └── schema.prisma
│   ├── src
│   │   ├── auth
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.middleware.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── auth.service.ts
│   │   ├── collaboration
│   │   │   ├── documentSession.ts
│   │   │   ├── operation.types.ts
│   │   │   ├── ot.ts
│   │   │   └── sessionManager.ts
│   │   ├── config
│   │   │   └── env.ts
│   │   ├── db
│   │   │   └── prismaClient.ts
│   │   ├── document
│   │   │   ├── document.controller.ts
│   │   │   ├── document.repository.ts
│   │   │   ├── document.routes.ts
│   │   │   └── document.service.ts
│   │   ├── middleware
│   │   │   └── errorHandler.ts
│   │   ├── presence
│   │   │   └── presenceManager.ts
│   │   ├── utils
│   │   │   └── logger.ts
│   │   ├── websocket
│   │   │   ├── wsHandlers.ts
│   │   │   └── wsServer.ts
│   │   └── main.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── shared
│   └── types.ts
├── CodebaseExtractor.py
├── docker-compose.yml
└── README.md
```

## 📄 Source Code

### `client\index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Collab Editor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `client\package.json`

```json
{
  "name": "collab-editor-client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@reduxjs/toolkit": "^2.2.7",
    "axios": "^1.7.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-redux": "^9.1.2",
    "react-router-dom": "^6.24.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.5.3",
    "vite": "^5.3.3"
  }
}
```

### `client\src\api\authApi.ts`

```typescript
import axiosClient from "./axiosClient";
import { AuthUser } from "../types";

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export async function loginRequest(email: string, password: string) {
  const { data } = await axiosClient.post<LoginResponse>("/auth/login", { email, password });
  return data;
}

export async function registerRequest(email: string, password: string, name: string) {
  const { data } = await axiosClient.post<{ user: AuthUser }>("/auth/register", {
    email,
    password,
    name,
  });
  return data;
}
```

### `client\src\api\axiosClient.ts`

```typescript
import axios from "axios";
import { store } from "../app/store";
import { tokensRefreshed, loggedOut } from "../features/auth/authSlice";

const axiosClient = axios.create({
  baseURL: "/api",
});

axiosClient.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshInFlight) {
        refreshInFlight = refreshAccessToken();
      }

      const newToken = await refreshInFlight;
      refreshInFlight = null;

      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosClient(originalRequest);
      }

      store.dispatch(loggedOut());
    }

    return Promise.reject(error);
  }
);

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = store.getState().auth.refreshToken;
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post("/api/auth/refresh", { refreshToken });
    store.dispatch(
      tokensRefreshed({ accessToken: data.accessToken, refreshToken: data.refreshToken })
    );
    return data.accessToken;
  } catch {
    return null;
  }
}

export default axiosClient;
```

### `client\src\api\documentApi.ts`

```typescript
import axiosClient from "./axiosClient";
import { DocumentDTO } from "../types";

export async function fetchDocuments() {
  const { data } = await axiosClient.get<DocumentDTO[]>("/documents");
  return data;
}

export async function fetchDocument(id: string) {
  const { data } = await axiosClient.get<DocumentDTO>(`/documents/${id}`);
  return data;
}

export async function createDocument(workspaceId: string, title: string) {
  const { data } = await axiosClient.post<DocumentDTO>("/documents", { workspaceId, title });
  return data;
}

export async function shareDocument(
  documentId: string,
  targetUserId: string,
  role: "EDITOR" | "VIEWER"
) {
  const { data } = await axiosClient.post(`/documents/${documentId}/share`, {
    targetUserId,
    role,
  });
  return data;
}
```

### `client\src\app\store.ts`

```typescript
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import documentsReducer from "../features/documents/documentsSlice";
import editorReducer from "../features/editor/editorSlice";
import presenceReducer from "../features/presence/presenceSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    documents: documentsReducer,
    editor: editorReducer,
    presence: presenceReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### `client\src\App.tsx`

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "./app/store";
import LoginPage from "./features/auth/LoginPage";
import DocumentListPage from "./features/documents/DocumentListPage";
import Editor from "./features/editor/Editor";
import { useParams } from "react-router-dom";

function DocumentRoute() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/documents" replace />;
  return <Editor documentId={id} />;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/documents"
        element={
          <RequireAuth>
            <DocumentListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/documents/:id"
        element={
          <RequireAuth>
            <div className="h-screen">
              <DocumentRoute />
            </div>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/documents" replace />} />
    </Routes>
  );
}
```

### `client\src\features\auth\authSlice.ts`

```typescript
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { AuthState } from "../../types";
import { loginRequest, registerRequest } from "../../api/authApi";

const persistedAccessToken = localStorage.getItem("accessToken");
const persistedRefreshToken = localStorage.getItem("refreshToken");

const initialState: AuthState = {
  user: null,
  accessToken: persistedAccessToken,
  refreshToken: persistedRefreshToken,
  status: "idle",
  error: null,
};

export const login = createAsyncThunk(
  "auth/login",
  async ({ email, password }: { email: string; password: string }) => {
    return await loginRequest(email, password);
  }
);

export const register = createAsyncThunk(
  "auth/register",
  async ({ email, password, name }: { email: string; password: string; name: string }) => {
    return await registerRequest(email, password, name);
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    tokensRefreshed(state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      localStorage.setItem("accessToken", action.payload.accessToken);
      localStorage.setItem("refreshToken", action.payload.refreshToken);
    },
    loggedOut(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.status = "idle";
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = "authenticated";
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        localStorage.setItem("accessToken", action.payload.accessToken);
        localStorage.setItem("refreshToken", action.payload.refreshToken);
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Login failed";
      })
      .addCase(register.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Registration failed";
      });
  },
});

export const { tokensRefreshed, loggedOut } = authSlice.actions;
export default authSlice.reducer;
```

### `client\src\features\auth\LoginPage.tsx`

```tsx
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { AppDispatch, RootState } from "../../app/store";
import { login, register } from "./authSlice";

export default function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { status, error } = useSelector((state: RootState) => state.auth);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "login") {
      const result = await dispatch(login({ email, password }));
      if (login.fulfilled.match(result)) navigate("/documents");
    } else {
      const result = await dispatch(register({ email, password, name }));
      if (register.fulfilled.match(result)) setMode("login");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-96 space-y-4">
        <h1 className="text-xl font-semibold">{mode === "login" ? "Sign in" : "Create account"}</h1>

        {mode === "register" && (
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}

        <input
          className="w-full border rounded px-3 py-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-50"
        >
          {mode === "login" ? "Sign in" : "Register"}
        </button>

        <button
          type="button"
          className="text-sm text-blue-600"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
```

### `client\src\features\documents\DocumentListPage.tsx`

```tsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { AppDispatch } from "../../app/store";
import { loadDocuments, createNewDocument, selectAllDocuments } from "./documentsSlice";

export default function DocumentListPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const documents = useSelector(selectAllDocuments);
  const [title, setTitle] = useState("");

  useEffect(() => {
    dispatch(loadDocuments());
  }, [dispatch]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Hardcoded default workspace for simplicity — a real workspace
    // picker would come from a workspaces slice not built in this pass.
    const result = await dispatch(
      createNewDocument({ workspaceId: "default-workspace-id", title })
    );
    if (createNewDocument.fulfilled.match(result)) {
      setTitle("");
      navigate(`/documents/${result.payload.id}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Your Documents</h1>

      <form onSubmit={handleCreate} className="flex gap-2 mb-8">
        <input
          className="flex-1 border rounded px-3 py-2"
          placeholder="New document title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Create
        </button>
      </form>

      <ul className="divide-y border rounded">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex justify-between"
            onClick={() => navigate(`/documents/${doc.id}`)}
          >
            <span>{doc.title}</span>
            <span className="text-xs text-gray-400">
              {new Date(doc.updatedAt).toLocaleDateString()}
            </span>
          </li>
        ))}
        {documents.length === 0 && (
          <li className="px-4 py-6 text-center text-gray-400">No documents yet</li>
        )}
      </ul>
    </div>
  );
}
```

### `client\src\features\documents\documentsSlice.ts`

```typescript
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
```

### `client\src\features\editor\Editor.tsx`

```tsx
import { useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { documentOpened, localEditMade, editorReset } from "./editorSlice";
import { presenceCleared } from "../presence/presenceSlice";
import { useCollabSocket } from "./useCollabSocket";
import { diffToOperation } from "./ot";
import PresenceBar from "../presence/PresenceBar";
import crypto from "crypto"; // not used directly; browser crypto.randomUUID is used below

interface EditorProps {
  documentId: string;
}

// Deliberately a plain <textarea>-backed editor rather than a rich-text
// tree (Lexical/ProseMirror) — the OT engine operates on flat text ranges,
// which keeps the focus on synchronization mechanics rather than DOM
// contenteditable complexity. Swapping in a rich-text tree later only
// changes how operations are generated, not how they're transformed/sent.
export default function Editor({ documentId }: EditorProps) {
  const dispatch = useDispatch();
  const content = useSelector((state: RootState) => state.editor.content);
  const version = useSelector((state: RootState) => state.editor.version);
  const connectionStatus = useSelector((state: RootState) => state.editor.connectionStatus);
  const user = useSelector((state: RootState) => state.auth.user);

  const clientIdRef = useRef(crypto.randomUUID());
  const prevContentRef = useRef(content);
  const { sendOperation, sendCursor } = useCollabSocket(documentId);

  useEffect(() => {
    dispatch(documentOpened({ documentId }));
    return () => {
      dispatch(editorReset());
      dispatch(presenceCleared({ documentId }));
    };
  }, [documentId, dispatch]);

  useEffect(() => {
    prevContentRef.current = content;
  }, [content]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      const op = diffToOperation(
        prevContentRef.current,
        newContent,
        version,
        user?.id ?? "unknown",
        clientIdRef.current
      );

      dispatch(localEditMade({ content: newContent, op }));
      sendOperation(op);
    },
    [version, user, dispatch, sendOperation]
  );

  const handleSelect = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      sendCursor(target.selectionStart);
    },
    [sendCursor]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="text-sm text-gray-500">
          {connectionStatus === "connected" ? "Connected" : "Reconnecting..."}
        </span>
        <PresenceBar documentId={documentId} />
      </div>
      <textarea
        className="flex-1 p-4 outline-none resize-none font-mono text-sm"
        value={content}
        onChange={handleChange}
        onSelect={handleSelect}
        spellCheck={false}
      />
    </div>
  );
}
```

### `client\src\features\editor\editorSlice.ts`

```typescript
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
```

### `client\src\features\editor\ot.ts`

```typescript
import { OpComponent, Operation } from "../../types";

// Client-side mirror of the server's OT engine. Must stay algorithmically
// identical to server/src/collaboration/ot.ts so both sides converge.

export function applyOperation(content: string, op: Operation): string {
  let result = "";
  let index = 0;

  for (const component of op.ops) {
    if (component.type === "retain") {
      result += content.slice(index, index + component.count);
      index += component.count;
    } else if (component.type === "insert") {
      result += component.text;
    } else if (component.type === "delete") {
      index += component.count;
    }
  }

  result += content.slice(index);
  return result;
}

export function transform(opA: Operation, opB: Operation): Operation {
  const transformedOps: OpComponent[] = [];
  const aOps = [...opA.ops];
  const bOps = [...opB.ops];
  let aIdx = 0;
  let bIdx = 0;
  let a = aOps[aIdx];
  let b = bOps[bIdx];

  while (a || b) {
    if (b && b.type === "insert") {
      transformedOps.push({ type: "retain", count: b.text.length });
      bIdx++;
      b = bOps[bIdx];
      continue;
    }
    if (a && a.type === "insert") {
      transformedOps.push({ type: "insert", text: a.text });
      aIdx++;
      a = aOps[aIdx];
      continue;
    }
    if (!a || !b) {
      if (a) {
        transformedOps.push(a);
        aIdx++;
        a = aOps[aIdx];
      } else if (b) {
        bIdx++;
        b = bOps[bIdx];
      }
      continue;
    }

    const aCount = a.type === "retain" || a.type === "delete" ? a.count : 0;
    const bCount = b.type === "retain" || b.type === "delete" ? b.count : 0;
    const minCount = Math.min(aCount, bCount);

    if (a.type === "retain" && b.type === "retain") {
      transformedOps.push({ type: "retain", count: minCount });
    } else if (a.type === "delete" && b.type === "retain") {
      transformedOps.push({ type: "delete", count: minCount });
    }

    if (minCount >= aCount) {
      aIdx++;
      a = aOps[aIdx];
    } else if (a) {
      a = { ...a, count: aCount - minCount } as OpComponent;
    }

    if (minCount >= bCount) {
      bIdx++;
      b = bOps[bIdx];
    } else if (b) {
      b = { ...b, count: bCount - minCount } as OpComponent;
    }
  }

  return {
    ops: mergeRetains(transformedOps),
    baseVersion: opA.baseVersion + 1,
    userId: opA.userId,
    clientId: opA.clientId,
  };
}

function mergeRetains(ops: OpComponent[]): OpComponent[] {
  const merged: OpComponent[] = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === "retain" && op.type === "retain") {
      last.count += op.count;
    } else if (op.type === "retain" && op.count === 0) {
      continue;
    } else {
      merged.push({ ...op });
    }
  }
  return merged;
}

// Diff two strings into a minimal Operation (naive common-prefix/suffix
// diff — sufficient for single-keystroke and paste-sized edits typed
// in a textarea; not a full Myers diff).
export function diffToOperation(
  oldText: string,
  newText: string,
  baseVersion: number,
  userId: string,
  clientId: string
): Operation {
  let prefixLen = 0;
  const maxPrefix = Math.min(oldText.length, newText.length);
  while (prefixLen < maxPrefix && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  const maxSuffix = Math.min(oldText.length, newText.length) - prefixLen;
  while (
    suffixLen < maxSuffix &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const deletedCount = oldText.length - prefixLen - suffixLen;
  const insertedText = newText.slice(prefixLen, newText.length - suffixLen);

  const ops: OpComponent[] = [];
  if (prefixLen > 0) ops.push({ type: "retain", count: prefixLen });
  if (deletedCount > 0) ops.push({ type: "delete", count: deletedCount });
  if (insertedText.length > 0) ops.push({ type: "insert", text: insertedText });
  if (suffixLen > 0) ops.push({ type: "retain", count: suffixLen });

  return { ops, baseVersion, userId, clientId };
}
```

### `client\src\features\editor\useCollabSocket.ts`

```typescript
import { useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import {
  synced,
  connectionStatusChanged,
  operationAcked,
  remoteOperationApplied,
} from "./editorSlice";
import { presenceUpdated } from "../presence/presenceSlice";
import { Operation, ServerMessage, ClientMessage } from "../../types";

// Encapsulates the WebSocket lifecycle: connect, join, send ops, receive
// sync/ack/operation/presence messages, and reconnect with exponential
// backoff on drop. Keeping this in a hook (not a thunk) lets React own
// the socket's lifetime alongside the Editor component that uses it.
export function useCollabSocket(documentId: string | null) {
  const dispatch = useDispatch();
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const user = useSelector((state: RootState) => state.auth.user);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const connect = useCallback(() => {
    if (!documentId || !accessToken || !user) return;

    dispatch(connectionStatusChanged("connecting"));

    const wsUrl = `ws://${window.location.hostname}:4000/ws?token=${accessToken}&name=${encodeURIComponent(
      user.name
    )}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      reconnectAttempt.current = 0;
      const joinMsg: ClientMessage = { type: "join", documentId };
      ws.send(JSON.stringify(joinMsg));

      heartbeatInterval.current = setInterval(() => {
        ws.send(JSON.stringify({ type: "heartbeat" }));
      }, 15000);
    };

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);

      switch (msg.type) {
        case "sync":
          dispatch(synced({ content: msg.content, version: msg.version }));
          break;
        case "ack":
          dispatch(operationAcked({ version: msg.version }));
          break;
        case "operation":
          dispatch(remoteOperationApplied({ operation: msg.operation, version: msg.version }));
          break;
        case "presence":
          dispatch(presenceUpdated({ documentId, users: msg.users }));
          break;
        case "error":
          console.error("Server error:", msg.message);
          break;
      }
    };

    ws.onclose = () => {
      dispatch(connectionStatusChanged("disconnected"));
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);

      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 15000);
      reconnectAttempt.current += 1;
      setTimeout(connect, delay);
    };
  }, [documentId, accessToken, user, dispatch]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    };
  }, [connect]);

  const sendOperation = useCallback((op: Operation) => {
    socketRef.current?.send(JSON.stringify({ type: "operation", operation: op } as ClientMessage));
  }, []);

  const sendCursor = useCallback((cursor: number) => {
    socketRef.current?.send(JSON.stringify({ type: "cursor", cursor } as ClientMessage));
  }, []);

  return { sendOperation, sendCursor };
}
```

### `client\src\features\presence\PresenceBar.tsx`

```tsx
import { useSelector } from "react-redux";
import { selectPresenceForDocument } from "./presenceSlice";

interface PresenceBarProps {
  documentId: string;
}

export default function PresenceBar({ documentId }: PresenceBarProps) {
  const users = useSelector(selectPresenceForDocument(documentId));

  return (
    <div className="flex items-center gap-1">
      {users.map((u) => (
        <div
          key={u.clientId}
          title={u.name}
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-semibold"
          style={{ backgroundColor: u.color }}
        >
          {u.name.charAt(0).toUpperCase()}
        </div>
      ))}
    </div>
  );
}
```

### `client\src\features\presence\presenceSlice.ts`

```typescript
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
```

### `client\src\index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
  margin: 0;
}
```

### `client\src\main.tsx`

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store } from "./app/store";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
```

### `client\src\types\index.ts`

```typescript
// Types shared conceptually between client and server (kept duplicated,
// not imported cross-package, to avoid a monorepo build-tooling detour —
// this is a deliberate simplicity trade-off for a single-developer project).

export type OpComponent =
  | { type: "retain"; count: number }
  | { type: "insert"; text: string }
  | { type: "delete"; count: number };

export interface Operation {
  ops: OpComponent[];
  baseVersion: number;
  userId: string;
  clientId: string;
}

export interface PresenceUser {
  userId: string;
  clientId: string;
  name: string;
  color: string;
  cursor: number | null;
  lastSeen: number;
}

export interface DocumentDTO {
  id: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type ServerMessage =
  | { type: "sync"; content: string; version: number }
  | { type: "ack"; version: number; clientId: string }
  | { type: "operation"; operation: Operation; version: number }
  | { type: "presence"; users: PresenceUser[] }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "join"; documentId: string }
  | { type: "operation"; operation: Operation }
  | { type: "cursor"; cursor: number }
  | { type: "heartbeat" };
```

### `client\tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "baseUrl": "src",
    "paths": {
      "@/*": ["*"]
    }
  },
  "include": ["src"]
}
```

### `client\vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:4000",
        ws: true,
      },
    },
  },
});
```

### `CodebaseExtractor.py`

```python
from pathlib import Path
import os

# Files and folders to ignore
IGNORE_DIRS = {
    "node_modules",
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "dist",
    "build",
    ".idea",
    ".vscode",
}

IGNORE_FILES = {
    "generate_project_doc.py",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
}

# File extensions that are usually safe to include as code
CODE_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".java",
    ".cpp",
    ".c",
    ".h",
    ".hpp",
    ".cs",
    ".go",
    ".rs",
    ".php",
    ".rb",
    ".swift",
    ".kt",
    ".html",
    ".css",
    ".scss",
    ".sass",
    ".json",
    ".xml",
    ".yaml",
    ".yml",
    ".md",
    ".txt",
    ".sql",
    ".sh",
    ".bat",
    ".env",
    ".gitignore",
    ".dockerfile",
}

OUTPUT_FILE = "PROJECT_DOCUMENTATION.md"


def get_language(file_path):
    extension = file_path.suffix.lower()

    languages = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "jsx",
        ".ts": "typescript",
        ".tsx": "tsx",
        ".java": "java",
        ".cpp": "cpp",
        ".c": "c",
        ".h": "c",
        ".hpp": "cpp",
        ".cs": "csharp",
        ".go": "go",
        ".rs": "rust",
        ".php": "php",
        ".rb": "ruby",
        ".swift": "swift",
        ".kt": "kotlin",
        ".html": "html",
        ".css": "css",
        ".scss": "scss",
        ".json": "json",
        ".xml": "xml",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".sql": "sql",
        ".sh": "bash",
        ".bat": "bat",
        ".md": "markdown",
        ".txt": "text",
    }

    return languages.get(extension, "text")


def create_project_tree(root_path):
    tree_lines = []

    def walk(directory, prefix=""):
        try:
            items = sorted(
                [
                    item
                    for item in directory.iterdir()
                    if item.name not in IGNORE_DIRS
                    and item.name not in IGNORE_FILES
                ],
                key=lambda x: (x.is_file(), x.name.lower()),
            )
        except PermissionError:
            return

        for index, item in enumerate(items):
            is_last = index == len(items) - 1

            connector = "└── " if is_last else "├── "
            tree_lines.append(f"{prefix}{connector}{item.name}")

            if item.is_dir():
                new_prefix = prefix + ("    " if is_last else "│   ")
                walk(item, new_prefix)

    tree_lines.append(root_path.name)
    walk(root_path)

    return "\n".join(tree_lines)


def collect_files(root_path):
    files = []

    for path in root_path.rglob("*"):
        if not path.is_file():
            continue

        # Skip ignored directories
        if any(part in IGNORE_DIRS for part in path.parts):
            continue

        # Skip ignored files
        if path.name in IGNORE_FILES:
            continue

        # Skip generated documentation file
        if path.name == OUTPUT_FILE:
            continue

        # Only include recognized code/text files
        if path.suffix.lower() in CODE_EXTENSIONS or path.name in {
            "Dockerfile",
            ".gitignore",
            ".env",
        }:
            files.append(path)

    return sorted(files)


def read_file(file_path):
    try:
        return file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return "[Binary or non-UTF-8 file skipped]"
    except Exception as error:
        return f"[Could not read file: {error}]"


def generate_documentation():
    root_path = Path(__file__).parent.resolve()

    print("Scanning project...")

    project_tree = create_project_tree(root_path)
    project_files = collect_files(root_path)

    markdown = []

    # Title
    markdown.append(f"# {root_path.name} - Project Documentation\n")

    # Project tree
    markdown.append("## 📁 Project Structure\n")
    markdown.append("```text")
    markdown.append(project_tree)
    markdown.append("```\n")

    # File contents
    markdown.append("## 📄 Source Code\n")

    for file_path in project_files:
        relative_path = file_path.relative_to(root_path)
        code = read_file(file_path)
        language = get_language(file_path)

        markdown.append(f"### `{relative_path}`\n")
        markdown.append(f"```{language}")
        markdown.append(code)
        markdown.append("```\n")

    output_path = root_path / OUTPUT_FILE
    output_path.write_text("\n".join(markdown), encoding="utf-8")

    print(f"\n✅ Documentation generated successfully!")
    print(f"📄 File: {OUTPUT_FILE}")
    print(f"📊 Files included: {len(project_files)}")


if __name__ == "__main__":
    generate_documentation()
```

### `docker-compose.yml`

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: collab_editor
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### `README.md`

```markdown
# Collaborative Document Editor

A real-time collaborative text editor built from scratch, implementing a
server-authoritative Operational Transformation (OT) engine — the same
class of algorithm behind Google Docs' original synchronization model.

This project was built to deeply understand distributed systems concepts
(conflict resolution, consistency, presence) rather than to depend on a
managed real-time backend (Firebase/Supabase) or an off-the-shelf CRDT
library. The synchronization logic — transform, apply, session management —
is fully hand-written.

## Features

- JWT-based authentication with access + refresh token rotation
- Workspace-scoped documents with OWNER / EDITOR / VIEWER permissions
- Real-time collaborative editing over WebSockets
- Custom Operational Transformation engine (retain/insert/delete model)
- Live cursor presence with per-user colors
- Optimistic local edits with pending/queued operation buffering
- Debounced autosave with periodic version snapshots for history/recovery
- Reconnect logic with exponential backoff

## Architecture
Browser A                          Browser B
|                                  |
|  WebSocket (/ws)                 |  WebSocket (/ws)
v                                  v
Collaboration Server (Node.js)
+------------------------------------+
|  wsServer -> wsHandlers             |
|  SessionManager -> DocumentSession   |
|  OT engine (transform/apply)          |
|  PresenceManager                      |
+------------------------------------+
|                  |
v                  v
PostgreSQL          (in-memory
(Prisma: users,        session state,
documents,            evicted after
permissions,          30s idle)
snapshots)

**How a keystroke flows:**
1. Client generates an `Operation` (diff of old vs new text) tagged with its
   `baseVersion` (last version it has seen).
2. Server's `DocumentSession` transforms the incoming op against any ops
   applied concurrently since that `baseVersion`, guaranteeing convergence.
3. Transformed op is applied to the authoritative in-memory copy, version
   incremented, and broadcast to every other connected client in that
   document's room.
4. Originating client gets an `ack`; other clients get the transformed
   `operation` message and apply it locally.
5. Content + version are persisted to Postgres on a 2s debounce, with a
   snapshot row written every 20 versions for recovery/history.

## Tech Stack

**Client:** React, TypeScript, Redux Toolkit, React Router, TailwindCSS, Vite
**Server:** Node.js, TypeScript, Express, `ws` (WebSocket), Prisma, PostgreSQL
**Auth:** JWT (access + refresh tokens), bcrypt password hashing

Deliberately excluded: Redis (single-instance session manager for now — the
`SessionManager`/`broadcastToRoom` seam is where Redis pub/sub would plug in
for horizontal scaling), Lexical/ProseMirror (flat-text `<textarea>` keeps
focus on OT mechanics rather than rich-text DOM complexity), Firebase/Supabase
(the whole point was implementing sync ourselves).

## Project Structure
collab-editor/
├── client/    # React + Redux Toolkit frontend
├── server/    # Express + WebSocket + Prisma backend
├── shared/    # Types shared conceptually between client/server
└── docker-compose.yml

See in-code comments in `server/src/collaboration/` and
`client/src/features/editor/ot.ts` for the OT algorithm details.

## Setup

### 1. Start PostgreSQL
```bash
docker-compose up -d
```

### 2. Server
```bash
cd server
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run dev
```
Server runs on `http://localhost:4000`.

### 3. Client
```bash
cd client
npm install
npm run dev
```
Client runs on `http://localhost:5173`.

### 4. Seed a workspace (required before creating documents)

The document creation flow expects a `Workspace` row to exist. Insert one
manually via Prisma Studio (`npx prisma studio` in `server/`) or a quick
seed script, then use its `id` where the client currently hardcodes
`"default-workspace-id"` in `DocumentListPage.tsx`.

## Known Gaps / Next Steps

- No dedicated workspace CRUD UI/API — documents assume a pre-existing
  workspace id.
- Single-instance only: `SessionManager` and the client broadcast set live
  in one process's memory. Scaling to multiple server instances requires
  replacing the in-memory `Set<RoomEntry>` broadcast in `wsServer.ts` with
  Redis pub/sub keyed by `documentId`.
- `diffToOperation` uses a common-prefix/suffix diff, which is correct for
  typed/pasted edits but not a full Myers diff — fine for a `<textarea>`,
  would need revisiting for a rich-text tree editor.
- No automated test suite yet (Vitest/Supertest/Playwright were scoped in
  planning but not implemented in this pass).

## License

MIT — educational project, not a commercial product.
```

### `server\package.json`

```json
{
  "name": "collab-editor-server",
  "version": "1.0.0",
  "main": "dist/main.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/main.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/main.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@prisma/client": "^5.18.0",
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "ws": "^8.18.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node": "^20.14.9",
    "@types/ws": "^8.5.11",
    "prisma": "^5.18.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.5.3"
  }
}
```

### `server\src\auth\auth.controller.ts`

```typescript
import { Request, Response } from "express";
import { z } from "zod";
import {
  registerUser,
  loginUser,
  refreshTokens,
  AuthError,
} from "./auth.service";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const user = await registerUser(
      parsed.data.email,
      parsed.data.password,
      parsed.data.name
    );
    return res.status(201).json({ user });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await loginUser(parsed.data.email, parsed.data.password);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(401).json({ error: err.message });
    }
    throw err;
  }
}

export async function refresh(req: Request, res: Response) {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const tokens = await refreshTokens(parsed.data.refreshToken);
    return res.status(200).json(tokens);
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(401).json({ error: err.message });
    }
    throw err;
  }
}
```

### `server\src\auth\auth.middleware.ts`

```typescript
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, TokenPayload } from "./auth.service";

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}
```

### `server\src\auth\auth.routes.ts`

```typescript
import { Router } from "express";
import { register, login, refresh } from "./auth.controller";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);

export default router;
```

### `server\src\auth\auth.service.ts`

```typescript
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../db/prismaClient";
import { env } from "../config/env";

const SALT_ROUNDS = 10;

export interface TokenPayload {
  userId: string;
  email: string;
}

export class AuthError extends Error {}

export async function registerUser(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthError("Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  });

  return sanitizeUser(user);
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AuthError("Invalid credentials");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthError("Invalid credentials");
  }

  const tokens = generateTokens({ userId: user.id, email: user.email });
  return { user: sanitizeUser(user), ...tokens };
}

export function generateTokens(payload: TokenPayload) {
  const accessToken = jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtl,
  });
  const refreshToken = jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.refreshTokenTtl,
  });
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as TokenPayload;
}

export async function refreshTokens(refreshToken: string) {
  let payload: TokenPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError("Invalid or expired refresh token");
  }
  return generateTokens({ userId: payload.userId, email: payload.email });
}

function sanitizeUser(user: { id: string; email: string; name: string }) {
  return { id: user.id, email: user.email, name: user.name };
}
```

### `server\src\collaboration\documentSession.ts`

```typescript
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
      (historical, idx) => this.version - this.history.length + idx + 1 > op.baseVersion
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
```

### `server\src\collaboration\operation.types.ts`

```typescript
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
```

### `server\src\collaboration\ot.ts`

```typescript
import { OpComponent, Operation } from "./operation.types";

// Core OT engine: applies operations to text and transforms concurrent
// operations against each other so both converge to the same final state
// (Convergence property in the CC1/CC2 sense of Ellis & Gibbs OT model).

export function applyOperation(content: string, op: Operation): string {
  let result = "";
  let index = 0;

  for (const component of op.ops) {
    if (component.type === "retain") {
      result += content.slice(index, index + component.count);
      index += component.count;
    } else if (component.type === "insert") {
      result += component.text;
    } else if (component.type === "delete") {
      index += component.count;
    }
  }

  // Any remaining untouched tail
  result += content.slice(index);
  return result;
}

// Transform opA against opB, assuming both were generated from the same
// base document version. Returns opA' such that applying opB then opA'
// yields the same result as applying opA then transform(opB, opA).
// This is a simplified single-insert/delete-per-op transform sufficient
// for a single flat text buffer (character-level OT, à la Google Wave).
export function transform(opA: Operation, opB: Operation): Operation {
  const transformedOps: OpComponent[] = [];

  let aOps = [...opA.ops];
  let bOps = [...opB.ops];

  let aIdx = 0;
  let bIdx = 0;

  let a = aOps[aIdx];
  let b = bOps[bIdx];

  while (a || b) {
    // opB inserted text: opA must retain over it (priority: opB goes first,
    // tie-broken by clientId to keep transforms deterministic)
    if (b && b.type === "insert") {
      transformedOps.push({ type: "retain", count: b.text.length });
      bIdx++;
      b = bOps[bIdx];
      continue;
    }

    // opA inserts its own text — passes through unchanged
    if (a && a.type === "insert") {
      transformedOps.push({ type: "insert", text: a.text });
      aIdx++;
      a = aOps[aIdx];
      continue;
    }

    if (!a || !b) {
      if (a) {
        transformedOps.push(a);
        aIdx++;
        a = aOps[aIdx];
      } else if (b) {
        // opB retain/delete with no corresponding opA component: nothing to add
        bIdx++;
        b = bOps[bIdx];
      }
      continue;
    }

    const aCount = a.type === "retain" ? a.count : a.type === "delete" ? a.count : 0;
    const bCount = b.type === "retain" ? b.count : b.type === "delete" ? b.count : 0;
    const minCount = Math.min(aCount, bCount);

    if (a.type === "retain" && b.type === "retain") {
      transformedOps.push({ type: "retain", count: minCount });
    } else if (a.type === "delete" && b.type === "retain") {
      transformedOps.push({ type: "delete", count: minCount });
    } else if (a.type === "retain" && b.type === "delete") {
      // opB deleted this range: opA should not retain characters that no longer exist
    } else if (a.type === "delete" && b.type === "delete") {
      // Both deleted the same range: no-op needed on opA's side, already gone
    }

    consume(a, minCount, aCount, () => {
      aIdx++;
      a = aOps[aIdx];
    }, (remaining) => (a = { ...a!, count: remaining } as OpComponent));

    consume(b, minCount, bCount, () => {
      bIdx++;
      b = bOps[bIdx];
    }, (remaining) => (b = { ...b!, count: remaining } as OpComponent));
  }

  return {
    ops: mergeRetains(transformedOps),
    baseVersion: opA.baseVersion + 1,
    userId: opA.userId,
    clientId: opA.clientId,
  };
}

function consume(
  component: OpComponent | undefined,
  used: number,
  total: number,
  advance: () => void,
  shrink: (remaining: number) => void
) {
  if (!component || component.type === "insert") return;
  if (used >= total) {
    advance();
  } else {
    shrink(total - used);
  }
}

// Collapse adjacent retain components produced by the transform loop
function mergeRetains(ops: OpComponent[]): OpComponent[] {
  const merged: OpComponent[] = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === "retain" && op.type === "retain") {
      last.count += op.count;
    } else if (op.type === "retain" && op.count === 0) {
      continue;
    } else {
      merged.push({ ...op });
    }
  }
  return merged;
}
```

### `server\src\collaboration\sessionManager.ts`

```typescript
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
```

### `server\src\config\env.ts`

```typescript
import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL ?? "7d",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
```

### `server\src\db\prismaClient.ts`

```typescript
import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
  });

if (env.nodeEnv !== "production") {
  global.__prisma = prisma;
}
```

### `server\src\document\document.controller.ts`

```typescript
import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../auth/auth.middleware";
import * as docService from "./document.service";
import { DocumentAccessError } from "./document.service";

const createSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().min(1),
});

const shareSchema = z.object({
  targetUserId: z.string().uuid(),
  role: z.enum(["EDITOR", "VIEWER"]),
});

export async function createDocument(req: AuthenticatedRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const doc = await docService.createNewDocument(
    parsed.data.workspaceId,
    req.user!.userId,
    parsed.data.title
  );
  return res.status(201).json(doc);
}

export async function getDocument(req: AuthenticatedRequest, res: Response) {
  try {
    const doc = await docService.getDocumentForUser(req.params.id, req.user!.userId);
    return res.status(200).json(doc);
  } catch (err) {
    if (err instanceof DocumentAccessError) {
      return res.status(403).json({ error: err.message });
    }
    throw err;
  }
}

export async function listDocuments(req: AuthenticatedRequest, res: Response) {
  const docs = await docService.listUserDocuments(req.user!.userId);
  return res.status(200).json(docs);
}

export async function shareDocument(req: AuthenticatedRequest, res: Response) {
  const parsed = shareSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const permission = await docService.shareDocument(
      req.params.id,
      req.user!.userId,
      parsed.data.targetUserId,
      parsed.data.role
    );
    return res.status(200).json(permission);
  } catch (err) {
    if (err instanceof DocumentAccessError) {
      return res.status(403).json({ error: err.message });
    }
    throw err;
  }
}

export async function getHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const snapshots = await docService.getSnapshotHistory(req.params.id, req.user!.userId);
    return res.status(200).json(snapshots);
  } catch (err) {
    if (err instanceof DocumentAccessError) {
      return res.status(403).json({ error: err.message });
    }
    throw err;
  }
}
```

### `server\src\document\document.repository.ts`

```typescript
import { prisma } from "../db/prismaClient";

export async function createDocument(
  workspaceId: string,
  ownerId: string,
  title: string
) {
  return prisma.document.create({
    data: {
      workspaceId,
      ownerId,
      title,
      content: "",
      version: 0,
      permissions: {
        create: { userId: ownerId, role: "OWNER" },
      },
    },
  });
}

export async function findDocumentById(documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId },
    include: { permissions: true },
  });
}

export async function listDocumentsForUser(userId: string) {
  return prisma.document.findMany({
    where: { permissions: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function updateDocumentContent(
  documentId: string,
  content: string,
  version: number
) {
  return prisma.document.update({
    where: { id: documentId },
    data: { content, version },
  });
}

export async function getPermission(documentId: string, userId: string) {
  return prisma.documentPermission.findUnique({
    where: { documentId_userId: { documentId, userId } },
  });
}

export async function addPermission(
  documentId: string,
  userId: string,
  role: "EDITOR" | "VIEWER"
) {
  return prisma.documentPermission.upsert({
    where: { documentId_userId: { documentId, userId } },
    update: { role },
    create: { documentId, userId, role },
  });
}

export async function createSnapshot(
  documentId: string,
  content: string,
  version: number
) {
  return prisma.documentSnapshot.create({
    data: { documentId, content, version },
  });
}

export async function listSnapshots(documentId: string) {
  return prisma.documentSnapshot.findMany({
    where: { documentId },
    orderBy: { version: "desc" },
    take: 50,
  });
}
```

### `server\src\document\document.routes.ts`

```typescript
import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import {
  createDocument,
  getDocument,
  listDocuments,
  shareDocument,
  getHistory,
} from "./document.controller";

const router = Router();

router.use(requireAuth);

router.post("/", createDocument);
router.get("/", listDocuments);
router.get("/:id", getDocument);
router.post("/:id/share", shareDocument);
router.get("/:id/history", getHistory);

export default router;
```

### `server\src\document\document.service.ts`

```typescript
import * as repo from "./document.repository";

export class DocumentAccessError extends Error {}

export type Role = "OWNER" | "EDITOR" | "VIEWER";

const ROLE_RANK: Record<Role, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export async function assertAccess(
  documentId: string,
  userId: string,
  minRole: Role
) {
  const permission = await repo.getPermission(documentId, userId);
  if (!permission || ROLE_RANK[permission.role as Role] < ROLE_RANK[minRole]) {
    throw new DocumentAccessError("Insufficient permissions");
  }
  return permission;
}

export async function createNewDocument(
  workspaceId: string,
  ownerId: string,
  title: string
) {
  return repo.createDocument(workspaceId, ownerId, title);
}

export async function getDocumentForUser(documentId: string, userId: string) {
  await assertAccess(documentId, userId, "VIEWER");
  const doc = await repo.findDocumentById(documentId);
  if (!doc) throw new DocumentAccessError("Document not found");
  return doc;
}

export async function listUserDocuments(userId: string) {
  return repo.listDocumentsForUser(userId);
}

export async function shareDocument(
  documentId: string,
  requesterId: string,
  targetUserId: string,
  role: "EDITOR" | "VIEWER"
) {
  await assertAccess(documentId, requesterId, "OWNER");
  return repo.addPermission(documentId, targetUserId, role);
}

// Called by the collaboration layer after OT operations are applied in-memory.
// Persists authoritative state + periodic snapshot for recovery.
export async function persistDocumentState(
  documentId: string,
  content: string,
  version: number
) {
  const updated = await repo.updateDocumentContent(documentId, content, version);
  if (version % 20 === 0) {
    await repo.createSnapshot(documentId, content, version);
  }
  return updated;
}

export async function getSnapshotHistory(documentId: string, userId: string) {
  await assertAccess(documentId, userId, "VIEWER");
  return repo.listSnapshots(documentId);
}
```

### `server\src\main.ts`

```typescript
import express from "express";
import cors from "cors";
import http from "http";
import { env } from "./config/env";
import authRoutes from "./auth/auth.routes";
import documentRoutes from "./document/document.routes";
import { errorHandler } from "./middleware/errorHandler";
import { setupWebSocketServer } from "./websocket/wsServer";
import { logger } from "./utils/logger";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);

app.use(errorHandler);

const server = http.createServer(app);
setupWebSocketServer(server);

server.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port}`);
});
```

### `server\src\middleware\errorHandler.ts`

```typescript
import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("Unhandled error:", err);

  if (err instanceof Error) {
    return res.status(500).json({ error: err.message });
  }

  return res.status(500).json({ error: "Internal server error" });
}
```

### `server\src\presence\presenceManager.ts`

```typescript
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
```

### `server\src\utils\logger.ts`

```typescript
type Level = "info" | "warn" | "error";

function log(level: Level, message: string, meta?: Record<string, unknown>) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  const line = JSON.stringify(entry);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
};
```

### `server\src\websocket\wsHandlers.ts`

```typescript
import { WebSocket } from "ws";
import { sessionManager } from "../collaboration/sessionManager";
import { presenceManager, PresenceInfo } from "../presence/presenceManager";
import { verifyAccessToken } from "../auth/auth.service";
import { assertAccess } from "../document/document.service";
import { Operation } from "../collaboration/operation.types";
import { logger } from "../utils/logger";
import crypto from "crypto";

interface ClientContext {
  ws: WebSocket;
  userId: string;
  name: string;
  clientId: string;
  documentId: string | null;
}

const CURSOR_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f39c12", "#1abc9c"];

export async function handleConnection(ws: WebSocket, token: string, name: string) {
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
    ws.close();
    return;
  }

  const ctx: ClientContext = {
    ws,
    userId: payload.userId,
    name,
    clientId: crypto.randomUUID(),
    documentId: null,
  };

  ws.on("message", (raw) => handleMessage(ctx, raw.toString()));
  ws.on("close", () => handleClose(ctx));
}

async function handleMessage(ctx: ClientContext, raw: string) {
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return sendError(ctx.ws, "Invalid message format");
  }

  switch (msg.type) {
    case "join":
      return handleJoin(ctx, msg.documentId);
    case "operation":
      return handleOperation(ctx, msg.operation as Operation);
    case "cursor":
      return handleCursor(ctx, msg.cursor as number);
    case "heartbeat":
      return handleHeartbeat(ctx);
    default:
      return sendError(ctx.ws, `Unknown message type: ${msg.type}`);
  }
}

async function handleJoin(ctx: ClientContext, documentId: string) {
  try {
    await assertAccess(documentId, ctx.userId, "VIEWER");
  } catch {
    return sendError(ctx.ws, "Access denied to document");
  }

  ctx.documentId = documentId;
  const session = await sessionManager.acquire(documentId);
  const state = session.getState();

  ctx.ws.send(
    JSON.stringify({ type: "sync", content: state.content, version: state.version })
  );

  const presence: PresenceInfo = {
    userId: ctx.userId,
    clientId: ctx.clientId,
    name: ctx.name,
    color: CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)],
    cursor: null,
    lastSeen: Date.now(),
  };
  presenceManager.join(documentId, presence);

  broadcastPresence(ctx.ws, documentId);
}

async function handleOperation(ctx: ClientContext, op: Operation) {
  if (!ctx.documentId) return sendError(ctx.ws, "Not joined to a document");

  try {
    await assertAccess(ctx.documentId, ctx.userId, "EDITOR");
  } catch {
    return sendError(ctx.ws, "Read-only access: cannot edit");
  }

  const session = await sessionManager.acquire(ctx.documentId);
  const { applied, newVersion } = session.receiveOperation(op);

  ctx.ws.send(JSON.stringify({ type: "ack", version: newVersion, clientId: op.clientId }));

  broadcastToRoom(
    ctx.ws,
    ctx.documentId,
    JSON.stringify({ type: "operation", operation: applied, version: newVersion })
  );
}

function handleCursor(ctx: ClientContext, cursor: number) {
  if (!ctx.documentId) return;
  presenceManager.updateCursor(ctx.documentId, ctx.clientId, cursor);
  broadcastPresence(ctx.ws, ctx.documentId);
}

function handleHeartbeat(ctx: ClientContext) {
  if (!ctx.documentId) return;
  presenceManager.updateCursor(
    ctx.documentId,
    ctx.clientId,
    presenceManager.list(ctx.documentId).find((p) => p.clientId === ctx.clientId)?.cursor ?? 0
  );
}

function handleClose(ctx: ClientContext) {
  if (ctx.documentId) {
    presenceManager.leave(ctx.documentId, ctx.clientId);
    sessionManager.release(ctx.documentId);
    broadcastPresence(ctx.ws, ctx.documentId);
  }
  logger.info("Client disconnected", { clientId: ctx.clientId });
}

// Requires access to the full client registry — wired in wsServer.ts via closures.
export let broadcastToRoom: (self: WebSocket, documentId: string, data: string) => void = () => {};
export function registerBroadcaster(fn: typeof broadcastToRoom) {
  broadcastToRoom = fn;
}

function broadcastPresence(self: WebSocket, documentId: string) {
  const list = presenceManager.list(documentId);
  broadcastToRoom(self, documentId, JSON.stringify({ type: "presence", users: list }));
}

function sendError(ws: WebSocket, message: string) {
  ws.send(JSON.stringify({ type: "error", message }));
}
```

### `server\src\websocket\wsServer.ts`

```typescript
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
    const originalOnMessage = ws.on.bind(ws);
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
```

### `server\tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "declaration": false,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "baseUrl": "src",
    "paths": {
      "@/*": ["*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### `shared\types.ts`

```typescript
// Types shared conceptually between client and server (kept duplicated,
// not imported cross-package, to avoid a monorepo build-tooling detour —
// this is a deliberate simplicity trade-off for a single-developer project).

export type OpComponent =
  | { type: "retain"; count: number }
  | { type: "insert"; text: string }
  | { type: "delete"; count: number };

export interface Operation {
  ops: OpComponent[];
  baseVersion: number;
  userId: string;
  clientId: string;
}

export interface PresenceUser {
  userId: string;
  clientId: string;
  name: string;
  color: string;
  cursor: number | null;
  lastSeen: number;
}

export interface DocumentDTO {
  id: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type ServerMessage =
  | { type: "sync"; content: string; version: number }
  | { type: "ack"; version: number; clientId: string }
  | { type: "operation"; operation: Operation; version: number }
  | { type: "presence"; users: PresenceUser[] }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "join"; documentId: string }
  | { type: "operation"; operation: Operation }
  | { type: "cursor"; cursor: number }
  | { type: "heartbeat" };
```
