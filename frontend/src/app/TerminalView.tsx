import type { RefObject } from "react";
import type {
  CommandHistoryEntry,
  Connection,
  FileEntry as BackendFileEntry,
  MonitorSnapshot,
  SavedCommand,
  Session,
  TerminalSize,
} from "../features/connections/types";
import { TerminalPane } from "../features/terminal/TerminalPane";
import { TerminalBroadcastBanner } from "./TerminalBroadcastBanner";
import { TerminalCommandInput } from "./TerminalCommandInput";
import { TerminalFilesDock } from "./TerminalFilesDock";
import { TerminalHistoryDock, type CommandHistoryScope } from "./TerminalHistoryDock";
import { TerminalMonitorDock } from "./TerminalMonitorDock";
import { TerminalSmartBar } from "./TerminalSmartBar";
import { TerminalToolbar } from "./TerminalToolbar";
import type { MonitorHistory } from "./monitorSnapshot";
import type { TerminalDock } from "./terminalViewTypes";
import type { TransferRecord } from "./useFileTransfers";

type TerminalViewProps = {
  activeConnection: Connection | null;
  activeSession: Session | null;
  activeTerminalBuffer: string;
  activeTerminalFullscreen: boolean;
  commandHistory: CommandHistoryEntry[];
  commandHistoryQuery: string;
  commandHistoryScope: CommandHistoryScope;
  connectedSessionCount: number;
  monitorHistory: MonitorHistory;
  monitorSnapshot: MonitorSnapshot | null;
  remoteFiles: BackendFileEntry[];
  remotePath: string;
  savedCommands: SavedCommand[];
  terminalBroadcast: boolean;
  terminalCPU: number;
  terminalCPUHistory: number[];
  terminalCPUHistoryMax: number;
  terminalCommand: string;
  terminalCommandInputRef: RefObject<HTMLInputElement | null>;
  terminalDisplayHost: string;
  terminalDisplayPath: string;
  terminalDisplayUser: string;
  terminalDock: TerminalDock;
  terminalIsProd: boolean;
  terminalLayoutKey: string;
  terminalMemory: number;
  terminalSmartOpen: boolean;
  theme: "dark" | "light";
  transfers: TransferRecord[];
  onChangeCommandHistoryQuery: (query: string) => void;
  onChangeCommandHistoryScope: (scope: CommandHistoryScope) => void;
  onChangeTerminalCommand: (command: string) => void;
  onClearActiveHistory: () => void;
  onClearFinishedTransfers: () => void;
  onCloseActiveSession: () => void;
  onCloseDock: () => void;
  onCloseSmartBar: () => void;
  onCommandCommit: (command: string) => void;
  onDeleteRemoteFile: (entry: BackendFileEntry) => void;
  onDeleteRemoteFiles: (entries: BackendFileEntry[]) => void;
  onDismissTransfer: (id: string) => void;
  onEditRemoteFile: (entry: BackendFileEntry) => void;
  onNewRemoteFile: () => void;
  onNewRemoteFolder: () => void;
  onOpenMonitorFullView: () => void;
  onOpenRemoteFolder: (entry: BackendFileEntry) => void;
  onOpenRemotePath: (path: string) => void;
  onPickSmartCommand: (command: string) => void;
  onRefreshRemoteFiles: () => void;
  onRenameRemoteFile: (entry: BackendFileEntry) => void;
  onReorderSmartCommand: (sourceId: string, targetId: string) => void;
  onRunTerminalCommand: (command: string) => void;
  onSyncRemoteFiles: () => void;
  onTerminalFullscreenChange: (sessionId: string, fullscreen: boolean) => void;
  onTerminalSizeChange: (size: TerminalSize) => void;
  onToggleBroadcast: () => void;
  onToggleFilesDock: () => void;
  onToggleHistoryDock: () => void;
  onToggleMonitorDock: () => void;
  onToggleSmartBar: () => void;
  onTransferRemoteFile: (entry: BackendFileEntry) => void;
  onTurnOffBroadcast: () => void;
  onUploadFolderToRemote: () => void;
  onUploadToRemote: () => void;
};

