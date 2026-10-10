import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Avatar from '../components/Avatar.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { IconDoc, IconLogout, IconPlus, IconSearch, IconTrash, Logo } from '../components/Icons.jsx';
import { gradientFor, timeAgo } from '../utils.js';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .listDocs()
      .then((r) => setDocs(r.documents))
      .catch((e) => (e.status === 401 ? logout() : setError(e.message)))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    setCreating(true);
    try {
      const r = await api.createDoc('Untitled document');
      nav(`/doc/${r.document.id}`);
    } catch (e) {
      setError(e.message);
      setCreating(false);
    }
  };

  const remove = async (e, d) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${d.title}"? This cannot be undone.`)) return;
    try {
      await api.deleteDoc(d.id);
      setDocs((x) => x.filter((y) => y.id !== d.id));
    } catch (err) {
      setError(err.message);
    }
  };

  const counts = useMemo(
    () => ({ all: docs.length, mine: docs.filter((d) => d.role === 'owner').length, shared: docs.filter((d) => d.role !== 'owner').length }),
    [docs]
  );

  const shown = docs
    .filter((d) => (tab === 'all' ? true : tab === 'mine' ? d.role === 'owner' : d.role !== 'owner'))
    .filter((d) => d.title.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="app">
      <header className="header">
        <div className="brand-row"><Logo /><span>CollabDocs</span></div>
        <label className="search">
          <IconSearch />
          <input placeholder="Search documents" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="grow" />
        <ThemeToggle />
        <div className="user-chip">
          <Avatar user={user} size={30} />
          <span className="user-name">{user.name}</span>
        </div>
        <button className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out"><IconLogout /></button>
      </header>

      <main className="container">
        <div className="page-head">
          <div>
            <h1>Documents</h1>
            <p className="muted">Create, edit and share documents in real time.</p>
          </div>
          <button className="btn primary lg" onClick={create} disabled={creating}>
            <IconPlus /> {creating ? 'Creating…' : 'New document'}
          </button>
        </div>

        <div className="tabs">
          {[['all', 'All'], ['mine', 'Owned by me'], ['shared', 'Shared with me']].map(([k, label]) => (
            <button key={k} className={tab === k ? 'tab active' : 'tab'} onClick={() => setTab(k)}>
              {label} <span className="count">{counts[k]}</span>
            </button>
          ))}
        </div>

        {error && <div className="alert">{error}</div>}

        {loading ? (
          <div className="grid">{[0, 1, 2, 3].map((i) => <div key={i} className="doc-card skeleton" />)}</div>
        ) : shown.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><IconDoc width={34} height={34} /></div>
            <h3>{q ? 'No matching documents' : 'No documents yet'}</h3>
            <p className="muted">{q ? 'Try a different search term.' : 'Create your first document to get started.'}</p>
            {!q && tab !== 'shared' && <button className="btn primary" onClick={create}><IconPlus /> New document</button>}
          </div>
        ) : (
          <div className="grid">
            {shown.map((d) => (
              <Link key={d.id} to={`/doc/${d.id}`} className="doc-card">
                <div className="doc-thumb" style={{ background: gradientFor(d.id) }}>
                  <div className="paper"><i /><i /><i className="short" /></div>
                </div>
                <div className="doc-body">
                  <div className="doc-title" title={d.title}>{d.title}</div>
                  <div className="doc-meta">
                    <span className={`badge ${d.role}`}>{d.role}</span>
                    <span className="muted small">{d.role === 'owner' ? 'Edited' : `by ${d.owner_name} ·`} {timeAgo(d.updated_at)}</span>
                  </div>
                </div>
                {d.role === 'owner' && (
                  <button className="doc-delete" onClick={(e) => remove(e, d)} title="Delete" aria-label="Delete document"><IconTrash width={16} height={16} /></button>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
