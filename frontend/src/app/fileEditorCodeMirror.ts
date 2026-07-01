import { type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { StreamLanguage } from "@codemirror/language";
import { css as cssLanguage } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { php } from "@codemirror/lang-php";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { c, cpp, csharp, dart, java, kotlin, objectiveC, objectiveCpp, scala, shader } from "@codemirror/legacy-modes/mode/clike";
import { clojure } from "@codemirror/legacy-modes/mode/clojure";
import { coffeeScript } from "@codemirror/legacy-modes/mode/coffeescript";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { erlang } from "@codemirror/legacy-modes/mode/erlang";
import { fortran } from "@codemirror/legacy-modes/mode/fortran";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";
import { haskell } from "@codemirror/legacy-modes/mode/haskell";
import { julia } from "@codemirror/legacy-modes/mode/julia";
import { less, sCSS } from "@codemirror/legacy-modes/mode/css";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { nginx } from "@codemirror/legacy-modes/mode/nginx";
import { pascal } from "@codemirror/legacy-modes/mode/pascal";
import { perl } from "@codemirror/legacy-modes/mode/perl";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { protobuf } from "@codemirror/legacy-modes/mode/protobuf";
import { python } from "@codemirror/legacy-modes/mode/python";
import { r } from "@codemirror/legacy-modes/mode/r";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { rust } from "@codemirror/legacy-modes/mode/rust";
import { sass } from "@codemirror/legacy-modes/mode/sass";
import { scheme } from "@codemirror/legacy-modes/mode/scheme";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { vb } from "@codemirror/legacy-modes/mode/vb";
import { verilog } from "@codemirror/legacy-modes/mode/verilog";
import { vhdl } from "@codemirror/legacy-modes/mode/vhdl";
import type { EditorLanguageId } from "./fileEditorLanguage";

export function codeMirrorExtensionsForLanguage(languageId: EditorLanguageId): Extension[] {
  switch (languageId) {
    case "c":
      return [StreamLanguage.define(c)];
    case "clojure":
      return [StreamLanguage.define(clojure)];
    case "coffeescript":
      return [StreamLanguage.define(coffeeScript)];
    case "cpp":
      return [StreamLanguage.define(cpp)];
    case "css":
      return [cssLanguage()];
    case "csharp":
      return [StreamLanguage.define(csharp)];
    case "dart":
      return [StreamLanguage.define(dart)];
    case "diff":
      return [StreamLanguage.define(diff)];
    case "dockerfile":
      return [StreamLanguage.define(dockerFile)];
    case "erlang":
      return [StreamLanguage.define(erlang)];
    case "fortran":
      return [StreamLanguage.define(fortran)];
    case "go":
      return [go()];
    case "groovy":
      return [StreamLanguage.define(groovy)];
    case "haskell":
      return [StreamLanguage.define(haskell)];
    case "html":
      return [html()];
    case "java":
      return [StreamLanguage.define(java)];
    case "javascript":
      return [javascript({ jsx: true })];
    case "julia":
      return [StreamLanguage.define(julia)];
    case "json":
      return [json()];
    case "kotlin":
      return [StreamLanguage.define(kotlin)];
    case "less":
      return [StreamLanguage.define(less)];
    case "lua":
      return [StreamLanguage.define(lua)];
    case "markdown":
      return [markdown()];
    case "nginx":
      return [StreamLanguage.define(nginx)];
    case "objectivec":
      return [StreamLanguage.define(objectiveC)];
    case "pascal":
      return [StreamLanguage.define(pascal)];
    case "perl":
      return [StreamLanguage.define(perl)];
    case "php":
      return [php()];
    case "powershell":
      return [StreamLanguage.define(powerShell)];
    case "properties":
      return [StreamLanguage.define(properties)];
    case "protobuf":
      return [StreamLanguage.define(protobuf)];
    case "python":
      return [StreamLanguage.define(python)];
    case "r":
      return [StreamLanguage.define(r)];
    case "ruby":
      return [StreamLanguage.define(ruby)];
    case "rust":
      return [StreamLanguage.define(rust)];
    case "sass":
      return [StreamLanguage.define(sass)];
    case "scala":
      return [StreamLanguage.define(scala)];
    case "scheme":
      return [StreamLanguage.define(scheme)];
    case "scss":
      return [StreamLanguage.define(sCSS)];
    case "shell":
      return [StreamLanguage.define(shell)];
    case "shader":
      return [StreamLanguage.define(shader)];
    case "sql":
      return [sql()];
    case "swift":
      return [StreamLanguage.define(swift)];
    case "toml":
      return [StreamLanguage.define(toml)];
    case "tsx":
      return [javascript({ jsx: true, typescript: true })];
    case "typescript":
      return [javascript({ typescript: true })];
    case "vb":
      return [StreamLanguage.define(vb)];
    case "verilog":
      return [StreamLanguage.define(verilog)];
    case "vhdl":
      return [StreamLanguage.define(vhdl)];
    case "xml":
      return [xml()];
    case "yaml":
      return [yaml()];
    case "makefile":
    case "plaintext":
      return [];
  }
}

export function fileEditorCodeMirrorExtensions(languageId: EditorLanguageId, wrapLines: boolean): Extension[] {
  const extensions: Extension[] = [
    termflowCodeMirrorTheme,
    search({ top: true }),
    keymap.of(searchKeymap),
    highlightSelectionMatches(),
    ...codeMirrorExtensionsForLanguage(languageId),
  ];

  if (wrapLines) {
    extensions.push(EditorView.lineWrapping);
  }

  return extensions;
}

const termflowCodeMirrorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      color: "var(--text)",
      backgroundColor: "var(--base)",
      fontFamily: "var(--font-mono)",
      fontSize: "12.5px",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
      lineHeight: "1.6",
    },
    ".cm-content": {
      minHeight: "100%",
      padding: "12px 14px",
      caretColor: "var(--accent)",
    },
    ".cm-line": {
      padding: "0 2px",
    },
    ".cm-gutters": {
      color: "var(--overlay0)",
      backgroundColor: "var(--mantle)",
      borderRight: "1px solid var(--surface0)",
    },
    ".cm-activeLineGutter": {
      color: "var(--text)",
      backgroundColor: "var(--surface0)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(180, 190, 254, 0.08)",
    },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(137, 180, 250, 0.35) !important",
    },
    ".cm-selectionMatch": {
      backgroundColor: "rgba(249, 226, 175, 0.24)",
    },
    ".cm-selectionMatch-main": {
      backgroundColor: "rgba(249, 226, 175, 0.38)",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(249, 226, 175, 0.32)",
      outline: "1px solid rgba(249, 226, 175, 0.42)",
    },
    ".cm-searchMatch-selected": {
      backgroundColor: "rgba(137, 180, 250, 0.45)",
      outline: "1px solid var(--accent)",
    },
    ".cm-panels": {
      color: "var(--text)",
      backgroundColor: "var(--mantle)",
      borderTop: "1px solid var(--surface0)",
      borderBottom: "1px solid var(--surface0)",
      fontFamily: "var(--font-mono)",
      fontSize: "11.5px",
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: "1px solid var(--surface0)",
    },
  },
  { dark: true },
);
