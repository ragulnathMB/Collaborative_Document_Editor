// Minimal Yjs <-> WebSocket provider (same wire protocol as y-websocket).
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

const encode = (type, write) => {
  const e = encoding.createEncoder();
  encoding.writeVarUint(e, type);
  write(e);
  return encoding.toUint8Array(e);
};

export class CollabProvider {
  constructor({ url, doc, awareness, onStatus, onSynced, onClose }) {
    this.getUrl = url;
    this.doc = doc;
    this.awareness = awareness;
    this.onStatus = onStatus || (() => {});
    this.onSynced = onSynced || (() => {});
    this.onClose = onClose || (() => {});
    this.ws = null;
    this.retries = 0;
    this.timer = null;
    this.destroyed = false;
    this.synced = false;

    this._onDocUpdate = (update, origin) => {
      if (origin !== this) this._send(encode(MSG_SYNC, (e) => syncProtocol.writeUpdate(e, update)));
    };
    this._onAwareness = ({ added, updated, removed }, origin) => {
      if (origin === this) return;
      const changed = added.concat(updated, removed);
      this._send(
        encode(MSG_AWARENESS, (e) =>
          encoding.writeVarUint8Array(e, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed))
        )
      );
    };
    doc.on('update', this._onDocUpdate);
    awareness.on('update', this._onAwareness);
    this._beforeUnload = () =>
      awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], 'unload');
    window.addEventListener('beforeunload', this._beforeUnload);

    this.connect();
  }

  _send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(msg);
  }

  connect() {
    if (this.destroyed) return;
    this.onStatus('connecting');
    const ws = new WebSocket(this.getUrl());
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    // Ignore every event from a socket that is no longer the active one
    // (fixes the stuck "Offline" state caused by React StrictMode's double mount).
    const active = () => !this.destroyed && this.ws === ws;

    ws.onopen = () => {
      if (!active()) return ws.close();
      this.retries = 0;
      this.onStatus('connected');
      this._send(encode(MSG_SYNC, (e) => syncProtocol.writeSyncStep1(e, this.doc)));
      if (this.awareness.getLocalState() !== null) {
        this._send(
          encode(MSG_AWARENESS, (e) =>
            encoding.writeVarUint8Array(
              e,
              awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID])
            )
          )
        );
      }
    };

    ws.onmessage = (ev) => {
      if (!active()) return;
      const decoder = decoding.createDecoder(new Uint8Array(ev.data));
      const type = decoding.readVarUint(decoder);
      if (type === MSG_SYNC) {
        const reply = encoding.createEncoder();
        encoding.writeVarUint(reply, MSG_SYNC);
        const st = syncProtocol.readSyncMessage(decoder, reply, this.doc, this);
        if (st === syncProtocol.messageYjsSyncStep2 && !this.synced) {
          this.synced = true;
          this.onSynced(true);
        }
        if (encoding.length(reply) > 1) this._send(encoding.toUint8Array(reply));
      } else if (type === MSG_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), this);
      }
    };

    ws.onclose = (ev) => {
      if (!active()) return;
      this.ws = null;
      if (this.synced) {
        this.synced = false;
        this.onSynced(false);
      }
      const remote = Array.from(this.awareness.getStates().keys()).filter((id) => id !== this.doc.clientID);
      awarenessProtocol.removeAwarenessStates(this.awareness, remote, this);
      this.onStatus('disconnected');
      this.onClose(ev.code);
      if (ev.code >= 4000) return; // auth/permission errors: don't retry
      const delay = Math.min(1000 * 2 ** this.retries++, 15000);
      this.timer = setTimeout(() => this.connect(), delay);
    };

    ws.onerror = () => {};
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.timer);
    window.removeEventListener('beforeunload', this._beforeUnload);
    this.doc.off('update', this._onDocUpdate);
    this.awareness.off('update', this._onAwareness);
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], 'destroy');
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      if (ws.readyState === WebSocket.CONNECTING) ws.onopen = () => ws.close();
      else ws.close();
    }
  }
}
