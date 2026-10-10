import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { pool } from './db.js';
import { verifyToken } from './auth.js';
import { getAccess } from './access.js';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const FLUSH_MS = 400; // batch DB writes
const COMPACT_AFTER = 200; // rows before compacting into a single snapshot row

/** docId -> Promise<Room> */
const rooms = new Map();

const send = (ws, msg) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(msg, (err) => err && ws.terminate());
};

function encode(type, write) {
  const e = encoding.createEncoder();
  encoding.writeVarUint(e, type);
  write(e);
  return encoding.toUint8Array(e);
}

// ---------------------------------------------------------------- rooms
async function loadRoom(docId) {
  const ydoc = new Y.Doc({ gc: true });
  const { rows } = await pool.query(
    'SELECT update FROM document_updates WHERE document_id=$1 ORDER BY id',
    [docId]
  );
  ydoc.transact(() => {
    for (const r of rows) Y.applyUpdate(ydoc, new Uint8Array(r.update));
  }, 'db');

  const awareness = new awarenessProtocol.Awareness(ydoc);
  awareness.setLocalState(null); // the server has no presence of its own

  const room = {
    id: docId,
    ydoc,
    awareness,
    conns: new Map(), // ws -> { userId, role, clientIds:Set }
    pending: [],
    timer: null,
    chain: Promise.resolve(),
    rowCount: rows.length,
    dead: false,
  };

  ydoc.on('update', (update, origin) => {
    const msg = encode(MSG_SYNC, (e) => syncProtocol.writeUpdate(e, update));
    for (const ws of room.conns.keys()) if (ws !== origin) send(ws, msg);
    if (origin !== 'db') schedule(room, update);
  });

  awareness.on('update', ({ added, updated, removed }, origin) => {
    const info = room.conns.get(origin);
    if (info) {
      added.forEach((id) => info.clientIds.add(id));
      removed.forEach((id) => info.clientIds.delete(id));
    }
    const changed = added.concat(updated, removed);
    const msg = encode(MSG_AWARENESS, (e) =>
      encoding.writeVarUint8Array(e, awarenessProtocol.encodeAwarenessUpdate(awareness, changed))
    );
    for (const ws of room.conns.keys()) send(ws, msg);
  });

  return room;
}

function getRoom(docId) {
  let p = rooms.get(docId);
  if (!p) {
    p = loadRoom(docId);
    rooms.set(docId, p);
    p.catch(() => rooms.delete(docId));
  }
  return p;
}

// ---------------------------------------------------------- persistence
function schedule(room, update) {
  room.pending.push(update);
  if (!room.timer) room.timer = setTimeout(() => flush(room), FLUSH_MS);
}

function flush(room) {
  clearTimeout(room.timer);
  room.timer = null;
  room.chain = room.chain.then(async () => {
    if (room.dead || room.pending.length === 0) return;
    const batch = room.pending.splice(0);
    const merged = batch.length === 1 ? batch[0] : Y.mergeUpdates(batch);
    try {
      await pool.query('INSERT INTO document_updates(document_id, update) VALUES($1,$2)', [
        room.id,
        Buffer.from(merged),
      ]);
      await pool.query('UPDATE documents SET updated_at=now() WHERE id=$1', [room.id]);
      room.rowCount++;
      if (room.rowCount > COMPACT_AFTER) await compact(room);
    } catch (e) {
      if (e.code === '23503') return; // document was deleted
      console.error('[collab] flush failed, will retry', e.message);
      room.pending.unshift(merged);
      if (!room.timer) room.timer = setTimeout(() => flush(room), 2000);
    }
  });
  return room.chain;
}

