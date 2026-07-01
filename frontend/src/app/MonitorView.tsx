import { useState } from "react";
import type { MonitorHistoryEntry, MonitorSnapshot } from "../features/connections/types";
import { Icon } from "./Icon";
import {
  buildMonitorBaselineInsights,
  buildMonitorCommandSafetyPack,
  buildMonitorCommands,
  buildMonitorEscalationBrief,
  buildMonitorEscalationWindow,
  buildMonitorForecast,
  buildMonitorHardeningGate,
  buildMonitorHealthScore,
  buildMonitorImpactWindow,
  buildMonitorIncidentPhase,
  buildMonitorMitigationBrief,
  buildMonitorMitigationPlan,
  buildMonitorRecoveryGate,
  buildMonitorRootCauseLens,
  buildMonitorRunbook,
  buildMonitorOpsBrief,
  buildMonitorRiskTimeline,
  buildMonitorVerificationChecklist,
  buildMonitorSessionReplay,
  buildMonitorSloBudget,
  evaluateMonitorAlerts,
  formatNetworkRate,
  monitorFreshness,
  primaryFilesystem,
  type MonitorHistory,
  type MonitorRules,
} from "./monitorSnapshot";

function availableMetricLabel(value: string | undefined, fallback: string) {
  return value && value.trim() ? value : fallback;
}

