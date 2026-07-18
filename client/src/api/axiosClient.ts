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
