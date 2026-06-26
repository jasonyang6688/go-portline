import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadModule(filename) {
  const source = readFileSync(join(__dirname, filename), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { exports: module.exports, module }, { filename });
  return module.exports;
}

function snapshot(overrides = {}) {
  return {
    sessionId: "s1",
    cpuPercent: 42,
    cpuIdlePercent: 58,
    cpuCores: 4,
    memoryPercent: 61,
    memoryTotalLabel: "8.0 GB",
    memoryUsedLabel: "4.9 GB",
    memoryAvailableLabel: "3.1 GB",
    diskPercent: 77,
    diskTotalLabel: "100.0 GB",
    diskUsedLabel: "77.0 GB",
    diskAvailableLabel: "23.0 GB",
    loadAverage: "1.20 1.10 1.02",
    processes: [],
    filesystems: [
      { filesystem: "/dev/sda1", type: "ext4", mount: "/", percent: 77, totalLabel: "100.0 GB", usedLabel: "77.0 GB", availableLabel: "23.0 GB" },
      { filesystem: "/dev/sdb1", type: "xfs", mount: "/var/log", percent: 92, totalLabel: "50.0 GB", usedLabel: "46.0 GB", availableLabel: "4.0 GB" },
    ],
    networkInterfaces: [{ name: "eth0", rxBytes: 1000, txBytes: 3000, rxLabel: "1000 B", txLabel: "2.9 KB" }],
    updatedAt: "2026-06-24T02:00:00.000Z",
    ...overrides,
  };
}

test("appends monitor history only from real snapshots", () => {
  const { appendMonitorHistory, createMonitorHistory } = loadModule("monitorSnapshot.ts");
  const empty = createMonitorHistory();

  const first = appendMonitorHistory(empty, null, 4, 1_000);
  const second = appendMonitorHistory(first, snapshot(), 4, 1_000);
  const third = appendMonitorHistory(second, snapshot({ cpuPercent: 45, networkInterfaces: [{ name: "eth0", rxBytes: 2500, txBytes: 4500 }] }), 4, 2_000);

  assert.deepEqual(plain(first.cpu), []);
  assert.deepEqual(plain(third.cpu), [42, 45]);
  assert.deepEqual(plain(third.networkRx), [0, 1500]);
  assert.deepEqual(plain(third.networkTx), [0, 1500]);
});

test("reports monitor freshness without pretending empty data is live", () => {
  const { monitorFreshness } = loadModule("monitorSnapshot.ts");

  assert.equal(monitorFreshness(null, 1_000), "waiting");
  assert.equal(monitorFreshness(snapshot({ updatedAt: "2026-06-24T02:00:00.000Z" }), Date.parse("2026-06-24T02:00:05.000Z")), "live");
  assert.equal(monitorFreshness(snapshot({ updatedAt: "2026-06-24T02:00:00.000Z" }), Date.parse("2026-06-24T02:00:30.000Z")), "stale");
});

test("builds actionable diagnostic commands from risky filesystems", () => {
  const { buildMonitorCommands, primaryFilesystem } = loadModule("monitorSnapshot.ts");

  assert.equal(primaryFilesystem(snapshot())?.mount, "/var/log");
  assert.deepEqual(
    plain(buildMonitorCommands(snapshot()).map((item) => item.command)),
    [
      "uptime && cat /proc/loadavg",
      "ps -eo pid,ppid,user,comm,pcpu,pmem,rss --sort=-pcpu | head -15",
      "df -hT && df -ih",
      "du -xhd1 /var/log 2>/dev/null | sort -h | tail -20",
      "ss -tunap | head -40",
      "journalctl -p err -n 80 --no-pager",
    ],
  );
});

test("evaluates monitor alerts from risky snapshots", () => {
  const { evaluateMonitorAlerts } = loadModule("monitorSnapshot.ts");
  const alerts = evaluateMonitorAlerts(snapshot({
    cpuPercent: 88,
    cpuCores: 4,
    memoryPercent: 91,
    loadAverage: "10.20 8.00 6.10",
  }));

  assert.deepEqual(
    plain(alerts.map((alert) => alert.id)),
    ["cpu", "memory", "filesystem:/var/log", "load"],
  );
  assert.equal(alerts[2].severity, "critical");
  assert.ok(alerts[2].detail.includes("/var/log"));
});

test("returns a healthy monitor alert when no thresholds are crossed", () => {
  const { evaluateMonitorAlerts } = loadModule("monitorSnapshot.ts");

  assert.deepEqual(plain(evaluateMonitorAlerts(snapshot({ filesystems: [] }))), [
    {
      id: "healthy",
      severity: "ok",
      title: "No active monitor alerts",
      detail: "Current CPU, memory, load, and filesystem samples are inside the default guardrails.",
    },
  ]);
});

test("applies custom monitor alert rules", () => {
  const { evaluateMonitorAlerts } = loadModule("monitorSnapshot.ts");
  const relaxedRules = {
    cpuWarn: 95,
    cpuCritical: 99,
    memoryWarn: 95,
    memoryCritical: 99,
    diskWarn: 95,
    diskCritical: 99,
    loadPerCoreWarn: 4,
    loadPerCoreCritical: 8,
  };

  const alerts = evaluateMonitorAlerts(snapshot({
    cpuPercent: 88,
    memoryPercent: 91,
    loadAverage: "10.20 8.00 6.10",
    filesystems: [{ filesystem: "/dev/sdb1", type: "xfs", mount: "/var/log", percent: 92, totalLabel: "50.0 GB", usedLabel: "46.0 GB", availableLabel: "4.0 GB" }],
  }), relaxedRules);

  assert.deepEqual(plain(alerts.map((alert) => alert.id)), ["healthy"]);
});

test("waits for enough persisted samples before baseline insights", () => {
  const { buildMonitorBaselineInsights } = loadModule("monitorSnapshot.ts");

  assert.deepEqual(plain(buildMonitorBaselineInsights(snapshot(), [])), {
    status: "learning",
    sampleCount: 0,
    summary: "Collecting more samples before comparing against a local baseline.",
    metrics: [],
  });
});

test("compares current monitor sample against persisted baseline", () => {
  const { buildMonitorBaselineInsights } = loadModule("monitorSnapshot.ts");
  const history = [
    { id: "newest", cpuPercent: 88, memoryPercent: 72, diskPercent: 79, alertLevel: "warn", createdAt: "2026-06-24T02:04:00.000Z" },
    { id: "old-1", cpuPercent: 42, memoryPercent: 70, diskPercent: 78, alertLevel: "ok", createdAt: "2026-06-24T02:03:00.000Z" },
    { id: "old-2", cpuPercent: 44, memoryPercent: 71, diskPercent: 78, alertLevel: "ok", createdAt: "2026-06-24T02:02:00.000Z" },
    { id: "old-3", cpuPercent: 46, memoryPercent: 72, diskPercent: 79, alertLevel: "ok", createdAt: "2026-06-24T02:01:00.000Z" },
  ];

  const insights = buildMonitorBaselineInsights(snapshot({ cpuPercent: 88, memoryPercent: 73, diskPercent: 80 }), history);

  assert.equal(insights.status, "shift");
  assert.equal(insights.sampleCount, 4);
  assert.equal(insights.summary, "CPU is 44 pts above its recent baseline.");
  assert.deepEqual(plain(insights.metrics[0]), {
    id: "cpu",
    label: "CPU",
    current: 88,
    average: 44,
    delta: 44,
    tone: "critical",
    detail: "44 pts above baseline",
  });
  assert.equal(insights.metrics[1].tone, "stable");
});

