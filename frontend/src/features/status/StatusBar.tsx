import type { Session } from "../connections/types";

interface Props {
  status: string;
  sessions: Session[];
  activeSession: Session | null;
  backendAvailable: boolean;
}

export function StatusBar({ status, sessions, activeSession, backendAvailable }: Props) {
  const connectedCount = sessions.filter((session) => session.status === "connected").length;

  return (
    <footer className="statusbar tf-statusbar">
      <span>{backendAvailable ? "Backend online" : "Offline preview"}</span>
      <span>{status}</span>
      <span>{connectedCount} connected</span>
      <span>{activeSession ? `Active: ${activeSession.name}` : "No active session"}</span>
    </footer>
  );
}
