import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  CommandHistoryEntry,
  FileEntry as BackendFileEntry,
  MonitorSnapshot,
  Session,
} from "../features/connections/types";
import {
  getMonitorSnapshot,
  listCommandHistory,
  listFiles,
} from "../shared/api/wails";
import { demoRemoteFilesForPath } from "./appDemoData";
import type { CommandHistoryScope } from "./TerminalHistoryDock";

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type UseActiveSessionDataOptions = {
  activeSession: Session | null;
  backendAvailable: boolean;
  commandHistoryScope: CommandHistoryScope;
  remotePath: string;
  applyMonitorSnapshot: (snapshot: MonitorSnapshot) => void;
  refreshPersistedMonitorHistory: (sessionId: string, connectionId: string) => Promise<void>;
  resetMonitorData: () => void;
  setCommandHistory: Dispatch<SetStateAction<CommandHistoryEntry[]>>;
  setRemoteFiles: Dispatch<SetStateAction<BackendFileEntry[]>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useActiveSessionData({
  activeSession,
  backendAvailable,
  commandHistoryScope,
  remotePath,
  applyMonitorSnapshot,
  refreshPersistedMonitorHistory,
  resetMonitorData,
  setCommandHistory,
  setRemoteFiles,
  setStatus,
}: UseActiveSessionDataOptions) {
  useEffect(() => {
    let cancelled = false;
    if (!activeSession) {
      setCommandHistory([]);
      resetMonitorData();
      setRemoteFiles([]);
      return;
    }
    if (!backendAvailable) {
      setCommandHistory([]);
      resetMonitorData();
      setRemoteFiles(demoRemoteFilesForPath(remotePath));
      return;
    }
    const session = activeSession;

    async function loadSessionData() {
      try {
        const historyFilter: Parameters<typeof listCommandHistory>[0] =
          commandHistoryScope === "host"
            ? { connectionId: session.connectionId, limit: 200 }
            : { limit: 200 };
        const [history, files, snapshot] = await Promise.all([
          listCommandHistory(historyFilter),
          listFiles({ side: "remote", sessionId: session.id, path: remotePath }),
          getMonitorSnapshot(session.id),
        ]);
        if (cancelled) {
          return;
        }
        setCommandHistory(history);
        setRemoteFiles(files);
        applyMonitorSnapshot(snapshot);
        void refreshPersistedMonitorHistory(session.id, session.connectionId);
      } catch (error) {
        if (!cancelled) {
          setStatus(messageFromError(error));
        }
      }
    }

    void loadSessionData();
    const id = window.setInterval(() => {
      void getMonitorSnapshot(session.id)
        .then((snapshot) => {
          if (!cancelled) {
            applyMonitorSnapshot(snapshot);
            void refreshPersistedMonitorHistory(session.id, session.connectionId);
          }
        })
        .catch(() => {});
    }, 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    activeSession,
    applyMonitorSnapshot,
    backendAvailable,
    commandHistoryScope,
    refreshPersistedMonitorHistory,
    remotePath,
    resetMonitorData,
    setCommandHistory,
    setRemoteFiles,
    setStatus,
  ]);
}
