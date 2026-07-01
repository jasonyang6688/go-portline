import { useEffect, useState } from "react";
import type {
  FileEntry as BackendFileEntry,
  Session,
} from "../features/connections/types";
import { FilesPane } from "./FilesPane";
import { Icon } from "./Icon";

type FileSide = "local" | "remote";

type TransferRecord = {
  id: string;
  direction: "upload" | "download";
  name: string;
  detail: string;
  status: "running" | "done" | "failed";
  bytes?: number;
  completedAt?: string;
};

interface FilesViewProps {
  activeSession: Session | null;
  localFiles: BackendFileEntry[];
  remoteFiles: BackendFileEntry[];
  localPath: string;
  remotePath: string;
  transfers: TransferRecord[];
  onLocalUp(): void;
  onRemoteUp(): void;
  onLocalRefresh(): void;
  onRemoteRefresh(): void;
  onNewFile(side: FileSide): void;
  onNewFolder(side: FileSide): void;
  onUploadFolder(): void;
  onOpenFolder(side: FileSide, entry: BackendFileEntry): void;
  onOpenPath(side: FileSide, path: string): void;
  onTransfer(side: FileSide, entry: BackendFileEntry): void;
  onTransferMany(side: FileSide, entries: BackendFileEntry[]): void;
  onEdit(side: FileSide, entry: BackendFileEntry): void;
  onRename(side: FileSide, entry: BackendFileEntry): void;
  onDelete(side: FileSide, entry: BackendFileEntry): void;
  onDeleteMany(side: FileSide, entries: BackendFileEntry[]): void;
  onDismissTransfer(id: string): void;
  onClearFinishedTransfers(): void;
}

function formatBytes(value: number | undefined): string {
  if (!Number.isFinite(value ?? NaN)) {
    return "";
  }
  const size = Math.max(0, value ?? 0);
  if (size < 1024) {
    return `${size} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let current = size / 1024;
  for (const unit of units) {
    if (current < 1024) {
      return `${current.toFixed(1)} ${unit}`;
    }
    current /= 1024;
  }
  return `${current.toFixed(1)} PB`;
}

export function FilesView({
  activeSession,
  localFiles,
  remoteFiles,
  localPath,
  remotePath,
  transfers,
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
  onEdit,
  onRename,
  onDelete,
  onDeleteMany,
  onDismissTransfer,
  onClearFinishedTransfers,
}: FilesViewProps) {
  const [localSelection, setLocalSelection] = useState<string[]>(["frontend"]);
  const [remoteSelection, setRemoteSelection] = useState<string[]>(["nginx.conf"]);

  useEffect(() => {
    const availableNames = new Set(localFiles.map((file) => file.name));
    setLocalSelection((current) => {
      if (localFiles.length === 0) {
        return current.length === 0 ? current : [];
      }
      const nextSelection = current.filter((name) => availableNames.has(name));
      return nextSelection.length === current.length ? current : nextSelection;
    });
  }, [localFiles]);

  useEffect(() => {
    const availableNames = new Set(remoteFiles.map((file) => file.name));
    setRemoteSelection((current) => {
      if (remoteFiles.length === 0) {
        return current.length === 0 ? current : [];
      }
      const nextSelection = current.filter((name) => availableNames.has(name));
      return nextSelection.length === current.length ? current : nextSelection;
    });
  }, [remoteFiles]);

  const toggleLocalSelection = (name: string) => {
    setLocalSelection((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  };
  const toggleRemoteSelection = (name: string) => {
    setRemoteSelection((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  };

  return (
    <section className="view-stack">
      <div className="view-header">
        <Icon name="files" size={16} />
        <span className="view-header-title">File Manager</span>
        <span className="view-header-note">{activeSession?.name ?? "No session"} · hover rows for actions</span>
      </div>
      <div className="files-split">
        <FilesPane
          side="local"
          path={localPath}
          transferTargetPath={remotePath}
          rows={localFiles}
          selectedNames={localSelection}
          onSelectSingle={(name) => setLocalSelection([name])}
          onToggleSelection={toggleLocalSelection}
          onSelectAll={setLocalSelection}
          onUp={onLocalUp}
          onRefresh={onLocalRefresh}
          onNewFile={() => onNewFile("local")}
          onNewFolder={() => onNewFolder("local")}
          onUploadFolder={onUploadFolder}
          onOpenFolder={(entry) => onOpenFolder("local", entry)}
          onOpenPath={(path) => onOpenPath("local", path)}
          onTransfer={(entry) => onTransfer("local", entry)}
          onTransferMany={(entries) => onTransferMany("local", entries)}
          onEdit={(entry) => onEdit("local", entry)}
          onRename={(entry) => onRename("local", entry)}
          onDelete={(entry) => onDelete("local", entry)}
          onDeleteMany={(entries) => onDeleteMany("local", entries)}
        />
        <div className="pane-divider" />
        <FilesPane
          side="remote"
          path={remotePath}
          transferTargetPath={localPath}
          rows={remoteFiles}
          selectedNames={remoteSelection}
          onSelectSingle={(name) => setRemoteSelection([name])}
          onToggleSelection={toggleRemoteSelection}
          onSelectAll={setRemoteSelection}
          onUp={onRemoteUp}
          onRefresh={onRemoteRefresh}
          onNewFile={() => onNewFile("remote")}
          onNewFolder={() => onNewFolder("remote")}
          onUploadFolder={onUploadFolder}
          onOpenFolder={(entry) => onOpenFolder("remote", entry)}
          onOpenPath={(path) => onOpenPath("remote", path)}
          onTransfer={(entry) => onTransfer("remote", entry)}
          onTransferMany={(entries) => onTransferMany("remote", entries)}
          onEdit={(entry) => onEdit("remote", entry)}
          onRename={(entry) => onRename("remote", entry)}
          onDelete={(entry) => onDelete("remote", entry)}
          onDeleteMany={(entries) => onDeleteMany("remote", entries)}
        />
        {transfers.length > 0 ? (
          <div className="xfer-stack">
            <div className="xfer-history-head">
              <span>Transfer history</span>
              <button type="button" onClick={onClearFinishedTransfers}>Clear done</button>
            </div>
            {transfers.map((transfer) => (
              <div className={`xfer-card ${transfer.status}`} key={transfer.id}>
                <div className="xfer-top">
                  <span className="xfer-dir">
                    <Icon name={transfer.direction === "upload" ? "upload" : "download"} size={13} />
                  </span>
                  <span className="xfer-name">{transfer.name} · {transfer.detail}</span>
                  <span className="xfer-pct">{transfer.status === "running" ? "..." : transfer.status}</span>
                  <button className="xfer-close" type="button" title={`Hide ${transfer.name}`} onClick={() => onDismissTransfer(transfer.id)}>
                    <Icon name="close" size={11} />
                  </button>
                </div>
                <div className="xfer-bar">
                  <div className="xfer-bar-fill" style={{ width: transfer.status === "running" ? "48%" : "100%" }} />
                </div>
                {transfer.bytes !== undefined ? <div className="xfer-bytes">{formatBytes(transfer.bytes)}</div> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
