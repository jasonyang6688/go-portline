import { Icon } from "./Icon";
import { metricTone } from "./appHelpers";
import { terminalSessionPrimaryAction } from "./terminalSessions";
import type { TerminalDock } from "./terminalViewTypes";

type TerminalToolbarProps = {
  terminalDock: TerminalDock;
  terminalIsProd: boolean;
  terminalDisplayPath: string;
  terminalCPU: number;
  terminalMemory: number;
  terminalCPUHistory: number[];
  terminalCPUHistoryMax: number;
  activeSessionStatus: string | null;
  reconnecting: boolean;
  onCloseActiveSession: () => void;
  onReconnectActiveSession: () => void;
  onToggleMonitorDock: () => void;
  onToggleFilesDock: () => void;
  onToggleHistoryDock: () => void;
};

export function TerminalToolbar({
  terminalDock,
  terminalIsProd,
  terminalDisplayPath,
  terminalCPU,
  terminalMemory,
  terminalCPUHistory,
  terminalCPUHistoryMax,
  activeSessionStatus,
  reconnecting,
  onCloseActiveSession,
  onReconnectActiveSession,
  onToggleMonitorDock,
  onToggleFilesDock,
  onToggleHistoryDock,
}: TerminalToolbarProps) {
  const primaryAction = terminalSessionPrimaryAction(activeSessionStatus, reconnecting);
  const isReconnectAction = primaryAction === "reconnect" || primaryAction === "reconnecting";
  const primaryActionLabel = primaryAction === "reconnecting"
    ? "Reconnecting active session"
    : isReconnectAction
      ? "Reconnect active session"
      : primaryAction === "close"
        ? "Close active session"
        : "No active session";

  return (
    <div className="term-toolbar">
      <div className="tt-host tt-host-compact">
        <span className={`dot${terminalIsProd ? " prod" : ""}`} />
        <span className="tt-crumb">{terminalDisplayPath}</span>
      </div>
      <div className="tt-spacer" />
      {!terminalDock ? (
        <div className="tt-vitals" aria-label="Session vitals">
          <button className={`tt-vital ${metricTone(terminalCPU)} cpu`} type="button" onClick={onToggleMonitorDock}>
            <span className="tt-vital-k">CPU</span>
            <span className="tt-vital-v">{terminalCPU}%</span>
            <span className="tt-spark" aria-hidden="true">
              {terminalCPUHistory.slice(-16).map((value, index) => (
                <span key={`${value}-${index}`} style={{ height: `${Math.max(4, (value / terminalCPUHistoryMax) * 22)}px` }} />
              ))}
            </span>
          </button>
          <button className={`tt-vital ${metricTone(terminalMemory)} mem`} type="button" onClick={onToggleMonitorDock}>
            <span className="tt-vital-k">MEM</span>
            <span className="tt-vital-v">{terminalMemory}%</span>
          </button>
        </div>
      ) : null}
      <button
        className={`tt-vital power${isReconnectAction ? " reconnect" : ""}`}
        type="button"
        aria-label={primaryActionLabel}
        aria-busy={primaryAction === "reconnecting"}
        title={primaryActionLabel}
        disabled={primaryAction === "disabled" || primaryAction === "reconnecting"}
        onClick={isReconnectAction ? onReconnectActiveSession : onCloseActiveSession}
      >
        {isReconnectAction ? <Icon name="refresh" size={14} /> : "⏻"}
      </button>
      <button
        className={`tt-btn${terminalDock === "monitor" ? " active" : ""}`}
        type="button"
        onClick={onToggleMonitorDock}
      >
        <Icon name="monitor" size={12} />
        Monitor
      </button>
      <button
        className={`tt-btn${terminalDock === "files" ? " active" : ""}`}
        type="button"
        onClick={onToggleFilesDock}
      >
        <Icon name="files" size={12} />
        Files
      </button>
      <button
        className={`tt-btn${terminalDock === "history" ? " active" : ""}`}
        type="button"
        onClick={onToggleHistoryDock}
      >
        <Icon name="list" size={12} />
        History
      </button>
    </div>
  );
}
