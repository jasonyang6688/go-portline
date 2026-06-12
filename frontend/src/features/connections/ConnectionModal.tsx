import { type FormEvent, useState } from "react";
import type { AuthType, SaveConnectionInput } from "./types";

interface Props {
  onCancel(): void;
  onSave(input: SaveConnectionInput): Promise<void>;
}

export function ConnectionModal({ onCancel, onSave }: Props) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("");
  const [authType, setAuthType] = useState<AuthType>("password");
  const [keyPath, setKeyPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await onSave({
        name: name.trim(),
        host: host.trim(),
        port,
        username: username.trim(),
        authType,
        keyPath: authType === "key" ? keyPath.trim() : "",
        group: "",
        tags: [],
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tf-modal-backdrop" role="presentation">
      <form className="tf-modal" onSubmit={handleSubmit} aria-labelledby="new-connection-title">
        <header>
          <div>
            <strong id="new-connection-title">New SSH connection</strong>
            <p className="tf-muted">Passwords are entered when a session is opened.</p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onCancel}
            aria-label="Close connection modal"
            title="Close connection modal"
          >
            ×
          </button>
        </header>

        {error ? <div className="tf-error">{error}</div> : null}

        <label className="tf-field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>

        <label className="tf-field">
          <span>Host</span>
          <input value={host} onChange={(event) => setHost(event.target.value)} required />
        </label>

        <div className="tf-field-grid">
          <label className="tf-field">
            <span>Port</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(event) => setPort(Number(event.target.value))}
              required
            />
          </label>

          <label className="tf-field">
            <span>Username</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} required />
          </label>
        </div>

        <label className="tf-field">
          <span>Authentication</span>
          <select
            value={authType}
            onChange={(event) => setAuthType(event.target.value as AuthType)}
          >
            <option value="password">Password</option>
            <option value="key">Private key</option>
          </select>
        </label>

        {authType === "key" ? (
          <label className="tf-field">
            <span>Private key path</span>
            <input
              value={keyPath}
              onChange={(event) => setKeyPath(event.target.value)}
              placeholder="~/.ssh/id_ed25519"
              required
            />
          </label>
        ) : null}

        <footer>
          <button className="secondary-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save connection"}
          </button>
        </footer>
      </form>
    </div>
  );
}
