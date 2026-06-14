import { type FormEvent, useEffect, useState } from "react";
import type { AuthType, Connection, SaveConnectionInput } from "./types";

interface Props {
  initialConnection?: Connection | null;
  onCancel(): void;
  onSave(input: SaveConnectionInput): Promise<void>;
}

function EyeIcon({ visible }: { visible: boolean }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (visible) {
    return (
      <svg {...common}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.5 5.5A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17.8 17.8 0 0 1-2.1 3.1" />
      <path d="M6.6 6.6C3.6 8.5 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.8-1.3" />
    </svg>
  );
}

export function ConnectionModal({ initialConnection, onCancel, onSave }: Props) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("");
  const [authType, setAuthType] = useState<AuthType>("password");
  const [password, setPassword] = useState("");
  const [keyPath, setKeyPath] = useState("");
  const [insecureIgnoreHostKey, setInsecureIgnoreHostKey] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [savePassword, setSavePassword] = useState(true);
  const [passwordVisible, setPasswordVisible] = useState(false);
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
      setInsecureIgnoreHostKey(false);
      setPassphrase("");
      setSavePassword(true);
      setPasswordVisible(false);
      setError("");
      return;
    }

    setName(initialConnection.name);
    setHost(initialConnection.host);
    setPort(initialConnection.port);
    setUsername(initialConnection.username);
    setAuthType(initialConnection.authType);
    setPassword(initialConnection.password);
    setKeyPath(initialConnection.keyPath);
    setInsecureIgnoreHostKey(initialConnection.insecureIgnoreHostKey);
    setPassphrase("");
    setSavePassword(initialConnection.password.trim() !== "");
    setPasswordVisible(false);
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
        password: authType === "password" && savePassword ? password : "",
        keyPath: authType === "key" ? keyPath.trim() : "",
        insecureIgnoreHostKey,
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
              name="connection-name"
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
              name="connection-host"
              value={host}
              onChange={(event) => setHost(event.target.value)}
              placeholder="10.0.1.120 or db.example.com"
              required
            />
          </label>

          <div className="field-row">
            <label className="field field-grow-2">
              <span className="field-label">User</span>
              <input
                className="field-input"
                name="connection-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="root"
                autoComplete="username"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Port</span>
              <input
                className="field-input"
                name="connection-port"
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
              <div className="secret-field">
                <input
                  className="field-input"
                  name="connection-password"
                  type={passwordVisible ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Account password"
                  autoComplete="current-password"
                />
                <button
                  className="secret-toggle"
                  type="button"
                  onClick={() => setPasswordVisible((current) => !current)}
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                  title={passwordVisible ? "Hide password" : "Show password"}
                >
                  <EyeIcon visible={passwordVisible} />
                </button>
              </div>
              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={savePassword}
                  onChange={(event) => setSavePassword(event.target.checked)}
                />
                Remember password locally
              </label>
            </div>
          ) : null}

          {authType === "key" ? (
            <>
              <label className="field">
                <span className="field-label">Private key file</span>
                <input
                  className="field-input"
                  name="connection-key-path"
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
                  name="connection-key-passphrase"
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

          <label className="auth-check host-key-check">
            <input
              type="checkbox"
              checked={insecureIgnoreHostKey}
              onChange={(event) => setInsecureIgnoreHostKey(event.target.checked)}
            />
            Trust this host without known_hosts verification
          </label>
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
