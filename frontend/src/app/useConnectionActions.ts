import { useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  Connection,
  SaveConnectionInput,
  Session,
  TerminalSize,
} from "../features/connections/types";
import {
  closeSession,
  deleteConnection,
  listConnections,
  openSession,
  saveConnection,
} from "../shared/api/wails";
import {
  DEMO_BUFFERS,
  DEMO_CONNECTIONS,
  DEMO_NOW,
} from "./appDemoData";
import { sortConnections } from "./appHelpers";
import {
  addSessionIfMissing,
  latestReconnectedSession,
  openedSessionStatusMessage,
  rekeyReconnectedTerminalBuffer,
  replaceReconnectedSession,
  terminalSessionPrimaryAction,
} from "./terminalSessions";
import type { SessionReconnectAttempt, SessionReconnectInputStore } from "./terminalViewTypes";

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isBackendUnavailable(error: unknown): boolean {
  return messageFromError(error) === "Wails backend is not available";
}

type ViewSetter = (view: "terminal" | "files" | "monitor" | "commands" | "settings") => void;

type UseConnectionActionsOptions = {
  activeSessionId: string | null;
  backendAvailable: boolean;
  connections: Connection[];
  liveSessionIdsRef: MutableRefObject<Set<string>>;
  sessions: Session[];
  terminalSize: TerminalSize;
  setActiveSessionId: Dispatch<SetStateAction<string | null>>;
  setActiveView: ViewSetter;
  setBackendAvailable: Dispatch<SetStateAction<boolean>>;
  setConnections: Dispatch<SetStateAction<Connection[]>>;
  setFullscreenTerminalSessions: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSessions: Dispatch<SetStateAction<Session[]>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setTerminalBuffers: Dispatch<SetStateAction<Record<string, string>>>;
};

