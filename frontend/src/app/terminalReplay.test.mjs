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
  vm.runInNewContext(outputText, { exports: module.exports, module }, { filename });
  return module.exports;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("appends only new terminal bytes after scrollback trimming keeps an overlapping suffix", () => {
  const { resolveTerminalWrite } = loadModule("terminalReplay.ts");

  assert.deepEqual(plain(resolveTerminalWrite("abcdef", "defghi")), {
    kind: "append",
    data: "ghi",
  });
});

test("preserves terminal replay context while a fullscreen TUI is active", () => {
  const { appendTerminalData } = loadModule("terminalReplay.ts");

  assert.equal(
    appendTerminalData("abcd", "efgh", { maxLength: 5, preserveReplayContext: true }),
    "abcdefgh",
  );
});

test("trims terminal scrollback only when replay context is not being preserved", () => {
  const { appendTerminalData } = loadModule("terminalReplay.ts");

  assert.equal(
    appendTerminalData("abcd", "efgh", { maxLength: 5, preserveReplayContext: false }),
    "defgh",
  );
});

test("preserves replay context for the first chunk that enters alternate screen", () => {
  const { shouldPreserveTerminalReplayContext } = loadModule("terminalReplay.ts");

  assert.equal(
    shouldPreserveTerminalReplayContext("\u001b[?1049h\u001b[Hvim screen", "s1", {}),
    true,
  );
});

test("blocks shell command injection while terminal is in alternate screen", () => {
  const { canWriteShellCommand } = loadModule("terminalReplay.ts");

  assert.equal(canWriteShellCommand("s1", { s1: true }), false);
  assert.equal(canWriteShellCommand("s1", { s1: false }), true);
  assert.equal(canWriteShellCommand(null, { s1: true }), false);
});
