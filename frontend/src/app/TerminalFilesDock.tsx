import { useEffect, useMemo, useRef, useState } from "react";
import type {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { FileEntry as BackendFileEntry } from "../features/connections/types";
import { Icon } from "./Icon";

type TransferRecord = {
  id: string;
  direction: "upload" | "download";
  name: string;
  detail: string;
  status: "running" | "done" | "failed";
  bytes?: number;
  completedAt?: string;
};

type ContextMenuPoint = {
  x: number;
  y: number;
};

interface TerminalFilesDockProps {
  files: BackendFileEntry[];
  path: string;
  hasSession: boolean;
  transfers: TransferRecord[];
  onRunCommand(command: string): void;
  onOpenFolder(entry: BackendFileEntry): void;
  onOpenPath(path: string): void;
  onRefresh(): void;
  onSync(): void;
  onUpload(): void;
  onUploadFolder(): void;
  onNewFile(): void;
  onNewFolder(): void;
  onTransfer(entry: BackendFileEntry): void;
  onEdit(entry: BackendFileEntry): void;
  onRename(entry: BackendFileEntry): void;
  onDelete(entry: BackendFileEntry): void;
  onDeleteMany(entries: BackendFileEntry[]): void;
  onDismissTransfer(id: string): void;
  onClearFinishedTransfers(): void;
  onClose(): void;
}

function shellQuote(value: string): string {
  return `'${value.split("'").join("'\\''")}'`;
}

function parentPath(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  const index = trimmed.lastIndexOf("/");
  if (index <= 0) {
    return "/";
  }
  return trimmed.slice(0, index);
}

function pathSegments(path: string): Array<{ label: string; path: string }> {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) {
    return [{ label: "/", path: "/" }];
  }
  return parts.map((part, index) => ({
    label: `${index === 0 ? "/" : "›"} ${part}`,
    path: `/${parts.slice(0, index + 1).join("/")}`,
  }));
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

function contextMenuPoint(event: ReactMouseEvent): ContextMenuPoint {
  return {
    x: Math.min(event.clientX, window.innerWidth - 220),
    y: Math.min(event.clientY, window.innerHeight - 300),
  };
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

export function TerminalFilesDock({
  files,
  path,
  hasSession,
  transfers,
  onRunCommand,
  onOpenFolder,
  onOpenPath,
  onRefresh,
  onSync,
  onUpload,
  onUploadFolder,
  onNewFile,
  onNewFolder,
  onTransfer,
  onEdit,
  onRename,
  onDelete,
  onDeleteMany,
  onDismissTransfer,
  onClearFinishedTransfers,
  onClose,
}: TerminalFilesDockProps) {
  const dockRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ point: ContextMenuPoint; entry: BackendFileEntry | null } | null>(null);
  const [selectionActive, setSelectionActive] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const selectedEntries = files.filter((file) => selectedSet.has(file.path));

  const openEntry = (entry: BackendFileEntry) => {
    if (entry.isDir) {
      onOpenFolder(entry);
      return;
    }
    onEdit(entry);
  };
  const [pathDraft, setPathDraft] = useState(path);

  useEffect(() => {
    setPathDraft(path);
  }, [path]);

  useEffect(() => {
    const availablePaths = new Set(files.map((file) => file.path));
    setSelectedPaths((current) => {
      const nextSelection = current.filter((filePath) => availablePaths.has(filePath));
      return nextSelection.length === current.length ? current : nextSelection;
    });
  }, [files]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (!selectionActive || isEditableEventTarget(event.target) || !dockRef.current?.contains(document.activeElement)) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelectedPaths(files.map((file) => file.path));
      }
    };
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [files, selectionActive]);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const closeMenu = () => setMenu(null);
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeMenuOnEscape);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeMenuOnEscape);
      window.removeEventListener("resize", closeMenu);
    };
  }, [menu]);

  const handlePathSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPath = pathDraft.trim();
    if (!nextPath) {
      setPathDraft(path);
      return;
    }
    onOpenPath(nextPath);
  };

  const handleEntryKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, entry: BackendFileEntry) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    openEntry(entry);
  };

  const toggleSelection = (entry: BackendFileEntry) => {
    setSelectedPaths((current) =>
      current.includes(entry.path) ? current.filter((filePath) => filePath !== entry.path) : [...current, entry.path],
    );
  };

  const handleEntryClick = (event: ReactMouseEvent<HTMLDivElement>, entry: BackendFileEntry) => {
    setSelectionActive(true);
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      toggleSelection(entry);
      return;
    }
    setSelectedPaths([entry.path]);
    openEntry(entry);
  };

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setSelectedPaths(files.map((file) => file.path));
    }
  };

  const activateSelection = (event: ReactMouseEvent | ReactPointerEvent) => {
    setSelectionActive(true);
    if (isEditableEventTarget(event.target)) {
      return;
    }
    listRef.current?.focus();
  };

  const openMenu = (event: ReactMouseEvent, entry: BackendFileEntry | null) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectionActive(true);
    if (event.ctrlKey && entry) {
      toggleSelection(entry);
      setMenu(null);
      return;
    }
    if (entry && !selectedSet.has(entry.path)) {
      setSelectedPaths([entry.path]);
    }
    setMenu({ point: contextMenuPoint(event), entry });
  };

  const menuEntries = menu?.entry && selectedSet.has(menu.entry.path)
    ? selectedEntries
    : menu?.entry
      ? [menu.entry]
      : selectedEntries;
  const menuTarget = menuEntries[0] ?? menu?.entry ?? null;

  return (
    <aside
      className="term-files"
      aria-label="Files panel"
      ref={dockRef}
      onPointerDownCapture={activateSelection}
      onFocusCapture={() => setSelectionActive(true)}
      onContextMenu={(event) => openMenu(event, null)}
    >
      <div className="tf-head">
        <span className="tf-head-title"><Icon name="files" size={13} />Files</span>
        <span className="tf-head-spacer" />
        <button className="tf-sync" type="button" title="Sync with terminal path" onClick={onSync}><Icon name="link" size={12} />Sync</button>
        <button className="tf-icon-btn" type="button" title="Refresh" onClick={onRefresh}><Icon name="refresh" size={13} /></button>
        <button className="tf-icon-btn" type="button" title="Go up" onClick={() => onOpenPath(parentPath(path))}>↑</button>
        <button className="tf-icon-btn" type="button" title="Upload local file" onClick={onUpload}><Icon name="upload" size={13} /></button>
        <button className="tf-icon-btn" type="button" title="Upload local folder" onClick={onUploadFolder}><Icon name="files" size={13} /></button>
        <button className="tf-icon-btn" type="button" title="Close panel" onClick={onClose}><Icon name="close" size={13} /></button>
      </div>
      <form className="tf-path-edit" onSubmit={handlePathSubmit}>
        <input
          aria-label="Remote path"
          name="terminal-remote-path"
          value={pathDraft}
          onChange={(event) => setPathDraft(event.target.value)}
        />
        <button className="tf-go" type="submit">Go</button>
      </form>
      <div className="tf-path">
        {pathSegments(path).map((segment) => (
          <button className="tf-path-seg" type="button" key={segment.path} onClick={() => onOpenPath(segment.path)}>
            {segment.label}
          </button>
        ))}
      </div>
      <div
        className="tf-list"
        ref={listRef}
        tabIndex={0}
        onKeyDown={handleListKeyDown}
        onContextMenu={(event) => openMenu(event, null)}
      >
        {files.length === 0 ? (
          <div className="tf-empty">
            {hasSession ? "No files found at this path." : "Open an SSH session to browse remote files."}
          </div>
        ) : null}
        {files.map((file) => (
          <div
            aria-label={`${file.isDir ? "Open folder" : "Edit file"} ${file.name}`}
            className={`tf-row${selectedSet.has(file.path) ? " selected" : ""}${file.isDir ? " dir" : ""}`}
            key={file.path}
            onClick={(event) => handleEntryClick(event, file)}
            onContextMenu={(event) => openMenu(event, file)}
            onKeyDown={(event) => handleEntryKeyDown(event, file)}
            role="button"
            tabIndex={0}
            title={file.isDir ? `Open ${file.path}` : `Edit ${file.path}`}
          >
            <span className="tf-row-icon">{file.isDir ? "🗂" : "📄"}</span>
            <span className="tf-row-name">{file.name}</span>
            <span className="tf-row-size">{file.sizeLabel}</span>
            <span className="tf-actions">
              {file.isDir ? (
                <button className="tf-act" type="button" title="Open folder" onClick={(event) => {
                  event.stopPropagation();
                  onOpenFolder(file);
                }}>
                  <Icon name="files" size={11} />
                </button>
              ) : (
                <button className="tf-act" type="button" title="Edit" onClick={(event) => {
                  event.stopPropagation();
                  onEdit(file);
                }}>
                  <Icon name="edit" size={11} />
                </button>
              )}
              {file.isDir ? (
                <button className="tf-act" type="button" title="cd here" onClick={(event) => {
                  event.stopPropagation();
                  onRunCommand(`cd ${shellQuote(file.path)}`);
                }}>
                  <Icon name="terminal" size={11} />
                </button>
              ) : null}
              <button className="tf-act" type="button" title="Rename" onClick={(event) => {
                event.stopPropagation();
                onRename(file);
              }}>
                <Icon name="file" size={11} />
              </button>
              <button className="tf-act" type="button" title="Download" onClick={(event) => {
                event.stopPropagation();
                onTransfer(file);
              }}>
                <Icon name="download" size={11} />
              </button>
            </span>
          </div>
        ))}
      </div>
      {menu ? (
        <div
          className="file-context-menu"
          role="menu"
          style={{ left: menu.point.x, top: menu.point.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button type="button" role="menuitem" onClick={() => {
            setMenu(null);
            onNewFile();
          }}><Icon name="file" size={13} />New file</button>
          <button type="button" role="menuitem" onClick={() => {
            setMenu(null);
            onNewFolder();
          }}><Icon name="files" size={13} />New folder</button>
          <div className="file-context-sep" />
          <button type="button" role="menuitem" onClick={() => {
            setMenu(null);
            onUpload();
          }}><Icon name="upload" size={13} />Upload file</button>
          <button type="button" role="menuitem" onClick={() => {
            setMenu(null);
            onUploadFolder();
          }}><Icon name="files" size={13} />Upload folder</button>
          {menuTarget ? (
            <>
              <div className="file-context-sep" />
              <button type="button" role="menuitem" onClick={() => {
                setMenu(null);
                openEntry(menuTarget);
              }}><Icon name={menuTarget.isDir ? "files" : "edit"} size={13} />{menuTarget.isDir ? "Open" : "Edit"}</button>
              {menuTarget.isDir ? (
                <button type="button" role="menuitem" onClick={() => {
                  setMenu(null);
                  onRunCommand(`cd ${shellQuote(menuTarget.path)}`);
                }}><Icon name="terminal" size={13} />cd here</button>
              ) : null}
              <button type="button" role="menuitem" onClick={() => {
                setMenu(null);
                onRename(menuTarget);
              }}><Icon name="file" size={13} />Rename</button>
              <button type="button" role="menuitem" onClick={() => {
                setMenu(null);
                onTransfer(menuTarget);
              }}><Icon name="download" size={13} />Download</button>
              <button className="danger" type="button" role="menuitem" onClick={() => {
                setMenu(null);
                if (menuEntries.length > 1) {
                  onDeleteMany(menuEntries);
                  return;
                }
                onDelete(menuTarget);
              }}><Icon name="trash" size={13} />Delete{menuEntries.length > 1 ? ` ${menuEntries.length} items` : ""}</button>
            </>
          ) : null}
        </div>
      ) : null}
      {transfers.length > 0 ? (
        <div className="tf-xfer-stack" aria-label="File transfer progress">
          <div className="tf-xfer-head">
            <span>Transfer history</span>
            <button className="tf-xfer-clear" type="button" onClick={onClearFinishedTransfers}>Clear done</button>
          </div>
          {transfers.map((transfer) => (
            <div className={`tf-xfer-card ${transfer.status}`} key={transfer.id}>
              <div className="tf-xfer-top">
                <span className="tf-xfer-dir">
                  <Icon name={transfer.direction === "upload" ? "upload" : "download"} size={12} />
                </span>
                <span className="tf-xfer-name">{transfer.name}</span>
                <span className="tf-xfer-status">{transfer.status === "running" ? "uploading" : transfer.status}</span>
                <button className="tf-xfer-close" type="button" title={`Hide ${transfer.name}`} onClick={() => onDismissTransfer(transfer.id)}>
                  <Icon name="close" size={10} />
                </button>
              </div>
              <div className="tf-xfer-bar">
                <div className="tf-xfer-fill" style={{ width: transfer.status === "running" ? "48%" : "100%" }} />
              </div>
              <div className="tf-xfer-detail">
                <span>{transfer.detail}</span>
                {transfer.bytes !== undefined ? <b>{formatBytes(transfer.bytes)}</b> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="tf-foot">
        <span>{selectedPaths.length > 0 ? `${selectedPaths.length}/${files.length} selected` : `${files.length} items`}</span>
        <button className="tf-foot-up" type="button" onClick={onUpload}><Icon name="upload" size={11} />Upload</button>
        <button className="tf-foot-up" type="button" onClick={onUploadFolder}><Icon name="files" size={11} />Folder</button>
      </div>
    </aside>
  );
}
