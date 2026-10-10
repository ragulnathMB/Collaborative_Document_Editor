import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, tokenStore } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const authenticate = useCallback(async (mode, form) => {
    const r = await (mode === 'login' ? api.login(form) : api.register(form));
    tokenStore.set(r.token);
    setUser(r.user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  return <AuthCtx.Provider value={{ user, loading, authenticate, logout }}>{children}</AuthCtx.Provider>;
}
