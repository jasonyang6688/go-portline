import type { MonitorSnapshot } from "../features/connections/types";
import { Icon } from "./Icon";
import {
  formatNetworkRate,
  monitorFreshness,
  type MonitorHistory,
} from "./monitorSnapshot";

interface TerminalMonitorDockProps {
  host: string;
  user: string;
  snapshot: MonitorSnapshot | null;
  history: MonitorHistory;
  onFullView(): void;
  onClose(): void;
}

function SparkBars({ values, color }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  return (
    <span className="spark">
      {values.map((value, index) => (
        <span
          className="spark-bar"
          key={`${value}-${index}`}
          style={{
            height: `${Math.max(4, (value / max) * 34)}px`,
            background: color,
            opacity: 0.35 + (index / values.length) * 0.65,
          }}
        />
      ))}
    </span>
  );
}

function MiniGauge({ value, label, sub, color }: { value: number; label: string; sub: string; color: string }) {
  const radius = 36;
  const circumference = Math.PI * radius;
  const dash = (value / 100) * circumference;

  return (
    <div className="mg">
      <svg width="104" height="68" viewBox="0 0 104 68" aria-hidden="true">
        <path d="M 14 54 A 38 38 0 0 1 90 54" fill="none" stroke="var(--surface0)" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M 14 54 A 38 38 0 0 1 90 54"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
        <text x="52" y="52" textAnchor="middle" fontSize="16" fill="var(--text)" fontFamily="var(--font-mono)" fontWeight="700">{value}%</text>
      </svg>
      <div className="mg-label">{label}</div>
      <div className="mg-sub">{sub}</div>
    </div>
  );
}

function metricColor(value: number) {
  if (value >= 85) return "var(--red)";
  if (value >= 60) return "var(--yellow)";
  return "var(--green)";
}

function availableMetricLabel(value: string | undefined, fallback: string) {
  return value && value.trim() ? value : fallback;
}

export function TerminalMonitorDock({
  host,
  user,
  snapshot,
  history,
  onFullView,
  onClose,
}: TerminalMonitorDockProps) {
  const freshness = monitorFreshness(snapshot);
  const cpu = snapshot?.cpuPercent ?? 0;
  const cpuIdle = snapshot?.cpuIdlePercent ?? 0;
  const cpuCores = snapshot?.cpuCores ?? 0;
  const mem = snapshot?.memoryPercent ?? 0;
  const disk = snapshot?.diskPercent ?? 0;
  const memoryUsed = availableMetricLabel(snapshot?.memoryUsedLabel, "--");
  const memoryAvailable = availableMetricLabel(snapshot?.memoryAvailableLabel, "--");
  const memoryTotal = availableMetricLabel(snapshot?.memoryTotalLabel, "--");
  const diskUsed = availableMetricLabel(snapshot?.diskUsedLabel, "--");
  const diskAvailable = availableMetricLabel(snapshot?.diskAvailableLabel, "--");
  const diskTotal = availableMetricLabel(snapshot?.diskTotalLabel, "--");
  const processes = snapshot?.processes ?? [];
  const latestRx = history.networkRx[history.networkRx.length - 1] ?? 0;
  const latestTx = history.networkTx[history.networkTx.length - 1] ?? 0;
  const cpuHistory = history.cpu.length ? history.cpu : [0];
  const networkHistory = history.networkRx.length ? history.networkRx : [0];

  return (
    <aside className="term-monitor" aria-label="Monitor panel">
      <div className="tf-head">
        <span className="tf-head-title"><Icon name="monitor" size={13} />Monitor</span>
        <span className="tf-head-spacer" />
        <span className={`tm-live ${freshness}`}><span className="tm-live-dot" />{freshness === "live" ? "live · 5s" : freshness}</span>
        <button className="tf-icon-btn" type="button" title="Open full view" onClick={onFullView}><Icon name="chart" size={13} /></button>
        <button className="tf-icon-btn" type="button" title="Close panel" onClick={onClose}><Icon name="close" size={13} /></button>
      </div>
      <div className="tm-host">{user}@{host}</div>
      <div className="tm-scroll">
        {!snapshot ? (
          <div className="monitor-empty">
            <div className="monitor-empty-title">Waiting for remote metrics</div>
            <div className="monitor-empty-sub">Open a live SSH session and refresh Monitor to collect host data.</div>
          </div>
        ) : null}
        <div className="tm-gauges">
          <MiniGauge value={cpu} label="CPU" sub={`${cpuIdle}% idle · ${cpuCores || "--"} cores`} color={metricColor(cpu)} />
          <MiniGauge value={mem} label="MEM" sub={`${memoryUsed} / ${memoryTotal}`} color={metricColor(mem)} />
          <MiniGauge value={disk} label="DISK" sub={`${diskUsed} / ${diskTotal}`} color={metricColor(disk)} />
        </div>
        <div className="tm-detail-grid" aria-label="Monitor details">
          <span>CPU idle</span><strong>{cpuIdle}%</strong>
          <span>Load avg</span><strong>{snapshot?.loadAverage ?? "live"}</strong>
          <span>Mem free</span><strong>{memoryAvailable}</strong>
          <span>Disk free</span><strong>{diskAvailable}</strong>
        </div>
        <section className="tm-chart">
          <div className="tm-chart-head"><Icon name="cpu" size={12} />CPU<span>{cpu}%</span></div>
          <SparkBars values={cpuHistory} color="var(--blue)" />
        </section>
        <section className="tm-chart">
          <div className="tm-chart-head"><Icon name="network" size={12} />Net<span>↓{formatNetworkRate(latestRx)} ↑{formatNetworkRate(latestTx)}</span></div>
          <SparkBars values={networkHistory} color="var(--teal)" />
        </section>
        <div className="tm-procs-head">
          <span>Top processes</span>
          <span>{processes.length ? "remote ps" : "no data"}</span>
        </div>
        <div className="tm-procs">
          {processes.length ? processes.map((process) => (
            <div className="tm-proc" key={process.pid}>
              <span className="tm-proc-name">{process.name}</span>
              <span className="tm-proc-pid">{process.pid}</span>
              <span className="tm-proc-mem">{process.memory}</span>
              <span className="tm-proc-cpu">{process.cpuPercent.toFixed(1)}%</span>
            </div>
          )) : <div className="tm-proc-empty">No process sample returned by the remote host.</div>}
        </div>
      </div>
      <div className="tm-foot">
        <span className="tm-cpu-dot">● CPU {cpu}%</span>
        <span className="tm-mem-dot">● MEM {mem}%</span>
        <button className="tf-foot-up" type="button" onClick={onFullView}><Icon name="chart" size={11} />Full view</button>
      </div>
    </aside>
  );
}
