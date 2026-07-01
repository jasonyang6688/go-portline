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

test("detects common editor languages from file paths", () => {
  const { detectEditorLanguage } = loadModule("fileEditorLanguage.ts");

  assert.deepEqual(plain(detectEditorLanguage("/tmp/main.go")), { id: "go", label: "Go" });
  assert.deepEqual(plain(detectEditorLanguage("/tmp/App.tsx")), { id: "tsx", label: "TSX" });
  assert.deepEqual(plain(detectEditorLanguage("/tmp/package.json")), { id: "json", label: "JSON" });
  assert.deepEqual(plain(detectEditorLanguage("/tmp/README.md")), { id: "markdown", label: "Markdown" });
  assert.deepEqual(plain(detectEditorLanguage("/tmp/deploy.sh")), { id: "shell", label: "Shell" });
});

test("detects extensionless config and falls back to plaintext", () => {
  const { detectEditorLanguage } = loadModule("fileEditorLanguage.ts");

  assert.deepEqual(plain(detectEditorLanguage("/tmp/Dockerfile")), { id: "dockerfile", label: "Dockerfile" });
  assert.deepEqual(plain(detectEditorLanguage("/tmp/Makefile")), { id: "makefile", label: "Makefile" });
  assert.deepEqual(plain(detectEditorLanguage("/tmp/unknown.custom")), { id: "plaintext", label: "Plain text" });
});

test("detects additional programming and configuration languages", () => {
  const { detectEditorLanguage } = loadModule("fileEditorLanguage.ts");

  const cases = [
    ["/srv/index.php", { id: "php", label: "PHP" }],
    ["/srv/manage.py", { id: "python", label: "Python" }],
    ["/srv/App.java", { id: "java", label: "Java" }],
    ["/srv/main.c", { id: "c", label: "C" }],
    ["/srv/main.cpp", { id: "cpp", label: "C++" }],
    ["/srv/lib.rs", { id: "rust", label: "Rust" }],
    ["/srv/app.rb", { id: "ruby", label: "Ruby" }],
    ["/srv/View.swift", { id: "swift", label: "Swift" }],
    ["/srv/Main.kt", { id: "kotlin", label: "Kotlin" }],
    ["/srv/page.vue", { id: "html", label: "Vue" }],
    ["/srv/Widget.svelte", { id: "html", label: "Svelte" }],
    ["/srv/Dockerfile.prod", { id: "dockerfile", label: "Dockerfile" }],
    ["/srv/.gitignore", { id: "properties", label: "Properties" }],
    ["/srv/patch.diff", { id: "diff", label: "Diff" }],
  ];

  for (const [path, expected] of cases) {
    assert.deepEqual(plain(detectEditorLanguage(path)), expected, path);
  }
});
