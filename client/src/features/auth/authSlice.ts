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
