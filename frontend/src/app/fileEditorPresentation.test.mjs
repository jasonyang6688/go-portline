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

test("builds the editor textarea class for fixed and wrapped lines", () => {
  const { fileEditorTextareaClassName } = loadModule("fileEditorPresentation.ts");

  assert.equal(fileEditorTextareaClassName(false), "fe-textarea");
  assert.equal(fileEditorTextareaClassName(true), "fe-textarea wrap");
});
