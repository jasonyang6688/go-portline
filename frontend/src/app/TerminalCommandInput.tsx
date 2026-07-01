import type { RefObject } from "react";
import { Icon } from "./Icon";

type TerminalCommandInputProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  command: string;
  terminalDisplayUser: string;
  terminalDisplayHost: string;
  terminalDisplayPath: string;
  terminalSmartOpen: boolean;
  terminalBroadcast: boolean;
  onCommandChange: (command: string) => void;
  onRunCommand: (command: string) => void;
  onToggleSmart: () => void;
  onToggleBroadcast: () => void;
};

export function TerminalCommandInput({
  inputRef,
  command,
  terminalDisplayUser,
  terminalDisplayHost,
  terminalDisplayPath,
  terminalSmartOpen,
  terminalBroadcast,
  onCommandChange,
  onRunCommand,
  onToggleSmart,
  onToggleBroadcast,
}: TerminalCommandInputProps) {
  return (
    <div className="term-input-row">
      <span className="term-prompt-label">
        <span className="t-user">{terminalDisplayUser}</span>
        <span className="t-muted">@</span>
        <span className="t-host">{terminalDisplayHost}</span>
        <span className="t-muted">:</span>
        <span className="t-path">{terminalDisplayPath}</span>
        <span className="t-prompt"> # </span>
      </span>
      <input
        ref={inputRef}
        className="term-input"
        name="terminal-command"
        aria-label="Command input"
        autoComplete="off"
        spellCheck={false}
        value={command}
        onChange={(event) => onCommandChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") {
            return;
          }
          const nextCommand = command.trim();
          if (!nextCommand) {
            return;
          }
          onRunCommand(nextCommand);
        }}
      />
      <button
        className={`tir-btn${terminalSmartOpen ? " active" : ""}`}
        type="button"
        title="Smart suggestions (⌘J)"
        onClick={onToggleSmart}
      >
        <Icon name="zap" size={14} />
      </button>
      <button
        className={`tir-btn${terminalBroadcast ? " active bcast" : ""}`}
        type="button"
        title="Broadcast input to all connected sessions"
        onClick={onToggleBroadcast}
      >
        <Icon name="network" size={14} />
        {terminalBroadcast ? <span className="tir-lab">ALL</span> : null}
      </button>
    </div>
  );
}
