import { useEffect, useMemo, useRef, useState } from "react";
import type {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { FileEntry as BackendFileEntry } from "../features/connections/types";
import { Icon } from "./Icon";

type FilePaneSide = "local" | "remote";

type ContextMenuPoint = {
  x: number;
  y: number;
};

interface FilesPaneProps {
  side: FilePaneSide;
  isLoading: boolean;
  path: string;
  transferTargetPath: string;
  rows: BackendFileEntry[];
  selectedNames: string[];
  onSelectSingle(name: string): void;
  onToggleSelection(name: string): void;
  onSelectAll(names: string[]): void;
  onUp(): void;
  onRefresh(): void;
  onNewFile(): void;
  onNewFolder(): void;
  onUploadFolder(): void;
  onOpenFolder(entry: BackendFileEntry): void;
  onOpenPath(path: string): void;
  onTransfer(entry: BackendFileEntry): void;
  onTransferMany(entries: BackendFileEntry[]): void;
  onEdit(entry: BackendFileEntry): void;
  onRename(entry: BackendFileEntry): void;
  onDelete(entry: BackendFileEntry): void;
  onDeleteMany(entries: BackendFileEntry[]): void;
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

function formatFileDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("zh-CN", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatOwnerGroup(entry: BackendFileEntry): string {
  if (!entry.owner && !entry.group) {
    return "";
  }
  return `${entry.owner || "-"}:${entry.group || "-"}`;
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

function fileGlyph(entry: BackendFileEntry): string {
  if (entry.isDir) return "📁";
  if (entry.name.endsWith(".go")) return "🔷";
  if (entry.name.endsWith(".md")) return "📝";
  if (entry.name.endsWith(".env")) return "🔑";
  if (entry.name.endsWith(".sh")) return "⚙";
  return "📄";
}

export function FilesPane({
  side,
  isLoading,
  path,
  transferTargetPath,
  rows,
  selectedNames,
  onSelectSingle,
  onToggleSelection,
  onSelectAll,
  onUp,
  onRefresh,
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
}: FilesPaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const transferLabel = side === "local" ? "Upload" : "Download";
  const loadingLabel = side === "local" ? "Loading local files..." : "Loading remote files...";
  const selectedSet = useMemo(() => new Set(selectedNames), [selectedNames]);
  const selectedEntries = rows.filter((row) => selectedSet.has(row.name));
  const selectedEntry = selectedEntries[0] ?? rows[0] ?? null;
  const activeTransferEntries = selectedEntries.length > 0 ? selectedEntries : selectedEntry ? [selectedEntry] : [];
  const [pathDraft, setPathDraft] = useState(path);
  const [menu, setMenu] = useState<{ point: ContextMenuPoint; entry: BackendFileEntry | null } | null>(null);
  const [selectionActive, setSelectionActive] = useState(false);

  useEffect(() => {
    setPathDraft(path);
  }, [path]);

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

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (!selectionActive || isEditableEventTarget(event.target) || !paneRef.current?.contains(document.activeElement)) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        onSelectAll(rows.map((row) => row.name));
      }
    };
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [onSelectAll, rows, selectionActive]);

  const handlePathSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPath = pathDraft.trim();
    if (!nextPath) {
      setPathDraft(path);
      return;
    }
    onOpenPath(nextPath);
  };

  const openOrSelect = (entry: BackendFileEntry) => {
    if (entry.isDir) {
      onOpenFolder(entry);
      return;
    }
    onSelectSingle(entry.name);
  };

  const handleRowKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, entry: BackendFileEntry) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    openOrSelect(entry);
  };

  const handleRowClick = (event: ReactMouseEvent<HTMLDivElement>, entry: BackendFileEntry) => {
    setSelectionActive(true);
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      onToggleSelection(entry.name);
      return;
    }
    openOrSelect(entry);
  };

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      onSelectAll(rows.map((row) => row.name));
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
      onToggleSelection(entry.name);
      setMenu(null);
      return;
    }
    if (entry && !selectedSet.has(entry.name)) {
      onSelectSingle(entry.name);
    }
    setMenu({ point: contextMenuPoint(event), entry });
  };

  const menuEntries = menu?.entry && selectedSet.has(menu.entry.name)
    ? selectedEntries
    : menu?.entry
      ? [menu.entry]
      : selectedEntries;
  const menuTarget = menuEntries[0] ?? menu?.entry ?? null;

  return (
    <div
      aria-busy={isLoading}
      className={`files-pane${isLoading ? " is-loading" : ""}`}
      ref={paneRef}
      onPointerDownCapture={activateSelection}
      onFocusCapture={() => setSelectionActive(true)}
      onContextMenu={(event) => openMenu(event, null)}
    >
      <div className="files-pane-header">
        <span className={`fp-badge ${side}`}>{side}</span>
        <form className="fp-path-form" onSubmit={handlePathSubmit}>
          <input
            aria-label={`${side} path`}
            className="fp-path-input"
            disabled={isLoading}
            value={pathDraft}
            onChange={(event) => setPathDraft(event.target.value)}
          />
          <button className="fp-btn" type="submit" disabled={isLoading}>Go</button>
        </form>
        <div className="fp-actions">
          <button className="fp-btn" type="button" title="Go up" onClick={onUp} disabled={isLoading}>↑</button>
          {side === "local" ? (
            <button className="fp-btn" type="button" title="Upload local folder" onClick={onUploadFolder} disabled={isLoading}><Icon name="files" size={13} /></button>
          ) : null}
          <button className="fp-btn" type="button" title="Refresh" onClick={onRefresh} disabled={isLoading}><Icon name="refresh" size={12} /></button>
          <button
            className="fp-btn"
            type="button"
            title={activeTransferEntries.length > 1 ? `${transferLabel} selected` : selectedEntry?.isDir ? transferLabel : transferLabel}
            disabled={isLoading || activeTransferEntries.length === 0}
            onClick={() => {
              if (activeTransferEntries.length === 0) {
                return;
              }
              onTransferMany(activeTransferEntries);
            }}
          >
            <Icon name={side === "local" ? "upload" : "download"} size={12} />
          </button>
        </div>
      </div>
      <div className="files-toolbar">
        <span className="files-toolbar-label">Path:</span>
        {pathSegments(path).map((segment) => (
          <button className="files-crumb" type="button" key={`${side}-${segment.path}`} onClick={() => onOpenPath(segment.path)} disabled={isLoading}>
            {segment.label}
          </button>
        ))}
      </div>
      <div
        className="files-list"
        ref={listRef}
        tabIndex={0}
        onKeyDown={handleListKeyDown}
        onContextMenu={(event) => openMenu(event, null)}
      >
        {isLoading ? (
          <div className="files-loading" role="status" aria-live="polite">
            <span className="files-spinner" aria-hidden="true" />
            <span>{loadingLabel}</span>
          </div>
        ) : null}
        {rows.map((row) => (
          <div
            className={`f-item${selectedSet.has(row.name) ? " selected" : ""}`}
            key={`${side}-${row.path}`}
            onClick={(event) => handleRowClick(event, row)}
            onContextMenu={(event) => openMenu(event, row)}
            onDoubleClick={() => row.isDir && onOpenFolder(row)}
            onKeyDown={(event) => handleRowKeyDown(event, row)}
            role="button"
            tabIndex={0}
          >
            <label className="f-check" onClick={(event) => event.stopPropagation()} title={`Select ${row.name}`}>
              <input
                aria-label={`Select ${row.name}`}
                checked={selectedSet.has(row.name)}
                type="checkbox"
                onChange={() => onToggleSelection(row.name)}
              />
            </label>
            <span className="f-item-icon">{fileGlyph(row)}</span>
            <span className="f-item-name">{row.name}</span>
            <span className="f-item-meta">
              <span className="f-item-size">{row.sizeLabel}</span>
              <span className="f-item-date">{formatFileDate(row.modTime)}</span>
              <span className="f-item-owner">{formatOwnerGroup(row)}</span>
            </span>
            <span className="f-row-actions">
              <button className="f-act go" type="button" title={row.isDir ? "Open folder" : transferLabel} onClick={(event) => {
                event.stopPropagation();
                if (row.isDir) {
                  onOpenFolder(row);
                  return;
                }
                onTransfer(row);
              }}>
                <Icon name={row.isDir ? "files" : side === "local" ? "upload" : "download"} size={13} />
              </button>
              {!row.isDir ? (
                <button className="f-act" type="button" title="Edit" onClick={(event) => {
                  event.stopPropagation();
                  onEdit(row);
                }}>
                  <Icon name="edit" size={13} />
                </button>
              ) : null}
              <button className="f-act" type="button" title="Rename" onClick={(event) => {
                event.stopPropagation();
                onRename(row);
              }}>
                <Icon name="file" size={13} />
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
          {side === "local" ? (
            <button type="button" role="menuitem" onClick={() => {
              setMenu(null);
              onUploadFolder();
            }}><Icon name="files" size={13} />Upload folder</button>
          ) : null}
          {menuTarget ? (
            <>
              <div className="file-context-sep" />
              <button type="button" role="menuitem" onClick={() => {
                setMenu(null);
                if (menuTarget.isDir) {
                  onOpenFolder(menuTarget);
                  return;
                }
                onEdit(menuTarget);
              }}><Icon name={menuTarget.isDir ? "files" : "edit"} size={13} />{menuTarget.isDir ? "Open" : "Edit"}</button>
              <button type="button" role="menuitem" onClick={() => {
                setMenu(null);
                onRename(menuTarget);
              }}><Icon name="file" size={13} />Rename</button>
              <button type="button" role="menuitem" onClick={() => {
                setMenu(null);
                if (menuEntries.length > 1) {
                  onTransferMany(menuEntries);
                  return;
                }
                onTransfer(menuTarget);
              }}><Icon name={side === "local" ? "upload" : "download"} size={13} />{menuEntries.length > 1 ? `${transferLabel} ${menuEntries.length} items` : transferLabel}</button>
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
      <div className="files-status">
        <span>{rows.length} items</span>
        {selectedNames.length > 0 ? <span>Selected: <strong>{selectedNames.length}</strong></span> : null}
        <span className="fs-spacer" />
        <span className={`fs-dest ${side}`}>
          <Icon name={side === "local" ? "upload" : "download"} size={11} />
          {transferLabel} → <b>{side === "local" ? `REMOTE ${transferTargetPath}` : `LOCAL ${transferTargetPath}`}</b>
        </span>
      </div>
    </div>
  );
}
