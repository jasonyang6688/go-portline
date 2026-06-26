type MonitorNetworkInterface = {
  name: string;
  rxBytes?: number;
  txBytes?: number;
};

type MonitorFilesystem = {
  filesystem?: string;
  type?: string;
  mount: string;
  percent: number;
  totalLabel?: string;
  usedLabel?: string;
  availableLabel?: string;
};

type MonitorSnapshotLike = {
  cpuPercent: number;
  cpuCores?: number;
  memoryPercent?: number;
  diskPercent?: number;
  loadAverage?: string;
  filesystems?: MonitorFilesystem[];
  networkInterfaces?: MonitorNetworkInterface[];
  updatedAt?: string;
};

type MonitorHistoryEntryLike = {
  id?: string | number;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  alertLevel?: string;
  createdAt?: string;
};

export type MonitorFreshness = "waiting" | "live" | "stale";

export type MonitorAlert = {
  id: string;
  severity: "ok" | "warn" | "critical";
  title: string;
  detail: string;
};

export type MonitorBaselineMetric = {
  id: "cpu" | "memory" | "disk";
  label: string;
  current: number;
  average: number;
  delta: number;
  tone: "stable" | "ok" | "warn" | "critical";
  detail: string;
};

export type MonitorBaselineInsights = {
  status: "waiting" | "learning" | "stable" | "shift";
  sampleCount: number;
  summary: string;
  metrics: MonitorBaselineMetric[];
};

export type MonitorRunbookCommand = {
  label: string;
  command: string;
};

export type MonitorRunbookStep = {
  id: string;
  priority: "now" | "next" | "watch";
  title: string;
  rationale: string;
  commands: MonitorRunbookCommand[];
};

export type MonitorRunbook = {
  status: "waiting" | "watching" | "ready";
  summary: string;
  steps: MonitorRunbookStep[];
};

export type MonitorForecastMetric = {
  id: "cpu" | "memory" | "disk";
  label: string;
  current: number;
  changePerHour: number;
  threshold: number;
  etaLabel: string;
  tone: "stable" | "ok" | "warn" | "critical";
  detail: string;
};

export type MonitorForecast = {
  status: "waiting" | "learning" | "steady" | "rising";
  sampleCount: number;
  summary: string;
  metrics: MonitorForecastMetric[];
};

export type MonitorHealthScore = {
  score: number;
  status: "healthy" | "watch" | "degraded" | "critical";
  summary: string;
  factors: string[];
};

export type MonitorRiskTimelineMetric = {
  id: "cpu" | "memory" | "disk";
  label: string;
  value: number;
  tone: "ok" | "warn" | "critical";
};

export type MonitorRiskTimelineEntry = {
  id: string;
  createdAt: string;
  timeLabel: string;
  tone: "ok" | "warn" | "critical";
  summary: string;
  metrics: MonitorRiskTimelineMetric[];
};

export type MonitorRiskTimeline = {
  status: "empty" | "ready";
  sampleCount: number;
  summary: string;
  entries: MonitorRiskTimelineEntry[];
};

export type MonitorIncidentPhase = {
  status: "waiting" | "stable" | "active" | "worsening" | "recovering";
  label: string;
  summary: string;
  evidence: string[];
};

export type MonitorEscalationWindow = {
  status: "waiting" | "none" | "watch" | "triage" | "page";
  label: string;
  deadline: string;
  summary: string;
  actions: string[];
};

export type MonitorRecoveryGateCriterion = {
  label: string;
  status: "passed" | "blocked";
  detail: string;
};

export type MonitorRecoveryGate = {
  status: "waiting" | "blocked" | "watch" | "ready";
  label: string;
  summary: string;
  criteria: MonitorRecoveryGateCriterion[];
  actions: string[];
};

export type MonitorImpactWindow = {
  status: "waiting" | "none" | "active" | "recovered";
  label: string;
  startedAtLabel: string;
  endedAtLabel: string;
  durationLabel: string;
  summary: string;
  evidence: string[];
};

export type MonitorRootCauseLens = {
  status: "waiting" | "clear" | "focused" | "multi_signal";
  label: string;
  confidenceLabel: "Waiting" | "Clean" | "Low" | "Medium" | "High";
  summary: string;
  evidence: string[];
  actions: string[];
};

export type MonitorMitigationStep = {
  id: "mitigate" | "verify" | "communicate" | "watch";
  priority: "now" | "next" | "verify";
  title: string;
  detail: string;
  guardrail: string;
};

export type MonitorMitigationPlan = {
  status: "waiting" | "standby" | "ready" | "urgent";
  label: string;
  summary: string;
  steps: MonitorMitigationStep[];
};

export type MonitorCommandSafetyLevel = "read_only" | "low_risk" | "high_risk";

export type MonitorSafeCommand = {
  label: string;
  command: string;
  sourceStep: string;
  safetyNote: string;
};

export type MonitorCommandSafetyGroup = {
  level: MonitorCommandSafetyLevel;
  label: string;
  description: string;
  commands: MonitorSafeCommand[];
};

export type MonitorCommandSafetyPack = {
  status: "waiting" | "ready" | "guarded";
  summary: string;
  groups: MonitorCommandSafetyGroup[];
  guardrails: string[];
};

export type MonitorVerificationItem = {
  id: "health" | "forecast" | "latest" | "impact" | "commands" | "gate";
  label: string;
  status: "passed" | "blocked";
  detail: string;
};

export type MonitorVerificationChecklist = {
  status: "waiting" | "blocked" | "ready";
  label: string;
  summary: string;
  items: MonitorVerificationItem[];
  actions: string[];
};

export type MonitorSessionReplayEvent = {
  id: "start" | "latest" | "recovery" | "phase" | "closeout";
  timeLabel: string;
  tone: "ok" | "warn" | "critical";
  title: string;
  detail: string;
};

export type MonitorSessionReplay = {
  status: "waiting" | "clean" | "active" | "recovered";
  label: string;
  summary: string;
  events: MonitorSessionReplayEvent[];
};

export type MonitorSloBudgetIndicator = {
  id: "impact" | "budget" | "closeout";
  label: string;
  tone: "ok" | "warn" | "critical";
  detail: string;
};

export type MonitorSloBudget = {
  status: "waiting" | "healthy" | "watch" | "breached";
  label: string;
  targetLabel: string;
  usedLabel: string;
  remainingLabel: string;
  summary: string;
  indicators: MonitorSloBudgetIndicator[];
  actions: string[];
};

export type MonitorHardeningItem = {
  id: "health" | "recovery" | "verification" | "slo" | "replay" | "commands";
  label: string;
  status: "passed" | "watch" | "blocked";
  detail: string;
};

export type MonitorHardeningGate = {
  status: "waiting" | "locked" | "review" | "ready";
  label: string;
  summary: string;
  items: MonitorHardeningItem[];
  actions: string[];
};

export type MonitorRules = {
  cpuWarn: number;
  cpuCritical: number;
  memoryWarn: number;
  memoryCritical: number;
  diskWarn: number;
  diskCritical: number;
  loadPerCoreWarn: number;
  loadPerCoreCritical: number;
};

export const DEFAULT_MONITOR_RULES: MonitorRules = {
  cpuWarn: 85,
  cpuCritical: 95,
  memoryWarn: 85,
  memoryCritical: 90,
  diskWarn: 80,
  diskCritical: 90,
  loadPerCoreWarn: 1.5,
  loadPerCoreCritical: 2,
};

export type MonitorHistory = {
  cpu: number[];
  networkRx: number[];
  networkTx: number[];
  lastNetworkBytes: Record<string, { rxBytes: number; txBytes: number }>;
  lastSampleAt: number | null;
};

export function createMonitorHistory(): MonitorHistory {
  return {
    cpu: [],
    networkRx: [],
    networkTx: [],
    lastNetworkBytes: {},
    lastSampleAt: null,
  };
}

export function appendMonitorHistory(
  current: MonitorHistory,
  snapshot: MonitorSnapshotLike | null,
  maxSamples = 28,
  sampledAt = Date.now(),
): MonitorHistory {
  if (!snapshot) {
    return current;
  }

  const elapsedSeconds = current.lastSampleAt ? Math.max((sampledAt - current.lastSampleAt) / 1000, 1) : 0;
  let rxBytesPerSecond = 0;
  let txBytesPerSecond = 0;
  const nextNetworkBytes: MonitorHistory["lastNetworkBytes"] = {};

  for (const item of snapshot.networkInterfaces ?? []) {
    const rxBytes = Math.max(0, Number(item.rxBytes ?? 0));
    const txBytes = Math.max(0, Number(item.txBytes ?? 0));
    const previous = current.lastNetworkBytes[item.name];
    if (previous && elapsedSeconds > 0) {
      rxBytesPerSecond += Math.max(0, rxBytes - previous.rxBytes) / elapsedSeconds;
      txBytesPerSecond += Math.max(0, txBytes - previous.txBytes) / elapsedSeconds;
    }
    nextNetworkBytes[item.name] = { rxBytes, txBytes };
  }

  return {
    cpu: trimSamples([...current.cpu, snapshot.cpuPercent], maxSamples),
    networkRx: trimSamples([...current.networkRx, Math.round(rxBytesPerSecond)], maxSamples),
    networkTx: trimSamples([...current.networkTx, Math.round(txBytesPerSecond)], maxSamples),
    lastNetworkBytes: nextNetworkBytes,
    lastSampleAt: sampledAt,
  };
}

export function monitorFreshness(
  snapshot: { updatedAt?: string } | null,
  now = Date.now(),
  staleAfterMs = 15_000,
): MonitorFreshness {
  if (!snapshot?.updatedAt) {
    return "waiting";
  }
  const updatedAt = Date.parse(snapshot.updatedAt);
  if (!Number.isFinite(updatedAt)) {
    return "waiting";
  }
  return now - updatedAt > staleAfterMs ? "stale" : "live";
}

