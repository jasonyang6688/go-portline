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

function keyEvent(key, overrides = {}) {
  return {
    altKey: false,
    ctrlKey: false,
    key,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  };
}

test("maps terminal copy and paste shortcuts without stealing ctrl-c interrupt", () => {
  const { terminalClipboardShortcutAction } = loadModule("terminalClipboard.ts");

  assert.equal(terminalClipboardShortcutAction(keyEvent("c", { metaKey: true }), false), "copy");
  assert.equal(terminalClipboardShortcutAction(keyEvent("c", { ctrlKey: true }), false), null);
  assert.equal(terminalClipboardShortcutAction(keyEvent("c", { ctrlKey: true }), true), "copy");
  assert.equal(terminalClipboardShortcutAction(keyEvent("C", { ctrlKey: true, shiftKey: true }), false), "copy");
  assert.equal(terminalClipboardShortcutAction(keyEvent("v", { metaKey: true }), false), "paste");
  assert.equal(terminalClipboardShortcutAction(keyEvent("V", { ctrlKey: true, shiftKey: true }), false), "paste");
  assert.equal(terminalClipboardShortcutAction(keyEvent("v", { ctrlKey: true }), false), "paste");
});

test("copies only non-empty terminal selections", async () => {
  const { copyTerminalSelection } = loadModule("terminalClipboard.ts");
  const writes = [];
  const clipboard = { writeText: async (text) => writes.push(text) };

  assert.equal(await copyTerminalSelection("", clipboard), false);
  assert.equal(await copyTerminalSelection("deploy\nready", clipboard), true);
  assert.deepEqual(writes, ["deploy\nready"]);
});

test("pastes clipboard text through terminal paste API", async () => {
  const { pasteClipboardToTerminal } = loadModule("terminalClipboard.ts");
  const pasted = [];
  const terminal = { focus() {}, paste: (text) => pasted.push(text) };
  const clipboard = { readText: async () => "printf hello" };

  assert.equal(await pasteClipboardToTerminal(terminal, clipboard), true);
  assert.deepEqual(pasted, ["printf hello"]);
});

test("ignores empty clipboard paste data", async () => {
  const { pasteClipboardToTerminal } = loadModule("terminalClipboard.ts");
  const pasted = [];
  const terminal = { focus() {}, paste: (text) => pasted.push(text) };
  const clipboard = { readText: async () => "" };

  assert.equal(await pasteClipboardToTerminal(terminal, clipboard), false);
  assert.deepEqual(pasted, []);
});
