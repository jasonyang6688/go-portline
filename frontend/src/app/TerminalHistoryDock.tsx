import type { CommandHistoryEntry } from "../features/connections/types";
import { Icon } from "./Icon";

export type CommandHistoryScope = "host" | "all";

interface TerminalHistoryDockProps {
  host: string;
  history: CommandHistoryEntry[];
  query: string;
  scope: CommandHistoryScope;
  onQueryChange(query: string): void;
  onScopeChange(scope: CommandHistoryScope): void;
  onRunCommand(command: string): void;
  onClear(): void;
  onClose(): void;
}

export function TerminalHistoryDock({
  host,
  history,
  query,
  scope,
  onQueryChange,
  onScopeChange,
  onRunCommand,
  onClear,
  onClose,
}: TerminalHistoryDockProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredHistory = normalizedQuery
    ? history.filter((entry) =>
        entry.command.toLowerCase().includes(normalizedQuery) ||
        entry.connectionName.toLowerCase().includes(normalizedQuery),
      )
    : history;

  return (
    <aside className="term-files term-hist" aria-label="History panel">
      <div className="tf-head">
        <span className="tf-head-title"><Icon name="list" size={13} />History</span>
        <span className="tf-head-spacer" />
        <button className="tf-icon-btn" type="button" title="Close panel" onClick={onClose}><Icon name="close" size={13} /></button>
      </div>
      <div className="hp-controls">
        <input
          className="hp-search"
          name="command-history-search"
          placeholder="Search commands..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <div className="hp-scope">
          <button className={scope === "host" ? "active" : ""} type="button" onClick={() => onScopeChange("host")}>{host}</button>
          <button className={scope === "all" ? "active" : ""} type="button" onClick={() => onScopeChange("all")}>All hosts</button>
        </div>
      </div>
      <div className="hp-list">
        {filteredHistory.length === 0 ? (
          <div className="hp-empty">
            {history.length === 0 ? "No commands logged yet. Commands you run in this terminal are recorded here." : "No commands match this search."}
          </div>
        ) : (
          filteredHistory.map((entry) => (
            <button className="hp-item" type="button" key={entry.id} onClick={() => onRunCommand(entry.command)}>
              <code>{entry.command}</code>
              <span>{scope === "all" ? entry.connectionName : new Date(entry.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
            </button>
          ))
        )}
      </div>
      <div className="tf-foot">
        <span>{filteredHistory.length}/{history.length} entries</span>
        <button className="tf-foot-up" type="button" onClick={onClear}><Icon name="trash" size={11} />Clear</button>
      </div>
    </aside>
  );
}