export function formatNetworkRate(bytesPerSecond: number): string {
  const value = Math.max(0, bytesPerSecond);
  if (value < 1024) {
    return `${Math.round(value)} B/s`;
  }
  const kib = value / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KB/s`;
  }
  const mib = kib / 1024;
  if (mib < 1024) {
    return `${mib.toFixed(1)} MB/s`;
  }
  return `${(mib / 1024).toFixed(1)} GB/s`;
}

export function primaryFilesystem(snapshot: { filesystems?: MonitorFilesystem[] } | null): MonitorFilesystem | null {
  const filesystems = snapshot?.filesystems ?? [];
  if (filesystems.length === 0) {
    return null;
  }
  return [...filesystems].sort((left, right) => right.percent - left.percent)[0];
}

export function buildMonitorCommands(snapshot: { filesystems?: MonitorFilesystem[] } | null): Array<{ label: string; command: string }> {
  const filesystem = primaryFilesystem(snapshot);
  const diskPath = filesystem?.mount && filesystem.mount !== "/" ? filesystem.mount : "/";
  return [
    { label: "Load", command: "uptime && cat /proc/loadavg" },
    { label: "Top CPU", command: "ps -eo pid,ppid,user,comm,pcpu,pmem,rss --sort=-pcpu | head -15" },
    { label: "Filesystems", command: "df -hT && df -ih" },
    { label: "Largest paths", command: `du -xhd1 ${shellQuote(diskPath)} 2>/dev/null | sort -h | tail -20` },
    { label: "Sockets", command: "ss -tunap | head -40" },
    { label: "Recent errors", command: "journalctl -p err -n 80 --no-pager" },
  ];
}

export function evaluateMonitorAlerts(snapshot: MonitorSnapshotLike | null, rules: MonitorRules = DEFAULT_MONITOR_RULES): MonitorAlert[] {
  if (!snapshot) {
    return [{
      id: "waiting",
      severity: "warn",
      title: "Waiting for monitor sample",
      detail: "No trusted host metrics have been collected for this session yet.",
    }];
  }

  const alerts: MonitorAlert[] = [];
  if (snapshot.cpuPercent >= rules.cpuWarn) {
    alerts.push({
      id: "cpu",
      severity: snapshot.cpuPercent >= rules.cpuCritical ? "critical" : "warn",
      title: "High CPU usage",
      detail: `CPU is at ${snapshot.cpuPercent}%. Check the top CPU processes before restarting services.`,
    });
  }

  const memoryPercent = snapshot.memoryPercent ?? 0;
  if (memoryPercent >= rules.memoryWarn) {
    alerts.push({
      id: "memory",
      severity: memoryPercent >= rules.memoryCritical ? "critical" : "warn",
      title: "High memory pressure",
      detail: `Memory usage is at ${memoryPercent}%. Confirm whether cache growth or a process leak is driving it.`,
    });
  }

  for (const filesystem of snapshot.filesystems ?? []) {
    if (filesystem.percent < rules.diskWarn) {
      continue;
    }
    alerts.push({
      id: `filesystem:${filesystem.mount}`,
      severity: filesystem.percent >= rules.diskCritical ? "critical" : "warn",
      title: `Filesystem ${filesystem.mount} is ${filesystem.percent}% full`,
      detail: `${filesystem.mount} has ${filesystem.availableLabel || "limited"} free. Inspect large paths and inode usage before deleting files.`,
    });
  }

  const oneMinuteLoad = Number((snapshot.loadAverage ?? "").trim().split(/\s+/)[0]);
  const cores = snapshot.cpuCores ?? 0;
  if (Number.isFinite(oneMinuteLoad) && cores > 0 && oneMinuteLoad >= cores * rules.loadPerCoreWarn) {
    alerts.push({
      id: "load",
      severity: oneMinuteLoad >= cores * rules.loadPerCoreCritical ? "critical" : "warn",
      title: "Load is high for core count",
      detail: `1-minute load is ${oneMinuteLoad.toFixed(2)} on ${cores} cores. Compare CPU wait, process queue, and disk IO symptoms.`,
    });
  }

  if (alerts.length > 0) {
    return alerts;
  }
  return [{
    id: "healthy",
    severity: "ok",
    title: "No active monitor alerts",
    detail: "Current CPU, memory, load, and filesystem samples are inside the default guardrails.",
  }];
}

export function buildMonitorBaselineInsights(
  snapshot: MonitorSnapshotLike | null,
  history: MonitorHistoryEntryLike[],
  minSamples = 3,
): MonitorBaselineInsights {
  if (!snapshot) {
    return {
      status: "waiting",
      sampleCount: history.length,
      summary: "Waiting for a trusted monitor sample before comparing against history.",
      metrics: [],
    };
  }

  if (history.length < minSamples) {
    return {
      status: "learning",
      sampleCount: history.length,
      summary: "Collecting more samples before comparing against a local baseline.",
      metrics: [],
    };
  }

  const baselineSamples = history.length > minSamples ? history.slice(1, 25) : history.slice(0, 25);
  const metrics = [
    baselineMetric("cpu", "CPU", snapshot.cpuPercent, average(baselineSamples.map((entry) => entry.cpuPercent))),
    baselineMetric("memory", "Memory", snapshot.memoryPercent ?? 0, average(baselineSamples.map((entry) => entry.memoryPercent))),
    baselineMetric("disk", "Disk", snapshot.diskPercent ?? primaryFilesystem(snapshot)?.percent ?? 0, average(baselineSamples.map((entry) => entry.diskPercent))),
  ];

  const largestShift = [...metrics].sort((left, right) => right.delta - left.delta)[0];
  const shifted = metrics.some((metric) => metric.tone === "warn" || metric.tone === "critical");
  if (shifted && largestShift.delta > 0) {
    return {
      status: "shift",
      sampleCount: history.length,
      summary: `${largestShift.label} is ${largestShift.delta} pts above its recent baseline.`,
      metrics,
    };
  }

  return {
    status: "stable",
    sampleCount: history.length,
    summary: "Current sample is close to the recent local baseline.",
    metrics,
  };
}

export function buildMonitorRunbook(
  snapshot: MonitorSnapshotLike | null,
  alerts: MonitorAlert[],
  baseline: MonitorBaselineInsights,
): MonitorRunbook {
  if (!snapshot) {
    return {
      status: "waiting",
      summary: "Open a live session before building a runbook.",
      steps: [],
    };
  }

  const alertIds = new Set(alerts.map((alert) => alert.id));
  const shiftedMetrics = new Set(
    baseline.metrics
      .filter((metric) => metric.tone === "warn" || metric.tone === "critical")
      .map((metric) => metric.id),
  );
  const steps: MonitorRunbookStep[] = [];
  const hasCpuSignal = alertIds.has("cpu") || alertIds.has("load") || shiftedMetrics.has("cpu");
  if (hasCpuSignal) {
    steps.push({
      id: "cpu-load",
      priority: "now",
      title: "Confirm CPU and scheduler pressure",
      rationale: "CPU or load is outside guardrails. Identify hot processes and decide whether this is saturation, IO wait, or expected batch work before restarting services.",
      commands: [
        { label: "Top CPU", command: "ps -eo pid,ppid,user,comm,pcpu,pmem,rss --sort=-pcpu | head -20" },
        { label: "Load + uptime", command: "uptime && cat /proc/loadavg" },
        { label: "CPU counters", command: "vmstat 1 5" },
      ],
    });
  }

  const hasMemorySignal = alertIds.has("memory") || shiftedMetrics.has("memory");
  if (hasMemorySignal) {
    steps.push({
      id: "memory",
      priority: steps.length === 0 ? "now" : "next",
      title: "Check memory pressure and OOM risk",
      rationale: "Memory is high or drifting above baseline. Separate reclaimable cache from process growth, then check for recent OOM kills.",
      commands: [
        { label: "Memory summary", command: "free -h && vmstat -s | head -20" },
        { label: "Top RSS", command: "ps -eo pid,user,comm,rss,pmem --sort=-rss | head -20" },
        { label: "OOM events", command: "journalctl -k -n 120 --no-pager | grep -i -E 'oom|killed process' || true" },
      ],
    });
  }

  const filesystemAlerts = alerts.filter((alert) => alert.id.startsWith("filesystem:"));
  const filesystem = primaryFilesystem(snapshot);
  if (filesystemAlerts.length > 0 || shiftedMetrics.has("disk")) {
    const mount = filesystem?.mount ?? "/";
    steps.push({
      id: `filesystem:${mount}`,
      priority: steps.length === 0 ? "now" : "next",
      title: `Inspect filesystem growth on ${mount}`,
      rationale: "Disk pressure can turn into write failures. Check filesystem and inode usage before deleting or rotating data.",
      commands: [
        { label: "Disk + inodes", command: "df -hT && df -ih" },
        { label: "Largest paths", command: `du -xhd1 ${shellQuote(mount)} 2>/dev/null | sort -h | tail -20` },
        { label: "Recent large files", command: `find ${shellQuote(mount)} -xdev -type f -size +500M -printf '%s %p\\n' 2>/dev/null | sort -n | tail -20` },
      ],
    });
  }

  if (steps.length === 0) {
    return {
      status: "watching",
      summary: "No active runbook actions. Keep collecting samples and watch for baseline drift.",
      steps: [{
        id: "watch-baseline",
        priority: "watch",
        title: "Keep watching the local baseline",
        rationale: "Current metrics are inside guardrails. Use this command pair if the host feels slow despite a clean monitor.",
        commands: [
          { label: "Quick health", command: "uptime && df -hT && free -h" },
          { label: "Recent errors", command: "journalctl -p err -n 50 --no-pager" },
        ],
      }],
    };
  }

  const meaningfulAlertCount = alerts.filter((alert) => alert.id !== "healthy" && alert.id !== "waiting").length;
  const baselineOnlySignals = [...shiftedMetrics].filter((metric) => {
    if (metric === "cpu") {
      return !alertIds.has("cpu") && !alertIds.has("load");
    }
    if (metric === "disk") {
      return filesystemAlerts.length === 0;
    }
    return !alertIds.has(metric);
  }).length;
  return {
    status: "ready",
    summary: `${meaningfulAlertCount + baselineOnlySignals} signals need attention. Start with ${hasCpuSignal ? "CPU or load" : steps[0].title.toLowerCase()} before changing services.`,
    steps,
  };
}

export function buildMonitorForecast(
  snapshot: MonitorSnapshotLike | null,
  history: MonitorHistoryEntryLike[],
  rules: MonitorRules,
  minSamples = 3,
): MonitorForecast {
  if (!snapshot) {
    return {
      status: "waiting",
      sampleCount: history.length,
      summary: "Waiting for a trusted monitor sample before estimating trend.",
      metrics: [],
    };
  }

  const samples = timestampedSamples(history);
  if (samples.length < minSamples) {
    return {
      status: "learning",
      sampleCount: samples.length,
      summary: "Collecting timestamped samples before estimating trend.",
      metrics: [],
    };
  }

  const metrics = [
    forecastMetric("cpu", "CPU", snapshot.cpuPercent, rules.cpuCritical, samples),
    forecastMetric("memory", "Memory", snapshot.memoryPercent ?? 0, rules.memoryCritical, samples),
    forecastMetric("disk", "Disk", snapshot.diskPercent ?? primaryFilesystem(snapshot)?.percent ?? 0, rules.diskCritical, samples),
  ];
  const riskiest = [...metrics].sort((left, right) => forecastRiskScore(right) - forecastRiskScore(left))[0];
  if (riskiest.tone === "warn" || riskiest.tone === "critical") {
    return {
      status: "rising",
      sampleCount: samples.length,
      summary: `${riskiest.label} is rising ${formatTrendRateMagnitude(riskiest.changePerHour)}; critical in ${riskiest.etaLabel}.`,
      metrics,
    };
  }

  return {
    status: "steady",
    sampleCount: samples.length,
    summary: "No resource is trending quickly toward its critical threshold.",
    metrics,
  };
}

export function buildMonitorOpsBrief(
  snapshot: MonitorSnapshotLike | null,
  alerts: MonitorAlert[],
  baseline: MonitorBaselineInsights,
  forecast: MonitorForecast,
  runbook: MonitorRunbook,
): string {
  if (!snapshot) {
    return "# Monitor Ops Brief\n\nNo trusted monitor sample has been collected yet.";
  }

  const lines = [
    "# Monitor Ops Brief",
    "",
    `Updated: ${snapshot.updatedAt ?? "unknown"}`,
    "",
    "## Current Sample",
    `- CPU: ${snapshot.cpuPercent}%`,
    `- Memory: ${snapshot.memoryPercent ?? 0}%`,
    `- Disk: ${snapshot.diskPercent ?? primaryFilesystem(snapshot)?.percent ?? 0}%`,
    `- Load average: ${snapshot.loadAverage ?? "unknown"}`,
    "",
    "## Active Alerts",
    ...formatAlertLines(alerts),
    "",
    "## Baseline Insights",
    `- ${baseline.summary}`,
    ...baseline.metrics.map((metric) => `- ${metric.label}: ${metric.current}% (${metric.detail}, avg ${metric.average}%)`),
    "",
    "## Trend Forecast",
    `- ${forecast.summary}`,
    ...forecast.metrics.map((metric) => `- ${metric.label}: ${formatTrendRate(metric.changePerHour)} toward ${metric.threshold}% (${metric.etaLabel})`),
    "",
    "## Runbook Advisor",
    `- ${runbook.summary}`,
    ...runbook.steps.flatMap((step, index) => [
      `${index + 1}. [${step.priority}] ${step.title}`,
      `   - ${step.rationale}`,
      ...step.commands.map((command) => `   - ${command.label}: \`${command.command}\``),
    ]),
  ];
  return lines.join("\n");
}

