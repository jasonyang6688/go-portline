import type {
  AppSettings,
  Connection,
  FileEntry as BackendFileEntry,
  MonitorHistoryEntry,
  MonitorSnapshot,
  SavedCommand,
  Session,
} from "../features/connections/types";
import { CommandsView } from "./CommandsView";
import { FilesView } from "./FilesView";
import { MonitorView } from "./MonitorView";
import { SettingsView } from "./SettingsView";
import type { MonitorHistory, MonitorRules } from "./monitorSnapshot";
import type { CommandScopeKey } from "./terminalSmartBarCommands";

type SecondaryViewId = "terminal" | "files" | "monitor" | "commands" | "settings";

type TransferRecord = {
  id: string;
  direction: "upload" | "download";
  name: string;
  detail: string;
  status: "running" | "done" | "failed";
  bytes?: number;
  completedAt?: string;
};

export function SecondaryView({
  view,
  activeSession,
  localFiles,
  remoteFiles,
  localPath,
  remotePath,
  transfers,
  monitorSnapshot,
  monitorHistory,
  persistedMonitorHistory,
  monitorRules,
  savedCommands,
  connections,
  appSettings,
  onRunCommand,
  onCopyIncidentReport,
  onRefreshMonitor,
  onChangeMonitorRules,
  onSaveSettings,
  onLocalUp,
  onRemoteUp,
  onLocalRefresh,
  onRemoteRefresh,
  onNewFile,
  onNewFolder,
  onUploadFolder,
  onOpenFolder,
  onOpenPath,
  onTransfer,
  onTransferMany,
  onEditFile,
  onRenameFile,
  onDeleteFile,
  onDeleteFiles,
  onDismissTransfer,
  onClearFinishedTransfers,
  onCreateSavedCommand,
  onEditSavedCommand,
  onDeleteSavedCommand,
  onToggleCommandPin,
}: {
  view: SecondaryViewId;
  activeSession: Session | null;
  localFiles: BackendFileEntry[];
  remoteFiles: BackendFileEntry[];
  localPath: string;
  remotePath: string;
  transfers: TransferRecord[];
  monitorSnapshot: MonitorSnapshot | null;
  monitorHistory: MonitorHistory;
  persistedMonitorHistory: MonitorHistoryEntry[];
  monitorRules: MonitorRules;
  savedCommands: SavedCommand[];
  connections: Connection[];
  appSettings: AppSettings;
  onRunCommand(command: string): void;
  onCopyIncidentReport(): Promise<string>;
  onRefreshMonitor(): Promise<void> | void;
  onChangeMonitorRules(rules: MonitorRules): void;
  onSaveSettings(settings: AppSettings): Promise<void> | void;
  onLocalUp(): void;
  onRemoteUp(): void;
  onLocalRefresh(): void;
  onRemoteRefresh(): void;
  onNewFile(side: "local" | "remote"): void;
  onNewFolder(side: "local" | "remote"): void;
  onUploadFolder(): void;
  onOpenFolder(side: "local" | "remote", entry: BackendFileEntry): void;
  onOpenPath(side: "local" | "remote", path: string): void;
  onTransfer(side: "local" | "remote", entry: BackendFileEntry): void;
  onTransferMany(side: "local" | "remote", entries: BackendFileEntry[]): void;
  onEditFile(side: "local" | "remote", entry: BackendFileEntry): void;
  onRenameFile(side: "local" | "remote", entry: BackendFileEntry): void;
  onDeleteFile(side: "local" | "remote", entry: BackendFileEntry): void;
  onDeleteFiles(side: "local" | "remote", entries: BackendFileEntry[]): void;
  onDismissTransfer(id: string): void;
  onClearFinishedTransfers(): void;
  onCreateSavedCommand(scopeKey: CommandScopeKey): void;
  onEditSavedCommand(command: SavedCommand): void;
  onDeleteSavedCommand(command: SavedCommand): void;
  onToggleCommandPin(command: SavedCommand): void;
}) {
  if (view === "files") {
    return (
      <FilesView
        activeSession={activeSession}
        localFiles={localFiles}
        remoteFiles={remoteFiles}
        localPath={localPath}
        remotePath={remotePath}
        transfers={transfers}
        onLocalUp={onLocalUp}
        onRemoteUp={onRemoteUp}
        onLocalRefresh={onLocalRefresh}
        onRemoteRefresh={onRemoteRefresh}
        onNewFile={onNewFile}
        onNewFolder={onNewFolder}
        onUploadFolder={onUploadFolder}
        onOpenFolder={onOpenFolder}
        onOpenPath={onOpenPath}
        onTransfer={onTransfer}
        onTransferMany={onTransferMany}
        onEdit={onEditFile}
        onRename={onRenameFile}
        onDelete={onDeleteFile}
        onDeleteMany={onDeleteFiles}
        onDismissTransfer={onDismissTransfer}
        onClearFinishedTransfers={onClearFinishedTransfers}
      />
    );
  }
  if (view === "monitor") {
    return (
      <MonitorView
        snapshot={monitorSnapshot}
        history={monitorHistory}
        persistedHistory={persistedMonitorHistory}
        rules={monitorRules}
        onChangeRules={onChangeMonitorRules}
        onRefreshMonitor={onRefreshMonitor}
        onCopyIncidentReport={onCopyIncidentReport}
      />
    );
  }
  if (view === "commands") {
    return (
      <CommandsView
        savedCommands={savedCommands}
        connections={connections}
        onRun={onRunCommand}
        onCreate={onCreateSavedCommand}
        onEdit={onEditSavedCommand}
        onDelete={onDeleteSavedCommand}
        onTogglePin={onToggleCommandPin}
      />
    );
  }
  return <SettingsView appSettings={appSettings} onSave={onSaveSettings} />;
}