test("builds a runbook from active monitor alerts and baseline shifts", () => {
  const { buildMonitorBaselineInsights, buildMonitorRunbook, evaluateMonitorAlerts } = loadModule("monitorSnapshot.ts");
  const current = snapshot({
    cpuPercent: 91,
    memoryPercent: 92,
    diskPercent: 88,
    loadAverage: "11.20 8.00 6.10",
    filesystems: [
      { filesystem: "/dev/sda1", type: "ext4", mount: "/", percent: 88, totalLabel: "100.0 GB", usedLabel: "88.0 GB", availableLabel: "12.0 GB" },
    ],
  });
  const baseline = buildMonitorBaselineInsights(current, [
    { id: "newest", cpuPercent: 91, memoryPercent: 92, diskPercent: 88, alertLevel: "warn", createdAt: "2026-06-24T02:04:00.000Z" },
    { id: "old-1", cpuPercent: 42, memoryPercent: 70, diskPercent: 78, alertLevel: "ok", createdAt: "2026-06-24T02:03:00.000Z" },
    { id: "old-2", cpuPercent: 44, memoryPercent: 71, diskPercent: 78, alertLevel: "ok", createdAt: "2026-06-24T02:02:00.000Z" },
    { id: "old-3", cpuPercent: 46, memoryPercent: 72, diskPercent: 79, alertLevel: "ok", createdAt: "2026-06-24T02:01:00.000Z" },
  ]);

  const runbook = buildMonitorRunbook(current, evaluateMonitorAlerts(current), baseline);

  assert.equal(runbook.status, "ready");
  assert.equal(runbook.summary, "4 signals need attention. Start with CPU or load before changing services.");
  assert.deepEqual(plain(runbook.steps.map((step) => step.id)), ["cpu-load", "memory", "filesystem:/"]);
  assert.equal(runbook.steps[0].priority, "now");
  assert.ok(runbook.steps[0].commands[0].command.includes("ps -eo"));
  assert.ok(runbook.steps[2].commands[1].command.includes("du -xhd1 /"));
});

test("returns a watch runbook for healthy monitor state", () => {
  const { buildMonitorBaselineInsights, buildMonitorRunbook, evaluateMonitorAlerts } = loadModule("monitorSnapshot.ts");
  const current = snapshot({ cpuPercent: 41, memoryPercent: 58, diskPercent: 62, filesystems: [] });
  const baseline = buildMonitorBaselineInsights(current, [
    { id: "h1", cpuPercent: 40, memoryPercent: 57, diskPercent: 62, alertLevel: "ok", createdAt: "2026-06-24T02:04:00.000Z" },
    { id: "h2", cpuPercent: 41, memoryPercent: 58, diskPercent: 61, alertLevel: "ok", createdAt: "2026-06-24T02:03:00.000Z" },
    { id: "h3", cpuPercent: 39, memoryPercent: 56, diskPercent: 62, alertLevel: "ok", createdAt: "2026-06-24T02:02:00.000Z" },
  ]);

  const runbook = buildMonitorRunbook(current, evaluateMonitorAlerts(current), baseline);

  assert.equal(runbook.status, "watching");
  assert.equal(runbook.steps[0].title, "Keep watching the local baseline");
  assert.equal(runbook.steps[0].priority, "watch");
});

test("forecasts threshold burn rate from persisted history", () => {
  const { DEFAULT_MONITOR_RULES, buildMonitorForecast } = loadModule("monitorSnapshot.ts");
  const forecast = buildMonitorForecast(
    snapshot({ cpuPercent: 62, memoryPercent: 69, diskPercent: 84, updatedAt: "2026-06-24T03:00:00.000Z" }),
    [
      { id: "h3", cpuPercent: 61, memoryPercent: 68, diskPercent: 80, alertLevel: "ok", createdAt: "2026-06-24T02:00:00.000Z" },
      { id: "h2", cpuPercent: 57, memoryPercent: 66, diskPercent: 76, alertLevel: "ok", createdAt: "2026-06-24T01:00:00.000Z" },
      { id: "h1", cpuPercent: 54, memoryPercent: 64, diskPercent: 72, alertLevel: "ok", createdAt: "2026-06-24T00:00:00.000Z" },
    ],
    DEFAULT_MONITOR_RULES,
  );

  assert.equal(forecast.status, "rising");
  assert.equal(forecast.summary, "Disk is rising 4 pts/hr; critical in about 2h.");
  assert.deepEqual(plain(forecast.metrics[2]), {
    id: "disk",
    label: "Disk",
    current: 84,
    changePerHour: 4,
    threshold: 90,
    etaLabel: "about 2h",
    tone: "warn",
    detail: "+4 pts/hr to 90%",
  });
});

test("waits for enough timestamped samples before forecasting", () => {
  const { DEFAULT_MONITOR_RULES, buildMonitorForecast } = loadModule("monitorSnapshot.ts");

  assert.deepEqual(plain(buildMonitorForecast(snapshot(), [], DEFAULT_MONITOR_RULES)), {
    status: "learning",
    sampleCount: 0,
    summary: "Collecting timestamped samples before estimating trend.",
    metrics: [],
  });
});

test("builds a markdown ops brief from monitor evidence", () => {
  const {
    DEFAULT_MONITOR_RULES,
    buildMonitorBaselineInsights,
    buildMonitorForecast,
    buildMonitorOpsBrief,
    buildMonitorRunbook,
    evaluateMonitorAlerts,
  } = loadModule("monitorSnapshot.ts");
  const current = snapshot({
    cpuPercent: 91,
    memoryPercent: 92,
    diskPercent: 88,
    loadAverage: "11.20 8.00 6.10",
    updatedAt: "2026-06-24T03:00:00.000Z",
    filesystems: [
      { filesystem: "/dev/sda1", type: "ext4", mount: "/", percent: 88, totalLabel: "100.0 GB", usedLabel: "88.0 GB", availableLabel: "12.0 GB" },
    ],
  });
  const history = [
    { id: "h3", cpuPercent: 91, memoryPercent: 92, diskPercent: 88, alertLevel: "warn", createdAt: "2026-06-24T02:00:00.000Z" },
    { id: "h2", cpuPercent: 57, memoryPercent: 66, diskPercent: 76, alertLevel: "ok", createdAt: "2026-06-24T01:00:00.000Z" },
    { id: "h1", cpuPercent: 54, memoryPercent: 64, diskPercent: 72, alertLevel: "ok", createdAt: "2026-06-24T00:00:00.000Z" },
  ];
  const alerts = evaluateMonitorAlerts(current);
  const baseline = buildMonitorBaselineInsights(current, history);
  const forecast = buildMonitorForecast(current, history, DEFAULT_MONITOR_RULES);
  const runbook = buildMonitorRunbook(current, alerts, baseline);

  const brief = buildMonitorOpsBrief(current, alerts, baseline, forecast, runbook);

  assert.ok(brief.startsWith("# Monitor Ops Brief"));
  assert.ok(brief.includes("- CPU: 91%"));
  assert.ok(brief.includes("## Active Alerts"));
  assert.ok(brief.includes("[warn] High CPU usage"));
  assert.ok(brief.includes("## Baseline Insights"));
  assert.ok(brief.includes("## Trend Forecast"));
  assert.ok(brief.includes("## Runbook Advisor"));
  assert.ok(brief.includes("Top CPU: `ps -eo pid,ppid,user,comm,pcpu,pmem,rss --sort=-pcpu | head -20`"));
});

test("builds a waiting ops brief without a monitor sample", () => {
  const { buildMonitorOpsBrief } = loadModule("monitorSnapshot.ts");

  assert.equal(
    buildMonitorOpsBrief(null, [], { status: "waiting", sampleCount: 0, summary: "waiting", metrics: [] }, { status: "waiting", sampleCount: 0, summary: "waiting", metrics: [] }, { status: "waiting", summary: "waiting", steps: [] }),
    "# Monitor Ops Brief\n\nNo trusted monitor sample has been collected yet.",
  );
});

test("builds a critical monitor health score from combined evidence", () => {
  const {
    DEFAULT_MONITOR_RULES,
    buildMonitorBaselineInsights,
    buildMonitorForecast,
    buildMonitorHealthScore,
    buildMonitorRunbook,
    evaluateMonitorAlerts,
  } = loadModule("monitorSnapshot.ts");
  const current = snapshot({
    cpuPercent: 91,
    memoryPercent: 92,
    diskPercent: 88,
    loadAverage: "11.20 8.00 6.10",
    filesystems: [
      { filesystem: "/dev/sda1", type: "ext4", mount: "/", percent: 88, totalLabel: "100.0 GB", usedLabel: "88.0 GB", availableLabel: "12.0 GB" },
    ],
  });
  const history = [
    { id: "h3", cpuPercent: 91, memoryPercent: 92, diskPercent: 88, alertLevel: "warn", createdAt: "2026-06-24T02:00:00.000Z" },
    { id: "h2", cpuPercent: 57, memoryPercent: 66, diskPercent: 76, alertLevel: "ok", createdAt: "2026-06-24T01:00:00.000Z" },
    { id: "h1", cpuPercent: 54, memoryPercent: 64, diskPercent: 72, alertLevel: "ok", createdAt: "2026-06-24T00:00:00.000Z" },
  ];
  const alerts = evaluateMonitorAlerts(current);
  const baseline = buildMonitorBaselineInsights(current, history);
  const forecast = buildMonitorForecast(current, history, DEFAULT_MONITOR_RULES);
  const runbook = buildMonitorRunbook(current, alerts, baseline);

  const score = buildMonitorHealthScore(current, alerts, baseline, forecast, runbook);

  assert.equal(score.score, 0);
  assert.equal(score.status, "critical");
  assert.equal(score.summary, "Health score 0/100: immediate attention required.");
  assert.ok(score.factors.includes("2 critical alerts"));
  assert.ok(score.factors.includes("3 rising forecasts"));
});