export function buildMonitorEscalationBrief(
  snapshot: MonitorSnapshotLike | null,
  phase: MonitorIncidentPhase,
  escalation: MonitorEscalationWindow,
  healthScore: MonitorHealthScore,
  forecast: MonitorForecast,
  runbook: MonitorRunbook,
): string {
  if (!snapshot) {
    return "# Monitor Escalation Brief\n\nNo trusted monitor sample has been collected yet.";
  }

  const firstStep = runbook.steps.find((step) => step.priority === "now") ?? runbook.steps[0];
  const lines = [
    "# Monitor Escalation Brief",
    "",
    `Updated: ${snapshot.updatedAt ?? "unknown"}`,
    "",
    "## Decision",
    `- Phase: ${phase.label}`,
    `- Escalation: ${escalation.label} (${escalation.deadline})`,
    `- Health score: ${healthScore.score}/100`,
    `- Forecast: ${forecast.summary}`,
    "",
    "## Evidence",
    ...phase.evidence.map((item) => `- ${item}`),
    ...healthScore.factors.map((factor) => `- ${factor}`),
    "",
    "## Actions",
    ...escalation.actions.map((action, index) => `${index + 1}. ${action}`),
    "",
    "## Runbook",
    `- ${runbook.summary}`,
    firstStep ? `- First runbook step: ${firstStep.title}` : "- First runbook step: none",
    ...(firstStep?.commands ?? []).map((command) => `  - ${command.label}: \`${command.command}\``),
  ];
  return lines.join("\n");
}

export function buildMonitorMitigationBrief(
  snapshot: MonitorSnapshotLike | null,
  rootCause: MonitorRootCauseLens,
  mitigation: MonitorMitigationPlan,
  escalation: MonitorEscalationWindow,
  recovery: MonitorRecoveryGate,
  impact: MonitorImpactWindow,
): string {
  if (!snapshot) {
    return "# Monitor Mitigation Brief\n\nNo trusted monitor sample has been collected yet.";
  }

  const lines = [
    "# Monitor Mitigation Brief",
    "",
    `Updated: ${snapshot.updatedAt ?? "unknown"}`,
    "",
    "## Decision",
    `- Root cause: ${rootCause.label} (${rootCause.confidenceLabel} confidence)`,
    `- Mitigation: ${mitigation.label}`,
    `- Escalation: ${escalation.label} (${escalation.deadline})`,
    `- Recovery gate: ${recovery.label}`,
    `- Impact: ${impact.label} from ${impact.startedAtLabel} to ${impact.endedAtLabel} (${impact.durationLabel})`,
    "",
    "## Evidence",
    `- ${rootCause.summary}`,
    ...rootCause.evidence.map((item) => `- ${item}`),
    ...impact.evidence.map((item) => `- ${item}`),
    "",
    "## Mitigation Steps",
    ...mitigation.steps.flatMap((step, index) => [
      `${index + 1}. [${step.priority}] ${step.title}`,
      `   - Detail: ${step.detail}`,
      `   - Guardrail: ${step.guardrail}`,
    ]),
    "",
    "## Closeout Guard",
    `- ${recovery.summary}`,
    ...recovery.actions.map((action) => `- ${action}`),
  ];
  return lines.join("\n");
}

export function buildMonitorHealthScore(
  snapshot: MonitorSnapshotLike | null,
  alerts: MonitorAlert[],
  baseline: MonitorBaselineInsights,
  forecast: MonitorForecast,
  runbook: MonitorRunbook,
): MonitorHealthScore {
  if (!snapshot) {
    return {
      score: 0,
      status: "critical",
      summary: "Health score 0/100: waiting for trusted monitor sample.",
      factors: ["No trusted monitor sample"],
    };
  }

  const activeAlerts = alerts.filter((alert) => alert.id !== "healthy" && alert.id !== "waiting");
  const criticalAlerts = activeAlerts.filter((alert) => alert.severity === "critical").length;
  const warningAlerts = activeAlerts.filter((alert) => alert.severity === "warn").length;
  const criticalBaseline = baseline.metrics.filter((metric) => metric.tone === "critical").length;
  const warningBaseline = baseline.metrics.filter((metric) => metric.tone === "warn").length;
  const risingForecasts = forecast.metrics.filter((metric) => metric.tone === "warn" || metric.tone === "critical").length;
  const criticalForecasts = forecast.metrics.filter((metric) => metric.tone === "critical").length;
  const nowSteps = runbook.steps.filter((step) => step.priority === "now").length;
  const nextSteps = runbook.steps.filter((step) => step.priority === "next").length;

  const penalty =
    criticalAlerts * 22
    + warningAlerts * 8
    + criticalBaseline * 14
    + warningBaseline * 7
    + criticalForecasts * 14
    + (risingForecasts - criticalForecasts) * 9
    + nowSteps * 10
    + nextSteps * 4;
  const score = clampScore(100 - penalty);
  const status = healthScoreStatus(score);
  const factors = [
    criticalAlerts > 0 ? `${criticalAlerts} critical ${pluralize("alert", criticalAlerts)}` : null,
    warningAlerts > 0 ? `${warningAlerts} warning ${pluralize("alert", warningAlerts)}` : null,
    criticalBaseline + warningBaseline > 0 ? `${criticalBaseline + warningBaseline} baseline ${pluralize("shift", criticalBaseline + warningBaseline)}` : null,
    risingForecasts > 0 ? `${risingForecasts} rising ${pluralize("forecast", risingForecasts)}` : null,
    nowSteps > 0 ? `${nowSteps} immediate runbook ${pluralize("step", nowSteps)}` : null,
    nextSteps > 0 ? `${nextSteps} follow-up runbook ${pluralize("step", nextSteps)}` : null,
  ].filter((factor): factor is string => Boolean(factor));

  return {
    score,
    status,
    summary: healthScoreSummary(score, status),
    factors: factors.length > 0 ? factors : ["No active risk signals"],
  };
}

