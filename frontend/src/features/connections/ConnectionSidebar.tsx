import { useState } from "react";
import type { Connection } from "./types";

interface Props {
  connections: Connection[];
  activeConnectionId?: string | null;
  collapsed?: boolean;
  connectedConnectionIds?: string[];
  onCreate(): void;
  onEdit(connection: Connection): void;
  onDelete(connection: Connection): void;
  onOpen(connection: Connection, password: string, insecureIgnoreHostKey: boolean): Promise<void> | void;
  onTrustHostKey(connection: Connection): Promise<void> | void;
  onRefresh?(): void;
}

function connectionBadge(connection: Connection): string | null {
  return connection.group.toLowerCase().includes("wsl") ? "WSL" : null;
}

function SidebarIcon({ name, size = 14 }: { name: "plus" | "refresh" | "edit" | "trash" | "close" | "server"; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "plus":
      return (
        <svg {...common}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
          <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
        </svg>
      );
    case "edit":
      return (
        <svg {...common}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case "server":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="7" rx="1.5" />
          <rect x="3" y="13" width="18" height="7" rx="1.5" />
          <line x1="7" y1="8" x2="7.01" y2="8" />
          <line x1="7" y1="17" x2="7.01" y2="17" />
        </svg>
      );
  }
}

export function ConnectionSidebar({
  connections,
  activeConnectionId,
  collapsed = false,
  connectedConnectionIds = [],
  onCreate,
  onEdit,
  onDelete,
  onOpen,
  onTrustHostKey,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState("");
  const [manageMode, setManageMode] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const filteredConnections = connections.filter((connection) => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return true;
    }
    return [connection.name, connection.host, connection.username, connection.group]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
  const groupedConnections = filteredConnections.reduce<Record<string, Connection[]>>((groups, connection) => {
    const key = connection.group || "SSH Servers";
    groups[key] = [...(groups[key] ?? []), connection];
    return groups;
  }, {});

  async function handleOpen(connection: Connection) {
    setOpeningId(connection.id);
    setErrorById((current) => ({ ...current, [connection.id]: "" }));

    try {
      await onOpen(connection, connection.password, false);
    } catch (error) {
      setErrorById((current) => ({
        ...current,
        [connection.id]: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setOpeningId((current) => (current === connection.id ? null : current));
    }
  }

  async function handleTrustHostKey(connection: Connection) {
    setOpeningId(connection.id);
    setErrorById((current) => ({ ...current, [connection.id]: "" }));

    try {
      await onTrustHostKey(connection);
    } catch (error) {
      setErrorById((current) => ({
        ...current,
        [connection.id]: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setOpeningId((current) => (current === connection.id ? null : current));
    }
  }

  function canTrustHostKey(error: string | undefined, connection: Connection): boolean {
    if (!error || connection.insecureIgnoreHostKey) {
      return false;
    }
    const message = error.toLowerCase();
    return message.includes("knownhosts") || message.includes("known_hosts") || message.includes("key is unknown");
  }

  return (
    <aside className={`sidebar tf-sidebar${collapsed ? " collapsed" : ""}`} aria-label="Saved connections">
      <div className="sb-header">
        <span className="sb-title">Connections</span>
        <button className="sb-action" type="button" onClick={onCreate} aria-label="New connection" title="New connection">
          <SidebarIcon name="plus" size={13} />
        </button>
        <button className="sb-action" type="button" aria-label="Refresh" title="Refresh" onClick={onRefresh}>
          <SidebarIcon name="refresh" size={13} />
        </button>
      </div>

      <div className="sb-search">
        <input
          name="connection-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search connections..."
          spellCheck={false}
        />
      </div>

      <div className="sb-scroll">
        {filteredConnections.length === 0 ? (
          <div className="sb-empty">
            <strong>No connections</strong>
            <span>Create an SSH target to start opening sessions.</span>
          </div>
        ) : (
          Object.entries(groupedConnections).map(([group, groupConnections]) => (
            <div className="sb-group" key={group}>
              <div className="sb-group-hdr">
                <span className="sb-group-arrow open">›</span>
                <SidebarIcon name="server" size={13} />
                {group}
                <span className="sb-badge">{groupConnections.length}</span>
              </div>
              {groupConnections.map((connection) => {
                const isOpening = openingId === connection.id;
                const isConnected = connectedConnectionIds.includes(connection.id);
                const isActive = activeConnectionId === connection.id;
                const error = errorById[connection.id];
                const badge = connectionBadge(connection);

                return (
                  <div className="sb-conn" key={connection.id}>
                    <div
                      className={`sb-item${isActive ? " active" : ""}${manageMode ? " managing" : ""}`}
                    >
                      <button
                        className="sb-main-btn"
                        type="button"
                        disabled={isOpening}
                        title={`${connection.username}@${connection.host}:${connection.port}`}
                        onClick={() => {
                          if (manageMode) {
                            onEdit(connection);
                            return;
                          }
                          void handleOpen(connection);
                        }}
                      >
                        <span className={`sb-dot ${isOpening ? "busy" : isConnected ? "on" : "off"}`} />
                        <span className="sb-item-name">{connection.name}</span>
                        {!manageMode && badge ? <span className="sb-badge wsl">{badge}</span> : null}
                      </button>
                      {manageMode ? (
                        <span className="sb-row-actions">
                          <button
                            className="sb-row-btn"
                            type="button"
                            title={`Edit ${connection.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              onEdit(connection);
                            }}
                          >
                            <SidebarIcon name="edit" size={13} />
                          </button>
                          <button
                            className="sb-row-btn danger"
                            type="button"
                            title={`Delete ${connection.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete(connection);
                            }}
                          >
                            <SidebarIcon name="trash" size={13} />
                          </button>
                        </span>
                      ) : null}
                    </div>
                    <div className="sb-conn-meta">
                      <span>{connection.username}@{connection.host}:{connection.port}</span>
                    </div>
                    {error ? (
                      <div className="tf-error sb-error">
                        <span>{error}</span>
                        {canTrustHostKey(error, connection) ? (
                          <button
                            className="sb-error-action"
                            type="button"
                            onClick={() => void handleTrustHostKey(connection)}
                          >
                            Trust & retry
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="sb-footer">
        <button className="sb-footer-btn primary" type="button" onClick={onCreate}>
          <SidebarIcon name="plus" size={14} />
          New
        </button>
        <button
          className={`sb-footer-btn${manageMode ? " active" : ""}`}
          type="button"
          onClick={() => setManageMode((current) => !current)}
        >
          <SidebarIcon name={manageMode ? "close" : "edit"} size={14} />
          {manageMode ? "Done" : "Manage"}
        </button>
      </div>
    </aside>
  );
}