test("builds a healthy monitor health score", () => {
  const {
    DEFAULT_MONITOR_RULES,
    buildMonitorBaselineInsights,
    buildMonitorForecast,
    buildMonitorHealthScore,
    buildMonitorRunbook,
    evaluateMonitorAlerts,
  } = loadModule("monitorSnapshot.ts");
  const current = snapshot({ cpuPercent: 41, memoryPercent: 58, diskPercent: 62, filesystems: [] });
  const history = [
    { id: "h1", cpuPercent: 40, memoryPercent: 57, diskPercent: 62, alertLevel: "ok", createdAt: "2026-06-24T02:00:00.000Z" },
    { id: "h2", cpuPercent: 41, memoryPercent: 58, diskPercent: 61, alertLevel: "ok", createdAt: "2026-06-24T01:00:00.000Z" },
    { id: "h3", cpuPercent: 39, memoryPercent: 56, diskPercent: 62, alertLevel: "ok", createdAt: "2026-06-24T00:00:00.000Z" },
  ];
  const alerts = evaluateMonitorAlerts(current);
  const baseline = buildMonitorBaselineInsights(current, history);
  const forecast = buildMonitorForecast(current, history, DEFAULT_MONITOR_RULES);
  const runbook = buildMonitorRunbook(current, alerts, baseline);

  const score = buildMonitorHealthScore(current, alerts, baseline, forecast, runbook);

  assert.equal(score.score, 100);
  assert.equal(score.status, "healthy");
  assert.deepEqual(plain(score.factors), ["No active risk signals"]);
});

test("builds a monitor risk timeline from persisted history", () => {
  const { DEFAULT_MONITOR_RULES, buildMonitorRiskTimeline } = loadModule("monitorSnapshot.ts");
  const timeline = buildMonitorRiskTimeline([
    { id: "old-ok", cpuPercent: 42, memoryPercent: 61, diskPercent: 70, alertLevel: "ok", createdAt: "2026-06-24T00:00:00.000Z" },
    { id: "warn-mem", cpuPercent: 58, memoryPercent: 87, diskPercent: 74, alertLevel: "warn", createdAt: "2026-06-24T02:00:00.000Z" },
    { id: "critical-cpu", cpuPercent: 97, memoryPercent: 92, diskPercent: 91, alertLevel: "critical", createdAt: "2026-06-24T03:00:00.000Z" },
    { id: "recent-ok", cpuPercent: 45, memoryPercent: 62, diskPercent: 71, alertLevel: "ok", createdAt: "2026-06-24T04:00:00.000Z" },
  ], DEFAULT_MONITOR_RULES, 3);

  assert.equal(timeline.status, "ready");
  assert.equal(timeline.sampleCount, 4);
  assert.equal(timeline.summary, "2 risky samples across the last 3 monitor snapshots.");
  assert.deepEqual(plain(timeline.entries.map((entry) => entry.id)), ["recent-ok", "critical-cpu", "warn-mem"]);
  assert.deepEqual(plain(timeline.entries.map((entry) => entry.timeLabel)), ["04:00", "03:00", "02:00"]);
  assert.equal(timeline.entries[0].tone, "ok");
  assert.equal(timeline.entries[1].tone, "critical");
  assert.equal(timeline.entries[1].summary, "CPU 97% crossed critical threshold.");
  assert.deepEqual(plain(timeline.entries[1].metrics.map((metric) => metric.tone)), ["critical", "critical", "critical"]);
  assert.equal(timeline.entries[2].tone, "warn");
  assert.equal(timeline.entries[2].summary, "Memory 87% crossed warning threshold.");
});

test("returns an empty monitor risk timeline without history", () => {
  const { buildMonitorRiskTimeline } = loadModule("monitorSnapshot.ts");

  assert.deepEqual(plain(buildMonitorRiskTimeline([])), {
    status: "empty",
    sampleCount: 0,
    summary: "Collect monitor samples to build a risk timeline.",
    entries: [],
  });
});

test("classifies a worsening monitor incident phase", () => {
  const {
    DEFAULT_MONITOR_RULES,
    buildMonitorForecast,
    buildMonitorIncidentPhase,
    buildMonitorRiskTimeline,
  } = loadModule("monitorSnapshot.ts");
  const current = snapshot({ cpuPercent: 91, memoryPercent: 82, diskPercent: 88, filesystems: [] });
  const history = [
    { id: "new", cpuPercent: 91, memoryPercent: 82, diskPercent: 88, alertLevel: "warn", createdAt: "2026-06-24T03:00:00.000Z" },
    { id: "old-2", cpuPercent: 57, memoryPercent: 66, diskPercent: 76, alertLevel: "ok", createdAt: "2026-06-24T02:00:00.000Z" },
    { id: "old-1", cpuPercent: 54, memoryPercent: 64, diskPercent: 72, alertLevel: "ok", createdAt: "2026-06-24T01:00:00.000Z" },
  ];

  const phase = buildMonitorIncidentPhase(
    current,
    { score: 62, status: "degraded", summary: "degraded", factors: ["2 warning alerts"] },
    buildMonitorForecast(current, history, DEFAULT_MONITOR_RULES),
    buildMonitorRiskTimeline(history, DEFAULT_MONITOR_RULES),
  );

  assert.equal(phase.status, "worsening");
  assert.equal(phase.label, "Worsening");
  assert.equal(phase.summary, "Incident phase: worsening. Risk increased in the latest sample and forecast still points upward.");
  assert.deepEqual(plain(phase.evidence), [
    "Latest sample moved from ok to warn",
    "Trend forecast is still rising",
    "Health score is 62/100",
  ]);
});

test("classifies a recovering monitor incident phase", () => {
  const {
    DEFAULT_MONITOR_RULES,
    buildMonitorForecast,
    buildMonitorIncidentPhase,
    buildMonitorRiskTimeline,
  } = loadModule("monitorSnapshot.ts");
  const current = snapshot({ cpuPercent: 44, memoryPercent: 62, diskPercent: 70, filesystems: [] });
  const history = [
    { id: "new", cpuPercent: 44, memoryPercent: 62, diskPercent: 70, alertLevel: "ok", createdAt: "2026-06-24T03:00:00.000Z" },
    { id: "old-2", cpuPercent: 97, memoryPercent: 92, diskPercent: 91, alertLevel: "critical", createdAt: "2026-06-24T02:00:00.000Z" },
    { id: "old-1", cpuPercent: 91, memoryPercent: 90, diskPercent: 88, alertLevel: "warn", createdAt: "2026-06-24T01:00:00.000Z" },
  ];

  const phase = buildMonitorIncidentPhase(
    current,
    { score: 91, status: "healthy", summary: "healthy", factors: ["No active risk signals"] },
    buildMonitorForecast(current, history, DEFAULT_MONITOR_RULES),
    buildMonitorRiskTimeline(history, DEFAULT_MONITOR_RULES),
  );

  assert.equal(phase.status, "recovering");
  assert.equal(phase.label, "Recovering");
  assert.equal(phase.summary, "Incident phase: recovering. Latest sample improved against the prior risk state.");
  assert.deepEqual(plain(phase.evidence), [
    "Latest sample moved from critical to ok",
    "Health score is 91/100",
  ]);
});