export function buildMonitorRiskTimeline(
  history: MonitorHistoryEntryLike[],
  rules: MonitorRules = DEFAULT_MONITOR_RULES,
  limit = 6,
): MonitorRiskTimeline {
  if (history.length === 0) {
    return {
      status: "empty",
      sampleCount: 0,
      summary: "Collect monitor samples to build a risk timeline.",
      entries: [],
    };
  }

  const entries = [...history]
    .sort((left, right) => historySortValue(right) - historySortValue(left))
    .slice(0, Math.max(1, limit))
    .map((entry, index) => riskTimelineEntry(entry, rules, index));
  const riskyCount = entries.filter((entry) => entry.tone !== "ok").length;

  return {
    status: "ready",
    sampleCount: history.length,
    summary: riskyCount > 0
      ? `${riskyCount} risky ${pluralize("sample", riskyCount)} across the last ${entries.length} monitor ${pluralize("snapshot", entries.length)}.`
      : `No risky samples across the last ${entries.length} monitor ${pluralize("snapshot", entries.length)}.`,
    entries,
  };
}

export function buildMonitorIncidentPhase(
  snapshot: MonitorSnapshotLike | null,
  healthScore: MonitorHealthScore,
  forecast: MonitorForecast,
  timeline: MonitorRiskTimeline,
): MonitorIncidentPhase {
  if (!snapshot || timeline.entries.length === 0) {
    return {
      status: "waiting",
      label: "Waiting",
      summary: "Incident phase: waiting for monitor evidence.",
      evidence: ["No trusted monitor timeline yet"],
    };
  }

  const latest = timeline.entries[0];
  const previous = timeline.entries[1];
  const latestRank = riskToneRank(latest.tone);
  const previousRank = previous ? riskToneRank(previous.tone) : latestRank;
  const evidence = [
    previous && latest.tone !== previous.tone ? `Latest sample moved from ${previous.tone} to ${latest.tone}` : null,
    forecast.status === "rising" ? "Trend forecast is still rising" : null,
    `Health score is ${healthScore.score}/100`,
  ].filter((item): item is string => Boolean(item));

  if (previous && latestRank > previousRank) {
    return {
      status: "worsening",
      label: "Worsening",
      summary: forecast.status === "rising"
        ? "Incident phase: worsening. Risk increased in the latest sample and forecast still points upward."
        : "Incident phase: worsening. Risk increased in the latest sample.",
      evidence,
    };
  }

  if (previous && latestRank < previousRank) {
    return {
      status: "recovering",
      label: "Recovering",
      summary: "Incident phase: recovering. Latest sample improved against the prior risk state.",
      evidence,
    };
  }

  if (latest.tone === "critical" || healthScore.status === "critical") {
    return {
      status: "active",
      label: "Active Incident",
      summary: "Incident phase: active. Critical evidence is still present in the current monitor view.",
      evidence,
    };
  }

  if (latest.tone === "warn" || healthScore.status === "degraded" || healthScore.status === "watch") {
    return {
      status: "active",
      label: "Active Watch",
      summary: "Incident phase: active watch. Risk signals remain present but are not escalating in the latest sample.",
      evidence,
    };
  }

  return {
    status: "stable",
    label: "Stable",
    summary: "Incident phase: stable. Recent monitor evidence is inside watch rules.",
    evidence,
  };
}

export function buildMonitorEscalationWindow(
  phase: MonitorIncidentPhase,
  healthScore: MonitorHealthScore,
  forecast: MonitorForecast,
  runbook: MonitorRunbook,
): MonitorEscalationWindow {
  if (phase.status === "waiting") {
    return {
      status: "waiting",
      label: "Waiting",
      deadline: "No sample",
      summary: "Escalation window: waiting for trusted monitor evidence.",
      actions: ["Open a live session and collect monitor samples"],
    };
  }

  if (phase.status === "recovering") {
    return {
      status: "watch",
      label: "Observe",
      deadline: "Next 2 samples",
      summary: "Escalation window: observe. Recovery is visible; verify the next two samples before closing.",
      actions: ["Confirm Risk Timeline keeps improving", "Keep Ops Brief ready if risk returns"],
    };
  }

  const forecastCritical = forecast.metrics.some((metric) => metric.tone === "critical");
  if (phase.status === "worsening" && (healthScore.status === "critical" || forecastCritical)) {
    return {
      status: "page",
      label: "Page Now",
      deadline: "Now",
      summary: "Escalation window: page now. Worsening incident with critical health evidence.",
      actions: escalationActions(runbook, forecast, true),
    };
  }

  if (phase.status === "worsening" || phase.status === "active" || healthScore.status === "degraded") {
    return {
      status: "triage",
      label: "Triage",
      deadline: "30m",
      summary: "Escalation window: triage within 30 minutes. Risk is active but not at page-now threshold.",
      actions: escalationActions(runbook, forecast, false),
    };
  }

  if (healthScore.status === "watch") {
    return {
      status: "watch",
      label: "Watch",
      deadline: "Next sample",
      summary: "Escalation window: watch the next monitor sample before escalating.",
      actions: ["Review Risk Timeline after the next sample", "Keep Ops Brief ready if risk returns"],
    };
  }

  return {
    status: "none",
    label: "No Escalation",
    deadline: "None",
    summary: "Escalation window: no escalation. Current monitor evidence is stable.",
    actions: ["Continue normal monitoring"],
  };
}

export function buildMonitorRecoveryGate(
  phase: MonitorIncidentPhase,
  healthScore: MonitorHealthScore,
  forecast: MonitorForecast,
  timeline: MonitorRiskTimeline,
): MonitorRecoveryGate {
  if (phase.status === "waiting" || timeline.entries.length === 0) {
    return {
      status: "waiting",
      label: "Waiting",
      summary: "Recovery gate: waiting for enough monitor evidence.",
      criteria: [],
      actions: ["Collect monitor samples before closing recovery"],
    };
  }

  const latest = timeline.entries[0];
  const previous = timeline.entries[1];
  const healthPassed = healthScore.score >= 90;
  const forecastPassed = forecast.status === "steady";
  const latestPassed = latest.tone === "ok";
  const phasePassed = phase.status === "stable" || phase.status === "recovering";
  const criteria: MonitorRecoveryGateCriterion[] = [
    {
      label: "Health score >= 90",
      status: healthPassed ? "passed" : "blocked",
      detail: `${healthScore.score}/100`,
    },
    {
      label: "Forecast steady",
      status: forecastPassed ? "passed" : "blocked",
      detail: forecast.status,
    },
    {
      label: "Latest sample clean",
      status: latestPassed ? "passed" : "blocked",
      detail: latest.tone,
    },
    {
      label: "Incident stable or recovering",
      status: phasePassed ? "passed" : "blocked",
      detail: phase.status,
    },
  ];
  const blocked = criteria.some((item) => item.status === "blocked");
  if (blocked) {
    return {
      status: "blocked",
      label: "Do Not Close",
      summary: "Recovery gate: blocked. Escalation remains active until health, forecast, and timeline are clean.",
      criteria,
      actions: ["Keep escalation window active", "Re-check after the next monitor sample"],
    };
  }

  if (previous?.tone !== "ok" || phase.status === "recovering") {
    return {
      status: "watch",
      label: "Watch Recovery",
      summary: "Recovery gate: watch. Recovery is visible, but one more clean sample is needed before closeout.",
      criteria,
      actions: ["Wait for one more clean sample", "Keep Escalation Brief ready"],
    };
  }

  return {
    status: "ready",
    label: "Ready To Close",
    summary: "Recovery gate: ready. Health, forecast, and recent samples are clean.",
    criteria,
    actions: ["Confirm service owner agrees with closeout", "Attach Escalation Brief to the incident record"],
  };
}

export function buildMonitorImpactWindow(timeline: MonitorRiskTimeline): MonitorImpactWindow {
  if (timeline.entries.length === 0) {
    return {
      status: "waiting",
      label: "Waiting",
      startedAtLabel: "unknown",
      endedAtLabel: "unknown",
      durationLabel: "unknown",
      summary: "Impact window: waiting for monitor history.",
      evidence: ["No monitor timeline entries yet"],
    };
  }

  const latest = timeline.entries[0];
  if (latest.tone !== "ok") {
    const activeRisk = leadingRiskEntries(timeline.entries);
    const startedAt = activeRisk[activeRisk.length - 1] ?? latest;
    const previousClean = timeline.entries[activeRisk.length];
    return {
      status: "active",
      label: "Active Impact",
      startedAtLabel: startedAt.timeLabel,
      endedAtLabel: "Active",
      durationLabel: impactDurationLabel(startedAt, latest),
      summary: `Impact window: active since ${startedAt.timeLabel}. Latest monitor sample is still risky.`,
      evidence: [
        `Latest risky tone: ${latest.tone}`,
        previousClean ? `Previous clean sample: ${previousClean.timeLabel}` : "No clean sample before active window",
      ],
    };
  }

  const firstRiskIndex = timeline.entries.findIndex((entry) => entry.tone !== "ok");
  if (firstRiskIndex === -1) {
    return {
      status: "none",
      label: "No Impact",
      startedAtLabel: "none",
      endedAtLabel: "none",
      durationLabel: "none",
      summary: "Impact window: no risky samples in the current timeline.",
      evidence: [`${timeline.entries.length} clean samples in timeline`],
    };
  }

  const recoveredRisk = contiguousRiskEntries(timeline.entries, firstRiskIndex);
  const startedAt = recoveredRisk[recoveredRisk.length - 1];
  return {
    status: "recovered",
    label: "Recovered",
    startedAtLabel: startedAt.timeLabel,
    endedAtLabel: latest.timeLabel,
    durationLabel: impactDurationLabel(startedAt, latest),
    summary: `Impact window: recovered. Risk ran from ${startedAt.timeLabel} to ${latest.timeLabel}.`,
    evidence: [
      `${recoveredRisk.length} risky ${pluralize("sample", recoveredRisk.length)} before recovery`,
      `Latest clean sample: ${latest.timeLabel}`,
    ],
  };
}

