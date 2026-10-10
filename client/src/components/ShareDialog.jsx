import { useState } from 'react';
import { api } from '../api.js';
import Avatar from './Avatar.jsx';
import { IconLink } from './Icons.jsx';

export default function ShareDialog({ docId, members, setMembers, onClose }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { member } = await api.addMember(docId, email, role);
      setMembers((m) => [...m.filter((x) => x.id !== member.id), member]);
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (m, newRole) => {
    try {
      await api.addMember(docId, m.email, newRole);
      setMembers((list) => list.map((x) => (x.id === m.id ? { ...x, role: newRole } : x)));
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    try {
      await api.removeMember(docId, id);
      setMembers((m) => m.filter((x) => x.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>Share document</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="share-form" onSubmit={add}>
          <input type="email" placeholder="Add people by email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button className="btn primary" disabled={busy}>Invite</button>
        </form>
        {error && <div className="alert">{error}</div>}

        <div className="section-label">People with access</div>
        <ul className="members">
          {members.length === 0 && <li className="muted small">Only you can access this document.</li>}
          {members.map((m) => (
            <li key={m.id}>
              <Avatar user={m} size={34} />
              <div className="grow">
                <div className="member-name">{m.name}</div>
                <div className="muted small">{m.email}</div>
              </div>
              <select value={m.role} onChange={(e) => changeRole(m, e.target.value)}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button className="btn ghost danger" onClick={() => remove(m.id)}>Remove</button>
            </li>
          ))}
        </ul>

        <div className="modal-foot">
          <button className="btn" onClick={copy}><IconLink /> {copied ? 'Copied!' : 'Copy link'}</button>
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