export function MonitorView({
  snapshot,
  history,
  persistedHistory,
  rules,
  onChangeRules,
  onRefreshMonitor,
  onCopyIncidentReport,
}: {
  snapshot: MonitorSnapshot | null;
  history: MonitorHistory;
  persistedHistory: MonitorHistoryEntry[];
  rules: MonitorRules;
  onChangeRules(rules: MonitorRules): void;
  onRefreshMonitor(): Promise<void> | void;
  onCopyIncidentReport(): Promise<string>;
}) {
  const [incidentStatus, setIncidentStatus] = useState("");
  const [incidentBusyAction, setIncidentBusyAction] = useState("");
  const freshness = monitorFreshness(snapshot);
  const alerts = evaluateMonitorAlerts(snapshot, rules);
  const cpu = snapshot?.cpuPercent ?? 0;
  const cpuIdle = snapshot?.cpuIdlePercent ?? 0;
  const cpuCores = snapshot?.cpuCores ?? 0;
  const mem = snapshot?.memoryPercent ?? 0;
  const disk = snapshot?.diskPercent ?? 0;
  const memoryTotal = availableMetricLabel(snapshot?.memoryTotalLabel, "--");
  const memoryUsed = availableMetricLabel(snapshot?.memoryUsedLabel, "--");
  const memoryAvailable = availableMetricLabel(snapshot?.memoryAvailableLabel, "--");
  const diskTotal = availableMetricLabel(snapshot?.diskTotalLabel, "--");
  const diskUsed = availableMetricLabel(snapshot?.diskUsedLabel, "--");
  const diskAvailable = availableMetricLabel(snapshot?.diskAvailableLabel, "--");
  const filesystems = snapshot?.filesystems ?? [];
  const networkInterfaces = snapshot?.networkInterfaces ?? [];
  const riskyFilesystem = primaryFilesystem(snapshot);
  const latestRx = history.networkRx[history.networkRx.length - 1] ?? 0;
  const latestTx = history.networkTx[history.networkTx.length - 1] ?? 0;
  const networkBars = history.networkRx.length ? history.networkRx : [0];
  const networkMax = Math.max(...networkBars, 1);
  const updatedLabel = snapshot?.updatedAt ? new Date(snapshot.updatedAt).toLocaleTimeString() : "not collected";
  const commands = buildMonitorCommands(snapshot);
  const latestPersistedSample = persistedHistory[0];
  const baselineInsights = buildMonitorBaselineInsights(snapshot, persistedHistory);
  const forecast = buildMonitorForecast(snapshot, persistedHistory, rules);
  const runbook = buildMonitorRunbook(snapshot, alerts, baselineInsights);
  const opsBrief = buildMonitorOpsBrief(snapshot, alerts, baselineInsights, forecast, runbook);
  const healthScore = buildMonitorHealthScore(snapshot, alerts, baselineInsights, forecast, runbook);
  const riskTimeline = buildMonitorRiskTimeline(persistedHistory, rules);
  const incidentPhase = buildMonitorIncidentPhase(snapshot, healthScore, forecast, riskTimeline);
  const escalationWindow = buildMonitorEscalationWindow(incidentPhase, healthScore, forecast, runbook);
  const recoveryGate = buildMonitorRecoveryGate(incidentPhase, healthScore, forecast, riskTimeline);
  const impactWindow = buildMonitorImpactWindow(riskTimeline);
  const rootCauseLens = buildMonitorRootCauseLens(alerts, baselineInsights, forecast, runbook, riskTimeline);
  const mitigationPlan = buildMonitorMitigationPlan(rootCauseLens, escalationWindow, recoveryGate, impactWindow, runbook);
  const commandSafetyPack = buildMonitorCommandSafetyPack(runbook, rootCauseLens, mitigationPlan);
  const verificationChecklist = buildMonitorVerificationChecklist(healthScore, forecast, riskTimeline, recoveryGate, impactWindow, commandSafetyPack);
  const sessionReplay = buildMonitorSessionReplay(riskTimeline, incidentPhase, impactWindow, verificationChecklist);
  const sloBudget = buildMonitorSloBudget(riskTimeline, impactWindow, verificationChecklist);
  const hardeningGate = buildMonitorHardeningGate(healthScore, recoveryGate, verificationChecklist, sloBudget, commandSafetyPack, sessionReplay);
  const mitigationBrief = buildMonitorMitigationBrief(snapshot, rootCauseLens, mitigationPlan, escalationWindow, recoveryGate, impactWindow);
  const escalationBrief = buildMonitorEscalationBrief(snapshot, incidentPhase, escalationWindow, healthScore, forecast, runbook);
  const hardeningBlockers = hardeningGate.items.filter((item) => item.status === "blocked").length;
  const hardeningWatchItems = hardeningGate.items.filter((item) => item.status === "watch").length;
  const commandNextAction = hardeningGate.actions[0] ?? escalationWindow.actions[0] ?? "Continue monitoring";
  const cards = [
    {
      label: "CPU",
      value: `${cpu}%`,
      sub: `load ${snapshot?.loadAverage ?? "--"}`,
      color: cpu > 85 ? "var(--red)" : "var(--green)",
      pct: cpu,
      details: [
        ["used", `${cpu}%`],
        ["idle", `${cpuIdle}%`],
        ["cores", cpuCores ? `${cpuCores}` : "--"],
        ["load", snapshot?.loadAverage ?? "--"],
      ],
    },
    {
      label: "Memory",
      value: `${mem}%`,
      sub: `${memoryUsed} used of ${memoryTotal}`,
      color: mem > 85 ? "var(--red)" : "var(--yellow)",
      pct: mem,
      details: [
        ["total", memoryTotal],
        ["used", memoryUsed],
        ["available", memoryAvailable],
      ],
    },
    {
      label: "Disk",
      value: `${disk}%`,
      sub: `${diskUsed} used of ${diskTotal}`,
      color: disk > 85 ? "var(--red)" : "var(--blue)",
      pct: disk,
      details: [
        ["total", diskTotal],
        ["used", diskUsed],
        ["free", diskAvailable],
      ],
    },
  ] as const;
  const processes = snapshot?.processes ?? [];
  const incidentBusy = incidentBusyAction !== "";
  const copyMonitorText = (text: string, successMessage: string) => {
    if (!navigator.clipboard?.writeText) {
      return Promise.reject(new Error("Clipboard is not available"));
    }
    return navigator.clipboard.writeText(text).then(() => successMessage);
  };
  const runMonitorAction = (
    actionId: string,
    pendingMessage: string,
    action: () => Promise<string> | string,
    failureMessage: string,
  ) => {
    setIncidentBusyAction(actionId);
    setIncidentStatus(pendingMessage);
    void Promise.resolve(action())
      .then((message) => setIncidentStatus(message))
      .catch(() => setIncidentStatus(failureMessage))
      .finally(() => setIncidentBusyAction(""));
  };

  return (
    <section className="view-stack">
      <div className="view-header">
        <Icon name="monitor" size={16} />
        <span className="view-header-title">Monitor</span>
        <span className={`tm-live ${freshness}`}><span className="tm-live-dot" /> {freshness === "live" ? "Live" : freshness}</span>
        <span className="monitor-updated">Updated {updatedLabel}</span>
      </div>
      <div className="monitor-wrap">
        <section className="monitor-stage monitor-stage-decision" aria-label="Monitor decision layer">
          <div className="monitor-stage-head">
            <span>Decision</span>
            <strong>Current incident posture and immediate actions</strong>
          </div>
        <section className={`monitor-flight-deck ${hardeningGate.status}`} aria-label="Monitor incident command" aria-busy={incidentBusy}>
          <div className="flight-decision">
            <span>Incident Command</span>
            <strong>{hardeningGate.label}</strong>
            <small>{hardeningGate.summary}</small>
          </div>
          <div className="flight-command">
            <div className="flight-next">
              <span>Next action</span>
              <strong>{commandNextAction}</strong>
            </div>
            <div className="flight-stats" aria-label="Monitor command stats">
              <span><strong>{hardeningBlockers}</strong> blockers</span>
              <span><strong>{hardeningWatchItems}</strong> watch</span>
              <span>SLO <strong>{sloBudget.label}</strong></span>
              <span>Active since <strong>{impactWindow.startedAtLabel}</strong></span>
            </div>
            <div className="flight-timeline" aria-label="Monitor command timeline">
              {sessionReplay.events.map((event) => (
                <span className={event.tone} key={event.id}>
                  <strong>{event.timeLabel}</strong>
                  {event.title}
                </span>
              ))}
            </div>
            <div className="flight-budget" aria-label="Monitor command budget">
              <span>{sloBudget.usedLabel}</span>
              <div><i style={{ width: sloBudget.status === "healthy" ? "0%" : "100%" }} /></div>
              <span>{sloBudget.remainingLabel}</span>
            </div>
          </div>
          <div className="flight-actions" aria-label="Monitor command actions">
            <button
              className={`flight-action primary${incidentBusyAction === "incident-report" ? " is-loading" : ""}`}
              type="button"
              disabled={incidentBusy}
              onClick={() => {
                runMonitorAction(
                  "incident-report",
                  "Collecting incident report...",
                  onCopyIncidentReport,
                  "Could not collect incident report",
                );
              }}
            >
              <Icon name="file" size={13} />{incidentBusyAction === "incident-report" ? "Collecting..." : "Incident Report"}
            </button>
            <button
              className={`flight-action${incidentBusyAction === "escalate" ? " is-loading" : ""}`}
              type="button"
              disabled={incidentBusy}
              onClick={() => {
                runMonitorAction(
                  "escalate",
                  "Copying escalation brief...",
                  () => copyMonitorText(escalationBrief, "Escalation brief copied"),
                  "Could not copy escalation brief",
                );
              }}
            >
              <Icon name="file" size={13} />{incidentBusyAction === "escalate" ? "Copying..." : "Escalate"}
            </button>
            <button
              className={`flight-action${incidentBusyAction === "recheck" ? " is-loading" : ""}`}
              type="button"
              disabled={incidentBusy}
              onClick={() => {
                runMonitorAction(
                  "recheck",
                  "Re-checking monitor sample...",
                  () => Promise.resolve(onRefreshMonitor()).then(() => "Monitor sample refreshed"),
                  "Could not refresh monitor sample",
                );
              }}
            >
              <Icon name="refresh" size={13} />{incidentBusyAction === "recheck" ? "Checking..." : "Re-check"}
            </button>
          </div>
        </section>
        <div className="monitor-actions">
          <button
            className="view-btn"
            type="button"
            disabled={incidentBusy}
            onClick={() => {
              runMonitorAction(
                "ops-brief",
                "Copying ops brief...",
                () => copyMonitorText(opsBrief, "Ops brief copied"),
                "Could not copy ops brief",
              );
            }}
          >
            <Icon name="file" size={13} />{incidentBusyAction === "ops-brief" ? "Copying..." : "Ops Brief"}
          </button>
          <button
            className="view-btn"
            type="button"
            disabled={incidentBusy}
            onClick={() => {
              runMonitorAction(
                "mitigation-brief",
                "Copying mitigation brief...",
                () => copyMonitorText(mitigationBrief, "Mitigation brief copied"),
                "Could not copy mitigation brief",
              );
            }}
          >
            <Icon name="file" size={13} />{incidentBusyAction === "mitigation-brief" ? "Copying..." : "Mitigation Brief"}
          </button>
          <button
            className="view-btn"
            type="button"
            disabled={incidentBusy}
            onClick={() => {
              runMonitorAction(
                "escalation-brief",
                "Copying escalation brief...",
                () => copyMonitorText(escalationBrief, "Escalation brief copied"),
                "Could not copy escalation brief",
              );
            }}
          >
            <Icon name="file" size={13} />{incidentBusyAction === "escalation-brief" ? "Copying..." : "Escalation Brief"}
          </button>
          <button
            className="view-btn primary"
            type="button"
            disabled={incidentBusy}
            onClick={() => {
              runMonitorAction(
                "secondary-incident-report",
                "Collecting incident report...",
                onCopyIncidentReport,
                "Could not collect incident report",
              );
            }}
          >
            <Icon name="file" size={13} />{incidentBusyAction === "secondary-incident-report" ? "Collecting..." : "Incident Report"}
          </button>
          {incidentStatus ? <span className="monitor-action-status">{incidentStatus}</span> : null}
        </div>
        <section className="monitor-rules" aria-label="Monitor rules">
          <div>
            <div className="monitor-rules-title">Watch Rules</div>
            <div className="monitor-rules-sub">
              Stored samples: {persistedHistory.length}
              {latestPersistedSample ? ` · latest ${latestPersistedSample.alertLevel}` : ""}
            </div>
          </div>
          <label>
            CPU warn
            <input type="number" min={1} max={100} value={rules.cpuWarn} onChange={(event) => onChangeRules({ ...rules, cpuWarn: Number(event.target.value) })} />
          </label>
          <label>
            MEM warn
            <input type="number" min={1} max={100} value={rules.memoryWarn} onChange={(event) => onChangeRules({ ...rules, memoryWarn: Number(event.target.value) })} />
          </label>
          <label>
            DISK warn
            <input type="number" min={1} max={100} value={rules.diskWarn} onChange={(event) => onChangeRules({ ...rules, diskWarn: Number(event.target.value) })} />
          </label>
        </section>
        <section className={`monitor-phase ${incidentPhase.status}`} aria-label="Incident phase">
          <div className="phase-kicker">Incident Phase</div>
          <div className="phase-main">
            <span className="phase-label">{incidentPhase.label}</span>
            <span className="phase-summary">{incidentPhase.summary}</span>
          </div>
          <div className="phase-evidence">
            {incidentPhase.evidence.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>
        <section className={`monitor-escalation ${escalationWindow.status}`} aria-label="Escalation window">
          <div className="escalation-deadline">
            <span>{escalationWindow.label}</span>
            <strong>{escalationWindow.deadline}</strong>
          </div>
          <div className="escalation-copy">
            <div className="escalation-title">Escalation Window</div>
            <div className="escalation-summary">{escalationWindow.summary}</div>
          </div>
          <div className="escalation-actions">
            {escalationWindow.actions.map((action) => (
              <span key={action}>{action}</span>
            ))}
          </div>
        </section>
        <section className={`monitor-recovery ${recoveryGate.status}`} aria-label="Recovery gate">
          <div className="recovery-status">
            <span>Recovery Gate</span>
            <strong>{recoveryGate.label}</strong>
          </div>
          <div className="recovery-copy">
            <div className="recovery-summary">{recoveryGate.summary}</div>
            {recoveryGate.actions.length ? (
              <div className="recovery-actions">
                {recoveryGate.actions.map((action) => (
                  <span key={action}>{action}</span>
                ))}
              </div>
            ) : null}
          </div>
          {recoveryGate.criteria.length ? (
            <div className="recovery-criteria">
              {recoveryGate.criteria.map((item) => (
                <span className={item.status} key={item.label}>
                  {item.label}: {item.detail}
                </span>
              ))}
            </div>
          ) : null}
        </section>
        <section className={`monitor-impact ${impactWindow.status}`} aria-label="Impact window">
          <div className="impact-status">
            <span>Impact Window</span>
            <strong>{impactWindow.label}</strong>
          </div>
          <div className="impact-range">
            <span>Start <strong>{impactWindow.startedAtLabel}</strong></span>
            <span>End <strong>{impactWindow.endedAtLabel}</strong></span>
            <span>Duration <strong>{impactWindow.durationLabel}</strong></span>
          </div>
          <div className="impact-copy">
            <div className="impact-summary">{impactWindow.summary}</div>
            <div className="impact-evidence">
              {impactWindow.evidence.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </section>
        </section>
        <section className="monitor-stage monitor-stage-evidence" aria-label="Monitor evidence layer">
          <div className="monitor-stage-head">
            <span>Evidence</span>
            <strong>Closeout signals, root cause, and safety evidence</strong>
          </div>
        <section className={`monitor-root-cause ${rootCauseLens.status}`} aria-label="Root cause lens">
          <div className="root-cause-status">
            <span>Root Cause Lens</span>
            <strong>{rootCauseLens.label}</strong>
            <small>{rootCauseLens.confidenceLabel} confidence</small>
          </div>
          <div className="root-cause-copy">
            <div className="root-cause-summary">{rootCauseLens.summary}</div>
            <div className="root-cause-evidence">
              {rootCauseLens.evidence.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
          <div className="root-cause-actions">
            {rootCauseLens.actions.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>
        <section className={`monitor-mitigation ${mitigationPlan.status}`} aria-label="Mitigation plan">
          <div className="mitigation-status">
            <span>Mitigation Plan</span>
            <strong>{mitigationPlan.label}</strong>
          </div>
          <div className="mitigation-copy">
            <div className="mitigation-summary">{mitigationPlan.summary}</div>
            <div className="mitigation-steps">
              {mitigationPlan.steps.map((step) => (
                <div className={`mitigation-step ${step.priority}`} key={step.id}>
                  <span>{step.priority}</span>
                  <strong>{step.title}</strong>
                  <small>{step.detail}</small>
                  <em>{step.guardrail}</em>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className={`monitor-command-safety ${commandSafetyPack.status}`} aria-label="Command safety pack">
          <div className="command-safety-status">
            <span>Command Safety Pack</span>
            <strong>{commandSafetyPack.status === "guarded" ? "Guarded" : commandSafetyPack.status}</strong>
          </div>
          <div className="command-safety-copy">
            <div className="command-safety-summary">{commandSafetyPack.summary}</div>
            <div className="command-safety-groups">
              {commandSafetyPack.groups.map((group) => (
                <div className={`command-safety-group ${group.level}`} key={group.level}>
                  <div className="command-safety-group-head">
                    <span>{group.label}</span>
                    <strong>{group.commands.length}</strong>
                  </div>
                  <small>{group.description}</small>
                  <div className="command-safety-command-list">
                    {group.commands.slice(0, 2).map((command) => (
                      <code key={`${group.level}-${command.label}`}>{command.label}: {command.command}</code>
                    ))}
                    {group.commands.length > 2 ? <em>+{group.commands.length - 2} more</em> : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="command-safety-guardrails">
              {commandSafetyPack.guardrails.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </section>
        <section className={`monitor-verification ${verificationChecklist.status}`} aria-label="Verification checklist">
          <div className="verification-status">
            <span>Verification Checklist</span>
            <strong>{verificationChecklist.label}</strong>
          </div>
          <div className="verification-copy">
            <div className="verification-summary">{verificationChecklist.summary}</div>
            <div className="verification-items">
              {verificationChecklist.items.map((item) => (
                <span className={item.status} key={item.id}>
                  {item.label}: {item.detail}
                </span>
              ))}
            </div>
            <div className="verification-actions">
              {verificationChecklist.actions.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </section>
        <section className={`monitor-session-replay ${sessionReplay.status}`} aria-label="Monitor session replay">
          <div className="session-replay-status">
            <span>Session Replay</span>
            <strong>{sessionReplay.label}</strong>
          </div>
          <div className="session-replay-copy">
            <div className="session-replay-summary">{sessionReplay.summary}</div>
            <div className="session-replay-events">
              {sessionReplay.events.map((event) => (
                <div className={`session-replay-event ${event.tone}`} key={event.id}>
                  <span>{event.timeLabel}</span>
                  <strong>{event.title}</strong>
                  <small>{event.detail}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className={`monitor-slo-budget ${sloBudget.status}`} aria-label="Monitor SLO budget">
          <div className="slo-budget-status">
            <span>Ops SLO</span>
            <strong>{sloBudget.label}</strong>
            <small>{sloBudget.targetLabel}</small>
          </div>
          <div className="slo-budget-copy">
            <div className="slo-budget-summary">{sloBudget.summary}</div>
            <div className="slo-budget-meter">
              <span>{sloBudget.usedLabel}</span>
              <span>{sloBudget.remainingLabel}</span>
            </div>
            <div className="slo-budget-indicators">
              {sloBudget.indicators.map((indicator) => (
                <span className={indicator.tone} key={indicator.id}>
                  {indicator.label}: {indicator.detail}
                </span>
              ))}
            </div>
            <div className="slo-budget-actions">
              {sloBudget.actions.map((action) => (
                <span key={action}>{action}</span>
              ))}
            </div>
          </div>
        </section>
        <section className={`monitor-hardening ${hardeningGate.status}`} aria-label="Monitor final hardening">
          <div className="hardening-status">
            <span>Final Hardening</span>
            <strong>{hardeningGate.label}</strong>
          </div>
          <div className="hardening-copy">
            <div className="hardening-summary">{hardeningGate.summary}</div>
            <div className="hardening-items">
              {hardeningGate.items.map((item) => (
                <span className={item.status} key={item.id}>
                  {item.label}: {item.detail}
                </span>
              ))}
            </div>
            <div className="hardening-actions">
              {hardeningGate.actions.map((action) => (
                <span key={action}>{action}</span>
              ))}
            </div>
          </div>
        </section>
        <section className={`monitor-health ${healthScore.status}`} aria-label="Monitor health score">
          <div className="health-score-ring" aria-label={`Health score ${healthScore.score} out of 100`}>
            <span>{healthScore.score}</span>
            <small>/100</small>
          </div>
          <div className="health-score-copy">
            <div className="health-score-head">
              <div>
                <div className="health-score-title">Health Score</div>
                <div className="health-score-summary">{healthScore.summary}</div>
              </div>
              <span className="health-score-status">{healthScore.status}</span>
            </div>
            <div className="health-score-factors">
              {healthScore.factors.map((factor) => (
                <span key={factor}>{factor}</span>
              ))}
            </div>
          </div>
        </section>
        </section>
        <section className="monitor-stage monitor-stage-details" aria-label="Monitor details layer">
          <div className="monitor-stage-head">
            <span>Details</span>
            <strong>Timeline, forecasts, runbooks, and raw host metrics</strong>
          </div>
        <section className={`monitor-timeline ${riskTimeline.status}`} aria-label="Risk timeline">
          <div className="timeline-head">
            <div>
              <div className="timeline-title">Risk Timeline</div>
              <div className="timeline-summary">{riskTimeline.summary}</div>
            </div>
            <div className="timeline-count">{riskTimeline.sampleCount} samples</div>
          </div>
          {riskTimeline.entries.length ? (
            <div className="timeline-list">
              {riskTimeline.entries.map((entry) => (
                <article className={`timeline-entry ${entry.tone}`} key={entry.id}>
                  <div className="timeline-time">{entry.timeLabel}</div>
                  <div className="timeline-entry-body">
                    <div className="timeline-entry-head">
                      <span className="timeline-entry-summary">{entry.summary}</span>
                      <span className="timeline-entry-tone">{entry.tone}</span>
                    </div>
                    <div className="timeline-metrics">
                      {entry.metrics.map((metric) => (
                        <span className={`timeline-metric ${metric.tone}`} key={metric.id}>
                          <span>{metric.label}</span>
                          <strong>{metric.value}%</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
        <section className={`monitor-baseline ${baselineInsights.status}`} aria-label="Baseline insights">
          <div className="baseline-head">
            <div>
              <div className="baseline-title">Baseline Insights</div>
              <div className="baseline-summary">{baselineInsights.summary}</div>
            </div>
            <div className="baseline-count">{baselineInsights.sampleCount} samples</div>
          </div>
          {baselineInsights.metrics.length ? (
            <div className="baseline-grid">
              {baselineInsights.metrics.map((metric) => (
                <div className={`baseline-metric ${metric.tone}`} key={metric.id}>
                  <span className="baseline-metric-label">{metric.label}</span>
                  <span className="baseline-metric-value">{metric.current}%</span>
                  <span className="baseline-metric-detail">{metric.detail}</span>
                  <span className="baseline-metric-average">avg {metric.average}%</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
        <section className={`monitor-forecast ${forecast.status}`} aria-label="Trend forecast">
          <div className="forecast-head">
            <div>
              <div className="forecast-title">Trend Forecast</div>
              <div className="forecast-summary">{forecast.summary}</div>
            </div>
            <div className="forecast-count">{forecast.sampleCount} timed samples</div>
          </div>
          {forecast.metrics.length ? (
            <div className="forecast-grid">
              {forecast.metrics.map((metric) => (
                <div className={`forecast-metric ${metric.tone}`} key={metric.id}>
                  <span className="forecast-metric-label">{metric.label}</span>
                  <span className="forecast-metric-value">{metric.changePerHour > 0 ? "+" : ""}{metric.changePerHour} pts/hr</span>
                  <span className="forecast-metric-detail">{metric.detail}</span>
                  <span className="forecast-metric-eta">{metric.etaLabel}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
        {!snapshot ? (
          <div className="monitor-empty">
            <div className="monitor-empty-title">No trusted monitor sample yet</div>
            <div className="monitor-empty-sub">Metrics are collected through the active SSH session. Empty data is shown as empty, not simulated.</div>
          </div>
        ) : null}
        <section className="monitor-alerts" aria-label="Monitor alerts">
          {alerts.map((alert) => (
            <article className={`monitor-alert ${alert.severity}`} key={alert.id}>
              <div className="monitor-alert-k">{alert.severity}</div>
              <div>
                <div className="monitor-alert-title">{alert.title}</div>
                <div className="monitor-alert-detail">{alert.detail}</div>
              </div>
            </article>
          ))}
        </section>
        <section className={`monitor-runbook ${runbook.status}`} aria-label="Runbook advisor">
          <div className="runbook-head">
            <div>
              <div className="runbook-title">Runbook Advisor</div>
              <div className="runbook-summary">{runbook.summary}</div>
            </div>
            <div className="runbook-count">{runbook.steps.length} steps</div>
          </div>
          <div className="runbook-steps">
            {runbook.steps.map((step) => (
              <article className={`runbook-step ${step.priority}`} key={step.id}>
                <div className="runbook-step-head">
                  <span className="runbook-priority">{step.priority}</span>
                  <span className="runbook-step-title">{step.title}</span>
                </div>
                <div className="runbook-rationale">{step.rationale}</div>
                <div className="runbook-commands">
                  {step.commands.map((command) => (
                    <button
                      className="runbook-command"
                      key={`${step.id}-${command.label}`}
                      type="button"
                      title="Copy command"
                      onClick={() => void navigator.clipboard?.writeText(command.command)}
                    >
                      <span>{command.label}</span>
                      <code>{command.command}</code>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
        <div className="monitor-cards">
          {cards.map(({ label, value, sub, color, pct, details }) => (
            <article className="monitor-card" key={label}>
              <div className="mc-label">{label}</div>
              <div className="mc-value">{value}</div>
              <div className="mc-sub">{sub}</div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
              </div>
              <div className="mc-stats">
                {details.map(([name, detailValue]) => (
                  <span className="mc-stat" key={name}>
                    <span className="mc-stat-label">{name}</span>
                    <span className="mc-stat-value">{detailValue}</span>
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
        <div className="monitor-bottom">
          <section className="monitor-section">
            <div className="ms-header">Processes</div>
            {processes.length ? processes.map((process) => (
              <div className="proc-row" key={`${process.name}-${process.pid}`}>
                <span className="proc-name">{process.name}</span>
                <span className="proc-pid">{process.pid}</span>
                <span className="proc-cpu">{process.cpuPercent.toFixed(1)}%</span>
                <span className="proc-mem">{process.memory}</span>
              </div>
            )) : <div className="monitor-section-empty">No process sample returned.</div>}
          </section>
          <section className="monitor-section">
            <div className="ms-header">Network</div>
            <div className="monitor-network-rate">↓ {formatNetworkRate(latestRx)} · ↑ {formatNetworkRate(latestTx)}</div>
            <div className="chart-area">
              <div className="mini-chart">
                {networkBars.map((height, index) => (
                  <span
                    className="chart-bar"
                    key={index}
                    style={{ height: `${Math.max(4, (height / networkMax) * 100)}%`, background: index % 3 === 0 ? "var(--teal)" : "var(--blue)" }}
                  />
                ))}
              </div>
            </div>
            <div className="monitor-net-list">
              {networkInterfaces.length ? networkInterfaces.map((item) => (
                <span key={item.name}>{item.name}: rx {item.rxLabel} · tx {item.txLabel}</span>
              )) : <span>No network counters returned.</span>}
            </div>
          </section>
          <section className="monitor-section">
            <div className="ms-header">Filesystems</div>
            {filesystems.length ? filesystems.map((filesystem) => (
              <div className={`fs-row${filesystem.mount === riskyFilesystem?.mount ? " risky" : ""}`} key={`${filesystem.filesystem}-${filesystem.mount}`}>
                <span className="fs-mount">{filesystem.mount}</span>
                <span className="fs-type">{filesystem.type || "--"}</span>
                <span className="fs-used">{filesystem.usedLabel || "--"} / {filesystem.totalLabel || "--"}</span>
                <span className="fs-pct">{filesystem.percent}%</span>
              </div>
            )) : <div className="monitor-section-empty">No filesystem sample returned.</div>}
          </section>
          <section className="monitor-section">
            <div className="ms-header">Triage Commands</div>
            <div className="triage-list">
              {commands.map((item) => (
                <button
                  className="triage-command"
                  key={item.label}
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(item.command)}
                  title="Copy command"
                >
                  <span>{item.label}</span>
                  <code>{item.command}</code>
                </button>
              ))}
            </div>
          </section>
        </div>
        </section>
      </div>
    </section>
  );
}
