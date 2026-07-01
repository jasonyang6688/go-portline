import { useState } from "react";
import type { SavedCommand } from "../features/connections/types";
import { Icon } from "./Icon";
import { getTerminalSmartBarCommands } from "./terminalSmartBarCommands";

interface TerminalSmartBarProps {
  savedCommands: SavedCommand[];
  connectionId: string | null;
  onClose(): void;
  onPick(command: string): void;
  onReorder(sourceId: string, targetId: string): void;
}

export function TerminalSmartBar({
  savedCommands,
  connectionId,
  onClose,
  onPick,
  onReorder,
}: TerminalSmartBarProps) {
  const pinnedCommands = getTerminalSmartBarCommands(savedCommands, connectionId);
  const [draggingCommandId, setDraggingCommandId] = useState<string | null>(null);

  return (
    <div className="term-smartbar">
      <div className="sm-head">
        <span className="sm-title"><Icon name="zap" size={12} />Quick Commands</span>
        <span className="sm-kbd">⌘J</span>
        <button className="tf-icon-btn sm-close" type="button" title="Close suggestions" onClick={onClose}>
          <Icon name="close" size={11} />
        </button>
      </div>
      <div className="sm-row">
        <span className="sm-cat">Scope</span>
        {pinnedCommands.length === 0 ? (
          <span className="sm-empty">No pinned commands</span>
        ) : (
          pinnedCommands.map((command) => (
            <button
              className={`tq-chip${draggingCommandId === command.id ? " dragging" : ""}`}
              type="button"
              key={command.id}
              draggable
              onDragStart={(event) => {
                setDraggingCommandId(command.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", command.id);
              }}
              onDragOver={(event) => {
                if (draggingCommandId && draggingCommandId !== command.id) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId = event.dataTransfer.getData("text/plain") || draggingCommandId;
                setDraggingCommandId(null);
                if (sourceId) {
                  onReorder(sourceId, command.id);
                }
              }}
              onDragEnd={() => setDraggingCommandId(null)}
              onClick={() => onPick(command.command)}
              title={`${command.name} - ${command.command}`}
              aria-label={`Run command ${command.name}: ${command.command}`}
            >
              <Icon name="play" size={9} />
              <span className="tq-chip-label">{command.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