test("builds a page-now escalation window from worsening critical evidence", () => {
  const {
    DEFAULT_MONITOR_RULES,
    buildMonitorEscalationWindow,
    buildMonitorForecast,
    buildMonitorIncidentPhase,
    buildMonitorRiskTimeline,
    buildMonitorRunbook,
    evaluateMonitorAlerts,
    buildMonitorBaselineInsights,
  } = loadModule("monitorSnapshot.ts");
  const current = snapshot({
    cpuPercent: 91,
    memoryPercent: 92,
    diskPercent: 88,
    loadAverage: "11.20 8.00 6.10",
    filesystems: [{ filesystem: "/dev/sda1", type: "ext4", mount: "/", percent: 88, availableLabel: "12.0 GB" }],
  });
  const history = [
    { id: "new", cpuPercent: 91, memoryPercent: 92, diskPercent: 88, alertLevel: "warn", createdAt: "2026-06-24T03:00:00.000Z" },
    { id: "old-2", cpuPercent: 57, memoryPercent: 66, diskPercent: 76, alertLevel: "ok", createdAt: "2026-06-24T02:00:00.000Z" },
    { id: "old-1", cpuPercent: 54, memoryPercent: 64, diskPercent: 72, alertLevel: "ok", createdAt: "2026-06-24T01:00:00.000Z" },
  ];
  const baseline = buildMonitorBaselineInsights(current, history);
  const forecast = buildMonitorForecast(current, history, DEFAULT_MONITOR_RULES);
  const runbook = buildMonitorRunbook(current, evaluateMonitorAlerts(current), baseline);
  const phase = buildMonitorIncidentPhase(
    current,
    { score: 0, status: "critical", summary: "critical", factors: ["2 critical alerts"] },
    forecast,
    buildMonitorRiskTimeline(history, DEFAULT_MONITOR_RULES),
  );

  const window = buildMonitorEscalationWindow(phase, { score: 0, status: "critical", summary: "critical", factors: [] }, forecast, runbook);

  assert.equal(window.status, "page");
  assert.equal(window.label, "Page Now");
  assert.equal(window.deadline, "Now");
  assert.equal(window.summary, "Escalation window: page now. Worsening incident with critical health evidence.");
  assert.deepEqual(plain(window.actions), [
    "Start runbook: Confirm CPU and scheduler pressure",
    "Track forecast: CPU critical in 13m",
    "Share incident context with the on-call owner",
  ]);
});

test("builds an observe escalation window for recovery", () => {
  const { buildMonitorEscalationWindow } = loadModule("monitorSnapshot.ts");

  const window = buildMonitorEscalationWindow(
    {
      status: "recovering",
      label: "Recovering",
      summary: "Incident phase: recovering.",
      evidence: ["Latest sample moved from critical to ok"],
    },
    { score: 91, status: "healthy", summary: "healthy", factors: ["No active risk signals"] },
    { status: "steady", sampleCount: 3, summary: "No resource is trending quickly toward its critical threshold.", metrics: [] },
    { status: "watching", summary: "watch", steps: [] },
  );

  assert.equal(window.status, "watch");
  assert.equal(window.label, "Observe");
  assert.equal(window.deadline, "Next 2 samples");
  assert.equal(window.summary, "Escalation window: observe. Recovery is visible; verify the next two samples before closing.");
  assert.deepEqual(plain(window.actions), [
    "Confirm Risk Timeline keeps improving",
    "Keep Ops Brief ready if risk returns",
  ]);
});

test("builds a markdown escalation brief for handoff", () => {
  const {
    DEFAULT_MONITOR_RULES,
    buildMonitorBaselineInsights,
    buildMonitorEscalationBrief,
    buildMonitorEscalationWindow,
    buildMonitorForecast,
    buildMonitorHealthScore,
    buildMonitorIncidentPhase,
    buildMonitorRiskTimeline,
    buildMonitorRunbook,
    evaluateMonitorAlerts,
  } = loadModule("monitorSnapshot.ts");
  const current = snapshot({
    cpuPercent: 91,
    memoryPercent: 92,
    diskPercent: 88,
    loadAverage: "11.20 8.00 6.10",
    updatedAt: "2026-06-24T03:00:00.000Z",
    filesystems: [{ filesystem: "/dev/sda1", type: "ext4", mount: "/", percent: 88, availableLabel: "12.0 GB" }],
  });
  const history = [
    { id: "new", cpuPercent: 91, memoryPercent: 92, diskPercent: 88, alertLevel: "warn", createdAt: "2026-06-24T03:00:00.000Z" },
    { id: "old-2", cpuPercent: 57, memoryPercent: 66, diskPercent: 76, alertLevel: "ok", createdAt: "2026-06-24T02:00:00.000Z" },
    { id: "old-1", cpuPercent: 54, memoryPercent: 64, diskPercent: 72, alertLevel: "ok", createdAt: "2026-06-24T01:00:00.000Z" },
  ];
  const alerts = evaluateMonitorAlerts(current);
  const baseline = buildMonitorBaselineInsights(current, history);
  const forecast = buildMonitorForecast(current, history, DEFAULT_MONITOR_RULES);
  const runbook = buildMonitorRunbook(current, alerts, baseline);
  const health = buildMonitorHealthScore(current, alerts, baseline, forecast, runbook);
  const phase = buildMonitorIncidentPhase(current, health, forecast, buildMonitorRiskTimeline(history, DEFAULT_MONITOR_RULES));
  const window = buildMonitorEscalationWindow(phase, health, forecast, runbook);

  const brief = buildMonitorEscalationBrief(current, phase, window, health, forecast, runbook);

  assert.ok(brief.startsWith("# Monitor Escalation Brief"));
  assert.ok(brief.includes("- Phase: Worsening"));
  assert.ok(brief.includes("- Escalation: Page Now (Now)"));
  assert.ok(brief.includes("- Health score: 0/100"));
  assert.ok(brief.includes("- Forecast: CPU is rising 18.5 pts/hr; critical in 13m."));
  assert.ok(brief.includes("1. Start runbook: Confirm CPU and scheduler pressure"));
  assert.ok(brief.includes("- First runbook step: Confirm CPU and scheduler pressure"));
});

test("builds a waiting escalation brief without a monitor sample", () => {
  const { buildMonitorEscalationBrief } = loadModule("monitorSnapshot.ts");

  assert.equal(
    buildMonitorEscalationBrief(null, { status: "waiting", label: "Waiting", summary: "waiting", evidence: [] }, { status: "waiting", label: "Waiting", deadline: "No sample", summary: "waiting", actions: [] }, { score: 0, status: "critical", summary: "waiting", factors: [] }, { status: "waiting", sampleCount: 0, summary: "waiting", metrics: [] }, { status: "waiting", summary: "waiting", steps: [] }),
    "# Monitor Escalation Brief\n\nNo trusted monitor sample has been collected yet.",
  );
});

test("blocks recovery closure while escalation remains active", () => {
  const { buildMonitorRecoveryGate } = loadModule("monitorSnapshot.ts");

  const gate = buildMonitorRecoveryGate(
    {
      status: "worsening",
      label: "Worsening",
      summary: "Incident phase: worsening.",
      evidence: ["Trend forecast is still rising"],
    },
    { score: 0, status: "critical", summary: "critical", factors: ["3 rising forecasts"] },
    { status: "rising", sampleCount: 4, summary: "CPU is rising 15 pts/hr; critical in 16m.", metrics: [] },
    {
      status: "ready",
      sampleCount: 4,
      summary: "1 risky sample across the last 4 monitor snapshots.",
      entries: [
        { id: "new", createdAt: "2026-06-24T03:00:00.000Z", timeLabel: "03:00", tone: "warn", summary: "CPU 91% crossed warning threshold.", metrics: [] },
        { id: "old", createdAt: "2026-06-24T02:00:00.000Z", timeLabel: "02:00", tone: "ok", summary: "All tracked metrics inside watch rules.", metrics: [] },
      ],
    },
  );

  assert.equal(gate.status, "blocked");
  assert.equal(gate.label, "Do Not Close");
  assert.equal(gate.summary, "Recovery gate: blocked. Escalation remains active until health, forecast, and timeline are clean.");
  assert.deepEqual(plain(gate.criteria), [
    { label: "Health score >= 90", status: "blocked", detail: "0/100" },
    { label: "Forecast steady", status: "blocked", detail: "rising" },
    { label: "Latest sample clean", status: "blocked", detail: "warn" },
    { label: "Incident stable or recovering", status: "blocked", detail: "worsening" },
  ]);
});

