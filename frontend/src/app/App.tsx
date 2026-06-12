import { useEffect, useMemo, useState } from "react";
import { ConnectionSidebar } from "../features/connections/ConnectionSidebar";
import { ConnectionModal } from "../features/connections/ConnectionModal";
import { SessionTabs } from "../features/sessions/SessionTabs";
import { StatusBar } from "../features/status/StatusBar";
import { TerminalPane } from "../features/terminal/TerminalPane";
import {
  openSession,
  listConnections,
  onWailsEvent,
  saveConnection,
} from "../shared/api/wails";
import type {
  Connection,
  SaveConnectionInput,
  Session,
  SessionClosedEvent,
  SessionErrorEvent,
  SessionStatusEvent,
  TerminalSize,
} from "../features/connections/types";
import {
  SESSION_CLOSED_EVENT,
  SESSION_ERROR_EVENT,
  SESSION_STATUS_EVENT,
} from "../features/connections/types";

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isBackendUnavailable(error: unknown): boolean {
  return messageFromError(error) === "Wails backend is not available";
}

function sortConnections(connections: Connection[]): Connection[] {
  return [...connections].sort((left, right) => {
    const leftKey = `${left.group}\u0000${left.name}`.toLowerCase();
    const rightKey = `${right.group}\u0000${right.name}`.toLowerCase();
    return leftKey.localeCompare(rightKey);
  });
}

const DEFAULT_TERMINAL_SIZE: TerminalSize = { cols: 120, rows: 32 };

export default function App() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready");
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [terminalSize, setTerminalSize] = useState<TerminalSize>(DEFAULT_TERMINAL_SIZE);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );
  const activeConnection = useMemo(
    () =>
      activeSession
        ? connections.find((connection) => connection.id === activeSession.connectionId) ?? null
        : null,
    [activeSession, connections],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadConnections() {
      try {
        const loaded = await listConnections();
        if (cancelled) {
          return;
        }
        setConnections(sortConnections(loaded));
        setBackendAvailable(true);
        setStatus(loaded.length > 0 ? `Loaded ${loaded.length} saved connections` : "Ready");
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (isBackendUnavailable(error)) {
          setBackendAvailable(false);
          setStatus("Offline preview");
          return;
        }
        setStatus(messageFromError(error));
      }
    }

    void loadConnections();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const offStatus = onWailsEvent<SessionStatusEvent>(SESSION_STATUS_EVENT, (event) => {
      setSessions((current) =>
        current.map((session) =>
          session.id === event.sessionId
            ? { ...session, status: event.status, lastActiveAt: new Date().toISOString() }
            : session,
        ),
      );
      setStatus(event.message ? `${event.status}: ${event.message}` : event.status);
    });

    const offError = onWailsEvent<SessionErrorEvent>(SESSION_ERROR_EVENT, (event) => {
      setStatus(event.message);
    });

    const offClosed = onWailsEvent<SessionClosedEvent>(SESSION_CLOSED_EVENT, (event) => {
      setSessions((current) => current.filter((session) => session.id !== event.sessionId));
      setStatus(`Session closed: ${event.sessionId}`);
    });

    return () => {
      offStatus();
      offError();
      offClosed();
    };
  }, []);

  useEffect(() => {
    if (activeSessionId && sessions.some((session) => session.id === activeSessionId)) {
      return;
    }
    setActiveSessionId(sessions[0]?.id ?? null);
  }, [activeSessionId, sessions]);

  async function handleSaveConnection(input: SaveConnectionInput) {
    try {
      const saved = await saveConnection(input);
      setConnections((current) => {
        const existingIndex = current.findIndex((connection) => connection.id === saved.id);
        const next =
          existingIndex >= 0
            ? current.map((connection) => (connection.id === saved.id ? saved : connection))
            : [...current, saved];
        return sortConnections(next);
      });
      setBackendAvailable(true);
      setStatus(`Saved connection: ${saved.name}`);
      setIsModalOpen(false);
    } catch (error) {
      if (isBackendUnavailable(error)) {
        setBackendAvailable(false);
        setStatus("Offline preview");
      } else {
        setStatus(messageFromError(error));
      }
      throw error;
    }
  }

  async function handleOpenConnection(
    connection: Connection,
    password: string,
    insecureIgnoreHostKey: boolean,
  ) {
    setStatus(`Connecting to ${connection.name}`);

    try {
      const session = await openSession({
        connectionId: connection.id,
        password,
        size: terminalSize,
        insecureIgnoreHostKey,
      });

      setSessions((current) => [...current, session]);
      setActiveSessionId(session.id);
      setBackendAvailable(true);
      setStatus(`Connected to ${connection.name}`);
    } catch (error) {
      if (isBackendUnavailable(error)) {
        setBackendAvailable(false);
        setStatus("Offline preview");
      } else {
        setStatus(messageFromError(error));
      }
      throw error;
    }
  }

  function handleTerminalSizeChange(size: TerminalSize) {
    setTerminalSize((current) =>
      current.cols === size.cols && current.rows === size.rows ? current : size,
    );
  }

  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="titlebar__brand">
          <span className="titlebar__app">TermFlow</span>
          <span className="titlebar__badge">SSH Workspace</span>
        </div>
        <div className="titlebar__meta">
          <span>{backendAvailable ? `${connections.length} saved connections` : "Offline preview"}</span>
          <span>{activeSession ? `${activeSession.name} · ${activeSession.status}` : "No active session"}</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="rail" aria-label="Primary navigation">
          <button className="rail__item rail__item--active" type="button" aria-label="Terminal" title="Terminal">
            T
          </button>
          <button className="rail__item" type="button" aria-label="Connections" title="Connections" disabled>
            C
          </button>
          <button className="rail__item" type="button" aria-label="Files" title="Files" disabled>
            F
          </button>
          <button className="rail__item" type="button" aria-label="Settings" title="Settings" disabled>
            S
          </button>
        </aside>

        <ConnectionSidebar
          connections={connections}
          onCreate={() => setIsModalOpen(true)}
          onOpen={handleOpenConnection}
        />

        <main className="main-pane">
          <SessionTabs
            sessions={sessions}
            activeSessionId={activeSessionId}
            onActivate={setActiveSessionId}
          />

          <section className="terminal-panel">
            <div className="terminal-panel__header">
              <div>
                <strong>Terminal</strong>
                <span className="terminal-panel__subtle">
                  {activeSession && activeConnection
                    ? `${activeConnection.username}@${activeConnection.host}:${activeConnection.port}`
                    : "No SSH session attached"}
                </span>
              </div>
              <div className="terminal-panel__stats">
                <span>{activeSession ? activeSession.status : "Shell idle"}</span>
                <span>{`Rows/Cols: ${terminalSize.rows}/${terminalSize.cols}`}</span>
              </div>
            </div>
            <div className="terminal-panel__body">
              <TerminalPane session={activeSession} onTerminalSizeChange={handleTerminalSizeChange} />
            </div>
          </section>
        </main>
      </div>

      <StatusBar
        status={status}
        sessions={sessions}
        activeSession={activeSession}
        backendAvailable={backendAvailable}
      />

      {isModalOpen ? (
        <ConnectionModal
          onCancel={() => setIsModalOpen(false)}
          onSave={handleSaveConnection}
        />
      ) : null}
    </div>
  );
}
