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

function command(id, tags) {
  return {
    id,
    name: `Command ${id}`,
    command: `echo ${id}`,
    description: "",
    tags,
    sortOrder: Number(id) || 0,
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z",
  };
}

test("returns every command available to the terminal scope", () => {
  const { getTerminalSmartBarCommands } = loadModule("terminalSmartBarCommands.ts");
  const commands = Array.from({ length: 10 }, (_, index) => command(String(index + 1), ["global"]));

  const visibleCommands = getTerminalSmartBarCommands(commands, null);

  assert.equal(visibleCommands.length, 10);
  assert.deepEqual(
    plain(visibleCommands.map((item) => item.id)),
    plain(commands.map((item) => item.id)),
  );
});

test("includes only global and matching connection commands", () => {
  const { getTerminalSmartBarCommands } = loadModule("terminalSmartBarCommands.ts");
  const commands = [
    command("global", ["global"]),
    command("matching-host", ["connection:c1"]),
    command("other-host", ["connection:c2"]),
  ];

  const visibleCommands = getTerminalSmartBarCommands(commands, "c1");

  assert.deepEqual(
    plain(visibleCommands.map((item) => item.id)),
    ["global", "matching-host"],
  );
});

test("reorders visible terminal commands and preserves hidden commands", () => {
  const { reorderTerminalSmartBarCommands } = loadModule("terminalSmartBarCommands.ts");
  const commands = [
    command("1", ["global"]),
    command("2", ["connection:hidden"]),
    command("3", ["global"]),
    command("4", ["global"]),
  ];

  const reordered = reorderTerminalSmartBarCommands(commands, null, "4", "1");

  assert.deepEqual(
    plain(reordered.map((item) => item.id)),
    ["4", "2", "1", "3"],
  );
  assert.deepEqual(
    plain(reordered.map((item) => item.sortOrder)),
    [0, 1, 2, 3],
  );
});