export function TerminalView({
  activeConnection,
  activeSession,
  activeTerminalBuffer,
  activeTerminalFullscreen,
  commandHistory,
  commandHistoryQuery,
  commandHistoryScope,
  connectedSessionCount,
  monitorHistory,
  monitorSnapshot,
  remoteFiles,
  remotePath,
  savedCommands,
  terminalBroadcast,
  terminalCPU,
  terminalCPUHistory,
  terminalCPUHistoryMax,
  terminalCommand,
  terminalCommandInputRef,
  terminalDisplayHost,
  terminalDisplayPath,
  terminalDisplayUser,
  terminalDock,
  terminalIsProd,
  terminalLayoutKey,
  terminalMemory,
  terminalSmartOpen,
  theme,
  transfers,
  onChangeCommandHistoryQuery,
  onChangeCommandHistoryScope,
  onChangeTerminalCommand,
  onClearActiveHistory,
  onClearFinishedTransfers,
  onCloseActiveSession,
  onCloseDock,
  onCloseSmartBar,
  onCommandCommit,
  onDeleteRemoteFile,
  onDeleteRemoteFiles,
  onDismissTransfer,
  onEditRemoteFile,
  onNewRemoteFile,
  onNewRemoteFolder,
  onOpenMonitorFullView,
  onOpenRemoteFolder,
  onOpenRemotePath,
  onPickSmartCommand,
  onRefreshRemoteFiles,
  onRenameRemoteFile,
  onReorderSmartCommand,
  onRunTerminalCommand,
  onSyncRemoteFiles,
  onTerminalFullscreenChange,
  onTerminalSizeChange,
  onToggleBroadcast,
  onToggleFilesDock,
  onToggleHistoryDock,
  onToggleMonitorDock,
  onToggleSmartBar,
  onTransferRemoteFile,
  onTurnOffBroadcast,
  onUploadFolderToRemote,
  onUploadToRemote,
}: TerminalViewProps) {
  return (
    <section className="term-pane">
      <TerminalToolbar
        terminalDock={terminalDock}
        terminalIsProd={terminalIsProd}
        terminalDisplayPath={terminalDisplayPath}
        terminalCPU={terminalCPU}
        terminalMemory={terminalMemory}
        terminalCPUHistory={terminalCPUHistory}
        terminalCPUHistoryMax={terminalCPUHistoryMax}
        onCloseActiveSession={onCloseActiveSession}
        onToggleMonitorDock={onToggleMonitorDock}
        onToggleFilesDock={onToggleFilesDock}
        onToggleHistoryDock={onToggleHistoryDock}
      />
      <div className="terminal-stage terminal-stage-alerts">
        <TerminalPane
          session={activeSession}
          terminalBuffer={activeTerminalBuffer}
          themeMode={theme}
          layoutKey={terminalLayoutKey}
          onTerminalSizeChange={onTerminalSizeChange}
          onFullscreenChange={onTerminalFullscreenChange}
          onCommandCommit={onCommandCommit}
        />
        {terminalDock === "monitor" ? (
          <TerminalMonitorDock
            host={terminalDisplayHost}
            user={terminalDisplayUser}
            snapshot={monitorSnapshot}
            history={monitorHistory}
            onFullView={onOpenMonitorFullView}
            onClose={onCloseDock}
          />
        ) : null}
        {terminalDock === "files" ? (
          <TerminalFilesDock
            files={remoteFiles}
            path={remotePath}
            hasSession={Boolean(activeSession)}
            transfers={transfers}
            onRunCommand={onRunTerminalCommand}
            onOpenFolder={onOpenRemoteFolder}
            onOpenPath={onOpenRemotePath}
            onRefresh={onRefreshRemoteFiles}
            onSync={onSyncRemoteFiles}
            onUpload={onUploadToRemote}
            onUploadFolder={onUploadFolderToRemote}
            onNewFile={onNewRemoteFile}
            onNewFolder={onNewRemoteFolder}
            onTransfer={onTransferRemoteFile}
            onEdit={onEditRemoteFile}
            onRename={onRenameRemoteFile}
            onDelete={onDeleteRemoteFile}
            onDeleteMany={onDeleteRemoteFiles}
            onDismissTransfer={onDismissTransfer}
            onClearFinishedTransfers={onClearFinishedTransfers}
            onClose={onCloseDock}
          />
        ) : null}
        {terminalDock === "history" ? (
          <TerminalHistoryDock
            host={terminalDisplayHost}
            history={commandHistory}
            query={commandHistoryQuery}
            scope={commandHistoryScope}
            onQueryChange={onChangeCommandHistoryQuery}
            onScopeChange={onChangeCommandHistoryScope}
            onRunCommand={onRunTerminalCommand}
            onClear={onClearActiveHistory}
            onClose={onCloseDock}
          />
        ) : null}
      </div>
      {terminalSmartOpen && !activeTerminalFullscreen ? (
        <TerminalSmartBar
          savedCommands={savedCommands}
          connectionId={activeConnection?.id ?? null}
          onClose={onCloseSmartBar}
          onPick={onPickSmartCommand}
          onReorder={onReorderSmartCommand}
        />
      ) : null}
      {terminalBroadcast && !activeTerminalFullscreen ? (
        <TerminalBroadcastBanner
          connectedSessionCount={connectedSessionCount}
          onTurnOff={onTurnOffBroadcast}
        />
      ) : null}
      {!activeTerminalFullscreen ? (
        <TerminalCommandInput
          inputRef={terminalCommandInputRef}
          command={terminalCommand}
          terminalDisplayUser={terminalDisplayUser}
          terminalDisplayHost={terminalDisplayHost}
          terminalDisplayPath={terminalDisplayPath}
          terminalSmartOpen={terminalSmartOpen}
          terminalBroadcast={terminalBroadcast}
          onCommandChange={onChangeTerminalCommand}
          onRunCommand={onRunTerminalCommand}
          onToggleSmart={onToggleSmartBar}
          onToggleBroadcast={onToggleBroadcast}
        />
      ) : null}
    </section>
  );
}
