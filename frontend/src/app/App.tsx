import { useEffect, useMemo, useRef, useState } from "react";
import type {
  FormEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { ConnectionSidebar } from "../features/connections/ConnectionSidebar";
import { StatusBar } from "../features/status/StatusBar";
import {
  listCommandHistory,
  listFiles,
  saveSettings,
  writeTerminal,
} from "../shared/api/wails";
import type {
  AppSettings,
  CommandHistoryEntry,
  Connection,
  FileEntry as BackendFileEntry,
  SavedCommand,
  Session,
  TerminalSize,
} from "../features/connections/types";
import { CWD_SYNC_COMMAND } from "./cwdSyncOutput";
import { canWriteShellCommand } from "./terminalReplay";
import { commandScopeKey } from "./terminalSmartBarCommands";
import { TitleBar } from "./TitleBar";
import type { CommandHistoryScope } from "./TerminalHistoryDock";
import { SecondaryView } from "./SecondaryView";
import { createCommandPaletteItems } from "./commandPaletteItems";
import { ActivityBar } from "./ActivityBar";
import { TerminalView } from "./TerminalView";
import type { PendingCwdSync, TerminalDock } from "./terminalViewTypes";
import { useFileEditors } from "./useFileEditors";
import { AppOverlays } from "./AppOverlays";
import { useFileTransfers } from "./useFileTransfers";
import { useWailsSessionEvents } from "./useWailsSessionEvents";
import { useInitialAppData } from "./useInitialAppData";
import { useMonitorData } from "./useMonitorData";
import { useActiveSessionData } from "./useActiveSessionData";
import { useFileActions } from "./useFileActions";
import { useSavedCommandActions } from "./useSavedCommandActions";
import { useConnectionActions } from "./useConnectionActions";
import { useTerminalActions } from "./useTerminalActions";
import { useClock } from "./useClock";
import {
  useCommandPaletteShortcut,
  useConnectionMenuDismiss,
} from "./useAppChromeEffects";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_LOCAL_PATH,
  DEFAULT_TERMINAL_SIZE,
  DEMO_NOW,
  demoRemoteFilesForPath,
  normalizeRemotePath,
} from "./appDemoData";
import {
  defaultRemotePath,
  isProductionConnection,
  joinPath,
  parentPath,
  terminalHost,
  terminalPath,
  terminalUser,
} from "./appHelpers";

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const NAV_ITEMS = [
  { id: "terminal", label: "Terminal", icon: "terminal" },
  { id: "files", label: "File Manager", icon: "files" },
  { id: "monitor", label: "Monitor", icon: "monitor" },
  { id: "commands", label: "Commands", icon: "commands" },
  { id: "settings", label: "Settings", icon: "settings" },
] as const;

type ViewId = (typeof NAV_ITEMS)[number]["id"];

