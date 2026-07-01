import type { Connection } from "../features/connections/types";
import { Icon } from "./Icon";

export function DeleteConnectionConfirm({
  connection,
  deleting,
  onCancel,
  onConfirm,
}: {
  connection: Connection;
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
        aria-labelledby="delete-connection-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="danger-head">
          <span className="danger-icon">
            <Icon name="trash" size={16} />
          </span>
          <div>
            <div className="danger-title" id="delete-connection-title">Delete Connection</div>
            <div className="danger-sub">This removes the saved host from your connection list.</div>
          </div>
        </header>
        <div className="danger-target">
          <span className="danger-target-name">{connection.name}</span>
          <span>{connection.username}@{connection.host}:{connection.port}</span>
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