export function buildMonitorRootCauseLens(
  alerts: MonitorAlert[],
  baseline: MonitorBaselineInsights,
  forecast: MonitorForecast,
  runbook: MonitorRunbook,
  timeline: MonitorRiskTimeline,
): MonitorRootCauseLens {
  const waiting = alerts.some((alert) => alert.id === "waiting")
    || baseline.status === "waiting"
    || forecast.status === "waiting"
    || timeline.entries.length === 0;
  if (waiting) {
    return {
      status: "waiting",
      label: "Waiting",
      confidenceLabel: "Waiting",
      summary: "Root cause lens: waiting for enough monitor evidence.",
      evidence: ["Collect monitor alerts, baseline, forecast, and timeline samples"],
      actions: ["Open a live session and refresh Monitor"],
    };
  }

  const signals = [
    ...rootCauseAlertSignals(alerts),
    ...rootCauseBaselineSignals(baseline),
    ...rootCauseForecastSignals(forecast),
    ...rootCauseTimelineSignals(timeline),
    ...rootCauseRunbookSignals(runbook),
  ];
  const grouped = rootCauseGroups(signals);
  if (grouped.length === 0) {
    return {
      status: "clear",
      label: "No Root Cause",
      confidenceLabel: "Clean",
      summary: "Root cause lens: no active suspect from current monitor evidence.",
      evidence: [
        "No active alerts",
        "Baseline is stable",
        "Forecast is steady",
        "Latest timeline sample is clean",
      ],
      actions: ["Continue normal monitoring"],
    };
  }

  const [primary, secondary] = grouped;
  const confidenceLabel = rootCauseConfidence(primary.score, secondary?.score ?? 0);
  const status = secondary && primary.score - secondary.score <= 1 && secondary.score >= 4 ? "multi_signal" : "focused";
  const label = status === "multi_signal" ? "Multi-signal" : primary.label;
  return {
    status,
    label,
    confidenceLabel,
    summary: status === "multi_signal"
      ? `Root cause lens: multiple suspects are tied; start with ${primary.label}.`
      : `Root cause lens: ${rootCauseSentenceLabel(primary.id)} is the leading suspect with ${confidenceLabel.toLowerCase()} confidence.`,
    evidence: primary.evidence.slice(0, 5),
    actions: rootCauseActions(primary.id, primary.actions),
  };
}

export function buildMonitorMitigationPlan(
  rootCause: MonitorRootCauseLens,
  escalation: MonitorEscalationWindow,
  recovery: MonitorRecoveryGate,
  impact: MonitorImpactWindow,
  runbook: MonitorRunbook,
): MonitorMitigationPlan {
  if (rootCause.status === "waiting") {
    return {
      status: "waiting",
      label: "Waiting",
      summary: "Mitigation plan: waiting for root cause evidence.",
      steps: [{
        id: "watch",
        priority: "verify",
        title: "Collect mitigation evidence",
        detail: "Root cause lens is still waiting for monitor samples.",
        guardrail: "Do not take remediation action without trusted monitor evidence.",
      }],
    };
  }

  if (rootCause.status === "clear") {
    return {
      status: "standby",
      label: "Standby",
      summary: "Mitigation plan: no active mitigation is recommended.",
      steps: [{
        id: "watch",
        priority: "verify",
        title: "Continue monitoring",
        detail: "Root cause lens is clean and no escalation is active.",
        guardrail: "Collect another sample before reopening if symptoms return.",
      }],
    };
  }

  const urgent = escalation.status === "page" || recovery.status === "blocked" || impact.status === "active";
  return {
    status: urgent ? "urgent" : "ready",
    label: urgent ? "Act Now" : "Ready",
    summary: urgent
      ? `Mitigation plan: act on ${rootCause.label} now, then prove the recovery gate can reopen.`
      : `Mitigation plan: prepare ${rootCause.label} mitigation and verify the next sample.`,
    steps: [
      {
        id: "mitigate",
        priority: urgent ? "now" : "next",
        title: `Execute ${rootCause.label} mitigation`,
        detail: mitigationAction(rootCause, runbook),
        guardrail: mitigationGuardrail(rootCause.label),
      },
      {
        id: "verify",
        priority: "verify",
        title: "Verify recovery gate",
        detail: recovery.status === "blocked"
          ? "Recovery gate is blocked; wait for health, forecast, and latest timeline evidence to clear before closeout."
          : "Recovery gate is not blocked; verify the next monitor sample before closeout.",
        guardrail: impact.status === "active" ? "Do not close while impact remains active." : "Confirm one clean sample after mitigation.",
      },
      {
        id: "communicate",
        priority: "next",
        title: "Communicate impact",
        detail: `Escalation is ${escalation.label} (${escalation.deadline}); include ${impact.label} and root cause evidence in the handoff.`,
        guardrail: urgent ? "Keep escalation active until a clean sample confirms mitigation." : "Keep the Ops Brief ready if risk returns.",
      },
    ],
  };
}

export function buildMonitorCommandSafetyPack(
  runbook: MonitorRunbook,
  rootCause: MonitorRootCauseLens,
  mitigation: MonitorMitigationPlan,
): MonitorCommandSafetyPack {
  const commands = runbook.steps.flatMap((step) => step.commands.map((command) => ({
    ...commandSafety(command.label, command.command, step.title),
  })));
  if (commands.length === 0) {
    return {
      status: "waiting",
      summary: "Command safety pack: waiting for runbook commands.",
      groups: commandSafetyGroups([]),
      guardrails: ["Collect monitor evidence before copying commands."],
    };
  }

  const groups = commandSafetyGroups(commands);
  const readOnlyCount = groups.find((group) => group.level === "read_only")?.commands.length ?? 0;
  const lowRiskCount = groups.find((group) => group.level === "low_risk")?.commands.length ?? 0;
  const highRiskCount = groups.find((group) => group.level === "high_risk")?.commands.length ?? 0;
  return {
    status: highRiskCount > 0 ? "guarded" : "ready",
    summary: `Command safety pack: ${readOnlyCount} read-only ${pluralize("command", readOnlyCount)}, ${lowRiskCount} low-risk ${pluralize("command", lowRiskCount)}, ${highRiskCount} high-risk ${pluralize("command", highRiskCount)} require approval.`,
    groups,
    guardrails: [
      "Copy read-only commands first.",
      highRiskCount > 0 ? "Do not run high-risk commands without owner approval and rollback context." : "Keep commands diagnostic until mitigation is approved.",
      rootCause.status === "waiting" ? `Mitigation status: ${mitigation.label}.` : `Root cause focus: ${rootCause.label}.`,
    ],
  };
}

export function buildMonitorVerificationChecklist(
  healthScore: MonitorHealthScore,
  forecast: MonitorForecast,
  timeline: MonitorRiskTimeline,
  recovery: MonitorRecoveryGate,
  impact: MonitorImpactWindow,
  commandSafety: MonitorCommandSafetyPack,
): MonitorVerificationChecklist {
  if (timeline.entries.length === 0 || recovery.status === "waiting" || impact.status === "waiting" || commandSafety.status === "waiting") {
    return {
      status: "waiting",
      label: "Waiting",
      summary: "Verification checklist: waiting for closeout evidence.",
      items: [],
      actions: ["Collect monitor samples and command safety evidence"],
    };
  }

  const latest = timeline.entries[0];
  const items: MonitorVerificationItem[] = [
    {
      id: "health",
      label: "Health score >= 90",
      status: healthScore.score >= 90 ? "passed" : "blocked",
      detail: `${healthScore.score}/100`,
    },
    {
      id: "forecast",
      label: "Forecast steady",
      status: forecast.status === "steady" ? "passed" : "blocked",
      detail: forecast.status,
    },
    {
      id: "latest",
      label: "Latest sample clean",
      status: latest.tone === "ok" ? "passed" : "blocked",
      detail: latest.tone,
    },
    {
      id: "impact",
      label: "Impact window closed",
      status: impact.status === "recovered" || impact.status === "none" ? "passed" : "blocked",
      detail: impact.status,
    },
    {
      id: "commands",
      label: "Command safety reviewed",
      status: commandSafety.status === "ready" ? "passed" : "blocked",
      detail: commandSafety.status,
    },
    {
      id: "gate",
      label: "Recovery gate ready",
      status: recovery.status === "ready" ? "passed" : "blocked",
      detail: recovery.status,
    },
  ];
  const blockedCount = items.filter((item) => item.status === "blocked").length;
  if (blockedCount > 0) {
    return {
      status: "blocked",
      label: "Do Not Close",
      summary: `Verification checklist: ${blockedCount} ${pluralize("check", blockedCount)} blocked. Keep mitigation active.`,
      items,
      actions: ["Keep escalation active", "Re-check after the next monitor sample"],
    };
  }

  return {
    status: "ready",
    label: "Ready To Close",
    summary: "Verification checklist: all closeout checks passed.",
    items,
    actions: ["Attach Mitigation Brief to the incident record", "Confirm service owner agrees with closeout"],
  };
}

