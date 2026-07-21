import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  vm.runInNewContext(outputText, { exports: module.exports, module, Set }, { filename });
  return module.exports;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("keeps existing terminal sessions when only the active tab changes", () => {
  const { reconcileTerminalSessions } = loadModule("terminalSessions.ts");

  assert.deepEqual(
    plain(
      reconcileTerminalSessions(
        ["s1", "s2"],
        [
          { id: "s1" },
          { id: "s2" },
        ],
      ),
    ),
    {
      createIds: [],
      disposeIds: [],
    },
  );
});

test("creates missing terminal sessions and disposes closed sessions", () => {
  const { reconcileTerminalSessions } = loadModule("terminalSessions.ts");

  assert.deepEqual(
    plain(
      reconcileTerminalSessions(
        ["s1", "closed"],
        [
          { id: "s1" },
          { id: "s2" },
        ],
      ),
    ),
    {
      createIds: ["s2"],
      disposeIds: ["closed"],
    },
  );
});

test("adds a created session once and preserves newer event state", () => {
  const { addSessionIfMissing } = loadModule("terminalSessions.ts");
  const created = { id: "s1", status: "connected" };
  const disconnected = { id: "s1", status: "disconnected" };

  assert.deepEqual(plain(addSessionIfMissing([], created)), [created]);
  assert.deepEqual(plain(addSessionIfMissing([disconnected], created)), [disconnected]);
});

test("allows terminal interaction only for connected sessions", () => {
  const { canInteractWithSession } = loadModule("terminalSessions.ts");

  assert.equal(canInteractWithSession({ status: "connected" }), true);
  assert.equal(canInteractWithSession({ status: "disconnected" }), false);
  assert.equal(canInteractWithSession({ status: "closed" }), false);
  assert.equal(canInteractWithSession(null), false);
});

test("reports the actual status when an opened session already disconnected", () => {
  const { openedSessionStatusMessage } = loadModule("terminalSessions.ts");

  assert.equal(openedSessionStatusMessage("prod-01", "connected"), "Connected to prod-01");
  assert.equal(openedSessionStatusMessage("prod-01", "disconnected"), "Session disconnected: prod-01");
});

test("uses reconnect as the primary action for a disconnected session", () => {
  const { terminalSessionPrimaryAction } = loadModule("terminalSessions.ts");

  assert.equal(terminalSessionPrimaryAction("connected", false), "close");
  assert.equal(terminalSessionPrimaryAction("disconnected", false), "reconnect");
  assert.equal(terminalSessionPrimaryAction("error", false), "reconnect");
  assert.equal(terminalSessionPrimaryAction("disconnected", true), "reconnecting");
  assert.equal(terminalSessionPrimaryAction(null, false), "disabled");
});

test("replaces a disconnected session in place while preserving newer replacement state", () => {
  const { replaceReconnectedSession } = loadModule("terminalSessions.ts");
  const sessions = [
    { id: "before", status: "connected" },
    { id: "old", status: "disconnected" },
    { id: "after", status: "connected" },
    { id: "new", status: "disconnected" },
  ];

  assert.deepEqual(
    plain(replaceReconnectedSession(sessions, "old", { id: "new", status: "connected" })),
    [
      { id: "before", status: "connected" },
      { id: "new", status: "disconnected" },
      { id: "after", status: "connected" },
    ],
  );
});

test("moves the old terminal history to the reconnected session", () => {
  const { rekeyReconnectedTerminalBuffer } = loadModule("terminalSessions.ts");
  const current = { old: "old output", new: "new prompt" };
  const next = rekeyReconnectedTerminalBuffer(current, "old", "new");

  assert.equal(next.old, undefined);
  assert.equal(next.new, "old output\r\n[reconnected]\r\nnew prompt");
  assert.deepEqual(current, { old: "old output", new: "new prompt" });
});

test("stages only the session created for the connection currently reconnecting", () => {
  const { shouldStageReconnectedSession } = loadModule("terminalSessions.ts");

  assert.equal(shouldStageReconnectedSession("c1", { connectionId: "c1" }), true);
  assert.equal(shouldStageReconnectedSession("c1", { connectionId: "c2" }), false);
  assert.equal(shouldStageReconnectedSession(null, { connectionId: "c1" }), false);
});

test("uses the latest staged status when a replacement disconnects before reconnect resolves", () => {
  const { latestReconnectedSession } = loadModule("terminalSessions.ts");
  const returned = { id: "new", status: "connected" };
  const staged = new Map([["new", { id: "new", status: "disconnected" }]]);

  assert.deepEqual(plain(latestReconnectedSession(staged, returned)), {
    id: "new",
    status: "disconnected",
  });
  assert.deepEqual(plain(latestReconnectedSession(new Map(), returned)), returned);
});

test("keeps a disconnected OpenSession result over a created-only connected stage", () => {
  const { latestReconnectedSession } = loadModule("terminalSessions.ts");
  const returned = { id: "new", status: "disconnected" };
  const staged = new Map([["new", { id: "new", status: "connected" }]]);

  assert.deepEqual(plain(latestReconnectedSession(staged, returned)), returned);
});
