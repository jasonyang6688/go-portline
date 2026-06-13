import { type FormEvent, useEffect, useState } from "react";
import type { AuthType, Connection, SaveConnectionInput } from "./types";

interface Props {
  initialConnection?: Connection | null;
  onCancel(): void;
  onSave(input: SaveConnectionInput): Promise<void>;
}

export function ConnectionModal({ initialConnection, onCancel, onSave }: Props) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("");
  const [authType, setAuthType] = useState<AuthType>("password");
  const [password, setPassword] = useState("");
  const [keyPath, setKeyPath] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [savePassword, setSavePassword] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEditing = Boolean(initialConnection);

  useEffect(() => {
    if (!initialConnection) {
      setName("");
      setHost("");
      setPort(22);
      setUsername("root");
      setAuthType("password");
      setPassword("");
      setKeyPath("");
      setPassphrase("");
      setSavePassword(true);
      setError("");
      return;
    }

    setName(initialConnection.name);
    setHost(initialConnection.host);
    setPort(initialConnection.port);
    setUsername(initialConnection.username);
    setAuthType(initialConnection.authType);
    setPassword("");
    setKeyPath(initialConnection.keyPath);
    setPassphrase("");
    setSavePassword(true);
    setError("");
  }, [initialConnection]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !host.trim()) {
      return;
    }
    setSaving(true);
    setError("");

    try {
      await onSave({
        id: initialConnection?.id,
        name: name.trim(),
        host: host.trim(),
        port,
        username: username.trim() || "root",
        authType,
        keyPath: authType === "key" ? keyPath.trim() : "",
        group: initialConnection?.group ?? "SSH Servers",
        tags: initialConnection?.tags ?? [],
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tf-overlay" role="presentation">
      <form className="modal-card" onSubmit={handleSubmit} aria-labelledby="new-connection-title">
        <header className="modal-head">
          <div className="modal-head-icon">+</div>
          <div>
            <div className="modal-title" id="new-connection-title">
              {isEditing ? "Edit Connection" : "New Connection"}
            </div>
            <div className="modal-sub">
              {isEditing ? "Update this host in your address book" : "Add a host to your address book and open it"}
            </div>
          </div>
          <button
            className="tf-icon-btn"
            type="button"
            onClick={onCancel}
            aria-label="Close connection modal"
            title="Close connection modal"
          >
            ×
          </button>
        </header>

        <div className="modal-body">
          {error ? <div className="tf-error">{error}</div> : null}

          <label className="field">
            <span className="field-label">Name / Label</span>
            <input
              className="field-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="prod-db-01"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Host</span>
            <input
              className="field-input"
              value={host}
              onChange={(event) => setHost(event.target.value)}
              placeholder="10.0.1.120 or db.example.com"
              required
            />
          </label>

          <div className="field-row">
            <label className="field field-grow-2">
              <span className="field-label">User</span>
              <input className="field-input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="root" required />
            </label>

            <label className="field">
              <span className="field-label">Port</span>
              <input
                className="field-input"
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(event) => setPort(Number(event.target.value))}
                placeholder="22"
                required
              />
            </label>
          </div>

          <div className="field">
            <span className="field-label">Authentication</span>
            <div className="seg-control">
              {[
                ["password", "Password"],
                ["key", "SSH Key"],
                ["agent", "Agent"],
              ].map(([value, label]) => (
                <button
                  className={`seg-opt${authType === value ? " on" : ""}`}
                  key={value}
                  type="button"
                  onClick={() => setAuthType(value as AuthType)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {authType === "password" ? (
            <div className="field">
              <span className="field-label">Password</span>
              <input
                className="field-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isEditing ? "•••••••• (unchanged)" : "Account password"}
                autoComplete="current-password"
              />
              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={savePassword}
                  onChange={(event) => setSavePassword(event.target.checked)}
                />
                Save password to keychain
              </label>
            </div>
          ) : null}

          {authType === "key" ? (
            <>
              <label className="field">
                <span className="field-label">Private key file</span>
                <input
                  className="field-input"
                  value={keyPath}
                  onChange={(event) => setKeyPath(event.target.value)}
                  placeholder="~/.ssh/id_ed25519"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">
                  Passphrase <span className="field-label-soft">(optional)</span>
                </span>
                <input
                  className="field-input"
                  type="password"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                  placeholder="Leave blank if the key has none"
                />
              </label>
            </>
          ) : null}

          {authType === "agent" ? (
            <div className="auth-note">
              <span className="auth-note-icon">⌘</span>
              <span>
                Authentication is delegated to your running SSH agent — identities loaded with <code>ssh-add</code> will be offered automatically. No secret is stored by TermFlow.
              </span>
            </div>
          ) : null}
        </div>

        <footer className="modal-foot">
          <button className="btn" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" type="submit" disabled={saving || !name.trim() || !host.trim()}>
            {saving ? "Saving..." : isEditing ? "Save changes" : "Save & Connect"}
          </button>
        </footer>
      </form>
    </div>
  );
}