export function buildMonitorSessionReplay(
  timeline: MonitorRiskTimeline,
  phase: MonitorIncidentPhase,
  impact: MonitorImpactWindow,
  verification: MonitorVerificationChecklist,
): MonitorSessionReplay {
  if (timeline.entries.length === 0) {
    return {
      status: "waiting",
      label: "Waiting",
      summary: "Session replay: waiting for monitor history.",
      events: [],
    };
  }

  const latest = timeline.entries[0];
  const firstRisk = [...timeline.entries].reverse().find((entry) => entry.tone !== "ok");
  if (!firstRisk) {
    return {
      status: "clean",
      label: "Clean Replay",
      summary: "Session replay: no risk detected in the current history window.",
      events: [
        replayEvent("latest", latest.timeLabel, "ok", "Latest sample", latest.summary),
        replayEvent("phase", "now", "ok", "Incident phase", phase.label),
        replayEvent("closeout", "now", verification.status === "ready" ? "ok" : "warn", "Closeout gate", verification.label),
      ],
    };
  }

  if (impact.status === "recovered") {
    return {
      status: "recovered",
      label: "Recovered Replay",
      summary: `Session replay: risk ran from ${impact.startedAtLabel} to ${impact.endedAtLabel} and closeout is ${verification.status === "ready" ? "ready" : "not ready"}.`,
      events: [
        replayEvent("start", impact.startedAtLabel, firstRisk.tone, "Risk opened", firstRisk.summary),
        replayEvent("recovery", impact.endedAtLabel, "ok", "Recovery observed", latest.summary),
        replayEvent("phase", "now", phase.status === "stable" ? "ok" : "warn", "Incident phase", phase.label),
        replayEvent("closeout", "now", verification.status === "ready" ? "ok" : "critical", "Closeout gate", verification.label),
      ],
    };
  }

  if (impact.status === "active") {
    return {
      status: "active",
      label: "Active Replay",
      summary: `Session replay: risk opened at ${impact.startedAtLabel} and is still active.`,
      events: [
        replayEvent("start", impact.startedAtLabel, firstRisk.tone, "Risk opened", firstRisk.summary),
        replayEvent("latest", latest.timeLabel, latest.tone, "Latest sample", latest.summary),
        replayEvent("phase", "now", phase.status === "stable" ? "ok" : "warn", "Incident phase", phase.label),
        replayEvent("closeout", "now", verification.status === "ready" ? "ok" : "critical", "Closeout gate", verification.label),
      ],
    };
  }

  return {
    status: "clean",
    label: "Clean Replay",
    summary: "Session replay: monitor history is currently clean.",
    events: [
      replayEvent("latest", latest.timeLabel, "ok", "Latest sample", latest.summary),
      replayEvent("phase", "now", "ok", "Incident phase", phase.label),
      replayEvent("closeout", "now", verification.status === "ready" ? "ok" : "warn", "Closeout gate", verification.label),
    ],
  };
}

export function buildMonitorSloBudget(
  timeline: MonitorRiskTimeline,
  impact: MonitorImpactWindow,
  verification: MonitorVerificationChecklist,
  budgetMinutes = 60,
): MonitorSloBudget {
  const safeBudgetMinutes = Math.max(1, Math.round(budgetMinutes));
  const targetLabel = `SLO target ${safeBudgetMinutes}m risky budget`;
  if (timeline.entries.length === 0 || impact.status === "waiting") {
    return {
      status: "waiting",
      label: "Budget Waiting",
      targetLabel,
      usedLabel: "0m used",
      remainingLabel: `${safeBudgetMinutes}m left`,
      summary: "SLO budget: waiting for monitor impact evidence.",
      indicators: [],
      actions: ["Collect monitor history before scoring SLO budget"],
    };
  }

  const usedMinutes = estimateImpactMinutes(timeline, impact);
  const remainingMinutes = Math.max(0, safeBudgetMinutes - usedMinutes);
  const closeoutBlocked = verification.status !== "ready";
  const breached = usedMinutes >= safeBudgetMinutes;
  const status: MonitorSloBudget["status"] = breached
    ? "breached"
    : usedMinutes === 0 && !closeoutBlocked
      ? "healthy"
      : "watch";
  const label = status === "breached"
    ? "Budget Breach"
    : status === "watch"
      ? "Budget Watch"
      : "Budget Healthy";
  const budgetTone: MonitorSloBudgetIndicator["tone"] = breached ? "critical" : usedMinutes > 0 ? "warn" : "ok";
  const impactTone: MonitorSloBudgetIndicator["tone"] = impact.status === "active" ? "critical" : impact.status === "recovered" ? "warn" : "ok";
  const closeoutTone: MonitorSloBudgetIndicator["tone"] = verification.status === "ready" ? "ok" : "critical";

  return {
    status,
    label,
    targetLabel,
    usedLabel: `${usedMinutes}m used`,
    remainingLabel: `${remainingMinutes}m left`,
    summary: sloBudgetSummary(status, usedMinutes, remainingMinutes, safeBudgetMinutes, verification),
    indicators: [
      {
        id: "impact",
        label: "Impact",
        tone: impactTone,
        detail: `${impact.label} from ${impact.startedAtLabel} to ${impact.endedAtLabel}`,
      },
      {
        id: "budget",
        label: "Budget",
        tone: budgetTone,
        detail: `${usedMinutes}m used of ${safeBudgetMinutes}m`,
      },
      {
        id: "closeout",
        label: "Closeout",
        tone: closeoutTone,
        detail: verification.label,
      },
    ],
    actions: sloBudgetActions(status, verification),
  };
}

export function buildMonitorHardeningGate(
  healthScore: MonitorHealthScore,
  recovery: MonitorRecoveryGate,
  verification: MonitorVerificationChecklist,
  sloBudget: MonitorSloBudget,
  commandSafety: MonitorCommandSafetyPack,
  sessionReplay: MonitorSessionReplay,
): MonitorHardeningGate {
  const items: MonitorHardeningItem[] = [
    {
      id: "health",
      label: "Health",
      status: healthScore.score >= 90 ? "passed" : "blocked",
      detail: `${healthScore.score}/100 ${healthScore.status}`,
    },
    {
      id: "recovery",
      label: "Recovery gate",
      status: recovery.status === "ready" ? "passed" : recovery.status === "watch" ? "watch" : "blocked",
      detail: recovery.label,
    },
    {
      id: "verification",
      label: "Verification",
      status: verification.status === "ready" ? "passed" : "blocked",
      detail: verification.label,
    },
    {
      id: "slo",
      label: "SLO budget",
      status: sloBudget.status === "breached" ? "blocked" : sloBudget.status === "waiting" ? "blocked" : sloBudget.status === "watch" ? "watch" : "passed",
      detail: sloBudget.label,
    },
    {
      id: "replay",
      label: "Session replay",
      status: sessionReplay.status === "active" || sessionReplay.status === "waiting" ? "blocked" : sessionReplay.status === "recovered" ? "watch" : "passed",
      detail: sessionReplay.label,
    },
    {
      id: "commands",
      label: "Command safety",
      status: commandSafety.status === "ready" ? "passed" : "blocked",
      detail: commandSafety.status,
    },
  ];
  const blockedCount = items.filter((item) => item.status === "blocked").length;
  if (blockedCount > 0) {
    return {
      status: "locked",
      label: "Hardening Locked",
      summary: `Final hardening: ${blockedCount} ${pluralize("blocker", blockedCount)} remain. Keep monitor in incident mode.`,
      items,
      actions: hardeningBlockedActions(sloBudget),
    };
  }

  const watchCount = items.filter((item) => item.status === "watch").length;
  if (watchCount > 0 && (recovery.status !== "ready" || verification.status !== "ready")) {
    return {
      status: "review",
      label: "Owner Review",
      summary: `Final hardening: ${watchCount} ${pluralize("watch item", watchCount)} need owner review before closeout.`,
      items,
      actions: ["Ask the service owner to review watch items", "Collect one more clean monitor sample"],
    };
  }

  return {
    status: "ready",
    label: "Hardened",
    summary: "Final hardening: ready for owner-approved closeout.",
    items,
    actions: [
      "Attach incident, mitigation, SLO, and verification evidence to the record",
      "Ask the service owner to approve closeout",
    ],
  };
}

function trimSamples(samples: number[], maxSamples: number): number[] {
  return samples.slice(Math.max(0, samples.length - maxSamples));
}

function average(values: number[]): number {
  const safeValues = values.filter((value) => Number.isFinite(value));
  if (safeValues.length === 0) {
    return 0;
  }
  return Math.round(safeValues.reduce((total, value) => total + value, 0) / safeValues.length);
}

function baselineMetric(
  id: MonitorBaselineMetric["id"],
  label: string,
  currentValue: number,
  averageValue: number,
): MonitorBaselineMetric {
  const current = Math.round(Math.max(0, currentValue));
  const delta = current - averageValue;
  const tone = delta >= 25 ? "critical" : delta >= 10 ? "warn" : delta <= -10 ? "ok" : "stable";
  const direction = delta > 0 ? "above" : delta < 0 ? "below" : "at";
  const detail = delta === 0 ? "at baseline" : `${Math.abs(delta)} pts ${direction} baseline`;
  return {
    id,
    label,
    current,
    average: averageValue,
    delta,
    tone,
    detail,
  };
}

type TimestampedMonitorHistoryEntry = MonitorHistoryEntryLike & { at: number };

function timestampedSamples(history: MonitorHistoryEntryLike[]): TimestampedMonitorHistoryEntry[] {
  return history
    .map((entry) => ({ ...entry, at: Date.parse(entry.createdAt ?? "") }))
    .filter((entry) => Number.isFinite(entry.at))
    .sort((left, right) => left.at - right.at);
}

function forecastMetric(
  id: MonitorForecastMetric["id"],
  label: string,
  currentValue: number,
  threshold: number,
  samples: TimestampedMonitorHistoryEntry[],
): MonitorForecastMetric {
  const current = Math.round(Math.max(0, currentValue));
  const oldest = samples[0];
  const newest = samples[samples.length - 1];
  const elapsedHours = Math.max((newest.at - oldest.at) / 3_600_000, 0);
  const firstValue = metricValue(oldest, id);
  const lastValue = metricValue(newest, id);
  const changePerHour = elapsedHours > 0 ? round1((lastValue - firstValue) / elapsedHours) : 0;
  const etaHours = changePerHour > 0 ? Math.max((threshold - current) / changePerHour, 0) : Infinity;
  const etaLabel = formatEta(etaHours);
  const tone = forecastTone(current, threshold, changePerHour, etaHours);
  const detail = changePerHour > 0
    ? `${formatTrendRate(changePerHour)} to ${threshold}%`
    : changePerHour < 0
      ? `${formatTrendRate(changePerHour)} away from ${threshold}%`
      : `flat vs ${threshold}%`;
  return {
    id,
    label,
    current,
    changePerHour,
    threshold,
    etaLabel,
    tone,
    detail,
  };
}