export function useConnectionActions({
  activeSessionId,
  backendAvailable,
  connections,
  liveSessionIdsRef,
  sessions,
  terminalSize,
  setActiveSessionId,
  setActiveView,
  setBackendAvailable,
  setConnections,
  setFullscreenTerminalSessions,
  setSessions,
  setStatus,
  setTerminalBuffers,
}: UseConnectionActionsOptions) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [pendingDeleteConnection, setPendingDeleteConnection] = useState<Connection | null>(null);
  const [deletingConnectionId, setDeletingConnectionId] = useState<string | null>(null);
  const [reconnectingSessionId, setReconnectingSessionId] = useState<string | null>(null);
  const [tabConnectionMenuOpen, setTabConnectionMenuOpen] = useState(false);
  const reconnectInputsRef = useRef<SessionReconnectInputStore>(new Map());
  const reconnectAttemptRef = useRef<SessionReconnectAttempt | null>(null);
  const reconnectingConnectionIdRef = useRef<string | null>(null);
  const stagedReconnectSessionsRef = useRef(new Map<string, Session>());

  async function refreshConnectionsFromBackend() {
    if (!backendAvailable) {
      setConnections(DEMO_CONNECTIONS);
      setStatus("Offline preview");
      return;
    }
    try {
      const loaded = await listConnections();
      setConnections(sortConnections(loaded));
      setStatus(`Refreshed ${loaded.length} saved connections`);
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  async function handleSaveConnection(input: SaveConnectionInput) {
    if (!backendAvailable) {
      const saved: Connection = {
        ...input,
        id: input.id ?? `demo-${Date.now()}`,
        createdAt: DEMO_NOW,
        updatedAt: new Date().toISOString(),
      };
      setConnections((current) => {
        const exists = current.some((connection) => connection.id === saved.id);
        return sortConnections(
          exists
            ? current.map((connection) => (connection.id === saved.id ? saved : connection))
            : [...current, saved],
        );
      });
      setSessions((current) =>
        current.map((session) =>
          session.connectionId === saved.id ? { ...session, name: saved.name } : session,
        ),
      );
      setStatus(`${input.id ? "Updated" : "Saved"} preview connection: ${saved.name}`);
      setEditingConnection(null);
      setIsModalOpen(false);
      return;
    }

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
      setEditingConnection(null);
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

    if (!backendAvailable) {
      const existing = sessions.find((session) => session.connectionId === connection.id);
      if (existing) {
        setActiveSessionId(existing.id);
        setActiveView("terminal");
        setStatus(`Preview session: ${connection.name}`);
        return;
      }
      const session: Session = {
        id: `demo-${connection.id}-${Date.now()}`,
        connectionId: connection.id,
        name: connection.name,
        status: "connected",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      setSessions((current) => addSessionIfMissing(current, session));
      setTerminalBuffers((current) => ({
        ...current,
        [session.id]: DEMO_BUFFERS["demo-prod"].split("prod-01").join(connection.name),
      }));
      setActiveSessionId(session.id);
      setActiveView("terminal");
      setStatus(`Preview session: ${connection.name}`);
      return;
    }

    try {
      const session = await openSession({
        connectionId: connection.id,
        password,
        size: terminalSize,
        insecureIgnoreHostKey,
      });

      reconnectInputsRef.current.set(session.id, { password, insecureIgnoreHostKey });
      setTerminalBuffers((current) => ({ ...current, [session.id]: current[session.id] ?? "" }));
      liveSessionIdsRef.current = new Set([...liveSessionIdsRef.current, session.id]);
      setSessions((current) => addSessionIfMissing(current, session));
      setActiveSessionId(session.id);
      setBackendAvailable(true);
      setStatus(openedSessionStatusMessage(connection.name, session.status));
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

  async function handleTrustHostKeyAndOpen(connection: Connection) {
    const trustedInput: SaveConnectionInput = {
      id: connection.id,
      name: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      authType: connection.authType,
      password: connection.password,
      keyPath: connection.keyPath,
      insecureIgnoreHostKey: true,
      group: connection.group,
      tags: connection.tags,
    };

    if (!backendAvailable) {
      const trusted = { ...connection, insecureIgnoreHostKey: true };
      setConnections((current) =>
        sortConnections(current.map((item) => (item.id === connection.id ? trusted : item))),
      );
      await handleOpenConnection(trusted, trusted.password, true);
      return;
    }

    try {
      setStatus(`Trusting host key for ${connection.name}`);
      const saved = await saveConnection(trustedInput);
      setConnections((current) =>
        sortConnections(current.map((item) => (item.id === saved.id ? saved : item))),
      );
      await handleOpenConnection(saved, saved.password, true);
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  async function handleReconnectSession(previousSession: Session) {
    if (
      reconnectingConnectionIdRef.current
      || terminalSessionPrimaryAction(previousSession.status, false) !== "reconnect"
    ) {
      return;
    }
    const connection = connections.find((item) => item.id === previousSession.connectionId);
    if (!connection) {
      setStatus(`Connection settings not found: ${previousSession.name}`);
      return;
    }

    setReconnectingSessionId(previousSession.id);
    const reconnectAttempt = {
      sessionId: previousSession.id,
      connectionId: connection.id,
    };
    reconnectAttemptRef.current = reconnectAttempt;
    reconnectingConnectionIdRef.current = connection.id;
    setStatus(`Reconnecting to ${connection.name}`);
    try {
      if (!backendAvailable) {
        const now = new Date().toISOString();
        const replacement: Session = {
          ...previousSession,
          id: `demo-${connection.id}-${Date.now()}`,
          status: "connected",
          createdAt: now,
          lastActiveAt: now,
        };
        setSessions((current) => replaceReconnectedSession(current, previousSession.id, replacement));
        setTerminalBuffers((current) =>
          rekeyReconnectedTerminalBuffer(current, previousSession.id, replacement.id),
        );
        liveSessionIdsRef.current = new Set(
          [...liveSessionIdsRef.current].filter((sessionId) => sessionId !== previousSession.id),
        );
        liveSessionIdsRef.current.add(replacement.id);
        setFullscreenTerminalSessions((current) => {
          const next = { ...current };
          delete next[previousSession.id];
          delete next[replacement.id];
          return next;
        });
        setActiveSessionId(replacement.id);
        setActiveView("terminal");
        setStatus(`Reconnected preview session: ${connection.name}`);
        return;
      }

      const returnedReplacement = await openSession({
        connectionId: connection.id,
        password: reconnectInputsRef.current.get(previousSession.id)?.password || connection.password,
        size: terminalSize,
        insecureIgnoreHostKey:
          reconnectInputsRef.current.get(previousSession.id)?.insecureIgnoreHostKey || connection.insecureIgnoreHostKey,
      });
      if (reconnectAttemptRef.current !== reconnectAttempt) {
        stagedReconnectSessionsRef.current.delete(returnedReplacement.id);
        reconnectInputsRef.current.delete(returnedReplacement.id);
        liveSessionIdsRef.current.delete(returnedReplacement.id);
        setTerminalBuffers((current) => {
          const next = { ...current };
          delete next[returnedReplacement.id];
          return next;
        });
        void closeSession(returnedReplacement.id).catch(() => undefined);
        return;
      }
      const replacement = latestReconnectedSession(stagedReconnectSessionsRef.current, returnedReplacement);
      stagedReconnectSessionsRef.current.delete(replacement.id);

      const reconnectInput = reconnectInputsRef.current.get(previousSession.id) ?? {
        password: connection.password,
        insecureIgnoreHostKey: connection.insecureIgnoreHostKey,
      };
      reconnectInputsRef.current.delete(previousSession.id);
      reconnectInputsRef.current.set(replacement.id, reconnectInput);
      liveSessionIdsRef.current = new Set(
        [...liveSessionIdsRef.current].filter((sessionId) => sessionId !== previousSession.id),
      );
      liveSessionIdsRef.current.add(replacement.id);
      setSessions((current) => replaceReconnectedSession(current, previousSession.id, replacement));
      setTerminalBuffers((current) =>
        rekeyReconnectedTerminalBuffer(current, previousSession.id, replacement.id),
      );
      setFullscreenTerminalSessions((current) => {
        const next = { ...current };
        delete next[previousSession.id];
        delete next[replacement.id];
        return next;
      });
      setActiveSessionId(replacement.id);
      setActiveView("terminal");
      setBackendAvailable(true);
      setStatus(openedSessionStatusMessage(connection.name, replacement.status));
      void closeSession(previousSession.id).catch(() => undefined);
    } catch (error) {
      setStatus(`Reconnect failed: ${messageFromError(error)}`);
    } finally {
      if (reconnectAttemptRef.current === reconnectAttempt) {
        reconnectAttemptRef.current = null;
      }
      if (reconnectingConnectionIdRef.current === connection.id) {
        reconnectingConnectionIdRef.current = null;
      }
      setReconnectingSessionId((current) => (current === previousSession.id ? null : current));
    }
  }

  async function confirmDeleteConnection(connection: Connection) {
    const removeConnection = () => {
      const removedSessionIds = new Set(
        sessions
          .filter((session) => session.connectionId === connection.id)
          .map((session) => session.id),
      );
      for (const sessionID of removedSessionIds) {
        reconnectInputsRef.current.delete(sessionID);
        stagedReconnectSessionsRef.current.delete(sessionID);
      }
      if (reconnectAttemptRef.current?.connectionId === connection.id) {
        reconnectAttemptRef.current = null;
      }
      setConnections((current) => current.filter((item) => item.id !== connection.id));
      setSessions((current) => current.filter((session) => session.connectionId !== connection.id));
      setTerminalBuffers((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([sessionID]) => !removedSessionIds.has(sessionID)),
        ),
      );
      setFullscreenTerminalSessions((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([sessionID]) => !removedSessionIds.has(sessionID)),
        ),
      );
      setActiveSessionId((current) => {
        if (current && !removedSessionIds.has(current)) {
          return current;
        }
        const nextSession = sessions.find((session) => session.connectionId !== connection.id);
        return nextSession?.id ?? null;
      });
    };

    setDeletingConnectionId(connection.id);
    if (!backendAvailable) {
      removeConnection();
      setStatus(`Deleted preview connection: ${connection.name}`);
      setPendingDeleteConnection(null);
      setDeletingConnectionId(null);
      return;
    }

    try {
      const sessionsToClose = sessions.filter((session) => session.connectionId === connection.id);
      await Promise.all(sessionsToClose.map((session) => closeSession(session.id).catch(() => undefined)));
      await deleteConnection(connection.id);
      removeConnection();
      setStatus(`Deleted connection: ${connection.name}`);
      setPendingDeleteConnection(null);
      await refreshConnectionsFromBackend();
    } catch (error) {
      setStatus(messageFromError(error));
    } finally {
      setDeletingConnectionId((current) => (current === connection.id ? null : current));
    }
  }

  function handleCreateConnectionFromTabs() {
    setTabConnectionMenuOpen(false);
    setEditingConnection(null);
    setPendingDeleteConnection(null);
    setIsModalOpen(true);
  }

  function handleOpenConnectionFromTabs(connection: Connection) {
    setTabConnectionMenuOpen(false);
    setPendingDeleteConnection(null);

    const existingSession = sessions.find((session) => session.connectionId === connection.id);
    if (existingSession) {
      setActiveSessionId(existingSession.id);
      setActiveView("terminal");
      setStatus(`Switched to ${connection.name}`);
      return;
    }

    void handleOpenConnection(connection, connection.password, false);
  }

  return {
    deletingConnectionId,
    editingConnection,
    isModalOpen,
    pendingDeleteConnection,
    reconnectingConnectionIdRef,
    reconnectAttemptRef,
    reconnectInputsRef,
    reconnectingSessionId,
    stagedReconnectSessionsRef,
    tabConnectionMenuOpen,
    confirmDeleteConnection,
    handleCreateConnectionFromTabs,
    handleOpenConnection,
    handleOpenConnectionFromTabs,
    handleReconnectSession,
    handleSaveConnection,
    handleTrustHostKeyAndOpen,
    refreshConnectionsFromBackend,
    setEditingConnection,
    setIsModalOpen,
    setPendingDeleteConnection,
    setTabConnectionMenuOpen,
  };
}