test("marks recovery gate ready after clean stable evidence", () => {
  const { buildMonitorRecoveryGate } = loadModule("monitorSnapshot.ts");

  const gate = buildMonitorRecoveryGate(
    {
      status: "stable",
      label: "Stable",
      summary: "Incident phase: stable.",
      evidence: ["Health score is 96/100"],
    },
    { score: 96, status: "healthy", summary: "healthy", factors: ["No active risk signals"] },
    { status: "steady", sampleCount: 4, summary: "No resource is trending quickly toward its critical threshold.", metrics: [] },
    {
      status: "ready",
      sampleCount: 4,
      summary: "No risky samples across the last 4 monitor snapshots.",
      entries: [
        { id: "new", createdAt: "2026-06-24T03:00:00.000Z", timeLabel: "03:00", tone: "ok", summary: "All tracked metrics inside watch rules.", metrics: [] },
        { id: "old", createdAt: "2026-06-24T02:00:00.000Z", timeLabel: "02:00", tone: "ok", summary: "All tracked metrics inside watch rules.", metrics: [] },
      ],
    },
  );

  assert.equal(gate.status, "ready");
  assert.equal(gate.label, "Ready To Close");
  assert.equal(gate.summary, "Recovery gate: ready. Health, forecast, and recent samples are clean.");
  assert.deepEqual(plain(gate.actions), [
    "Confirm service owner agrees with closeout",
    "Attach Escalation Brief to the incident record",
  ]);
});

test("builds an active impact window from the latest risky sample", () => {
  const { buildMonitorImpactWindow } = loadModule("monitorSnapshot.ts");

  const impact = buildMonitorImpactWindow({
    status: "ready",
    sampleCount: 4,
    summary: "1 risky sample across the last 4 monitor snapshots.",
    entries: [
      { id: "new", createdAt: "2026-06-24T03:00:00.000Z", timeLabel: "03:00", tone: "warn", summary: "CPU 91% crossed warning threshold.", metrics: [] },
      { id: "old", createdAt: "2026-06-24T02:00:00.000Z", timeLabel: "02:00", tone: "ok", summary: "All tracked metrics inside watch rules.", metrics: [] },
    ],
  });

  assert.equal(impact.status, "active");
  assert.equal(impact.label, "Active Impact");
  assert.equal(impact.startedAtLabel, "03:00");
  assert.equal(impact.endedAtLabel, "Active");
  assert.equal(impact.durationLabel, "latest sample");
  assert.equal(impact.summary, "Impact window: active since 03:00. Latest monitor sample is still risky.");
  assert.deepEqual(plain(impact.evidence), [
    "Latest risky tone: warn",
    "Previous clean sample: 02:00",
  ]);
});

test("builds a recovered impact window after risky samples clear", () => {
  const { buildMonitorImpactWindow } = loadModule("monitorSnapshot.ts");

  const impact = buildMonitorImpactWindow({
    status: "ready",
    sampleCount: 4,
    summary: "Recovered after risk.",
    entries: [
      { id: "clean", createdAt: "2026-06-24T04:00:00.000Z", timeLabel: "04:00", tone: "ok", summary: "All tracked metrics inside watch rules.", metrics: [] },
      { id: "critical", createdAt: "2026-06-24T03:00:00.000Z", timeLabel: "03:00", tone: "critical", summary: "CPU 97% crossed critical threshold.", metrics: [] },
      { id: "warn", createdAt: "2026-06-24T02:00:00.000Z", timeLabel: "02:00", tone: "warn", summary: "CPU 91% crossed warning threshold.", metrics: [] },
      { id: "before", createdAt: "2026-06-24T01:00:00.000Z", timeLabel: "01:00", tone: "ok", summary: "All tracked metrics inside watch rules.", metrics: [] },
    ],
  });

  assert.equal(impact.status, "recovered");
  assert.equal(impact.label, "Recovered");
  assert.equal(impact.startedAtLabel, "02:00");
  assert.equal(impact.endedAtLabel, "04:00");
  assert.equal(impact.durationLabel, "about 2h");
  assert.equal(impact.summary, "Impact window: recovered. Risk ran from 02:00 to 04:00.");
  assert.deepEqual(plain(impact.evidence), [
    "2 risky samples before recovery",
    "Latest clean sample: 04:00",
  ]);
});

test("builds a focused root cause lens from correlated CPU and load evidence", () => {
  const { buildMonitorRootCauseLens } = loadModule("monitorSnapshot.ts");

  const lens = buildMonitorRootCauseLens(
    [
      { id: "cpu", severity: "warn", title: "High CPU usage", detail: "CPU is at 91%." },
      { id: "load", severity: "warn", title: "Load is high for core count", detail: "1-minute load is 7.20 on 4 cores." },
    ],
    {
      status: "shift",
      sampleCount: 4,
      summary: "CPU is 47 pts above its recent baseline.",
      metrics: [
        { id: "cpu", label: "CPU", current: 91, average: 44, delta: 47, tone: "critical", detail: "47 pts above baseline" },
        { id: "memory", label: "Memory", current: 82, average: 71, delta: 11, tone: "warn", detail: "11 pts above baseline" },
      ],
    },
    {
      status: "rising",
      sampleCount: 4,
      summary: "CPU is rising 15 pts/hr; critical in 16m.",
      metrics: [
        { id: "cpu", label: "CPU", current: 91, changePerHour: 15, threshold: 95, etaLabel: "16m", tone: "critical", detail: "+15 pts/hr to 95%" },
        { id: "memory", label: "Memory", current: 82, changePerHour: 3.3, threshold: 90, etaLabel: "about 3h", tone: "warn", detail: "+3.3 pts/hr to 90%" },
      ],
    },
    {
      status: "ready",
      summary: "4 signals need attention.",
      steps: [
        { id: "cpu-load", priority: "now", title: "Confirm CPU and scheduler pressure", rationale: "CPU or load is outside guardrails.", commands: [] },
        { id: "memory", priority: "next", title: "Check memory pressure and OOM risk", rationale: "Memory is high.", commands: [] },
      ],
    },
    {
      status: "ready",
      sampleCount: 4,
      summary: "1 risky sample across the last 4 monitor snapshots.",
      entries: [
        {
          id: "new",
          createdAt: "2026-06-24T03:00:00.000Z",
          timeLabel: "03:00",
          tone: "warn",
          summary: "CPU 91% crossed warning threshold.",
          metrics: [
            { id: "cpu", label: "CPU", value: 91, tone: "warn" },
            { id: "memory", label: "Memory", value: 82, tone: "ok" },
            { id: "disk", label: "Disk", value: 88, tone: "warn" },
          ],
        },
      ],
    },
  );

  assert.equal(lens.status, "focused");
  assert.equal(lens.label, "CPU / Load");
  assert.equal(lens.confidenceLabel, "High");
  assert.equal(lens.summary, "Root cause lens: CPU / load is the leading suspect with high confidence.");
  assert.deepEqual(plain(lens.evidence), [
    "Active alert: High CPU usage",
    "Active alert: Load is high for core count",
    "Baseline: CPU 47 pts above baseline",
    "Forecast: CPU +15 pts/hr to critical",
    "Latest timeline: CPU warn",
  ]);
  assert.deepEqual(plain(lens.actions), [
    "Runbook: Confirm CPU and scheduler pressure",
    "Validate whether this is CPU saturation, run queue pressure, or IO wait before restarting services.",
  ]);
});

test("builds a clear root cause lens when monitor evidence is clean", () => {
  const { buildMonitorRootCauseLens } = loadModule("monitorSnapshot.ts");

  const lens = buildMonitorRootCauseLens(
    [{ id: "healthy", severity: "ok", title: "No active monitor alerts", detail: "clean" }],
    { status: "stable", sampleCount: 4, summary: "Current sample is close to baseline.", metrics: [] },
    { status: "steady", sampleCount: 4, summary: "No resource is trending quickly toward its critical threshold.", metrics: [] },
    { status: "watching", summary: "No active runbook actions.", steps: [] },
    {
      status: "ready",
      sampleCount: 4,
      summary: "No risky samples across the last 4 monitor snapshots.",
      entries: [
        { id: "new", createdAt: "2026-06-24T03:00:00.000Z", timeLabel: "03:00", tone: "ok", summary: "All tracked metrics inside watch rules.", metrics: [] },
      ],
    },
  );

  assert.equal(lens.status, "clear");
  assert.equal(lens.label, "No Root Cause");
  assert.equal(lens.confidenceLabel, "Clean");
  assert.equal(lens.summary, "Root cause lens: no active suspect from current monitor evidence.");
  assert.deepEqual(plain(lens.evidence), [
    "No active alerts",
    "Baseline is stable",
    "Forecast is steady",
    "Latest timeline sample is clean",
  ]);
});

