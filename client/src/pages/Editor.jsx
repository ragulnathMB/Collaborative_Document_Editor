import { useCallback, useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';
import { QuillBinding } from 'y-quill';
import 'quill/dist/quill.snow.css';
import { api, tokenStore } from '../api.js';
import { useAuth } from '../auth.jsx';
import { CollabProvider } from '../provider.js';
import Avatar from '../components/Avatar.jsx';
import ShareDialog from '../components/ShareDialog.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { IconBack, IconShare, IconWide, Logo } from '../components/Icons.jsx';
import { colorFor } from '../utils.js';

Quill.register('modules/cursors', QuillCursors);

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }, { align: [] }],
  ['blockquote', 'code-block', 'link'],
  [{ color: [] }, { background: [] }],
  ['clean'],
];

export default function Editor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const shellRef = useRef(null);
  const [info, setInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('connecting');
  const [synced, setSynced] = useState(false);
  const [peers, setPeers] = useState([]);
  const [showShare, setShowShare] = useState(false);
  const [wide, setWide] = useState(false);
  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const [epoch, setEpoch] = useState(0); // bump to force a fresh connection

  const role = info?.document.role;
  const canWrite = role === 'owner' || role === 'editor';

  const loadInfo = useCallback(() => {
    return api
      .getDoc(id)
      .then((r) => {
        setInfo(r);
        setMembers(r.members);
        setTitle(r.document.title);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    setInfo(null);
    setError('');
    loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    if (!info || !shellRef.current) return;
    const shell = shellRef.current;
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('quill');
    const awareness = new Awareness(ydoc);
    awareness.setLocalStateField('user', { id: user.id, name: user.name, color: colorFor(user.id) });

    const container = document.createElement('div');
    shell.appendChild(container);
    const quill = new Quill(container, {
      theme: 'snow',
      readOnly: !canWrite,
      placeholder: canWrite ? 'Start typing…' : 'This document is empty',
      modules: { cursors: true, toolbar: canWrite ? TOOLBAR : false, history: { userOnly: true } },
    });
    const binding = new QuillBinding(ytext, quill, awareness);

    const updateCounts = () => {
      const t = quill.getText().trim();
      setCounts({ words: t ? t.split(/\s+/).length : 0, chars: t.length });
    };
    quill.on('text-change', updateCounts);
    updateCounts();

    // click on the grey canvas focuses the editor
    const onCanvasClick = (e) => {
      if (e.target === container && canWrite) quill.setSelection(quill.getLength(), 0);
    };
    container.addEventListener('mousedown', onCanvasClick);

    const updatePeers = () => {
      const seen = new Map();
      awareness.getStates().forEach((s, clientId) => {
        if (clientId !== ydoc.clientID && s.user && !seen.has(s.user.id)) seen.set(s.user.id, s.user);
      });
      setPeers(Array.from(seen.values()));
    };
    awareness.on('change', updatePeers);

    const provider = new CollabProvider({
      url: () => {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        return `${proto}://${location.host}/ws?doc=${id}&token=${encodeURIComponent(tokenStore.get())}`;
      },
      doc: ydoc,
      awareness,
      onStatus: setStatus,
      onSynced: setSynced,
      onClose: (code) => {
        if (code === 4001) loadInfo().then(() => setEpoch((n) => n + 1));
        else if (code === 4401) nav('/login');
        else if (code === 4403 || code === 4404) setError('You no longer have access to this document.');
      },
    });

    return () => {
      provider.destroy();
      binding.destroy();
      quill.off('text-change', updateCounts);
      awareness.off('change', updatePeers);
      awareness.destroy();
      ydoc.destroy();
      setPeers([]);
      setSynced(false);
      shell.innerHTML = '';
    };
  }, [info?.document.id, role, epoch]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTitle = async () => {
    const t = title.trim() || 'Untitled document';
    setTitle(t);
    if (t === info.document.title) return;
    try {
      await api.renameDoc(id, t);
      setInfo((i) => ({ ...i, document: { ...i.document, title: t } }));
    } catch (e) {
      setError(e.message);
    }
  };

  if (error)
    return (
      <div className="center-screen">
        <div className="notice">
          <h3>Can't open this document</h3>
          <p className="muted">{error}</p>
          <Link to="/" className="btn primary">Back to documents</Link>
        </div>
      </div>
    );
  if (!info) return <div className="center-screen muted">Loading document…</div>;

  const state = status === 'connected' ? (synced ? 'ok' : 'syncing') : status === 'connecting' ? 'syncing' : 'off';
  const label = { ok: 'Synced', syncing: status === 'connecting' ? 'Connecting…' : 'Syncing…', off: 'Offline · reconnecting' }[state];
  const shownPeers = peers.slice(0, 4);

  return (
    <div className="editor-page">
      <header className="header editor-header">
        <Link to="/" className="icon-btn" title="All documents" aria-label="Back"><IconBack /></Link>
        <Logo size={26} />
        <input
          className="title-input"
          value={title}
          disabled={!canWrite}
          maxLength={200}
          style={{ width: `${Math.min(Math.max(title.length, 10) + 2, 48)}ch` }}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <span className={`pill ${state}`}><i />{label}</span>
        {!canWrite && <span className="badge viewer">View only</span>}
        <div className="grow" />
        <div className="avatars">
          {peers.length > shownPeers.length && <span className="avatar more">+{peers.length - shownPeers.length}</span>}
          {shownPeers.map((p) => <Avatar key={p.id} user={p} size={30} ring />)}
          <Avatar user={{ ...user, color: colorFor(user.id) }} size={30} ring title={`${user.name} (you)`} />
        </div>
        <button className={`icon-btn ${wide ? 'active' : ''}`} onClick={() => setWide((w) => !w)} title="Toggle wide page" aria-label="Toggle wide page"><IconWide /></button>
        <ThemeToggle />
        {role === 'owner' && <button className="btn primary" onClick={() => setShowShare(true)}><IconShare /> Share</button>}
      </header>

      <div className={`editor-shell ${wide ? 'wide' : ''}`} ref={shellRef} />

      <footer className="statusbar">
        <span>{counts.words} words · {counts.chars} characters</span>
        <span className="grow" />
        <span>{peers.length ? `${peers.length + 1} people editing` : 'Only you'}</span>
      </footer>

      {showShare && <ShareDialog docId={id} members={members} setMembers={setMembers} onClose={() => setShowShare(false)} />}
    </div>
  );
}
