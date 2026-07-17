import { useEffect, useRef } from "react";
import type { FormEvent } from "react";
import type { FileEntry as BackendFileEntry } from "../features/connections/types";
import { Icon } from "./Icon";

export type PendingFileDelete = {
  side: "local" | "remote";
  entries: BackendFileEntry[];
};

export type PendingNewItem = {
  side: "local" | "remote";
  kind: "file" | "folder";
  name: string;
  error: string | null;
  saving: boolean;
};

export type PendingRenameItem = {
  side: "local" | "remote";
  entry: BackendFileEntry;
  name: string;
  error: string | null;
  saving: boolean;
};

export function FileDeleteConfirm({
  pendingDelete,
  deleting,
  onCancel,
  onConfirm,
}: {
  pendingDelete: PendingFileDelete;
  deleting: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  const { side, entries } = pendingDelete;
  const singleEntry = entries.length === 1 ? entries[0] : null;
  const title = entries.length === 1 ? `Delete ${singleEntry?.isDir ? "Folder" : "File"}` : "Delete Items";
  const itemWord = entries.length === 1 ? "item" : "items";
  const subtitle =
    side === "remote"
      ? `This removes the selected remote ${itemWord} from the active SSH session.`
      : `This removes the selected local ${itemWord} from disk.`;

  return (
    <div className="danger-overlay" role="presentation" onMouseDown={deleting ? undefined : onCancel}>
      <section
        className="danger-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-file-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="danger-head">
          <span className="danger-icon">
            <Icon name="trash" size={16} />
          </span>
          <div>
            <div className="danger-title" id="delete-file-title">{title}</div>
            <div className="danger-sub">{subtitle}</div>
          </div>
        </header>
        <div className="danger-body">
          <div className="danger-target">
            <span className="danger-target-name">
              {singleEntry ? singleEntry.name : `${entries.length} ${side} items`}
            </span>
            {singleEntry ? <span className="danger-target-detail">{singleEntry.path}</span> : null}
          </div>
          {singleEntry ? null : (
            <ul className="file-delete-list" aria-label="Selected items">
              {entries.map((entry) => (
                <li className="file-delete-item" key={`${entry.path}:${entry.name}`}>
                  {entry.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="danger-actions">
          <button className="btn" type="button" onClick={onCancel} disabled={deleting}>
            Cancel
          </button>
          <button className="btn danger" type="button" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function NewFileItemModal({
  pendingItem,
  basePath,
  onChangeName,
  onCancel,
  onConfirm,
}: {
  pendingItem: PendingNewItem;
  basePath: string;
  onChangeName(name: string): void;
  onCancel(): void;
  onConfirm(): void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const title = `New ${pendingItem.side} ${pendingItem.kind}`;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onConfirm();
  };

  return (
    <div className="tf-overlay" role="presentation" onMouseDown={pendingItem.saving ? undefined : onCancel}>
      <section
        className="modal-card new-item-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-file-item-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <span className="modal-head-icon">
            <Icon name={pendingItem.kind === "file" ? "file" : "files"} size={16} />
          </span>
          <div>
            <div className="modal-title" id="new-file-item-title">{title}</div>
            <div className="modal-sub">{basePath}</div>
          </div>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label className="field">
              <span>Name</span>
              <input
                ref={inputRef}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={pendingItem.name}
                onChange={(event) => onChangeName(event.target.value)}
                placeholder={pendingItem.kind === "file" ? "example.txt" : "new-folder"}
              />
            </label>
            {pendingItem.error ? <div className="modal-error">{pendingItem.error}</div> : null}
          </div>
          <footer className="modal-foot">
            <button className="btn" type="button" onClick={onCancel} disabled={pendingItem.saving}>
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={pendingItem.saving}>
              {pendingItem.saving ? "Creating..." : "Create"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function RenameFileItemModal({
  pendingItem,
  onChangeName,
  onCancel,
  onConfirm,
}: {
  pendingItem: PendingRenameItem;
  onChangeName(name: string): void;
  onCancel(): void;
  onConfirm(): void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const kind = pendingItem.entry.isDir ? "folder" : "file";
  const title = `Rename ${pendingItem.side} ${kind}`;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onConfirm();
  };

  return (
    <div className="tf-overlay" role="presentation" onMouseDown={pendingItem.saving ? undefined : onCancel}>
      <section
        className="modal-card new-item-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-file-item-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <span className="modal-head-icon">
            <Icon name={pendingItem.entry.isDir ? "files" : "file"} size={16} />
          </span>
          <div>
            <div className="modal-title" id="rename-file-item-title">{title}</div>
            <div className="modal-sub">{pendingItem.entry.path}</div>
          </div>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label className="field">
              <span>Name</span>
              <input
                ref={inputRef}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={pendingItem.name}
                onChange={(event) => onChangeName(event.target.value)}
              />
            </label>
            {pendingItem.error ? <div className="modal-error">{pendingItem.error}</div> : null}
          </div>
          <footer className="modal-foot">
            <button className="btn" type="button" onClick={onCancel} disabled={pendingItem.saving}>
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={pendingItem.saving}>
              {pendingItem.saving ? "Renaming..." : "Rename"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
