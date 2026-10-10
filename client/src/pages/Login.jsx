import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { IconBolt, IconLock, IconUsers, Logo } from '../components/Icons.jsx';

export default function Login() {
  const { authenticate } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await authenticate(mode, form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <div className="auth-layout">
      <aside className="auth-hero">
        <div className="brand-row"><Logo size={36} /><span>CollabDocs</span></div>
        <h1>Write together,<br />in real time.</h1>
        <p>A fast collaborative editor with live cursors, instant sync and secure sharing.</p>
        <ul>
          <li><IconBolt /> Conflict-free live editing powered by CRDTs</li>
          <li><IconUsers /> See collaborators' cursors as they type</li>
          <li><IconLock /> Role-based sharing: owner, editor, viewer</li>
        </ul>
      </aside>

      <main className="auth-panel">
        <div className="auth-theme"><ThemeToggle /></div>
        <form className="auth-form" onSubmit={submit}>
          <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
          <p className="muted">{isLogin ? 'Sign in to continue to your documents.' : 'Start collaborating in under a minute.'}</p>

          {!isLogin && (
            <label>Full name<input placeholder="Jane Doe" value={form.name} onChange={set('name')} required autoFocus /></label>
          )}
          <label>Email<input type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required autoFocus={isLogin} /></label>
          <label>Password<input type="password" placeholder="At least 8 characters" value={form.password} onChange={set('password')} required minLength={isLogin ? undefined : 8} /></label>

          {error && <div className="alert">{error}</div>}
          <button className="btn primary lg" disabled={busy}>{busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}</button>

          <p className="switch muted">
            {isLogin ? "Don't have an account? " : 'Already registered? '}
            <button type="button" className="link" onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(''); }}>
              {isLogin ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}
