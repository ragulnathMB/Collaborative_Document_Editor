import { useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import {
  synced,
  connectionStatusChanged,
  operationAcked,
  remoteOperationApplied,
} from "./editorSlice";
import { presenceUpdated } from "../presence/presenceSlice";
import { Operation, ServerMessage, ClientMessage } from "../../types";

// Encapsulates the WebSocket lifecycle: connect, join, send ops, receive
// sync/ack/operation/presence messages, and reconnect with exponential
// backoff on drop. Keeping this in a hook (not a thunk) lets React own
// the socket's lifetime alongside the Editor component that uses it.
export function useCollabSocket(documentId: string | null) {
  const dispatch = useDispatch();
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const user = useSelector((state: RootState) => state.auth.user);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const connect = useCallback(() => {
    if (!documentId || !accessToken || !user) return;

    dispatch(connectionStatusChanged("connecting"));

    const wsUrl = `ws://${window.location.hostname}:4000/ws?token=${accessToken}&name=${encodeURIComponent(
      user.name
    )}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      reconnectAttempt.current = 0;
      const joinMsg: ClientMessage = { type: "join", documentId };
      ws.send(JSON.stringify(joinMsg));

      heartbeatInterval.current = setInterval(() => {
        ws.send(JSON.stringify({ type: "heartbeat" }));
      }, 15000);
    };

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);

      switch (msg.type) {
        case "sync":
          dispatch(synced({ content: msg.content, version: msg.version }));
          break;
        case "ack":
          dispatch(operationAcked({ version: msg.version }));
          break;
        case "operation":
          dispatch(remoteOperationApplied({ operation: msg.operation, version: msg.version }));
          break;
        case "presence":
          dispatch(presenceUpdated({ documentId, users: msg.users }));
          break;
        case "error":
          console.error("Server error:", msg.message);
          break;
      }
    };

    ws.onclose = () => {
      dispatch(connectionStatusChanged("disconnected"));
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);

      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 15000);
      reconnectAttempt.current += 1;
      setTimeout(connect, delay);
    };
  }, [documentId, accessToken, user, dispatch]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    };
  }, [connect]);

  const sendOperation = useCallback((op: Operation) => {
    socketRef.current?.send(JSON.stringify({ type: "operation", operation: op } as ClientMessage));
  }, []);

  const sendCursor = useCallback((cursor: number) => {
    socketRef.current?.send(JSON.stringify({ type: "cursor", cursor } as ClientMessage));
  }, []);

  return { sendOperation, sendCursor };
}