test("builds an urgent mitigation plan from root cause and blocked recovery evidence", () => {
  const { buildMonitorMitigationPlan } = loadModule("monitorSnapshot.ts");

  const plan = buildMonitorMitigationPlan(
    {
      status: "focused",
      label: "Disk",
      confidenceLabel: "High",
      summary: "Root cause lens: disk is the leading suspect with high confidence.",
      evidence: ["Active alert: Filesystem / is 88% full"],
      actions: [
        "Runbook: Inspect filesystem growth on /",
        "Check filesystem and inode growth before deleting or rotating files.",
      ],
    },
    {
      status: "page",
      label: "Page Now",
      deadline: "Now",
      summary: "Escalation window: page now.",
      actions: ["Start runbook: Inspect filesystem growth on /"],
    },
    {
      status: "blocked",
      label: "Do Not Close",
      summary: "Recovery gate: blocked.",
      criteria: [],
      actions: ["Keep escalation window active"],
    },
    {
      status: "active",
      label: "Active Impact",
      startedAtLabel: "03:00",
      endedAtLabel: "Active",
      durationLabel: "latest sample",
      summary: "Impact window: active since 03:00.",
      evidence: ["Latest risky tone: warn"],
    },
    {
      status: "ready",
      summary: "4 signals need attention.",
      steps: [
        { id: "filesystem:/", priority: "now", title: "Inspect filesystem growth on /", rationale: "Disk pressure can turn into write failures.", commands: [] },
      ],
    },
  );

  assert.equal(plan.status, "urgent");
  assert.equal(plan.label, "Act Now");
  assert.equal(plan.summary, "Mitigation plan: act on Disk now, then prove the recovery gate can reopen.");
  assert.deepEqual(plain(plan.steps), [
    {
      id: "mitigate",
      priority: "now",
      title: "Execute Disk mitigation",
      detail: "Runbook: Inspect filesystem growth on /",
      guardrail: "Use reversible checks first; avoid destructive cleanup until filesystem and inode growth are confirmed.",
    },
    {
      id: "verify",
      priority: "verify",
      title: "Verify recovery gate",
      detail: "Recovery gate is blocked; wait for health, forecast, and latest timeline evidence to clear before closeout.",
      guardrail: "Do not close while impact remains active.",
    },
    {
      id: "communicate",
      priority: "next",
      title: "Communicate impact",
      detail: "Escalation is Page Now (Now); include Active Impact and root cause evidence in the handoff.",
      guardrail: "Keep escalation active until a clean sample confirms mitigation.",
    },
  ]);
});

test("builds a standby mitigation plan when monitor evidence is clear", () => {
  const { buildMonitorMitigationPlan } = loadModule("monitorSnapshot.ts");

  const plan = buildMonitorMitigationPlan(
    {
      status: "clear",
      label: "No Root Cause",
      confidenceLabel: "Clean",
      summary: "Root cause lens: no active suspect from current monitor evidence.",
      evidence: ["No active alerts"],
      actions: ["Continue normal monitoring"],
    },
    { status: "none", label: "No Escalation", deadline: "None", summary: "stable", actions: [] },
    { status: "ready", label: "Ready To Close", summary: "ready", criteria: [], actions: [] },
    { status: "none", label: "No Impact", startedAtLabel: "none", endedAtLabel: "none", durationLabel: "none", summary: "none", evidence: [] },
    { status: "watching", summary: "No active runbook actions.", steps: [] },
  );

  assert.equal(plan.status, "standby");
  assert.equal(plan.label, "Standby");
  assert.equal(plan.summary, "Mitigation plan: no active mitigation is recommended.");
  assert.deepEqual(plain(plan.steps), [
    {
      id: "watch",
      priority: "verify",
      title: "Continue monitoring",
      detail: "Root cause lens is clean and no escalation is active.",
      guardrail: "Collect another sample before reopening if symptoms return.",
    },
  ]);
});

test("builds a markdown mitigation brief for action handoff", () => {
  const { buildMonitorMitigationBrief } = loadModule("monitorSnapshot.ts");

  const brief = buildMonitorMitigationBrief(
    snapshot({ updatedAt: "2026-06-24T03:00:00.000Z", diskPercent: 88, loadAverage: "7.20 6.80 5.90" }),
    {
      status: "focused",
      label: "Disk",
      confidenceLabel: "High",
      summary: "Root cause lens: disk is the leading suspect with high confidence.",
      evidence: ["Active alert: Filesystem / is 88% full", "Forecast: Disk +4 pts/hr to critical"],
      actions: ["Runbook: Inspect filesystem growth on /"],
    },
    {
      status: "urgent",
      label: "Act Now",
      summary: "Mitigation plan: act on Disk now, then prove the recovery gate can reopen.",
      steps: [
        { id: "mitigate", priority: "now", title: "Execute Disk mitigation", detail: "Runbook: Inspect filesystem growth on /", guardrail: "Use reversible checks first." },
        { id: "verify", priority: "verify", title: "Verify recovery gate", detail: "Recovery gate is blocked.", guardrail: "Do not close while impact remains active." },
      ],
    },
    { status: "page", label: "Page Now", deadline: "Now", summary: "Escalation window: page now.", actions: ["Start runbook: Inspect filesystem growth on /"] },
    { status: "blocked", label: "Do Not Close", summary: "Recovery gate: blocked.", criteria: [], actions: ["Keep escalation window active"] },
    { status: "active", label: "Active Impact", startedAtLabel: "03:00", endedAtLabel: "Active", durationLabel: "latest sample", summary: "Impact window: active since 03:00.", evidence: ["Latest risky tone: warn"] },
  );

  assert.ok(brief.startsWith("# Monitor Mitigation Brief"));
  assert.ok(brief.includes("- Root cause: Disk (High confidence)"));
  assert.ok(brief.includes("- Mitigation: Act Now"));
  assert.ok(brief.includes("- Escalation: Page Now (Now)"));
  assert.ok(brief.includes("- Recovery gate: Do Not Close"));
  assert.ok(brief.includes("- Impact: Active Impact from 03:00 to Active (latest sample)"));
  assert.ok(brief.includes("1. [now] Execute Disk mitigation"));
  assert.ok(brief.includes("   - Detail: Runbook: Inspect filesystem growth on /"));
  assert.ok(brief.includes("   - Guardrail: Use reversible checks first."));
  assert.ok(brief.includes("- Active alert: Filesystem / is 88% full"));
});

test("builds a waiting mitigation brief without a monitor sample", () => {
  const { buildMonitorMitigationBrief } = loadModule("monitorSnapshot.ts");

  assert.equal(
    buildMonitorMitigationBrief(
      null,
      { status: "waiting", label: "Waiting", confidenceLabel: "Waiting", summary: "waiting", evidence: [], actions: [] },
      { status: "waiting", label: "Waiting", summary: "waiting", steps: [] },
      { status: "waiting", label: "Waiting", deadline: "No sample", summary: "waiting", actions: [] },
      { status: "waiting", label: "Waiting", summary: "waiting", criteria: [], actions: [] },
      { status: "waiting", label: "Waiting", startedAtLabel: "unknown", endedAtLabel: "unknown", durationLabel: "unknown", summary: "waiting", evidence: [] },
    ),
    "# Monitor Mitigation Brief\n\nNo trusted monitor sample has been collected yet.",
  );
});

