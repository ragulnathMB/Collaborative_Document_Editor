// End-to-end smoke test. Start the server first (npm run dev), then: npm run smoke
import WebSocket from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const HTTP = process.env.API_URL || 'http://localhost:4000';
const WS = HTTP.replace(/^http/, 'ws');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => {
  if (!c) throw new Error('FAIL: ' + m);
  console.log('ok  -', m);
};

async function call(path, method = 'GET', body, token) {
  const r = await fetch(HTTP + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: r.status === 204 ? null : await r.json() };
}

function client(docId, token) {
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  const ws = new WebSocket(`${WS}/ws?doc=${docId}&token=${token}`);
  const c = { doc, ws, text: doc.getText('t'), closeCode: null, awareness };
  const enc = (t, f) => {
    const e = encoding.createEncoder();
    encoding.writeVarUint(e, t);
    f(e);
    return encoding.toUint8Array(e);
  };
  ws.on('open', () => ws.send(enc(0, (e) => syncProtocol.writeSyncStep1(e, doc))));
  ws.on('message', (d) => {
    const dec = decoding.createDecoder(new Uint8Array(d));
    const t = decoding.readVarUint(dec);
    if (t === 0) {
      const reply = encoding.createEncoder();
      encoding.writeVarUint(reply, 0);
      syncProtocol.readSyncMessage(dec, reply, doc, 'remote');
      if (encoding.length(reply) > 1) ws.send(encoding.toUint8Array(reply));
    } else if (t === 1) awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(dec), 'remote');
  });
  doc.on('update', (u, origin) => {
    if (origin !== 'remote' && ws.readyState === 1) ws.send(enc(0, (e) => syncProtocol.writeUpdate(e, u)));
  });
  ws.on('close', (code) => (c.closeCode = code));
  return c;
}

const suffix = Date.now();
const reg = async (n) =>
  (await call('/auth/register', 'POST', { email: `${n}${suffix}@t.dev`, name: n, password: 'password123' })).data;

const alice = await reg('alice');
const bob = await reg('bob');
const carol = await reg('carol');

const { data } = await call('/documents', 'POST', { title: 'Smoke' }, alice.token);
const docId = data.document.id;
assert(!!docId, 'document created');

let r = await call(`/documents/${docId}`, 'GET', null, bob.token);
assert(r.status === 404, 'non-member cannot read document');

await call(`/documents/${docId}/members`, 'POST', { email: bob.user.email, role: 'editor' }, alice.token);
await call(`/documents/${docId}/members`, 'POST', { email: carol.user.email, role: 'viewer' }, alice.token);

const a = client(docId, alice.token);
const b = client(docId, bob.token);
const cv = client(docId, carol.token);
await sleep(600);

a.text.insert(0, 'Hello');
await sleep(300);
b.text.insert(5, ' World');
await sleep(500);
assert(a.text.toString() === 'Hello World', 'alice sees merged text');
assert(b.text.toString() === 'Hello World', 'bob sees merged text');
assert(cv.text.toString() === 'Hello World', 'viewer receives updates');

// concurrent edits converge
a.text.insert(0, 'A:');
b.text.insert(b.text.length, ' :B');
await sleep(600);
assert(a.text.toString() === b.text.toString(), 'concurrent edits converge: ' + JSON.stringify(a.text.toString()));

// viewer writes are ignored
cv.text.insert(0, 'HACK');
await sleep(500);
assert(!a.text.toString().includes('HACK'), 'viewer write rejected by server');

const expected = a.text.toString();
[a, b, cv].forEach((x) => x.ws.close());
await sleep(1200);

const d = client(docId, alice.token);
await sleep(800);
assert(d.text.toString() === expected, 'content persisted in PostgreSQL and reloaded');

const bad = client(docId, 'garbage');
await sleep(500);
assert(bad.closeCode === 4401, 'invalid token rejected');

await call(`/documents/${docId}/members/${bob.user.id}`, 'DELETE', null, alice.token);
const e = client(docId, bob.token);
await sleep(500);
assert(e.closeCode === 4404, 'revoked user cannot connect');

d.ws.close();
console.log('\nALL CHECKS PASSED');
process.exit(0);
