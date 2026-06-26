import type {
  Connection,
  AppSettings,
  CommandHistoryEntry,
  CommandHistoryFilter,
  FileContent,
  FileEntry,
  FileListInput,
  FileMutationInput,
  FileReadInput,
  FileRenameInput,
  FileSaveInput,
  FileTransferInput,
  FileTransferResult,
  MonitorHistoryEntry,
  MonitorHistoryFilter,
  MonitorSnapshot,
  OpenSessionInput,
  RunCommandInput,
  SaveSavedCommandInput,
  SaveConnectionInput,
  SavedCommand,
  Session,
  TerminalSize,
  TestConnectionInput,
} from "../../features/connections/types";

type WailsEventRuntime = {
  EventsOn?(name: string, callback: (...data: unknown[]) => void): unknown;
  EventsOnMultiple?(
    name: string,
    callback: (...data: unknown[]) => void,
    maxCallbacks?: number,
  ): unknown;
};

type WailsAppApi = {
  ListConnections(): Promise<Connection[]>;
  SaveConnection(input: SaveConnectionInput): Promise<Connection>;
  DeleteConnection(id: string): Promise<void>;
  TestConnection(input: TestConnectionInput): Promise<void>;
  OpenSession(input: OpenSessionInput): Promise<Session>;
  CloseSession(sessionId: string): Promise<void>;
  WriteTerminal(sessionId: string, data: string): Promise<void>;
  RecordCommandHistory(sessionId: string, command: string): Promise<void>;
  ResizeTerminal(sessionId: string, size: TerminalSize): Promise<void>;
  RunCommand(input: RunCommandInput): Promise<void>;
  ListCommandHistory(filter: CommandHistoryFilter): Promise<CommandHistoryEntry[]>;
  ClearCommandHistory(connectionId: string): Promise<void>;
  ListSavedCommands(): Promise<SavedCommand[]>;
  SaveSavedCommand(input: SaveSavedCommandInput): Promise<SavedCommand>;
  DeleteSavedCommand(id: string): Promise<void>;
  GetSettings(): Promise<AppSettings>;
  SaveSettings(input: AppSettings): Promise<AppSettings>;
  ListFiles(input: FileListInput): Promise<FileEntry[]>;
  ReadFile(input: FileReadInput): Promise<FileContent>;
  SaveFile(input: FileSaveInput): Promise<void>;
  CreateFolder(input: FileMutationInput): Promise<void>;
  RenameFile(input: FileRenameInput): Promise<void>;
  DeleteFile(input: FileMutationInput): Promise<void>;
  TransferFile(input: FileTransferInput): Promise<FileTransferResult>;
  SelectLocalFile(): Promise<string>;
  SelectLocalFiles(): Promise<string[]>;
  SelectLocalDirectory(title: string): Promise<string>;
  SelectSaveFile(defaultFilename: string): Promise<string>;
  GetMonitorSnapshot(sessionId: string): Promise<MonitorSnapshot>;
  ListMonitorHistory(filter: MonitorHistoryFilter): Promise<MonitorHistoryEntry[]>;
  GetMonitorIncidentReport(sessionId: string): Promise<string>;
};

declare global {
  interface Window {
    go?: {
      main?: {
        App?: WailsAppApi;
      };
    };
    runtime?: WailsEventRuntime;
  }
}

function appApi(): WailsAppApi {
  const api = window.go?.main?.App;
  if (!api) {
    throw new Error("Wails backend is not available");
  }
  return api;
}

export function listConnections(): Promise<Connection[]> {
  return appApi().ListConnections();
}

export function saveConnection(input: SaveConnectionInput): Promise<Connection> {
  return appApi().SaveConnection(input);
}

export function deleteConnection(id: string): Promise<void> {
  return appApi().DeleteConnection(id);
}

export function testConnection(input: TestConnectionInput): Promise<void> {
  return appApi().TestConnection(input);
}

export function openSession(input: OpenSessionInput): Promise<Session> {
  return appApi().OpenSession(input);
}