export default function App() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terminalBuffers, setTerminalBuffers] = useState<Record<string, string>>({});
  const [fullscreenTerminalSessions, setFullscreenTerminalSessions] = useState<Record<string, boolean>>({});
  const [savedCommands, setSavedCommands] = useState<SavedCommand[]>([]);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);
  const [commandHistoryQuery, setCommandHistoryQuery] = useState("");
  const [commandHistoryScope, setCommandHistoryScope] = useState<CommandHistoryScope>("host");
  const [localFiles, setLocalFiles] = useState<BackendFileEntry[]>([]);
  const [remoteFiles, setRemoteFiles] = useState<BackendFileEntry[]>([]);
  const [fileListLoading, setFileListLoading] = useState({ local: false, remote: false });
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [localPath, setLocalPath] = useState(DEFAULT_LOCAL_PATH);
  const [remotePathBySession, setRemotePathBySession] = useState<Record<string, string>>({});
  const fileListRequestsRef = useRef({ local: 0, remote: 0 });
  const liveSessionIdsRef = useRef<Set<string>>(new Set());
  const fullscreenTerminalSessionsRef = useRef<Record<string, boolean>>({});
  const pendingCwdSyncRef = useRef<PendingCwdSync | null>(null);
  const tabConnectionMenuRef = useRef<HTMLDivElement | null>(null);
  const refreshRemoteFilesRef = useRef<(path?: string) => Promise<void>>(async () => {});
  const terminalCommandInputRef = useRef<HTMLInputElement | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewId>("terminal");
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [terminalDock, setTerminalDock] = useState<TerminalDock>(null);
  const [terminalSmartOpen, setTerminalSmartOpen] = useState(false);
  const [terminalBroadcast, setTerminalBroadcast] = useState(false);
  const [terminalCommand, setTerminalCommand] = useState("");
  const [terminalCommandLog, setTerminalCommandLog] = useState<string[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [status, setStatus] = useState("Ready");
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [terminalSize, setTerminalSize] = useState<TerminalSize>(DEFAULT_TERMINAL_SIZE);
  const clock = useClock();
  const {
    fileEditors,
    closeFileEditor,
    failLoadingFileEditor,
    finishLoadingFileEditor,
    focusFileEditor,
    hideFileEditor,
    markFileEditorSaved,
    moveFileEditor,
    openFileEditor,
    resizeFileEditor,
    startSavingFileEditor,
    stopSavingFileEditor,
    toggleFileEditorWrap,
    updateFileEditorContent,
  } = useFileEditors();

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
  const remoteHomePath = defaultRemotePath(activeConnection);
  const remotePath = activeSession ? remotePathBySession[activeSession.id] ?? remoteHomePath : remoteHomePath;
  const {
    monitorHistory,
    monitorRules,
    monitorSnapshot,
    persistedMonitorHistory,
    applyMonitorSnapshot,
    copyMonitorIncidentReport,
    handleMonitorRulesChange,
    refreshMonitorSnapshot,
    refreshPersistedMonitorHistory,
    resetMonitorData,
  } = useMonitorData({
    activeSession,
    backendAvailable,
    setStatus,
  });
  const {
    transfers,
    clearFinishedTransfers,
    dismissTransfer,
    handleFileTransfer,
    handleFileTransfers,
    handleUploadFolderToRemoteDirectory,
    handleUploadToRemoteDirectory,
  } = useFileTransfers({
    backendAvailable,
    localPath,
    remotePath,
    refreshLocalFiles,
    refreshRemoteFiles,
    requireActiveRemoteSession,
    setStatus,
  });
  const {
    deletingFiles,
    pendingFileDelete,
    pendingNewItem,
    pendingRenameItem,
    confirmCreateNewItem,
    confirmDeleteFiles,
    confirmRenameItem,
    handleDeleteFile,
    handleDeleteFiles,
    handleEditFile,
    handleNewFile,
    handleNewFolder,
    handleRenameFile,
    handleSaveEditedFile,
    setPendingFileDelete,
    setPendingNewItem,
    setPendingRenameItem,
  } = useFileActions({
    backendAvailable,
    fileEditors,
    localFiles,
    localPath,
    remoteFiles,
    remotePath,
    failLoadingFileEditor,
    finishLoadingFileEditor,
    markFileEditorSaved,
    openFileEditor,
    refreshLocalFiles,
    refreshRemoteFiles,
    requireActiveRemoteSession,
    setStatus,
    startSavingFileEditor,
    stopSavingFileEditor,
  });
  const {
    commandEditor,
    deletingCommandId,
    pendingCommandDelete,
    confirmDeleteSavedCommand,
    handleCreateSavedCommand,
    handleDeleteSavedCommand,
    handleEditSavedCommand,
    handleReorderTerminalSmartBarCommand,
    handleSaveCommandEditor,
    handleToggleCommandPin,
    setCommandEditor,
    setPendingCommandDelete,
  } = useSavedCommandActions({
    activeConnectionId: activeConnection?.id ?? null,
    backendAvailable,
    connections,
    savedCommands,
    setSavedCommands,
    setStatus,
  });
  const {
    deletingConnectionId,
    editingConnection,
    isModalOpen,
    pendingDeleteConnection,
    tabConnectionMenuOpen,
    confirmDeleteConnection,
    handleCreateConnectionFromTabs,
    handleOpenConnection,
    handleOpenConnectionFromTabs,
    handleSaveConnection,
    handleTrustHostKeyAndOpen,
    refreshConnectionsFromBackend,
    setEditingConnection,
    setIsModalOpen,
    setPendingDeleteConnection,
    setTabConnectionMenuOpen,
  } = useConnectionActions({
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
  });
  useWailsSessionEvents({
    fullscreenTerminalSessionsRef,
    liveSessionIdsRef,
    pendingCwdSyncRef,
    refreshRemoteFilesRef,
    sessions,
    setFullscreenTerminalSessions,
    setSessions,
    setStatus,
    setTerminalBuffers,
  });
  useInitialAppData({
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
  });
  useActiveSessionData({
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
  });
  const terminalDisplayUser = terminalUser(activeConnection);
  const terminalDisplayHost = terminalHost(activeConnection, activeSession);
  const terminalDisplayPath = terminalDock === "files" ? remotePath : terminalPath(activeConnection);
  const {
    handleClearActiveHistory,
    handleCloseSession,
    handleRunTerminalCommand,
    handleTerminalCommandCommit,
    handleTerminalFullscreenChange,
    handleTerminalSizeChange,
    pickTerminalSmartCommand,
  } = useTerminalActions({
    activeSession,
    activeSessionId,
    backendAvailable,
    commandHistoryScope,
    fullscreenTerminalSessionsRef,
    sessions,
    terminalBroadcast,
    terminalCommandInputRef,
    terminalDisplayHost,
    terminalDisplayPath,
    terminalDisplayUser,
    refreshCommandHistory,
    setActiveSessionId,
    setCommandHistory,
    setFullscreenTerminalSessions,
    setSessions,
    setStatus,
    setTerminalBuffers,
    setTerminalCommand,
    setTerminalCommandLog,
    setTerminalSize,
    setTerminalSmartOpen,
  });

  function setSessionRemotePath(sessionID: string, path: string) {
    const nextPath = normalizeRemotePath(path);
    setRemotePathBySession((current) => {
      if (current[sessionID] === nextPath) {
        return current;
      }
      return {
        ...current,
        [sessionID]: nextPath,
      };
    });
  }

  function startFileListLoading(side: "local" | "remote"): number {
    const requestId = fileListRequestsRef.current[side] + 1;
    fileListRequestsRef.current = {
      ...fileListRequestsRef.current,
      [side]: requestId,
    };
    setFileListLoading((current) => current[side] ? current : { ...current, [side]: true });
    return requestId;
  }

  function finishFileListLoading(side: "local" | "remote", requestId: number) {
    if (fileListRequestsRef.current[side] !== requestId) {
      return;
    }
    setFileListLoading((current) => current[side] ? { ...current, [side]: false } : current);
  }

  async function refreshLocalFiles(path = localPath) {
    if (!backendAvailable) {
      setLocalFiles(DEMO_LOCAL_FILES);
      return;
    }
    const requestId = startFileListLoading("local");
    try {
      const files = await listFiles({ side: "local", path });
      if (fileListRequestsRef.current.local === requestId) {
        setLocalPath(path);
        setLocalFiles(files);
      }
    } catch (error) {
      if (fileListRequestsRef.current.local === requestId) {
        setStatus(messageFromError(error));
      }
    } finally {
      finishFileListLoading("local", requestId);
    }
  }

  async function refreshRemoteFiles(path = remotePath) {
    const session = activeSession;
    if (!session) {
      setStatus("No active session");
      setRemoteFiles([]);
      setFileListLoading((current) => current.remote ? { ...current, remote: false } : current);
      return;
    }
    const nextPath = normalizeRemotePath(path);
    if (!backendAvailable) {
      setSessionRemotePath(session.id, nextPath);
      setRemoteFiles(demoRemoteFilesForPath(nextPath));
      setStatus(`Preview files: ${nextPath}`);
      return;
    }
    const requestId = startFileListLoading("remote");
    try {
      const files = await listFiles({ side: "remote", sessionId: session.id, path: nextPath });
      if (fileListRequestsRef.current.remote === requestId) {
        setSessionRemotePath(session.id, nextPath);
        setRemoteFiles(files);
      }
    } catch (error) {
      if (fileListRequestsRef.current.remote === requestId) {
        setStatus(messageFromError(error));
      }
    } finally {
      finishFileListLoading("remote", requestId);
    }
  }

  async function syncRemoteFilesToTerminalCwd() {
    if (!activeSession) {
      setStatus("No active session");
      setRemoteFiles([]);
      return;
    }
    if (!backendAvailable) {
      await refreshRemoteFiles(remotePath);
      setStatus(`Preview files: ${remotePath}`);
      return;
    }
    if (!canWriteShellCommand(activeSession.id, fullscreenTerminalSessionsRef.current)) {
      setStatus("Exit the fullscreen terminal app before syncing files");
      return;
    }

    if (pendingCwdSyncRef.current) {
      window.clearTimeout(pendingCwdSyncRef.current.timeoutId);
      pendingCwdSyncRef.current = null;
    }

    const sessionId = activeSession.id;
    const timeoutId = window.setTimeout(() => {
      if (pendingCwdSyncRef.current?.sessionId !== sessionId) {
        return;
      }
      pendingCwdSyncRef.current = null;
      setStatus("Could not read terminal working directory");
    }, 2500);

    pendingCwdSyncRef.current = { sessionId, output: "", timeoutId };
    setStatus("Syncing files with terminal path");
    try {
      await writeTerminal(sessionId, CWD_SYNC_COMMAND);
    } catch (error) {
      window.clearTimeout(timeoutId);
      if (pendingCwdSyncRef.current?.sessionId === sessionId) {
        pendingCwdSyncRef.current = null;
      }
      setStatus(messageFromError(error));
    }
  }

  useEffect(() => {
    refreshRemoteFilesRef.current = refreshRemoteFiles;
  });

  async function refreshCommandHistory(scope = commandHistoryScope) {
    if (!backendAvailable) {
      setCommandHistory([]);
      return;
    }
    if (scope === "host" && !activeSession) {
      setCommandHistory([]);
      return;
    }
    const filter: Parameters<typeof listCommandHistory>[0] =
      scope === "host" && activeSession
        ? { connectionId: activeSession.connectionId, limit: 200 }
        : { limit: 200 };
    const history = await listCommandHistory(filter);
    setCommandHistory(history);
  }

  useEffect(() => {
    fullscreenTerminalSessionsRef.current = fullscreenTerminalSessions;
  }, [fullscreenTerminalSessions]);

  useCommandPaletteShortcut(() => setPaletteOpen((open) => !open));
  useConnectionMenuDismiss({
    connectionMenuOpen: tabConnectionMenuOpen,
    connectionMenuRef: tabConnectionMenuRef,
    onClose: () => setTabConnectionMenuOpen(false),
  });

  useEffect(() => {
    if (activeSessionId && sessions.some((session) => session.id === activeSessionId)) {
      return;
    }
    setActiveSessionId(sessions.find((session) => session.id === "demo-123123")?.id ?? sessions[0]?.id ?? null);
  }, [activeSessionId, sessions]);

  async function handleSaveAppSettings(settings: AppSettings) {
    if (!backendAvailable) {
      setAppSettings(settings);
      setTheme(settings.theme === "dark" ? "dark" : "light");
      setStatus("Saved preview settings");
      return;
    }
    try {
      const saved = await saveSettings(settings);
      setAppSettings(saved);
      setTheme(saved.theme === "dark" ? "dark" : "light");
      setStatus("Settings saved");
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  function requireActiveRemoteSession(): string | null {
    if (!activeSession) {
      setStatus("Open an SSH session before using remote files");
      return null;
    }
    return activeSession.id;
  }

  const paletteItems = createCommandPaletteItems({
    connections,
    navItems: NAV_ITEMS,
    savedCommands,
    onCreateConnection: () => {
      setEditingConnection(null);
      setIsModalOpen(true);
    },
    onOpenConnection: (connection) => void handleOpenConnection(connection, "", false),
    onRunCommand: (command) => void handleRunTerminalCommand(command),
    onSetView: setActiveView,
  });
  const terminalIsProd = isProductionConnection(activeConnection);
  const activeTerminalFullscreen = activeSession ? fullscreenTerminalSessions[activeSession.id] === true : false;
  const terminalLayoutKey = [
    activeSession?.id ?? "none",
    activeTerminalFullscreen ? "fullscreen" : "shell",
    terminalDock ?? "none",
    terminalSmartOpen && !activeTerminalFullscreen ? "smart" : "no-smart",
    terminalBroadcast && !activeTerminalFullscreen ? "broadcast" : "no-broadcast",
  ].join(":");
  const terminalCPU = monitorSnapshot?.cpuPercent ?? 0;
  const terminalMemory = monitorSnapshot?.memoryPercent ?? 0;
  const terminalCPUHistory = monitorHistory.cpu.length ? monitorHistory.cpu : [terminalCPU];
  const terminalCPUHistoryMax = Math.max(...terminalCPUHistory, 1);
  const hideStatusBar = activeView === "terminal" && activeTerminalFullscreen;
  const showConnectionSidebar = activeView !== "commands" && activeView !== "settings";
  return (
    <div className="app" data-theme={theme}>
      <TitleBar
        activeSessionId={activeSessionId}
        clock={clock}
        connectionMenuRef={tabConnectionMenuRef}
        connectionMenuOpen={tabConnectionMenuOpen}
        connections={connections}
        isProductionConnection={isProductionConnection}
        onActivateSession={setActiveSessionId}
        onCloseSession={handleCloseSession}
        onCreateConnection={handleCreateConnectionFromTabs}
        onOpenConnection={handleOpenConnectionFromTabs}
        onOpenPalette={() => setPaletteOpen(true)}
        onToggleConnectionMenu={() => setTabConnectionMenuOpen((open) => !open)}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        sessions={sessions}
        theme={theme}
      />

      <div className="app-body">
        <ActivityBar
          activeView={activeView}
          items={NAV_ITEMS}
          settingsView="settings"
          sidebarCollapsed={sidebarCollapsed}
          onSetView={setActiveView}
          onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
        />

        {showConnectionSidebar ? (
          <ConnectionSidebar
            connections={connections}
            activeConnectionId={activeConnection?.id ?? null}
            collapsed={sidebarCollapsed}
            connectedConnectionIds={sessions
              .filter((session) => session.status === "connected")
              .map((session) => session.connectionId)}
            onCreate={() => {
              setEditingConnection(null);
              setPendingDeleteConnection(null);
              setIsModalOpen(true);
            }}
            onEdit={(connection) => {
              setEditingConnection(connection);
              setPendingDeleteConnection(null);
              setIsModalOpen(true);
            }}
            onDelete={(connection) => {
              setEditingConnection(null);
              setIsModalOpen(false);
              setPendingDeleteConnection(connection);
            }}
            onOpen={handleOpenConnection}
            onTrustHostKey={(connection) => void handleTrustHostKeyAndOpen(connection)}
            onRefresh={() => void refreshConnectionsFromBackend()}
          />
        ) : null}

        <main className="main-pane">
          {activeView === "terminal" ? (
            <TerminalView
              activeConnection={activeConnection}
              activeSession={activeSession}
              activeTerminalFullscreen={activeTerminalFullscreen}
              commandHistory={commandHistory}
              commandHistoryQuery={commandHistoryQuery}
              commandHistoryScope={commandHistoryScope}
              connectedSessionCount={sessions.filter((session) => session.status === "connected").length}
              monitorHistory={monitorHistory}
              monitorSnapshot={monitorSnapshot}
              remoteFiles={remoteFiles}
              remoteFilesLoading={fileListLoading.remote}
              remotePath={remotePath}
              savedCommands={savedCommands}
              sessions={sessions}
              terminalBroadcast={terminalBroadcast}
              terminalBuffers={terminalBuffers}
              terminalCPU={terminalCPU}
              terminalCPUHistory={terminalCPUHistory}
              terminalCPUHistoryMax={terminalCPUHistoryMax}
              terminalCommand={terminalCommand}
              terminalCommandInputRef={terminalCommandInputRef}
              terminalDisplayHost={terminalDisplayHost}
              terminalDisplayPath={terminalDisplayPath}
              terminalDisplayUser={terminalDisplayUser}
              terminalDock={terminalDock}
              terminalIsProd={terminalIsProd}
              terminalLayoutKey={terminalLayoutKey}
              terminalMemory={terminalMemory}
              terminalSmartOpen={terminalSmartOpen}
              theme={theme}
              transfers={transfers}
              onChangeCommandHistoryQuery={setCommandHistoryQuery}
              onChangeCommandHistoryScope={(scope) => {
                setCommandHistoryScope(scope);
                void refreshCommandHistory(scope);
              }}
              onChangeTerminalCommand={setTerminalCommand}
              onClearActiveHistory={() => void handleClearActiveHistory()}
              onClearFinishedTransfers={clearFinishedTransfers}
              onCloseActiveSession={() => activeSession && handleCloseSession(activeSession.id)}
              onCloseDock={() => setTerminalDock(null)}
              onCloseSmartBar={() => setTerminalSmartOpen(false)}
              onCommandCommit={(command) => void handleTerminalCommandCommit(command)}
              onDeleteRemoteFile={(entry) => void handleDeleteFile("remote", entry)}
              onDeleteRemoteFiles={(entries) => void handleDeleteFiles("remote", entries)}
              onDismissTransfer={dismissTransfer}
              onEditRemoteFile={(entry) => void handleEditFile("remote", entry)}
              onNewRemoteFile={() => void handleNewFile("remote")}
              onNewRemoteFolder={() => void handleNewFolder("remote")}
              onOpenMonitorFullView={() => {
                setTerminalDock(null);
                setActiveView("monitor");
                void refreshMonitorSnapshot();
              }}
              onOpenRemoteFolder={(entry) => void refreshRemoteFiles(entry.path)}
              onOpenRemotePath={(path) => void refreshRemoteFiles(path)}
              onPickSmartCommand={pickTerminalSmartCommand}
              onRefreshRemoteFiles={() => void refreshRemoteFiles()}
              onRenameRemoteFile={(entry) => void handleRenameFile("remote", entry)}
              onReorderSmartCommand={(sourceId, targetId) => void handleReorderTerminalSmartBarCommand(sourceId, targetId)}
              onRunTerminalCommand={(command) => void handleRunTerminalCommand(command)}
              onSyncRemoteFiles={() => void syncRemoteFilesToTerminalCwd()}
              onTerminalFullscreenChange={handleTerminalFullscreenChange}
              onTerminalSizeChange={handleTerminalSizeChange}
              onToggleBroadcast={() => setTerminalBroadcast((current) => !current)}
              onToggleFilesDock={() => {
                setTerminalDock((current) => (current === "files" ? null : "files"));
                if (terminalDock !== "files") {
                  void refreshRemoteFiles();
                }
              }}
              onToggleHistoryDock={() => {
                setTerminalDock((current) => (current === "history" ? null : "history"));
                if (terminalDock !== "history") {
                  void refreshCommandHistory(commandHistoryScope);
                }
              }}
              onToggleMonitorDock={() => setTerminalDock((current) => (current === "monitor" ? null : "monitor"))}
              onToggleSmartBar={() => setTerminalSmartOpen((current) => !current)}
              onTransferRemoteFile={(entry) => handleFileTransfer("remote", entry)}
              onTurnOffBroadcast={() => setTerminalBroadcast(false)}
              onUploadFolderToRemote={() => void handleUploadFolderToRemoteDirectory()}
              onUploadToRemote={() => void handleUploadToRemoteDirectory()}
            />
          ) : (
            <section className="placeholder-view">
              <SecondaryView
                view={activeView}
                activeSession={activeSession}
                localFiles={localFiles}
                remoteFiles={remoteFiles}
                fileListLoading={fileListLoading}
                localPath={localPath}
                remotePath={remotePath}
                transfers={transfers}
                monitorSnapshot={monitorSnapshot}
                monitorHistory={monitorHistory}
                persistedMonitorHistory={persistedMonitorHistory}
                monitorRules={monitorRules}
                savedCommands={savedCommands}
                connections={connections}
                appSettings={appSettings}
                onRunCommand={(command) => void handleRunTerminalCommand(command)}
                onCopyIncidentReport={copyMonitorIncidentReport}
                onRefreshMonitor={() => refreshMonitorSnapshot()}
                onChangeMonitorRules={handleMonitorRulesChange}
                onSaveSettings={handleSaveAppSettings}
                onLocalUp={() => void refreshLocalFiles(parentPath(localPath))}
                onRemoteUp={() => void refreshRemoteFiles(parentPath(remotePath))}
                onLocalRefresh={() => void refreshLocalFiles()}
                onRemoteRefresh={() => void refreshRemoteFiles()}
                onNewFile={(side) => void handleNewFile(side)}
                onNewFolder={(side) => void handleNewFolder(side)}
                onUploadFolder={() => void handleUploadFolderToRemoteDirectory()}
                onOpenFolder={(side, entry) => {
                  if (!entry.isDir) {
                    return;
                  }
                  void (side === "local" ? refreshLocalFiles(entry.path) : refreshRemoteFiles(entry.path));
                }}
                onOpenPath={(side, path) => void (side === "local" ? refreshLocalFiles(path) : refreshRemoteFiles(path))}
                onTransfer={handleFileTransfer}
                onTransferMany={(side, entries) => void handleFileTransfers(side, entries)}
                onEditFile={(side, entry) => void handleEditFile(side, entry)}
                onRenameFile={(side, entry) => void handleRenameFile(side, entry)}
                onDeleteFile={(side, entry) => void handleDeleteFile(side, entry)}
                onDeleteFiles={(side, entries) => void handleDeleteFiles(side, entries)}
                onDismissTransfer={dismissTransfer}
                onClearFinishedTransfers={clearFinishedTransfers}
                onCreateSavedCommand={handleCreateSavedCommand}
                onEditSavedCommand={handleEditSavedCommand}
                onDeleteSavedCommand={handleDeleteSavedCommand}
                onToggleCommandPin={(command) => void handleToggleCommandPin(command)}
              />
            </section>
          )}
        </main>
      </div>

      {!hideStatusBar ? (
        <StatusBar
          status={status}
          sessions={sessions}
          activeSession={activeSession}
          activeConnection={activeConnection}
          backendAvailable={backendAvailable}
        />
      ) : null}

      <AppOverlays
        commandEditor={commandEditor}
        connections={connections}
        deletingCommandId={deletingCommandId}
        deletingConnectionId={deletingConnectionId}
        deletingFiles={deletingFiles}
        editingConnection={editingConnection}
        fileEditors={fileEditors}
        isConnectionModalOpen={isModalOpen}
        newItemBasePath={pendingNewItem ? (pendingNewItem.side === "local" ? localPath : remotePath) : null}
        paletteItems={paletteItems}
        paletteOpen={paletteOpen}
        paletteQuery={paletteQuery}
        pendingCommandDelete={pendingCommandDelete}
        pendingDeleteConnection={pendingDeleteConnection}
        pendingFileDelete={pendingFileDelete}
        pendingNewItem={pendingNewItem}
        pendingRenameItem={pendingRenameItem}
        onCancelCommandDelete={() => setPendingCommandDelete(null)}
        onCancelCommandEditor={() => setCommandEditor(null)}
        onCancelConnectionDelete={() => setPendingDeleteConnection(null)}
        onCancelConnectionModal={() => {
          setEditingConnection(null);
          setIsModalOpen(false);
        }}
        onCancelFileDelete={() => setPendingFileDelete(null)}
        onCancelNewItem={() => setPendingNewItem(null)}
        onCancelRenameItem={() => setPendingRenameItem(null)}
        onChangeFileEditor={updateFileEditorContent}
        onChangeNewItemName={(name) =>
          setPendingNewItem((current) => current ? { ...current, name, error: null } : current)
        }
        onChangePaletteQuery={setPaletteQuery}
        onChangeRenameItemName={(name) =>
          setPendingRenameItem((current) => current ? { ...current, name, error: null } : current)
        }
        onCloseFileEditor={closeFileEditor}
        onClosePalette={() => {
          setPaletteOpen(false);
          setPaletteQuery("");
        }}
        onConfirmCommandDelete={(command) => void confirmDeleteSavedCommand(command)}
        onConfirmConnectionDelete={(connection) => void confirmDeleteConnection(connection)}
        onConfirmFileDelete={(pendingDelete) => void confirmDeleteFiles(pendingDelete)}
        onConfirmNewItem={(pendingItem) => void confirmCreateNewItem(pendingItem)}
        onConfirmRenameItem={(pendingItem) => void confirmRenameItem(pendingItem)}
        onFocusFileEditor={focusFileEditor}
        onHideFileEditor={hideFileEditor}
        onMoveFileEditor={moveFileEditor}
        onResizeFileEditor={resizeFileEditor}
        onSaveCommandEditor={handleSaveCommandEditor}
        onSaveConnection={handleSaveConnection}
        onSaveFileEditor={(editorId) => void handleSaveEditedFile(editorId)}
        onToggleFileEditorWrap={toggleFileEditorWrap}
      />
    </div>
  );
}
