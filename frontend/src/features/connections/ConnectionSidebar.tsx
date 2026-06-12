import { useState } from "react";
import type { Connection } from "./types";

interface Props {
  connections: Connection[];
  onCreate(): void;
  onOpen(connection: Connection, password: string, insecureIgnoreHostKey: boolean): Promise<void> | void;
}

function authLabel(connection: Connection): string {
  switch (connection.authType) {
    case "key":
      return "Key";
    case "agent":
      return "Agent";
    default:
      return "Password";
  }
}

export function ConnectionSidebar({ connections, onCreate, onOpen }: Props) {
  const [passwordById, setPasswordById] = useState<Record<string, string>>({});
  const [insecureById, setInsecureById] = useState<Record<string, boolean>>({});
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  async function handleOpen(connection: Connection) {
    setOpeningId(connection.id);
    setErrorById((current) => ({ ...current, [connection.id]: "" }));

    try {
      await onOpen(
        connection,
        passwordById[connection.id] ?? "",
        insecureById[connection.id] ?? false,
      );
    } catch (error) {
      setErrorById((current) => ({
        ...current,
        [connection.id]: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setOpeningId((current) => (current === connection.id ? null : current));
    }
  }

  return (
    <aside className="sidebar tf-sidebar" aria-label="Saved connections">
      <section className="panel-card tf-panel-card">
        <div className="panel-card__header tf-sidebar__header">
          <div>
            <h1>Connections</h1>
            <p>{connections.length} saved</p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onCreate}
            aria-label="Create connection"
            title="Create connection"
          >
            +
          </button>
        </div>

        <div className="tf-connection-list">
          {connections.length === 0 ? (
            <div className="empty-state">
              <strong>No connections</strong>
              <p>Create an SSH target to start opening sessions.</p>
            </div>
          ) : (
            connections.map((connection) => {
              const isOpening = openingId === connection.id;
              const error = errorById[connection.id];

              return (
                <article className="tf-connection-card" key={connection.id}>
                  <div className="tf-connection-card__meta">
                    <div className="tf-connection-card__title">
                      <span className="tf-status-dot tf-status-dot--idle" aria-hidden="true" />
                      <strong>{connection.name}</strong>
                    </div>
                    <span className="tf-chip">{authLabel(connection)}</span>
                  </div>

                  <div className="tf-connection-card__target">
                    {connection.username}@{connection.host}:{connection.port}
                  </div>

                  {connection.group ? <div className="tf-muted">Group: {connection.group}</div> : null}

                  {connection.authType === "password" ? (
                    <label className="tf-field">
                      <span>Password</span>
                      <input
                        type="password"
                        value={passwordById[connection.id] ?? ""}
                        onChange={(event) =>
                          setPasswordById((current) => ({
                            ...current,
                            [connection.id]: event.target.value,
                          }))
                        }
                        placeholder="Enter session password"
                        autoComplete="current-password"
                      />
                    </label>
                  ) : (
                    <div className="tf-field tf-field--static">
                      <span>Private key</span>
                      <code>{connection.keyPath || "No key path saved"}</code>
                    </div>
                  )}

                  <label className="tf-toggle">
                    <input
                      type="checkbox"
                      checked={insecureById[connection.id] ?? false}
                      onChange={(event) =>
                        setInsecureById((current) => ({
                          ...current,
                          [connection.id]: event.target.checked,
                        }))
                      }
                    />
                    <span>Ignore host key verification</span>
                  </label>

                  {error ? <div className="tf-error">{error}</div> : null}

                  <div className="tf-connection-card__actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => void handleOpen(connection)}
                      disabled={isOpening}
                      aria-label={`Open ${connection.name}`}
                      title={`Open ${connection.name}`}
                    >
                      {isOpening ? "Opening..." : "Open"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </aside>
  );
}
