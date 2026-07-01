import type { RefObject } from "react";
import type { Connection, Session } from "../features/connections/types";
import { Icon } from "./Icon";

interface TitleBarProps {
  activeSessionId: string | null;
  clock: string;
  connectionMenuRef: RefObject<HTMLDivElement | null>;
  connectionMenuOpen: boolean;
  connections: Connection[];
  isProductionConnection(connection: Connection | null): boolean;
  onActivateSession(sessionId: string): void;
  onCloseSession(sessionId: string): void;
  onCreateConnection(): void;
  onOpenConnection(connection: Connection): void;
  onOpenPalette(): void;
  onToggleConnectionMenu(): void;
  onToggleTheme(): void;
  sessions: Session[];
  theme: "dark" | "light";
}

function sessionConnection(session: Session, connections: Connection[]): Connection | null {
  return connections.find((connection) => connection.id === session.connectionId) ?? null;
}

function sessionBadge(
  connection: Connection | null,
  isProductionConnection: (connection: Connection | null) => boolean,
): string {
  if (isProductionConnection(connection)) {
    return "PROD";
  }
  if (connection?.group.toLowerCase().includes("wsl")) {
    return "WSL";
  }
  return "SSH";
}

export function TitleBar({
  activeSessionId,
  clock,
  connectionMenuRef,
  connectionMenuOpen,
  connections,
  isProductionConnection,
  onActivateSession,
  onCloseSession,
  onCreateConnection,
  onOpenConnection,
  onOpenPalette,
  onToggleConnectionMenu,
  onToggleTheme,
  sessions,
  theme,
}: TitleBarProps) {
  return (
    <header className="titlebar">
      <div className="tb-brand">
        <span className="tb-logo">
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <rect width="18" height="18" rx="5" fill="currentColor" opacity="0.12" />
            <path d="M4.5 6h4c2.8 0 2.8 6 5.2 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M4.5 12h4.8" fill="none" stroke="var(--yellow)" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 9.5 14.5 12 12 14.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        Portline
      </div>
      <div className="tb-tabs">
        <div className="tb-tab-strip">
          {sessions.length === 0 ? (
            <span className="tb-tab muted">No active session</span>
          ) : (
            sessions.map((session) => {
              const connection = sessionConnection(session, connections);
              const badge = sessionBadge(connection, isProductionConnection);
              const isProd = badge === "PROD";

              return (
                <button
                  className={`tb-tab${session.id === activeSessionId ? " active" : ""}`}
                  key={session.id}
                  type="button"
                  onClick={() => onActivateSession(session.id)}
                  title={`${session.name} (${session.status})`}
                >
                  <span className={`tab-dot ${session.status === "connected" ? "on" : "off"}${isProd ? " prod" : ""}`} />
                  <span className="tab-name">{session.name}</span>
                  <span className={`tab-type ${badge.toLowerCase()}`}>{badge}</span>
                  <span
                    className="tab-close"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCloseSession(session.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.stopPropagation();
                        onCloseSession(session.id);
                      }
                    }}
                  >
                    &times;
                  </span>
                </button>
              );
            })
          )}
        </div>
        <div className="tb-add-wrap" ref={connectionMenuRef}>
          <button
            className={`tb-add${connectionMenuOpen ? " active" : ""}`}
            type="button"
            onClick={onToggleConnectionMenu}
            aria-haspopup="menu"
            aria-expanded={connectionMenuOpen}
            title="Open or create connection"
          >
            <Icon name="plus" size={13} />
          </button>
          {connectionMenuOpen ? (
            <div className="tb-connection-menu" role="menu" aria-label="Open or create connection">
              <button className="tb-connection-new" type="button" role="menuitem" onClick={onCreateConnection}>
                <span className="tb-connection-icon"><Icon name="plus" size={13} /></span>
                <span>
                  <span className="tb-connection-name">New Connection</span>
                  <span className="tb-connection-meta">Add a server to the address book</span>
                </span>
              </button>
              <div className="tb-connection-section">Saved Servers</div>
              <div className="tb-connection-list">
                {connections.length === 0 ? (
                  <div className="tb-connection-empty">No saved servers yet</div>
                ) : (
                  connections.map((connection) => {
                    const isOpen = sessions.some((session) => session.connectionId === connection.id);
                    return (
                      <button
                        className="tb-connection-item"
                        key={connection.id}
                        type="button"
                        role="menuitem"
                        onClick={() => onOpenConnection(connection)}
                      >
                        <span className={`tab-dot on${isProductionConnection(connection) ? " prod" : ""}`} />
                        <span className="tb-connection-copy">
                          <span className="tb-connection-name">{connection.name}</span>
                          <span className="tb-connection-meta">{connection.username}@{connection.host}:{connection.port}</span>
                        </span>
                        {isOpen ? <span className="tb-connection-state">Open</span> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="tb-right">
        <button className="tb-command" type="button" title="Command palette" onClick={onOpenPalette}>
          <Icon name="search" size={12} />
          <span className="tb-kbd">⌘K</span>
        </button>
        <span className="tb-time">{clock}</span>
        <button
          className="tb-icon-btn"
          type="button"
          title="Theme"
          onClick={onToggleTheme}
        >
          <Icon name={theme === "dark" ? "moon" : "settings"} size={14} />
        </button>
        <button className="tb-icon-btn" type="button" title="Notifications">
          <Icon name="bell" size={14} />
        </button>
        <button className="tb-icon-btn" type="button" title="Account">
          <Icon name="user" size={14} />
        </button>
      </div>
    </header>
  );
}
