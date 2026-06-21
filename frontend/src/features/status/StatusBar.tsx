import type { Connection, Session } from "../connections/types";

interface Props {
  status: string;
  sessions: Session[];
  activeSession: Session | null;
  activeConnection: Connection | null;
  backendAvailable: boolean;
}

export function StatusBar({ status, sessions, activeSession, activeConnection }: Props) {
  const connectedCount = sessions.filter((session) => session.status === "connected").length;
  const user = activeConnection?.username ?? "root";
  const host = activeConnection?.host ?? activeSession?.name ?? "localhost";
  const port = activeConnection?.port ?? 22;

  return (
    <footer className="statusbar tf-statusbar">
      <span className="sb-seg sb-brand-seg">›_ Portline v0.1.4</span>
      <span className="sb-seg">
        <span className="sb-status-dot" />
        {activeSession?.name ?? status}
      </span>
      <span className="sb-seg">⌘ {user} @ {host} : {port}</span>
      <span className="sb-seg right">{connectedCount} sessions</span>
      <span className="sb-seg">Encrypted</span>
    </footer>
  );
}
