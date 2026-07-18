import { useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { documentOpened, localEditMade, editorReset } from "./editorSlice";
import { presenceCleared } from "../presence/presenceSlice";
import { useCollabSocket } from "./useCollabSocket";
import { diffToOperation } from "./ot";
import PresenceBar from "../presence/PresenceBar";
import { Link } from "react-router-dom";

interface EditorProps {
  documentId: string;
}

// Deliberately a plain <textarea>-backed editor rather than a rich-text
// tree (Lexical/ProseMirror) — the OT engine operates on flat text ranges,
// which keeps the focus on synchronization mechanics rather than DOM
// contenteditable complexity. Swapping in a rich-text tree later only
// changes how operations are generated, not how they're transformed/sent.
export default function Editor({ documentId }: EditorProps) {
  const dispatch = useDispatch();
  const content = useSelector((state: RootState) => state.editor.content);
  const version = useSelector((state: RootState) => state.editor.version);
  const connectionStatus = useSelector((state: RootState) => state.editor.connectionStatus);
  const user = useSelector((state: RootState) => state.auth.user);

  const clientIdRef = useRef(crypto.randomUUID());
  const prevContentRef = useRef(content);
  const { sendOperation, sendCursor } = useCollabSocket(documentId);

  useEffect(() => {
    dispatch(documentOpened({ documentId }));
    return () => {
      dispatch(editorReset());
      dispatch(presenceCleared({ documentId }));
    };
  }, [documentId, dispatch]);

  useEffect(() => {
    prevContentRef.current = content;
  }, [content]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      const op = diffToOperation(
        prevContentRef.current,
        newContent,
        version,
        user?.id ?? "unknown",
        clientIdRef.current
      );

      dispatch(localEditMade({ content: newContent, op }));
      sendOperation(op);
    },
    [version, user, dispatch, sendOperation]
  );

  const handleSelect = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      sendCursor(target.selectionStart);
    },
    [sendCursor]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-3">
          <Link to="/workspaces" className="text-sm text-blue-600">
            ← Workspaces
          </Link>
          <span className="text-sm text-gray-500">
            {connectionStatus === "connected" ? "Connected" : "Reconnecting..."}
          </span>
        </div>
        <PresenceBar documentId={documentId} />
      </div>
      <textarea
        className="flex-1 p-4 outline-none resize-none font-mono text-sm"
        value={content}
        onChange={handleChange}
        onSelect={handleSelect}
        spellCheck={false}
      />
    </div>
  );
}