test("builds a command safety pack from runbook commands", () => {
  const { buildMonitorCommandSafetyPack } = loadModule("monitorSnapshot.ts");

  const pack = buildMonitorCommandSafetyPack(
    {
      status: "ready",
      summary: "Disk runbook ready.",
      steps: [
        {
          id: "filesystem:/",
          priority: "now",
          title: "Inspect filesystem growth on /",
          rationale: "Disk pressure can turn into write failures.",
          commands: [
            { label: "Disk + inodes", command: "df -hT && df -ih" },
            { label: "Largest paths", command: "du -xhd1 / 2>/dev/null | sort -h | tail -20" },
            { label: "Cleanup logs", command: "rm -rf /var/log/*.gz" },
          ],
        },
        {
          id: "service",
          priority: "next",
          title: "Restart worker",
          rationale: "Only after owner approval.",
          commands: [
            { label: "Restart worker", command: "systemctl restart worker" },
          ],
        },
      ],
    },
    {
      status: "focused",
      label: "Disk",
      confidenceLabel: "High",
      summary: "Root cause lens: disk is the leading suspect with high confidence.",
      evidence: [],
      actions: [],
    },
    {
      status: "urgent",
      label: "Act Now",
      summary: "Mitigation plan: act on Disk now.",
      steps: [],
    },
  );

  assert.equal(pack.status, "guarded");
  assert.equal(pack.summary, "Command safety pack: 2 read-only commands, 0 low-risk commands, 2 high-risk commands require approval.");
  assert.deepEqual(plain(pack.groups.map((group) => ({ level: group.level, count: group.commands.length }))), [
    { level: "read_only", count: 2 },
    { level: "low_risk", count: 0 },
    { level: "high_risk", count: 2 },
  ]);
  assert.deepEqual(plain(pack.groups[0].commands.map((item) => item.label)), ["Disk + inodes", "Largest paths"]);
  assert.deepEqual(plain(pack.groups[2].commands.map((item) => item.safetyNote)), [
    "High-risk command: destructive file operation detected.",
    "High-risk command: service restart can cause customer-visible impact.",
  ]);
  assert.deepEqual(plain(pack.guardrails), [
    "Copy read-only commands first.",
    "Do not run high-risk commands without owner approval and rollback context.",
    "Root cause focus: Disk.",
  ]);
});

test("builds an empty command safety pack while waiting for runbook commands", () => {
  const { buildMonitorCommandSafetyPack } = loadModule("monitorSnapshot.ts");

  const pack = buildMonitorCommandSafetyPack(
    { status: "waiting", summary: "waiting", steps: [] },
    { status: "waiting", label: "Waiting", confidenceLabel: "Waiting", summary: "waiting", evidence: [], actions: [] },
    { status: "waiting", label: "Waiting", summary: "waiting", steps: [] },
  );

  assert.equal(pack.status, "waiting");
  assert.equal(pack.summary, "Command safety pack: waiting for runbook commands.");
  assert.deepEqual(plain(pack.guardrails), ["Collect monitor evidence before copying commands."]);
});

test("blocks verification checklist while recovery evidence is unsafe", () => {
  const { buildMonitorVerificationChecklist } = loadModule("monitorSnapshot.ts");

  const checklist = buildMonitorVerificationChecklist(
    { score: 1, status: "critical", summary: "critical", factors: ["warning alerts"] },
    { status: "rising", sampleCount: 4, summary: "CPU is rising.", metrics: [] },
    {
      status: "ready",
      sampleCount: 4,
      summary: "1 risky sample.",
      entries: [{ id: "new", createdAt: "2026-06-24T03:00:00.000Z", timeLabel: "03:00", tone: "warn", summary: "Disk 88% crossed warning threshold.", metrics: [] }],
    },
    { status: "blocked", label: "Do Not Close", summary: "Recovery gate: blocked.", criteria: [], actions: [] },
    { status: "active", label: "Active Impact", startedAtLabel: "03:00", endedAtLabel: "Active", durationLabel: "latest sample", summary: "Impact window: active.", evidence: [] },
    { status: "ready", summary: "Command safety pack: 9 read-only commands, 0 low-risk commands, 0 high-risk commands require approval.", groups: [], guardrails: [] },
  );

  assert.equal(checklist.status, "blocked");
  assert.equal(checklist.label, "Do Not Close");
  assert.equal(checklist.summary, "Verification checklist: 5 checks blocked. Keep mitigation active.");
  assert.deepEqual(plain(checklist.items), [
    { id: "health", label: "Health score >= 90", status: "blocked", detail: "1/100" },
    { id: "forecast", label: "Forecast steady", status: "blocked", detail: "rising" },
    { id: "latest", label: "Latest sample clean", status: "blocked", detail: "warn" },
    { id: "impact", label: "Impact window closed", status: "blocked", detail: "active" },
    { id: "commands", label: "Command safety reviewed", status: "passed", detail: "ready" },
    { id: "gate", label: "Recovery gate ready", status: "blocked", detail: "blocked" },
  ]);
});

test("marks verification checklist ready when all closeout evidence is clean", () => {
  const { buildMonitorVerificationChecklist } = loadModule("monitorSnapshot.ts");

  const checklist = buildMonitorVerificationChecklist(
    { score: 96, status: "healthy", summary: "healthy", factors: [] },
    { status: "steady", sampleCount: 4, summary: "steady", metrics: [] },
    {
      status: "ready",
      sampleCount: 4,
      summary: "clean",
      entries: [{ id: "new", createdAt: "2026-06-24T04:00:00.000Z", timeLabel: "04:00", tone: "ok", summary: "All tracked metrics inside watch rules.", metrics: [] }],
    },
    { status: "ready", label: "Ready To Close", summary: "Recovery gate: ready.", criteria: [], actions: [] },
    { status: "recovered", label: "Recovered", startedAtLabel: "02:00", endedAtLabel: "04:00", durationLabel: "about 2h", summary: "Impact window: recovered.", evidence: [] },
    { status: "ready", summary: "Command safety pack: ready.", groups: [], guardrails: [] },
  );

  assert.equal(checklist.status, "ready");
  assert.equal(checklist.label, "Ready To Close");
  assert.equal(checklist.summary, "Verification checklist: all closeout checks passed.");
  assert.deepEqual(plain(checklist.actions), [
    "Attach Mitigation Brief to the incident record",
    "Confirm service owner agrees with closeout",
  ]);
});

test("builds an active monitor session replay from timeline evidence", () => {
  const { buildMonitorSessionReplay } = loadModule("monitorSnapshot.ts");

  const replay = buildMonitorSessionReplay(
    {
      status: "ready",
      sampleCount: 4,
      summary: "1 risky sample across the last 4 monitor snapshots.",
      entries: [
        { id: "risk", createdAt: "2026-06-24T03:00:00.000Z", timeLabel: "03:00", tone: "warn", summary: "Disk 88% crossed warning threshold.", metrics: [] },
        { id: "clean", createdAt: "2026-06-24T02:00:00.000Z", timeLabel: "02:00", tone: "ok", summary: "All tracked metrics inside watch rules.", metrics: [] },
      ],
    },
    { status: "worsening", label: "Worsening", summary: "Incident phase: worsening.", evidence: [] },
    { status: "active", label: "Active Impact", startedAtLabel: "03:00", endedAtLabel: "Active", durationLabel: "latest sample", summary: "Impact window: active since 03:00.", evidence: [] },
    { status: "blocked", label: "Do Not Close", summary: "Verification checklist: 5 checks blocked. Keep mitigation active.", items: [], actions: [] },
  );

  assert.equal(replay.status, "active");
  assert.equal(replay.label, "Active Replay");
  assert.equal(replay.summary, "Session replay: risk opened at 03:00 and is still active.");
  assert.deepEqual(plain(replay.events), [
    { id: "start", timeLabel: "03:00", tone: "warn", title: "Risk opened", detail: "Disk 88% crossed warning threshold." },
    { id: "latest", timeLabel: "03:00", tone: "warn", title: "Latest sample", detail: "Disk 88% crossed warning threshold." },
    { id: "phase", timeLabel: "now", tone: "warn", title: "Incident phase", detail: "Worsening" },
    { id: "closeout", timeLabel: "now", tone: "critical", title: "Closeout gate", detail: "Do Not Close" },
  ]);
});

