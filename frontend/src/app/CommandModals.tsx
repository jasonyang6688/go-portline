import { useState } from "react";
import type { FormEvent } from "react";
import type { Connection, SavedCommand, SaveSavedCommandInput } from "../features/connections/types";
import { Icon } from "./Icon";
import {
  commandConnectionId,
  commandScopeTags,
  connectionIdFromScopeKey,
  type CommandScopeKey,
  type CommandScopeType,
} from "./terminalSmartBarCommands";

export type CommandEditorRequest = {
  command: SavedCommand | null;
  scopeKey: CommandScopeKey;
};

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function CommandEditorModal({
  request,
  connections,
  onCancel,
  onSave,
}: {
  request: CommandEditorRequest;
  connections: Connection[];
  onCancel(): void;
  onSave(input: SaveSavedCommandInput): Promise<void>;
}) {
  const editingCommand = request.command;
  const initialConnectionId = editingCommand ? commandConnectionId(editingCommand) : connectionIdFromScopeKey(request.scopeKey);
  const [name, setName] = useState(editingCommand?.name ?? "");
  const [command, setCommand] = useState(editingCommand?.command ?? "");
  const [description, setDescription] = useState(editingCommand?.description ?? "");
  const [scopeType, setScopeType] = useState<CommandScopeType>(initialConnectionId ? "connection" : "global");
  const [connectionId, setConnectionId] = useState(initialConnectionId ?? connections[0]?.id ?? "");
  const [danger, setDanger] = useState(editingCommand?.tags.includes("danger") ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEditing = editingCommand !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !command.trim()) {
      setError("Name and command are required.");
      return;
    }
    if (scopeType === "connection" && !connectionId) {
      setError("Choose a connection for this command.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        id: editingCommand?.id,
        name: name.trim(),
        command: command.trim(),
        description: description.trim(),
        tags: commandScopeTags(editingCommand?.tags ?? [], scopeType, connectionId, danger),
      });
    } catch (saveError) {
      setError(messageFromError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tf-overlay" role="presentation" onMouseDown={saving ? undefined : onCancel}>
      <form className="modal-card command-modal-card" onSubmit={handleSubmit} aria-labelledby="command-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <div className="modal-head-icon"><Icon name="commands" size={14} /></div>
          <div>
            <div className="modal-title" id="command-modal-title">{isEditing ? "Edit Command" : "New Command"}</div>
            <div className="modal-sub">Choose whether this command is global or tied to one connection</div>
          </div>
          <button className="tf-icon-btn" type="button" onClick={onCancel} aria-label="Close command modal" title="Close command modal">
            <Icon name="close" size={12} />
          </button>
        </header>

        <div className="modal-body">
          {error ? <div className="modal-error">{error}</div> : null}
          <label className="field">
            <span className="field-label">Name</span>
            <input className="field-input" name="command-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Restart nginx" autoFocus required />
          </label>
          <label className="field">
            <span className="field-label">Command</span>
            <textarea className="field-input command-textarea" name="command-body" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="systemctl restart nginx" required />
          </label>
          <label className="field">
            <span className="field-label">Description</span>
            <input className="field-input" name="command-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short note shown in the command library" />
          </label>
          <div className="field">
            <span className="field-label">Scope</span>
            <div className="seg-control">
              <button className={`seg-opt${scopeType === "global" ? " on" : ""}`} type="button" onClick={() => setScopeType("global")}>Global</button>
              <button className={`seg-opt${scopeType === "connection" ? " on" : ""}`} type="button" onClick={() => setScopeType("connection")}>Connection</button>
            </div>
          </div>
          {scopeType === "connection" ? (
            <label className="field">
              <span className="field-label">Connection</span>
              <select className="field-input" name="command-connection" value={connectionId} onChange={(event) => setConnectionId(event.target.value)} required>
                {connections.map((connection) => (
                  <option value={connection.id} key={connection.id}>{connection.name} · {connection.username}@{connection.host}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="auth-check">
            <input type="checkbox" checked={danger} onChange={(event) => setDanger(event.target.checked)} />
            Mark as destructive
          </label>
        </div>

        <footer className="modal-foot">
          <button className="btn" type="button" onClick={onCancel}>Cancel</button>
          <button className="btn primary" type="submit" disabled={saving || !name.trim() || !command.trim()}>
            {saving ? "Saving..." : isEditing ? "Save changes" : "Save command"}
          </button>
        </footer>
      </form>
    </div>
  );
}

export function CommandDeleteConfirm({
  command,
  deleting,
  onCancel,
  onConfirm,
}: {
  command: SavedCommand;
  deleting: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <div className="danger-overlay" role="presentation" onMouseDown={deleting ? undefined : onCancel}>
      <section
        className="danger-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-command-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="danger-head">
          <span className="danger-icon">
            <Icon name="trash" size={16} />
          </span>
          <div>
            <div className="danger-title" id="delete-command-title">Delete Command</div>
            <div className="danger-sub">This removes the saved shortcut from the command library.</div>
          </div>
        </header>
        <div className="danger-target">
          <span className="danger-target-name">{command.name}</span>
          <span>{command.command}</span>
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
