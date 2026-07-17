import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadModule(filename, globals = {}) {
  const source = readFileSync(join(__dirname, filename), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { exports: module.exports, module, ...globals }, { filename });
  return module.exports;
}

function keyEvent(key, overrides = {}) {
  return {
    altKey: false,
    ctrlKey: false,
    key,
    metaKey: false,
    ...overrides,
  };
}

test("maps fullscreen vim keys to terminal input data", () => {
  const { terminalKeyDataFromKeyboardEvent } = loadModule("terminalKeyboard.ts");

  assert.equal(terminalKeyDataFromKeyboardEvent(keyEvent("i")), "i");
  assert.equal(terminalKeyDataFromKeyboardEvent(keyEvent("Escape")), "\u001b");
  assert.equal(terminalKeyDataFromKeyboardEvent(keyEvent("Enter")), "\r");
  assert.equal(terminalKeyDataFromKeyboardEvent(keyEvent("Backspace")), "\u007f");
});

test("maps navigation and control keys to terminal escape sequences", () => {
  const { terminalKeyDataFromKeyboardEvent } = loadModule("terminalKeyboard.ts");

  assert.equal(terminalKeyDataFromKeyboardEvent(keyEvent("ArrowUp")), "\u001b[A");
  assert.equal(terminalKeyDataFromKeyboardEvent(keyEvent("Delete")), "\u001b[3~");
  assert.equal(terminalKeyDataFromKeyboardEvent(keyEvent("c", { ctrlKey: true })), "\u0003");
  assert.equal(terminalKeyDataFromKeyboardEvent(keyEvent("x", { altKey: true })), "\u001bx");
});

test("does not fallback for app shortcuts or unknown non-character keys", () => {
  const { terminalKeyDataFromKeyboardEvent } = loadModule("terminalKeyboard.ts");

  assert.equal(terminalKeyDataFromKeyboardEvent(keyEvent("k", { metaKey: true })), null);
  assert.equal(terminalKeyDataFromKeyboardEvent(keyEvent("Shift")), null);
});

test("uses fullscreen keyboard fallback only outside xterm and form controls", () => {
  class FakeElement {}
  const { shouldUseTerminalKeyboardFallback } = loadModule("terminalKeyboard.ts", { Element: FakeElement });
  const target = (selector) =>
    Object.assign(new FakeElement(), {
      closest(pattern) {
        return pattern === selector ? {} : null;
      },
    });

  assert.equal(shouldUseTerminalKeyboardFallback(null), true);
  assert.equal(shouldUseTerminalKeyboardFallback(target(".xterm")), false);
  assert.equal(shouldUseTerminalKeyboardFallback(target("input, textarea, select, [contenteditable='true']")), false);
  assert.equal(shouldUseTerminalKeyboardFallback(target(".not-terminal")), true);
});
