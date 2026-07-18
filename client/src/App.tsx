import { Navigate, Route, Routes } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "./app/store";
import LoginPage from "./features/auth/LoginPage";
import DocumentListPage from "./features/documents/DocumentListPage";
import WorkspacesPage from "./features/workspaces/WorkspacesPage";
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
        path="/workspaces"
        element={
          <RequireAuth>
            <WorkspacesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/workspaces/:workspaceId/documents"
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
      <Route path="*" element={<Navigate to="/workspaces" replace />} />
    </Routes>
  );
}
