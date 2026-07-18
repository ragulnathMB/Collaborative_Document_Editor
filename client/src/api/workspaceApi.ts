import axiosClient from "./axiosClient";
import { WorkspaceDTO, WorkspaceMemberDTO } from "../types";

export async function fetchWorkspaces() {
  const { data } = await axiosClient.get<WorkspaceDTO[]>("/workspaces");
  return data;
}

export async function createWorkspace(name: string) {
  const { data } = await axiosClient.post<WorkspaceDTO>("/workspaces", { name });
  return data;
}

export async function fetchWorkspaceMembers(workspaceId: string) {
  const { data } = await axiosClient.get<WorkspaceMemberDTO[]>(`/workspaces/${workspaceId}/members`);
  return data;
}

export async function inviteWorkspaceMember(workspaceId: string, email: string) {
  const { data } = await axiosClient.post<WorkspaceMemberDTO>(`/workspaces/${workspaceId}/invite`, {
    email,
  });
  return data;
}