export function closeSession(sessionId: string): Promise<void> {
  return appApi().CloseSession(sessionId);
}

export function writeTerminal(sessionId: string, data: string): Promise<void> {
  return appApi().WriteTerminal(sessionId, data);
}

export function recordCommandHistory(sessionId: string, command: string): Promise<void> {
  return appApi().RecordCommandHistory(sessionId, command);
}

export function resizeTerminal(sessionId: string, size: TerminalSize): Promise<void> {
  return appApi().ResizeTerminal(sessionId, size);
}

export function runCommand(input: RunCommandInput): Promise<void> {
  return appApi().RunCommand(input);
}

export function listCommandHistory(filter: CommandHistoryFilter): Promise<CommandHistoryEntry[]> {
  return appApi().ListCommandHistory(filter);
}

export function clearCommandHistory(connectionId: string): Promise<void> {
  return appApi().ClearCommandHistory(connectionId);
}

export function listSavedCommands(): Promise<SavedCommand[]> {
  return appApi().ListSavedCommands();
}

export function saveSavedCommand(input: SaveSavedCommandInput): Promise<SavedCommand> {
  return appApi().SaveSavedCommand(input);
}

export function deleteSavedCommand(id: string): Promise<void> {
  return appApi().DeleteSavedCommand(id);
}

export function getSettings(): Promise<AppSettings> {
  return appApi().GetSettings();
}

export function saveSettings(input: AppSettings): Promise<AppSettings> {
  return appApi().SaveSettings(input);
}

export function listFiles(input: FileListInput): Promise<FileEntry[]> {
  return appApi().ListFiles(input);
}

export function readFile(input: FileReadInput): Promise<FileContent> {
  return appApi().ReadFile(input);
}

export function saveFile(input: FileSaveInput): Promise<void> {
  return appApi().SaveFile(input);
}

export function createFolder(input: FileMutationInput): Promise<void> {
  return appApi().CreateFolder(input);
}

export function renameFile(input: FileRenameInput): Promise<void> {
  return appApi().RenameFile(input);
}

export function deleteFile(input: FileMutationInput): Promise<void> {
  return appApi().DeleteFile(input);
}

export function transferFile(input: FileTransferInput): Promise<FileTransferResult> {
  return appApi().TransferFile(input);
}

export function selectLocalFile(): Promise<string> {
  return appApi().SelectLocalFile();
}

export function selectLocalFiles(): Promise<string[]> {
  return appApi().SelectLocalFiles();
}

export function selectLocalDirectory(title: string): Promise<string> {
  return appApi().SelectLocalDirectory(title);
}

export function selectSaveFile(defaultFilename: string): Promise<string> {
  return appApi().SelectSaveFile(defaultFilename);
}

export function getMonitorSnapshot(sessionId: string): Promise<MonitorSnapshot> {
  return appApi().GetMonitorSnapshot(sessionId);
}

export function listMonitorHistory(filter: MonitorHistoryFilter): Promise<MonitorHistoryEntry[]> {
  return appApi().ListMonitorHistory(filter);
}

export function getMonitorIncidentReport(sessionId: string): Promise<string> {
  return appApi().GetMonitorIncidentReport(sessionId);
}

export function onWailsEvent<T>(name: string, callback: (data: T) => void): () => void {
  const runtime = window.runtime;
  if (!runtime) {
    return () => {};
  }

  const eventCallback = (...data: unknown[]) => callback(data[0] as T);

  if (runtime.EventsOn) {
    const unsubscribe = runtime.EventsOn(name, eventCallback);
    return typeof unsubscribe === "function" ? () => unsubscribe() : () => {};
  }

  if (runtime.EventsOnMultiple) {
    const unsubscribe = runtime.EventsOnMultiple(name, eventCallback, -1);
    return typeof unsubscribe === "function" ? () => unsubscribe() : () => {};
  }

  throw new Error("Wails runtime event API is not available");
}
