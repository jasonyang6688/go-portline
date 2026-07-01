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

function item(label, sub) {
  return { label, sub, action: () => undefined };
}

test("returns every command palette item when the query is empty", () => {
  const { getFilteredCommandPaletteItems } = loadModule("commandPaletteItems.ts");
  const items = [
    item("New connection", "Add an SSH host"),
    item("Terminal", "Navigate"),
  ];

  assert.deepEqual(plain(getFilteredCommandPaletteItems(items, "   ")), plain(items));
});

test("filters command palette items by label or subtitle case-insensitively", () => {
  const { getFilteredCommandPaletteItems } = loadModule("commandPaletteItems.ts");
  const items = [
    item("Production shell", "root@prod.example.com:22"),
    item("Clear cache", "redis-cli flushdb"),
    item("Settings", "Navigate"),
  ];

  assert.deepEqual(
    plain(getFilteredCommandPaletteItems(items, " REDIS ").map((result) => result.label)),
    ["Clear cache"],
  );
});
