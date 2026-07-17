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