async function compact(room) {
  const snapshot = Buffer.from(Y.encodeStateAsUpdate(room.ydoc));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM document_updates WHERE document_id=$1', [room.id]);
    await client.query('INSERT INTO document_updates(document_id, update) VALUES($1,$2)', [
      room.id,
      snapshot,
    ]);
    await client.query('COMMIT');
    room.rowCount = 1;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function maybeCloseRoom(room) {
  if (room.conns.size > 0) return;
  await flush(room);
  if (room.conns.size > 0) return; // someone joined while flushing
  rooms.delete(room.id);
  room.awareness.destroy();
  room.ydoc.destroy();
}

// ------------------------------------------------------------ messaging
function greet(room, ws) {
  send(ws, encode(MSG_SYNC, (e) => syncProtocol.writeSyncStep1(e, room.ydoc)));
  const ids = Array.from(room.awareness.getStates().keys());
  if (ids.length) {
    send(
      ws,
      encode(MSG_AWARENESS, (e) =>
        encoding.writeVarUint8Array(e, awarenessProtocol.encodeAwarenessUpdate(room.awareness, ids))
      )
    );
  }
}

function handleMessage(room, ws, info, data) {
  try {
    const decoder = decoding.createDecoder(data);
    const type = decoding.readVarUint(decoder);
    if (type === MSG_SYNC) {
      const syncType = decoding.readVarUint(decoder);
      const canWrite = info.role !== 'viewer';
      if (syncType === syncProtocol.messageYjsSyncStep1) {
        const reply = encoding.createEncoder();
        encoding.writeVarUint(reply, MSG_SYNC);
        syncProtocol.readSyncStep1(decoder, reply, room.ydoc);
        send(ws, encoding.toUint8Array(reply));
      } else if (canWrite && syncType === syncProtocol.messageYjsSyncStep2) {
        syncProtocol.readSyncStep2(decoder, room.ydoc, ws);
      } else if (canWrite && syncType === syncProtocol.messageYjsUpdate) {
        syncProtocol.readUpdate(decoder, room.ydoc, ws);
      } // viewers' writes are silently dropped
    } else if (type === MSG_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(room.awareness, decoding.readVarUint8Array(decoder), ws);
    }
  } catch (e) {
    console.error('[collab] bad message', e.message);
  }
}

// -------------------------------------------------------------- public API
export function disconnectUser(docId, userId, code = 4403, reason = 'Access revoked') {
  const p = rooms.get(docId);
  if (!p) return;
  p.then((room) => {
    for (const [ws, info] of room.conns) if (info.userId === userId) ws.close(code, reason);
  }).catch(() => {});
}

export function closeDoc(docId) {
  const p = rooms.get(docId);
  if (!p) return;
  p.then((room) => {
    room.dead = true;
    for (const ws of room.conns.keys()) ws.close(4404, 'Document deleted');
  }).catch(() => {});
}

async function authorize(url) {
  const token = url.searchParams.get('token');
  const docId = url.searchParams.get('doc');
  let user;
  try {
    user = verifyToken(token);
  } catch {
    return { error: 4401, reason: 'Unauthorized' };
  }
  const doc = await getAccess(docId, user.id);
  if (!doc) return { error: 4404, reason: 'Document not found' };
  return { docId: doc.id, user, role: doc.role };
}

export function attachCollab(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 });

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/ws') return socket.destroy();
    let result;
    try {
      result = await authorize(url);
    } catch (e) {
      console.error('[ws] authorize failed', e.message);
      result = { error: 4500, reason: 'Server error' };
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req, result));
  });

  wss.on('connection', (ws, _req, result) => {
    if (result.error) return ws.close(result.error, result.reason);

    const { docId, user, role } = result;
    const info = { userId: user.id, role, clientIds: new Set() };
    ws.binaryType = 'nodebuffer';
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));

    // Register listeners immediately; handlers wait for the room to load (order preserved).
    const ready = getRoom(docId).then((room) => {
      if (ws.readyState === WebSocket.OPEN) {
        room.conns.set(ws, info);
        greet(room, ws);
      }
      return room;
    });

    ws.on('message', async (data, isBinary) => {
      if (!isBinary) return;
      const room = await ready.catch(() => null);
      if (!room || !room.conns.has(ws)) return;
      handleMessage(room, ws, info, new Uint8Array(data));
    });

    ws.on('close', async () => {
      const room = await ready.catch(() => null);
      if (!room) return;
      room.conns.delete(ws);
      awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(info.clientIds), null);
      maybeCloseRoom(room).catch((e) => console.error('[collab] close room', e.message));
    });

    ws.on('error', (e) => console.error('[ws] error', e.message));
    ready.catch(() => ws.close(4500, 'Failed to load document'));
  });

  // Drop dead connections
  const hb = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
  wss.on('close', () => clearInterval(hb));

  // Flush everything on shutdown
  const shutdown = async () => {
    const all = await Promise.allSettled(Array.from(rooms.values()));
    await Promise.allSettled(all.filter((r) => r.status === 'fulfilled').map((r) => flush(r.value)));
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
