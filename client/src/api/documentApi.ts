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
