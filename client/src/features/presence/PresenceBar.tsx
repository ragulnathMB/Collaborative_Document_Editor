import { useSelector } from "react-redux";
import { selectPresenceForDocument } from "./presenceSlice";
import { PresenceUser } from "../../types";

interface PresenceBarProps {
  documentId: string;
}

export default function PresenceBar({ documentId }: PresenceBarProps) {
  const users = useSelector(selectPresenceForDocument(documentId));

  return (
    <div className="flex items-center gap-1">
      {users.map((u: PresenceUser) => (
        <div
          key={u.clientId}
          title={u.name}
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-semibold"
          style={{ backgroundColor: u.color }}
        >
          {u.name.charAt(0).toUpperCase()}
        </div>
      ))}
    </div>
  );
}
