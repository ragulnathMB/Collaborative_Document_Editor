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
