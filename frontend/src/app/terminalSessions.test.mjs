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
