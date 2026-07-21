import { useEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  Session,
  SessionClosedEvent,
  SessionErrorEvent,
  SessionOutputEvent,
  SessionStatusEvent,
} from "../features/connections/types";
import {
  SESSION_CREATED_EVENT,
  SESSION_CLOSED_EVENT,
  SESSION_ERROR_EVENT,
  SESSION_OUTPUT_EVENT,
  SESSION_STATUS_EVENT,
} from "../features/connections/types";
import { onWailsEvent } from "../shared/api/wails";
import { MAX_TERMINAL_BUFFER_LENGTH } from "./appDemoData";
import { formatStatusLine } from "./appHelpers";
import { resolveCwdSyncOutput } from "./cwdSyncOutput";
import {
  appendTerminalData,
  shouldPreserveTerminalReplayContext,
} from "./terminalReplay";
import type {
  PendingCwdSync,
  SessionReconnectAttempt,
  SessionReconnectInputStore,
} from "./terminalViewTypes";
import { addSessionIfMissing, shouldStageReconnectedSession } from "./terminalSessions";

type UseWailsSessionEventsOptions = {
  fullscreenTerminalSessionsRef: MutableRefObject<Record<string, boolean>>;
  liveSessionIdsRef: MutableRefObject<Set<string>>;
  pendingCwdSyncRef: MutableRefObject<PendingCwdSync | null>;
  reconnectAttemptRef: MutableRefObject<SessionReconnectAttempt | null>;
  reconnectingConnectionIdRef: MutableRefObject<string | null>;
  reconnectInputsRef: MutableRefObject<SessionReconnectInputStore>;
  refreshRemoteFilesRef: MutableRefObject<(path?: string) => Promise<void>>;
  sessions: Session[];
  stagedReconnectSessionsRef: MutableRefObject<Map<string, Session>>;
  setFullscreenTerminalSessions: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSessions: Dispatch<SetStateAction<Session[]>>;
  setStatus: (status: string) => void;
  setTerminalBuffers: Dispatch<SetStateAction<Record<string, string>>>;
};

