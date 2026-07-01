import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AppSettings,
  CommandHistoryEntry,
  Connection,
  FileEntry as BackendFileEntry,
  SavedCommand,
  Session,
} from "../features/connections/types";
import {
  getSettings,
  listConnections,
  listFiles,
  listSavedCommands,
} from "../shared/api/wails";
import {
  DEFAULT_APP_SETTINGS,
  DEMO_BUFFERS,
  DEMO_CONNECTIONS,
  DEMO_LOCAL_FILES,
  DEMO_REMOTE_FILES,
  DEMO_SESSIONS,
} from "./appDemoData";
import { sortConnections } from "./appHelpers";

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isBackendUnavailable(error: unknown): boolean {
  return messageFromError(error) === "Wails backend is not available";
}

type UseInitialAppDataOptions = {
  localPath: string;
  setActiveSessionId: Dispatch<SetStateAction<string | null>>;
  setAppSettings: Dispatch<SetStateAction<AppSettings>>;
  setBackendAvailable: Dispatch<SetStateAction<boolean>>;
  setCommandHistory: Dispatch<SetStateAction<CommandHistoryEntry[]>>;
  setConnections: Dispatch<SetStateAction<Connection[]>>;
  setLocalFiles: Dispatch<SetStateAction<BackendFileEntry[]>>;
  setRemoteFiles: Dispatch<SetStateAction<BackendFileEntry[]>>;
  setSavedCommands: Dispatch<SetStateAction<SavedCommand[]>>;
  setSessions: Dispatch<SetStateAction<Session[]>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setTerminalBuffers: Dispatch<SetStateAction<Record<string, string>>>;
  setTheme: Dispatch<SetStateAction<"dark" | "light">>;
};

export function useInitialAppData({
  localPath,
  setActiveSessionId,
  setAppSettings,
  setBackendAvailable,
  setCommandHistory,
  setConnections,
  setLocalFiles,
  setRemoteFiles,
  setSavedCommands,
  setSessions,
  setStatus,
  setTerminalBuffers,
  setTheme,
}: UseInitialAppDataOptions) {
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

        const [commandsResult, settingsResult, localFilesResult] = await Promise.allSettled([
          listSavedCommands(),
          getSettings(),
          listFiles({ side: "local", path: localPath }),
        ]);
        if (cancelled) {
          return;
        }
        if (commandsResult.status === "fulfilled") {
          setSavedCommands(commandsResult.value);
        }
        if (settingsResult.status === "fulfilled") {
          setAppSettings(settingsResult.value);
          setTheme(settingsResult.value.theme === "dark" ? "dark" : "light");
        }
        if (localFilesResult.status === "fulfilled") {
          setLocalFiles(localFilesResult.value);
        } else {
          setLocalFiles([]);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (isBackendUnavailable(error)) {
          setBackendAvailable(false);
          setConnections(DEMO_CONNECTIONS);
          setSessions(DEMO_SESSIONS);
          setTerminalBuffers(DEMO_BUFFERS);
          setSavedCommands([]);
          setCommandHistory([]);
          setLocalFiles(DEMO_LOCAL_FILES);
          setRemoteFiles(DEMO_REMOTE_FILES);
          setAppSettings(DEFAULT_APP_SETTINGS);
          setActiveSessionId("demo-123123");
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
  }, [
    localPath,
    setActiveSessionId,
    setAppSettings,
    setBackendAvailable,
    setCommandHistory,
    setConnections,
    setLocalFiles,
    setRemoteFiles,
    setSavedCommands,
    setSessions,
    setStatus,
    setTerminalBuffers,
    setTheme,
  ]);
}
