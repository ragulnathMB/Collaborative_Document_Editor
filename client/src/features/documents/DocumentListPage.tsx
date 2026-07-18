import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams, Link } from "react-router-dom";
import { AppDispatch, RootState } from "../../app/store";
import { loadDocuments, createNewDocument, selectAllDocuments } from "./documentsSlice";
import { loadWorkspaces, selectWorkspaceById } from "../workspaces/workspacesSlice";
import NavBar from "../../components/NavBar";

export default function DocumentListPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const allDocuments = useSelector(selectAllDocuments);
  const workspacesStatus = useSelector((state: RootState) => state.workspaces.status);
  const workspace = useSelector(workspaceId ? selectWorkspaceById(workspaceId) : () => undefined);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Documents scoped to the workspace in the URL — the list endpoint returns
  // every document the user can see across all workspaces, so filter here.
  const documents = allDocuments.filter((doc) => doc.workspaceId === workspaceId);

  useEffect(() => {
    dispatch(loadDocuments());
    if (workspacesStatus === "idle") {
      dispatch(loadWorkspaces());
    }
  }, [dispatch, workspacesStatus]);

  if (!workspaceId) {
    navigate("/workspaces", { replace: true });
    return null;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);

    const result = await dispatch(createNewDocument({ workspaceId, title }));
    if (createNewDocument.fulfilled.match(result)) {
      setTitle("");
      navigate(`/documents/${result.payload.id}`);
    } else {
      setError("Could not create document — you may not have access to this workspace.");
    }
  };

  return (
    <div>
      <NavBar />
      <div className="max-w-2xl mx-auto py-10 px-4">
        <Link to="/workspaces" className="text-sm text-blue-600">
          ← All workspaces
        </Link>
        <h1 className="text-2xl font-bold mt-2 mb-6">
          {workspace ? workspace.name : "Documents"}
        </h1>

        <form onSubmit={handleCreate} className="flex gap-2 mb-2">
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
        {error && <p className="text-red-500 text-sm mb-6">{error}</p>}
        {!error && <div className="mb-8" />}

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
    </div>
  );
}
