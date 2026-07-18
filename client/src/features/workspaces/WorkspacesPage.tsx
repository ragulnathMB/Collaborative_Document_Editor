import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { AppDispatch } from "../../app/store";
import { loadWorkspaces, createNewWorkspace, selectAllWorkspaces } from "./workspacesSlice";
import { inviteWorkspaceMember, fetchWorkspaceMembers } from "../../api/workspaceApi";
import { WorkspaceMemberDTO } from "../../types";
import NavBar from "../../components/NavBar";

export default function WorkspacesPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const workspaces = useSelector(selectAllWorkspaces);
  const [name, setName] = useState("");

  const [inviteOpenFor, setInviteOpenFor] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberDTO[]>([]);

  useEffect(() => {
    dispatch(loadWorkspaces());
  }, [dispatch]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await dispatch(createNewWorkspace({ name }));
    if (createNewWorkspace.fulfilled.match(result)) {
      setName("");
    }
  };

  const openInvite = async (workspaceId: string) => {
    setInviteOpenFor(workspaceId);
    setInviteEmail("");
    setInviteStatus(null);
    try {
      setMembers(await fetchWorkspaceMembers(workspaceId));
    } catch {
      setMembers([]);
    }
  };

  const handleInvite = async (e: React.FormEvent, workspaceId: string) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      const member = await inviteWorkspaceMember(workspaceId, inviteEmail);
      setMembers((prev) => [...prev, member]);
      setInviteEmail("");
      setInviteStatus(null);
    } catch (err: any) {
      setInviteStatus(err?.response?.data?.error ?? "Could not invite that user");
    }
  };

  return (
    <div>
      <NavBar />
      <div className="max-w-2xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-bold mb-6">Your Workspaces</h1>

        <form onSubmit={handleCreate} className="flex gap-2 mb-8">
          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder="New workspace name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
            Create
          </button>
        </form>

        <ul className="divide-y border rounded">
          {workspaces.map((ws) => (
            <li key={ws.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div
                  className="cursor-pointer"
                  onClick={() => navigate(`/workspaces/${ws.id}/documents`)}
                >
                  <span className="font-medium">{ws.name}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {ws.role === "OWNER" ? "Owner" : "Member"} · {ws.memberCount}{" "}
                    {ws.memberCount === 1 ? "member" : "members"}
                  </span>
                </div>
                <div className="flex gap-3 text-sm">
                  <button
                    className="text-blue-600"
                    onClick={() => navigate(`/workspaces/${ws.id}/documents`)}
                  >
                    Open
                  </button>
                  {ws.role === "OWNER" && (
                    <button
                      className="text-gray-500"
                      onClick={() =>
                        inviteOpenFor === ws.id ? setInviteOpenFor(null) : openInvite(ws.id)
                      }
                    >
                      {inviteOpenFor === ws.id ? "Close" : "Invite"}
                    </button>
                  )}
                </div>
              </div>

              {inviteOpenFor === ws.id && (
                <div className="mt-3 bg-gray-50 border rounded p-3">
                  <form onSubmit={(e) => handleInvite(e, ws.id)} className="flex gap-2">
                    <input
                      className="flex-1 border rounded px-3 py-1.5 text-sm"
                      placeholder="Member's email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm"
                    >
                      Add
                    </button>
                  </form>
                  {inviteStatus && (
                    <p className="text-red-500 text-xs mt-2">{inviteStatus}</p>
                  )}
                  <ul className="mt-3 space-y-1">
                    {members.map((m) => (
                      <li key={m.userId} className="text-xs text-gray-600 flex justify-between">
                        <span>
                          {m.name} ({m.email})
                        </span>
                        <span className="text-gray-400">{m.role}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
          {workspaces.length === 0 && (
            <li className="px-4 py-6 text-center text-gray-400">
              No workspaces yet — create one above to get started.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