export function useWailsSessionEvents({
  fullscreenTerminalSessionsRef,
  liveSessionIdsRef,
  pendingCwdSyncRef,
  reconnectAttemptRef,
  reconnectingConnectionIdRef,
  reconnectInputsRef,
  refreshRemoteFilesRef,
  sessions,
  stagedReconnectSessionsRef,
  setFullscreenTerminalSessions,
  setSessions,
  setStatus,
  setTerminalBuffers,
}: UseWailsSessionEventsOptions) {
  useEffect(() => {
    const nextSessionIds = new Set(sessions.map((session) => session.id));
    if (reconnectingConnectionIdRef.current) {
      for (const sessionId of liveSessionIdsRef.current) {
        nextSessionIds.add(sessionId);
      }
    }
    liveSessionIdsRef.current = nextSessionIds;
  }, [liveSessionIdsRef, reconnectingConnectionIdRef, sessions]);

  useEffect(() => {
    const offCreated = onWailsEvent<Session>(SESSION_CREATED_EVENT, (session) => {
      liveSessionIdsRef.current.add(session.id);
      if (shouldStageReconnectedSession(reconnectingConnectionIdRef.current, session)) {
        stagedReconnectSessionsRef.current.set(session.id, session);
      } else {
        setSessions((current) => addSessionIfMissing(current, session));
      }
      setTerminalBuffers((current) => ({
        ...current,
        [session.id]: current[session.id] ?? "",
      }));
    });

    const offOutput = onWailsEvent<SessionOutputEvent>(SESSION_OUTPUT_EVENT, (event) => {
      if (!liveSessionIdsRef.current.has(event.sessionId)) {
        return;
      }
      let terminalOutput = event.data;
      const pendingSync = pendingCwdSyncRef.current;
      if (pendingSync?.sessionId === event.sessionId) {
        const output = `${pendingSync.output}${event.data}`.slice(-4096);
        const synced = resolveCwdSyncOutput(output);
        if (synced) {
          window.clearTimeout(pendingSync.timeoutId);
          pendingCwdSyncRef.current = null;
          terminalOutput = synced.terminalOutput;
          void refreshRemoteFilesRef.current(synced.syncedPath).then(() => {
            setStatus(`Synced files to ${synced.syncedPath}`);
          });
        } else {
          pendingCwdSyncRef.current = { ...pendingSync, output };
          return;
        }
      }
      if (!terminalOutput) {
        return;
      }
      setTerminalBuffers((current) => ({
        ...current,
        [event.sessionId]: appendTerminalData(current[event.sessionId] ?? "", terminalOutput, {
          maxLength: MAX_TERMINAL_BUFFER_LENGTH,
          preserveReplayContext: shouldPreserveTerminalReplayContext(
            terminalOutput,
            event.sessionId,
            fullscreenTerminalSessionsRef.current,
          ),
        }),
      }));
    });

    const offStatus = onWailsEvent<SessionStatusEvent>(SESSION_STATUS_EVENT, (event) => {
      if (!liveSessionIdsRef.current.has(event.sessionId)) {
        return;
      }
      const lastActiveAt = new Date().toISOString();
      const stagedSession = stagedReconnectSessionsRef.current.get(event.sessionId);
      if (stagedSession) {
        stagedReconnectSessionsRef.current.set(event.sessionId, {
          ...stagedSession,
          status: event.status,
          lastActiveAt,
        });
      }
      setSessions((current) =>
        current.map((session) =>
          session.id === event.sessionId
            ? { ...session, status: event.status, lastActiveAt }
            : session,
        ),
      );
      setTerminalBuffers((current) => ({
        ...current,
        [event.sessionId]: appendTerminalData(current[event.sessionId] ?? "", formatStatusLine(event), {
          maxLength: MAX_TERMINAL_BUFFER_LENGTH,
          preserveReplayContext: false,
        }),
      }));
      setStatus(event.message ? `${event.status}: ${event.message}` : event.status);
    });

    const offError = onWailsEvent<SessionErrorEvent>(SESSION_ERROR_EVENT, (event) => {
      setStatus(event.message);
    });

    const offClosed = onWailsEvent<SessionClosedEvent>(SESSION_CLOSED_EVENT, (event) => {
      const wasRegistered = liveSessionIdsRef.current.delete(event.sessionId);
      if (reconnectAttemptRef.current?.sessionId === event.sessionId) {
        reconnectAttemptRef.current = null;
      }
      reconnectInputsRef.current.delete(event.sessionId);
      stagedReconnectSessionsRef.current.delete(event.sessionId);
      if (pendingCwdSyncRef.current?.sessionId === event.sessionId) {
        window.clearTimeout(pendingCwdSyncRef.current.timeoutId);
        pendingCwdSyncRef.current = null;
      }
      setSessions((current) => current.filter((session) => session.id !== event.sessionId));
      setTerminalBuffers((current) => {
        const next = { ...current };
        delete next[event.sessionId];
        return next;
      });
      setFullscreenTerminalSessions((current) => {
        const next = { ...current };
        delete next[event.sessionId];
        return next;
      });
      if (wasRegistered) {
        setStatus(`Session closed: ${event.sessionId}`);
      }
    });

    return () => {
      if (pendingCwdSyncRef.current) {
        window.clearTimeout(pendingCwdSyncRef.current.timeoutId);
        pendingCwdSyncRef.current = null;
      }
      offCreated();
      offOutput();
      offStatus();
      offError();
      offClosed();
    };
  }, [
    fullscreenTerminalSessionsRef,
    liveSessionIdsRef,
    pendingCwdSyncRef,
    reconnectAttemptRef,
    reconnectingConnectionIdRef,
    reconnectInputsRef,
    refreshRemoteFilesRef,
    setFullscreenTerminalSessions,
    setSessions,
    setStatus,
    setTerminalBuffers,
    stagedReconnectSessionsRef,
  ]);
}
