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

test("finds case-insensitive non-overlapping editor matches", () => {
  const { findEditorSearchMatches } = loadModule("fileEditorSearch.ts");

  const matches = findEditorSearchMatches("Alpha beta alpha", "alpha");

  assert.deepEqual(plain(matches), [
    { start: 0, end: 5 },
    { start: 11, end: 16 },
  ]);
});

test("replaces the selected editor match without changing other matches", () => {
  const { findEditorSearchMatches, replaceEditorSearchMatch } = loadModule("fileEditorSearch.ts");
  const content = "port=8080\nbackup_port=8080\n";
  const [firstMatch] = findEditorSearchMatches(content, "8080");

  const nextContent = replaceEditorSearchMatch(content, firstMatch, "3000");

  assert.equal(nextContent, "port=3000\nbackup_port=8080\n");
});

test("replaces all editor matches and reports the count", () => {
  const { replaceAllEditorSearchMatches } = loadModule("fileEditorSearch.ts");

  const result = replaceAllEditorSearchMatches("listen 80;\nproxy_pass :80;\n", "80", "8080");

  assert.deepEqual(plain(result), {
    content: "listen 8080;\nproxy_pass :8080;\n",
    count: 2,
  });
});
