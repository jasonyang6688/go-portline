import type { Session } from "../connections/types";

interface Props {
  sessions: Session[];
  activeSessionId: string | null;
  onActivate(sessionId: string): void;
}

export function SessionTabs({ sessions, activeSessionId, onActivate }: Props) {
  return (
    <div className="tabs tf-tabs" aria-label="Session tabs">
      {sessions.length === 0 ? (
        <span className="tab tf-tab tf-tab--placeholder">No active session</span>
      ) : (
        sessions.map((session) => (
          <button
            key={session.id}
            className={`tab tf-tab${session.id === activeSessionId ? " tab--active tf-tab--active" : ""}`}
            type="button"
            onClick={() => onActivate(session.id)}
            aria-pressed={session.id === activeSessionId}
            title={`${session.name} (${session.status})`}
          >
            <span
              className={`tf-status-dot tf-status-dot--${session.status}`}
              aria-hidden="true"
            />
            <span>{session.name}</span>
          </button>
        ))
      )}
    </div>
  );
}
