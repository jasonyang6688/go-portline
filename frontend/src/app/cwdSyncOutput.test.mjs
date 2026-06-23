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

test("suppresses hidden cwd sync command output after extracting path", () => {
  const { CWD_SYNC_ECHO, CWD_SYNC_OSC_PREFIX, CWD_SYNC_OSC_SUFFIX, resolveCwdSyncOutput } = loadModule("cwdSyncOutput.ts");
  const prompt = "ubuntu@ip-172-31-43-226:/var/www/html/lordhair.com/public_html$ ";
  const output = `${CWD_SYNC_ECHO}\r\n${CWD_SYNC_OSC_PREFIX}/var/www/html/lordhair.com/public_html${CWD_SYNC_OSC_SUFFIX}\r\n${prompt}`;

  const result = resolveCwdSyncOutput(output);

  assert.deepEqual(plain(result), {
    syncedPath: "/var/www/html/lordhair.com/public_html",
    terminalOutput: "",
  });
});

test("waits for more output until cwd sync marker is complete", () => {
  const { CWD_SYNC_OSC_PREFIX, resolveCwdSyncOutput } = loadModule("cwdSyncOutput.ts");

  const result = resolveCwdSyncOutput(`${CWD_SYNC_OSC_PREFIX}/var/www/html`);

  assert.equal(result, null);
});