function metricValue(entry: MonitorHistoryEntryLike, id: MonitorForecastMetric["id"]): number {
  if (id === "cpu") {
    return entry.cpuPercent;
  }
  if (id === "memory") {
    return entry.memoryPercent;
  }
  return entry.diskPercent;
}

function forecastTone(current: number, threshold: number, changePerHour: number, etaHours: number): MonitorForecastMetric["tone"] {
  if (current >= threshold || etaHours <= 1) {
    return "critical";
  }
  if (changePerHour > 0 && (etaHours <= 6 || changePerHour >= 3)) {
    return "warn";
  }
  if (changePerHour < -1) {
    return "ok";
  }
  return "stable";
}

function forecastRiskScore(metric: MonitorForecastMetric): number {
  if (metric.tone === "critical") {
    return 1000 + metric.changePerHour;
  }
  if (metric.tone === "warn") {
    return 100 + metric.changePerHour;
  }
  return metric.changePerHour;
}

function formatTrendRate(value: number): string {
  const rounded = round1(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} pts/hr`;
}

function formatTrendRateMagnitude(value: number): string {
  const rounded = Math.abs(round1(value));
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} pts/hr`;
}

function formatEta(hours: number): string {
  if (!Number.isFinite(hours)) {
    return "not projected";
  }
  if (hours <= 0) {
    return "now";
  }
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))}m`;
  }
  if (hours < 24) {
    return `about ${Math.ceil(hours)}h`;
  }
  return `about ${Math.ceil(hours / 24)}d`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function healthScoreStatus(score: number): MonitorHealthScore["status"] {
  if (score >= 90) {
    return "healthy";
  }
  if (score >= 70) {
    return "watch";
  }
  if (score >= 40) {
    return "degraded";
  }
  return "critical";
}

function healthScoreSummary(score: number, status: MonitorHealthScore["status"]): string {
  if (status === "critical") {
    return `Health score ${score}/100: immediate attention required.`;
  }
  if (status === "degraded") {
    return `Health score ${score}/100: multiple signals need triage.`;
  }
  if (status === "watch") {
    return `Health score ${score}/100: watch the next samples.`;
  }
  return `Health score ${score}/100: all monitor signals healthy.`;
}

function pluralize(label: string, count: number): string {
  return count === 1 ? label : `${label}s`;
}

function historySortValue(entry: MonitorHistoryEntryLike): number {
  const parsed = Date.parse(entry.createdAt ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function riskTimelineEntry(entry: MonitorHistoryEntryLike, rules: MonitorRules, index: number): MonitorRiskTimelineEntry {
  const metrics: MonitorRiskTimelineMetric[] = [
    riskTimelineMetric("cpu", "CPU", entry.cpuPercent, rules.cpuWarn, rules.cpuCritical),
    riskTimelineMetric("memory", "Memory", entry.memoryPercent, rules.memoryWarn, rules.memoryCritical),
    riskTimelineMetric("disk", "Disk", entry.diskPercent, rules.diskWarn, rules.diskCritical),
  ];
  const lead = [...metrics].sort((left, right) => riskToneRank(right.tone) - riskToneRank(left.tone) || right.value - left.value)[0];
  const tone = lead?.tone ?? "ok";

  return {
    id: entry.id === undefined ? `${entry.createdAt ?? "sample"}-${index}` : String(entry.id),
    createdAt: entry.createdAt ?? "",
    timeLabel: formatTimelineTime(entry.createdAt),
    tone,
    summary: tone === "ok"
      ? "All tracked metrics inside watch rules."
      : `${lead.label} ${lead.value}% crossed ${tone === "critical" ? "critical" : "warning"} threshold.`,
    metrics,
  };
}

function riskTimelineMetric(
  id: MonitorRiskTimelineMetric["id"],
  label: string,
  value: number,
  warn: number,
  critical: number,
): MonitorRiskTimelineMetric {
  const safeValue = Math.round(Math.max(0, value));
  const tone = safeValue >= critical ? "critical" : safeValue >= warn ? "warn" : "ok";
  return {
    id,
    label,
    value: safeValue,
    tone,
  };
}

function riskToneRank(tone: MonitorRiskTimelineMetric["tone"]): number {
  if (tone === "critical") {
    return 2;
  }
  if (tone === "warn") {
    return 1;
  }
  return 0;
}

function formatTimelineTime(value: string | undefined): string {
  const parsed = Date.parse(value ?? "");
  if (!Number.isFinite(parsed)) {
    return "unknown";
  }
  return new Date(parsed).toISOString().slice(11, 16);
}

function leadingRiskEntries(entries: MonitorRiskTimelineEntry[]): MonitorRiskTimelineEntry[] {
  const risky: MonitorRiskTimelineEntry[] = [];
  for (const entry of entries) {
    if (entry.tone === "ok") {
      break;
    }
    risky.push(entry);
  }
  return risky;
}

function contiguousRiskEntries(entries: MonitorRiskTimelineEntry[], startIndex: number): MonitorRiskTimelineEntry[] {
  const risky: MonitorRiskTimelineEntry[] = [];
  for (const entry of entries.slice(startIndex)) {
    if (entry.tone === "ok") {
      break;
    }
    risky.push(entry);
  }
  return risky;
}

function impactDurationLabel(start: MonitorRiskTimelineEntry, end: MonitorRiskTimelineEntry): string {
  const startTime = Date.parse(start.createdAt);
  const endTime = Date.parse(end.createdAt);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime === endTime) {
    return "latest sample";
  }
  const minutes = Math.max(1, Math.round(Math.abs(endTime - startTime) / 60_000));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  return `about ${hours}h`;
}

type RootCauseDomain = "cpu" | "memory" | "disk";

type RootCauseSignal = {
  id: RootCauseDomain;
  label: string;
  score: number;
  evidence?: string;
  action?: string;
};

type RootCauseGroup = {
  id: RootCauseDomain;
  label: string;
  score: number;
  evidence: string[];
  actions: string[];
};

function rootCauseAlertSignals(alerts: MonitorAlert[]): RootCauseSignal[] {
  return alerts
    .filter((alert) => alert.id !== "healthy" && alert.id !== "waiting")
    .flatMap((alert) => {
      const domain = rootCauseDomainFromAlert(alert);
      if (!domain) {
        return [];
      }
      return [{
        id: domain,
        label: rootCauseDomainLabel(domain),
        score: alert.severity === "critical" ? 4 : 3,
        evidence: `Active alert: ${alert.title}`,
      }];
    });
}

function rootCauseBaselineSignals(baseline: MonitorBaselineInsights): RootCauseSignal[] {
  return baseline.metrics
    .filter((metric) => metric.tone === "warn" || metric.tone === "critical")
    .map((metric) => ({
      id: metric.id,
      label: rootCauseDomainLabel(metric.id),
      score: metric.tone === "critical" ? 3 : 2,
      evidence: `Baseline: ${metric.label} ${metric.detail}`,
    }));
}

function rootCauseForecastSignals(forecast: MonitorForecast): RootCauseSignal[] {
  return forecast.metrics
    .filter((metric) => metric.tone === "warn" || metric.tone === "critical")
    .map((metric) => ({
      id: metric.id,
      label: rootCauseDomainLabel(metric.id),
      score: metric.tone === "critical" ? 3 : 2,
      evidence: `Forecast: ${metric.label} ${formatTrendRate(metric.changePerHour)} to critical`,
    }));
}

function rootCauseTimelineSignals(timeline: MonitorRiskTimeline): RootCauseSignal[] {
  const latest = timeline.entries[0];
  if (!latest) {
    return [];
  }
  return latest.metrics
    .filter((metric) => metric.tone === "warn" || metric.tone === "critical")
    .map((metric) => ({
      id: metric.id,
      label: rootCauseDomainLabel(metric.id),
      score: metric.tone === "critical" ? 3 : 2,
      evidence: `Latest timeline: ${metric.label} ${metric.tone}`,
    }));
}

function rootCauseRunbookSignals(runbook: MonitorRunbook): RootCauseSignal[] {
  return runbook.steps.flatMap((step) => {
    const domain = rootCauseDomainFromRunbook(step.id);
    if (!domain) {
      return [];
    }
    return [{
      id: domain,
      label: rootCauseDomainLabel(domain),
      score: step.priority === "now" ? 2 : 1,
      action: `Runbook: ${step.title}`,
    }];
  });
}

function rootCauseGroups(signals: RootCauseSignal[]): RootCauseGroup[] {
  return (["cpu", "memory", "disk"] as const)
    .map((id) => {
      const matching = signals.filter((signal) => signal.id === id);
      return {
        id,
        label: rootCauseDomainLabel(id),
        score: matching.reduce((total, signal) => total + signal.score, 0),
        evidence: uniqueStrings(matching.map((signal) => signal.evidence).filter((item): item is string => Boolean(item))),
        actions: uniqueStrings(matching.map((signal) => signal.action).filter((item): item is string => Boolean(item))),
      };
    })
    .filter((group) => group.score > 0)
    .sort((left, right) => right.score - left.score);
}

function rootCauseActions(id: RootCauseDomain, actions: string[]): string[] {
  const defaults: Record<RootCauseDomain, string> = {
    cpu: "Validate whether this is CPU saturation, run queue pressure, or IO wait before restarting services.",
    memory: "Separate cache growth from process RSS growth before killing workloads.",
    disk: "Check filesystem and inode growth before deleting or rotating files.",
  };
  return [...actions, defaults[id]].slice(0, 3);
}

function mitigationAction(rootCause: MonitorRootCauseLens, runbook: MonitorRunbook): string {
  const rootCauseAction = rootCause.actions.find((action) => action.startsWith("Runbook:")) ?? rootCause.actions[0];
  if (rootCauseAction) {
    return rootCauseAction;
  }
  const firstStep = runbook.steps.find((step) => step.priority === "now") ?? runbook.steps[0];
  return firstStep ? `Runbook: ${firstStep.title}` : "Open Runbook Advisor and collect mitigation context.";
}

function mitigationGuardrail(label: string): string {
  if (label === "Disk") {
    return "Use reversible checks first; avoid destructive cleanup until filesystem and inode growth are confirmed.";
  }
  if (label === "Memory") {
    return "Avoid killing processes until cache, RSS growth, and OOM evidence are separated.";
  }
  if (label === "CPU / Load") {
    return "Confirm saturation, run queue pressure, or IO wait before restarting services.";
  }
  return "Prefer reversible checks before applying remediation.";
}

function commandSafety(label: string, command: string, sourceStep: string): MonitorSafeCommand & { level: MonitorCommandSafetyLevel } {
  const level = commandSafetyLevel(command);
  return {
    level,
    label,
    command,
    sourceStep,
    safetyNote: commandSafetyNote(command, level),
  };
}

function commandSafetyGroups(commands: Array<MonitorSafeCommand & { level: MonitorCommandSafetyLevel }>): MonitorCommandSafetyGroup[] {
  return (["read_only", "low_risk", "high_risk"] as const).map((level) => ({
    level,
    label: commandSafetyLabel(level),
    description: commandSafetyDescription(level),
    commands: commands
      .filter((command) => command.level === level)
      .map(({ level: _level, ...command }) => command),
  }));
}

function replayEvent(
  id: MonitorSessionReplayEvent["id"],
  timeLabel: string,
  tone: MonitorSessionReplayEvent["tone"],
  title: string,
  detail: string,
): MonitorSessionReplayEvent {
  return {
    id,
    timeLabel,
    tone,
    title,
    detail,
  };
}

function estimateImpactMinutes(timeline: MonitorRiskTimeline, impact: MonitorImpactWindow): number {
  if (impact.status === "none" || impact.status === "waiting") {
    return 0;
  }

  const latest = timeline.entries[0];
  const startedAt = timelineEntryByLabel(timeline.entries, impact.startedAtLabel);
  const endedAt = impact.status === "active" ? latest : timelineEntryByLabel(timeline.entries, impact.endedAtLabel);
  if (!startedAt || !endedAt) {
    return 0;
  }

  const startTime = Date.parse(startedAt.createdAt);
  const endTime = Date.parse(endedAt.createdAt);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return 0;
  }

  const directMinutes = Math.round(Math.abs(endTime - startTime) / 60_000);
  if (directMinutes > 0) {
    return directMinutes;
  }

  return impact.status === "active" ? nearestOlderSampleIntervalMinutes(timeline.entries, endedAt) : 0;
}

function timelineEntryByLabel(entries: MonitorRiskTimelineEntry[], timeLabel: string): MonitorRiskTimelineEntry | undefined {
  return entries.find((entry) => entry.timeLabel === timeLabel);
}

function nearestOlderSampleIntervalMinutes(entries: MonitorRiskTimelineEntry[], entry: MonitorRiskTimelineEntry): number {
  const currentTime = Date.parse(entry.createdAt);
  if (!Number.isFinite(currentTime)) {
    return 5;
  }
  const olderEntry = entries
    .filter((item) => {
      const parsed = Date.parse(item.createdAt);
      return Number.isFinite(parsed) && parsed < currentTime;
    })
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
  if (!olderEntry) {
    return 5;
  }
  return Math.max(1, Math.round((currentTime - Date.parse(olderEntry.createdAt)) / 60_000));
}

function sloBudgetSummary(
  status: MonitorSloBudget["status"],
  usedMinutes: number,
  remainingMinutes: number,
  budgetMinutes: number,
  verification: MonitorVerificationChecklist,
): string {
  if (status === "breached") {
    return `SLO budget: ${usedMinutes}m consumed against ${budgetMinutes}m budget. Keep incident active.`;
  }
  if (status === "healthy") {
    return "SLO budget: no risky sample has consumed the current budget.";
  }
  return `SLO budget: ${usedMinutes}m consumed, ${remainingMinutes}m remaining. Closeout is ${verification.status === "ready" ? "ready" : "not ready"}.`;
}

function sloBudgetActions(
  status: MonitorSloBudget["status"],
  verification: MonitorVerificationChecklist,
): string[] {
  if (status === "breached") {
    return [
      "Escalate budget breach in the incident channel",
      "Keep mitigation active until SLO owner accepts closeout",
    ];
  }
  if (status === "healthy") {
    return ["Continue normal monitoring"];
  }
  if (verification.status === "ready") {
    return [
      "Attach SLO budget note to the incident record",
      "Keep watching until one more clean sample confirms recovery",
    ];
  }
  return [
    "Keep budget watch open until closeout checks pass",
    "Recalculate budget after the next monitor sample",
  ];
}

function hardeningBlockedActions(sloBudget: MonitorSloBudget): string[] {
  return [
    "Keep Monitor in incident mode",
    "Resolve verification and recovery blockers before closeout",
    sloBudget.status === "breached"
      ? "Escalate the SLO budget breach to the service owner"
      : "Collect another clean sample before requesting closeout",
  ];
}

function commandSafetyLevel(command: string): MonitorCommandSafetyLevel {
  const normalized = command.toLowerCase();
  if (/\brm\s+-|\brm\s+|\btruncate\b|\bmkfs\b|\bdd\s+|\bshutdown\b|\breboot\b/.test(normalized)) {
    return "high_risk";
  }
  if (/\bsystemctl\s+(restart|stop|reload)|\bservice\s+\S+\s+(restart|stop|reload)|\bkill\s+-?9?\b|\bpkill\b/.test(normalized)) {
    return "high_risk";
  }
  if (/\b(chmod|chown|mount|umount|iptables|ufw)\b/.test(normalized)) {
    return "low_risk";
  }
  if (isReadOnlyCommand(normalized)) {
    return "read_only";
  }
  return "low_risk";
}

function isReadOnlyCommand(command: string): boolean {
  const first = command.trim().split(/\s+/)[0];
  return ["cat", "df", "du", "find", "free", "grep", "head", "journalctl", "ps", "sort", "ss", "tail", "uptime", "vmstat"].includes(first);
}

function commandSafetyNote(command: string, level: MonitorCommandSafetyLevel): string {
  const normalized = command.toLowerCase();
  if (/\brm\s+-|\brm\s+|\btruncate\b|\bmkfs\b|\bdd\s+/.test(normalized)) {
    return "High-risk command: destructive file operation detected.";
  }
  if (/\bsystemctl\s+(restart|stop|reload)|\bservice\s+\S+\s+(restart|stop|reload)/.test(normalized)) {
    return "High-risk command: service restart can cause customer-visible impact.";
  }
  if (/\bkill\s+-?9?\b|\bpkill\b|\bshutdown\b|\breboot\b/.test(normalized)) {
    return "High-risk command: process or host interruption detected.";
  }
  if (level === "low_risk") {
    return "Low-risk command: review target and side effects before running.";
  }
  return "Read-only command: safe to copy for diagnosis.";
}

function commandSafetyLabel(level: MonitorCommandSafetyLevel): string {
  if (level === "read_only") {
    return "Read-only";
  }
  if (level === "low_risk") {
    return "Low Risk";
  }
  return "High Risk";
}

function commandSafetyDescription(level: MonitorCommandSafetyLevel): string {
  if (level === "read_only") {
    return "Diagnostic commands that should not mutate host state.";
  }
  if (level === "low_risk") {
    return "Commands that may alter state or need target review.";
  }
  return "Commands requiring owner approval, rollback context, or a maintenance window.";
}

function rootCauseDomainFromAlert(alert: MonitorAlert): RootCauseDomain | null {
  if (alert.id === "cpu" || alert.id === "load") {
    return "cpu";
  }
  if (alert.id === "memory") {
    return "memory";
  }
  if (alert.id === "disk" || alert.id.startsWith("filesystem:")) {
    return "disk";
  }
  return null;
}

function rootCauseDomainFromRunbook(id: string): RootCauseDomain | null {
  if (id === "cpu-load") {
    return "cpu";
  }
  if (id === "memory") {
    return "memory";
  }
  if (id.startsWith("filesystem:")) {
    return "disk";
  }
  return null;
}

function rootCauseDomainLabel(id: RootCauseDomain): string {
  if (id === "cpu") {
    return "CPU / Load";
  }
  if (id === "memory") {
    return "Memory";
  }
  return "Disk";
}

function rootCauseSentenceLabel(id: RootCauseDomain): string {
  if (id === "cpu") {
    return "CPU / load";
  }
  return rootCauseDomainLabel(id).toLowerCase();
}

function rootCauseConfidence(score: number, runnerUpScore: number): MonitorRootCauseLens["confidenceLabel"] {
  if (score >= 9 && score - runnerUpScore >= 2) {
    return "High";
  }
  if (score >= 5) {
    return "Medium";
  }
  return "Low";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function escalationActions(runbook: MonitorRunbook, forecast: MonitorForecast, includeOwner: boolean): string[] {
  const firstStep = runbook.steps.find((step) => step.priority === "now") ?? runbook.steps[0];
  const riskiest = [...forecast.metrics].sort((left, right) => forecastRiskScore(right) - forecastRiskScore(left))[0];
  const actions = [
    firstStep ? `Start runbook: ${firstStep.title}` : "Open Runbook Advisor",
    riskiest ? `Track forecast: ${riskiest.label} critical in ${riskiest.etaLabel}` : "Review Trend Forecast",
  ];
  if (includeOwner) {
    actions.push("Share incident context with the on-call owner");
  } else {
    actions.push("Prepare Ops Brief before escalation");
  }
  return actions;
}

function formatAlertLines(alerts: MonitorAlert[]): string[] {
  const active = alerts.filter((alert) => alert.id !== "healthy" && alert.id !== "waiting");
  if (active.length === 0) {
    return ["- No active monitor alerts."];
  }
  return active.map((alert) => `- [${alert.severity}] ${alert.title}: ${alert.detail}`);
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}
