import { useState } from "react";
import type { Connection, SavedCommand } from "../features/connections/types";
import { Icon } from "./Icon";
import {
  CONNECTION_TAG_PREFIX,
  commandScopeKey,
  connectionIdFromScopeKey,
  scopeKeyForConnection,
  type CommandScopeKey,
} from "./terminalSmartBarCommands";

export function CommandsView({
  savedCommands,
  connections,
  onRun,
  onCreate,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  savedCommands: SavedCommand[];
  connections: Connection[];
  onRun(command: string): void;
  onCreate(scopeKey: CommandScopeKey): void;
  onEdit(command: SavedCommand): void;
  onDelete(command: SavedCommand): void;
  onTogglePin(command: SavedCommand): void;
}) {
  const [activeScope, setActiveScope] = useState<CommandScopeKey>("global");
  const activeConnectionId = connectionIdFromScopeKey(activeScope);
  const activeConnection = activeConnectionId ? connections.find((connection) => connection.id === activeConnectionId) ?? null : null;
  const commands = savedCommands.filter((command) => commandScopeKey(command) === activeScope);
  const scopeTitle = activeConnection ? activeConnection.name : "Global Commands";
  const scopeSubtitle = activeConnection
    ? `${activeConnection.username}@${activeConnection.host}:${activeConnection.port}`
    : "Available from every terminal session";
  const globalCount = savedCommands.filter((command) => commandScopeKey(command) === "global").length;
  const countForConnection = (connectionId: string) =>
    savedCommands.filter((command) => commandScopeKey(command) === scopeKeyForConnection(connectionId)).length;

  return (
    <section className="view-stack">
      <div className="view-header">
        <Icon name="commands" size={16} />
        <span className="view-header-title">Command Library</span>
        <button className="view-btn primary" type="button" onClick={() => onCreate(activeScope)}><Icon name="plus" size={13} />New Command</button>
      </div>
      <div className="cmd-wrap">
        <aside className="cmd-sidebar" aria-label="Command scopes">
          <button
            className={`cmd-nav-item cmd-scope-main${activeScope === "global" ? " active" : ""}`}
            type="button"
            onClick={() => setActiveScope("global")}
          >
            <Icon name="list" size={14} />
            <span>
              <span className="cmd-scope-name">Global Commands</span>
              <span className="cmd-scope-meta">All terminals</span>
            </span>
            <span className="cmd-count">{globalCount}</span>
          </button>
          {connections.map((connection) => {
            const scopeKey = scopeKeyForConnection(connection.id);
            return (
              <button
                className={`cmd-nav-item${activeScope === scopeKey ? " active" : ""}`}
                type="button"
                key={connection.id}
                onClick={() => setActiveScope(scopeKey)}
              >
                <Icon name={connection.tags.includes("wsl") ? "terminal" : "network"} size={14} />
                <span>
                  <span className="cmd-scope-name">{connection.name}</span>
                  <span className="cmd-scope-meta">{connection.username}@{connection.host}</span>
                </span>
                <span className="cmd-count">{countForConnection(connection.id)}</span>
              </button>
            );
          })}
        </aside>
        <div className="cmd-main">
          <div className="cmd-main-head">
            <div>
              <div className="cmd-main-title">{scopeTitle}</div>
              <div className="cmd-main-sub">{scopeSubtitle}</div>
            </div>
            <button className="view-btn" type="button" onClick={() => onCreate(activeScope)}>
              <Icon name="plus" size={13} />Add here
            </button>
          </div>
          <div className="cmd-grid">
          {commands.length === 0 ? (
            <div className="cmd-empty">
              <div className="cmd-empty-title">No commands in this scope</div>
              <div className="cmd-empty-sub">Save reusable shell commands for {activeConnection ? activeConnection.name : "all connections"}.</div>
              <button className="view-btn primary" type="button" onClick={() => onCreate(activeScope)}>
                <Icon name="plus" size={13} />Create command
              </button>
            </div>
          ) : (
            commands.map((command) => {
              const isGlobal = commandScopeKey(command) === "global";
              return (
                <article className={`cmd-card${isGlobal ? " pinned" : ""}`} key={command.id}>
                  <div className="cmd-card-head">
                    <div className="cmd-card-name">{command.name}</div>
                    <button
                      className={`cmd-pin${isGlobal ? " on" : ""}`}
                      type="button"
                      title={isGlobal ? "Global command" : "Make global"}
                      disabled={isGlobal}
                      onClick={() => onTogglePin(command)}
                    >
                      <Icon name="pin" size={13} />
                    </button>
                  </div>
                  <code className="cmd-card-code">{command.command}</code>
                  <div className="cmd-card-desc">{command.description}</div>
                  <div className="cmd-card-footer">
                    {command.tags.map((tag) => (
                      <span className={`tag tag-${tag === "danger" ? "danger" : tag === "param" ? "param" : tag === "global" ? "global" : tag.startsWith(CONNECTION_TAG_PREFIX) ? "server" : "server"}`} key={tag}>
                        {tag.startsWith(CONNECTION_TAG_PREFIX) ? "host" : tag}
                      </span>
                    ))}
                    <button className="cmd-run-btn secondary" type="button" onClick={() => onEdit(command)}>
                      <Icon name="edit" size={10} />Edit
                    </button>
                    <button className="cmd-run-btn danger" type="button" onClick={() => onDelete(command)}>
                      <Icon name="trash" size={10} />Delete
                    </button>
                    <button className="cmd-run-btn" type="button" onClick={() => onRun(command.command)}>
                      <Icon name="play" size={10} />{command.tags.includes("param") ? "Run..." : "Run"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
          </div>
        </div>
      </div>
    </section>
  );
}