test("builds a recovered monitor session replay from recovered impact evidence", () => {
  const { buildMonitorSessionReplay } = loadModule("monitorSnapshot.ts");

  const replay = buildMonitorSessionReplay(
    {
      status: "ready",
      sampleCount: 4,
      summary: "Recovered after risk.",
      entries: [
        { id: "clean", createdAt: "2026-06-24T04:00:00.000Z", timeLabel: "04:00", tone: "ok", summary: "All tracked metrics inside watch rules.", metrics: [] },
        { id: "risk", createdAt: "2026-06-24T03:00:00.000Z", timeLabel: "03:00", tone: "critical", summary: "CPU 97% crossed critical threshold.", metrics: [] },
        { id: "before", createdAt: "2026-06-24T02:00:00.000Z", timeLabel: "02:00", tone: "ok", summary: "All tracked metrics inside watch rules.", metrics: [] },
      ],
    },
    { status: "stable", label: "Stable", summary: "Incident phase: stable.", evidence: [] },
    { status: "recovered", label: "Recovered", startedAtLabel: "03:00", endedAtLabel: "04:00", durationLabel: "about 1h", summary: "Impact window: recovered.", evidence: [] },
    { status: "ready", label: "Ready To Close", summary: "Verification checklist: all closeout checks passed.", items: [], actions: [] },
  );

  assert.equal(replay.status, "recovered");
  assert.equal(replay.label, "Recovered Replay");
  assert.equal(replay.summary, "Session replay: risk ran from 03:00 to 04:00 and closeout is ready.");
  assert.deepEqual(plain(replay.events.map((event) => event.title)), [
    "Risk opened",
    "Recovery observed",
    "Incident phase",
    "Closeout gate",
  ]);
});

test("marks monitor SLO budget breached for active impact over budget", () => {
  const { buildMonitorSloBudget } = loadModule("monitorSnapshot.ts");

  const budget = buildMonitorSloBudget(
    {
      status: "ready",
      sampleCount: 4,
      summary: "1 risky sample across the last 4 monitor snapshots.",
      entries: [
        { id: "risk", createdAt: "2026-06-24T03:00:00.000Z", timeLabel: "03:00", tone: "warn", summary: "Disk 88% crossed warning threshold.", metrics: [] },
        { id: "clean", createdAt: "2026-06-24T02:00:00.000Z", timeLabel: "02:00", tone: "ok", summary: "All tracked metrics inside watch rules.", metrics: [] },
      ],
    },
    { status: "active", label: "Active Impact", startedAtLabel: "03:00", endedAtLabel: "Active", durationLabel: "latest sample", summary: "Impact window: active since 03:00.", evidence: [] },
    { status: "blocked", label: "Do Not Close", summary: "Verification checklist: 5 checks blocked. Keep mitigation active.", items: [], actions: [] },
    30,
  );

  assert.equal(budget.status, "breached");
  assert.equal(budget.label, "Budget Breach");
  assert.equal(budget.targetLabel, "SLO target 30m risky budget");
  assert.equal(budget.usedLabel, "60m used");
  assert.equal(budget.remainingLabel, "0m left");
  assert.equal(budget.summary, "SLO budget: 60m consumed against 30m budget. Keep incident active.");
  assert.deepEqual(plain(budget.indicators), [
    { id: "impact", label: "Impact", tone: "critical", detail: "Active Impact from 03:00 to Active" },
    { id: "budget", label: "Budget", tone: "critical", detail: "60m used of 30m" },
    { id: "closeout", label: "Closeout", tone: "critical", detail: "Do Not Close" },
  ]);
});

test("keeps recovered monitor SLO budget on watch inside budget", () => {
  const { buildMonitorSloBudget } = loadModule("monitorSnapshot.ts");

  const budget = buildMonitorSloBudget(
    {
      status: "ready",
      sampleCount: 4,
      summary: "Recovered after risk.",
      entries: [
        { id: "clean", createdAt: "2026-06-24T04:00:00.000Z", timeLabel: "04:00", tone: "ok", summary: "All tracked metrics inside watch rules.", metrics: [] },
        { id: "risk", createdAt: "2026-06-24T03:00:00.000Z", timeLabel: "03:00", tone: "critical", summary: "CPU 97% crossed critical threshold.", metrics: [] },
        { id: "before", createdAt: "2026-06-24T02:00:00.000Z", timeLabel: "02:00", tone: "ok", summary: "All tracked metrics inside watch rules.", metrics: [] },
      ],
    },
    { status: "recovered", label: "Recovered", startedAtLabel: "03:00", endedAtLabel: "04:00", durationLabel: "about 1h", summary: "Impact window: recovered.", evidence: [] },
    { status: "ready", label: "Ready To Close", summary: "Verification checklist: all closeout checks passed.", items: [], actions: [] },
    120,
  );

  assert.equal(budget.status, "watch");
  assert.equal(budget.label, "Budget Watch");
  assert.equal(budget.usedLabel, "60m used");
  assert.equal(budget.remainingLabel, "60m left");
  assert.equal(budget.summary, "SLO budget: 60m consumed, 60m remaining. Closeout is ready.");
  assert.deepEqual(plain(budget.actions), [
    "Attach SLO budget note to the incident record",
    "Keep watching until one more clean sample confirms recovery",
  ]);
});

test("locks final hardening while incident evidence remains unsafe", () => {
  const { buildMonitorHardeningGate } = loadModule("monitorSnapshot.ts");

  const gate = buildMonitorHardeningGate(
    { score: 1, status: "critical", summary: "Health score 1/100: immediate attention required.", factors: [] },
    { status: "blocked", label: "Do Not Close", summary: "Recovery gate: blocked.", criteria: [], actions: [] },
    { status: "blocked", label: "Do Not Close", summary: "Verification checklist: 5 checks blocked.", items: [], actions: [] },
    {
      status: "breached",
      label: "Budget Breach",
      targetLabel: "SLO target 60m risky budget",
      usedLabel: "60m used",
      remainingLabel: "0m left",
      summary: "SLO budget: 60m consumed against 60m budget. Keep incident active.",
      indicators: [],
      actions: [],
    },
    { status: "ready", summary: "Command safety pack: ready.", groups: [], guardrails: [] },
    { status: "active", label: "Active Replay", summary: "Session replay: risk opened at 03:00 and is still active.", events: [] },
  );

  assert.equal(gate.status, "locked");
  assert.equal(gate.label, "Hardening Locked");
  assert.equal(gate.summary, "Final hardening: 5 blockers remain. Keep monitor in incident mode.");
  assert.deepEqual(plain(gate.items.map((item) => `${item.label}: ${item.detail}`)), [
    "Health: 1/100 critical",
    "Recovery gate: Do Not Close",
    "Verification: Do Not Close",
    "SLO budget: Budget Breach",
    "Session replay: Active Replay",
    "Command safety: ready",
  ]);
  assert.deepEqual(plain(gate.actions), [
    "Keep Monitor in incident mode",
    "Resolve verification and recovery blockers before closeout",
    "Escalate the SLO budget breach to the service owner",
  ]);
});

test("marks final hardening ready when closeout evidence is accepted", () => {
  const { buildMonitorHardeningGate } = loadModule("monitorSnapshot.ts");

  const gate = buildMonitorHardeningGate(
    { score: 96, status: "healthy", summary: "Health score 96/100: all monitor signals healthy.", factors: [] },
    { status: "ready", label: "Ready To Close", summary: "Recovery gate: ready.", criteria: [], actions: [] },
    { status: "ready", label: "Ready To Close", summary: "Verification checklist: all closeout checks passed.", items: [], actions: [] },
    {
      status: "watch",
      label: "Budget Watch",
      targetLabel: "SLO target 120m risky budget",
      usedLabel: "60m used",
      remainingLabel: "60m left",
      summary: "SLO budget: 60m consumed, 60m remaining. Closeout is ready.",
      indicators: [],
      actions: [],
    },
    { status: "ready", summary: "Command safety pack: ready.", groups: [], guardrails: [] },
    { status: "recovered", label: "Recovered Replay", summary: "Session replay: risk ran from 03:00 to 04:00 and closeout is ready.", events: [] },
  );

  assert.equal(gate.status, "ready");
  assert.equal(gate.label, "Hardened");
  assert.equal(gate.summary, "Final hardening: ready for owner-approved closeout.");
  assert.deepEqual(plain(gate.actions), [
    "Attach incident, mitigation, SLO, and verification evidence to the record",
    "Ask the service owner to approve closeout",
  ]);
});
