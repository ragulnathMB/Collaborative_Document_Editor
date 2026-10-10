const TOKEN_KEY = 'collab_token';
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request(path, { method = 'GET', body } = {}) {
  const token = tokenStore.get();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  register: (b) => request('/auth/register', { method: 'POST', body: b }),
  login: (b) => request('/auth/login', { method: 'POST', body: b }),
  me: () => request('/auth/me'),
  listDocs: () => request('/documents'),
  createDoc: (title) => request('/documents', { method: 'POST', body: { title } }),
  getDoc: (id) => request(`/documents/${id}`),
  renameDoc: (id, title) => request(`/documents/${id}`, { method: 'PATCH', body: { title } }),
  deleteDoc: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
  addMember: (id, email, role) =>
    request(`/documents/${id}/members`, { method: 'POST', body: { email, role } }),
  removeMember: (id, userId) => request(`/documents/${id}/members/${userId}`, { method: 'DELETE' }),
};
