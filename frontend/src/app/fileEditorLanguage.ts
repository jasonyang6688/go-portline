export type EditorLanguageId =
  | "c"
  | "clojure"
  | "coffeescript"
  | "cpp"
  | "css"
  | "csharp"
  | "dart"
  | "diff"
  | "dockerfile"
  | "erlang"
  | "fortran"
  | "go"
  | "groovy"
  | "haskell"
  | "html"
  | "javascript"
  | "java"
  | "json"
  | "julia"
  | "kotlin"
  | "less"
  | "lua"
  | "makefile"
  | "markdown"
  | "nginx"
  | "objectivec"
  | "pascal"
  | "perl"
  | "php"
  | "plaintext"
  | "powershell"
  | "properties"
  | "protobuf"
  | "python"
  | "r"
  | "ruby"
  | "rust"
  | "sass"
  | "scss"
  | "scala"
  | "scheme"
  | "shell"
  | "shader"
  | "sql"
  | "swift"
  | "toml"
  | "tsx"
  | "typescript"
  | "vb"
  | "verilog"
  | "vhdl"
  | "xml"
  | "yaml";

export type EditorLanguageInfo = {
  id: EditorLanguageId;
  label: string;
};

const extensionLanguages: Record<string, EditorLanguageInfo> = {
  bash: { id: "shell", label: "Shell" },
  c: { id: "c", label: "C" },
  cc: { id: "cpp", label: "C++" },
  clj: { id: "clojure", label: "Clojure" },
  cljs: { id: "clojure", label: "Clojure" },
  cjs: { id: "javascript", label: "JavaScript" },
  coffee: { id: "coffeescript", label: "CoffeeScript" },
  conf: { id: "properties", label: "Properties" },
  cpp: { id: "cpp", label: "C++" },
  cs: { id: "csharp", label: "C#" },
  css: { id: "css", label: "CSS" },
  cu: { id: "cpp", label: "C++" },
  cxx: { id: "cpp", label: "C++" },
  dart: { id: "dart", label: "Dart" },
  diff: { id: "diff", label: "Diff" },
  erl: { id: "erlang", label: "Erlang" },
  f: { id: "fortran", label: "Fortran" },
  f90: { id: "fortran", label: "Fortran" },
  fs: { id: "shader", label: "Shader" },
  go: { id: "go", label: "Go" },
  gradle: { id: "groovy", label: "Groovy" },
  graphql: { id: "javascript", label: "GraphQL" },
  groovy: { id: "groovy", label: "Groovy" },
  h: { id: "c", label: "C" },
  hbs: { id: "html", label: "Handlebars" },
  hh: { id: "cpp", label: "C++" },
  hlsl: { id: "shader", label: "Shader" },
  hpp: { id: "cpp", label: "C++" },
  hs: { id: "haskell", label: "Haskell" },
  htm: { id: "html", label: "HTML" },
  html: { id: "html", label: "HTML" },
  hxx: { id: "cpp", label: "C++" },
  ino: { id: "cpp", label: "C++" },
  ini: { id: "properties", label: "Properties" },
  java: { id: "java", label: "Java" },
  js: { id: "javascript", label: "JavaScript" },
  json: { id: "json", label: "JSON" },
  jsx: { id: "javascript", label: "JSX" },
  jl: { id: "julia", label: "Julia" },
  kt: { id: "kotlin", label: "Kotlin" },
  kts: { id: "kotlin", label: "Kotlin" },
  less: { id: "less", label: "Less" },
  lua: { id: "lua", label: "Lua" },
  m: { id: "objectivec", label: "Objective-C" },
  mm: { id: "objectivec", label: "Objective-C++" },
  md: { id: "markdown", label: "Markdown" },
  mjs: { id: "javascript", label: "JavaScript" },
  markdown: { id: "markdown", label: "Markdown" },
  nginx: { id: "nginx", label: "Nginx" },
  p: { id: "pascal", label: "Pascal" },
  patch: { id: "diff", label: "Diff" },
  pas: { id: "pascal", label: "Pascal" },
  perl: { id: "perl", label: "Perl" },
  php: { id: "php", label: "PHP" },
  pl: { id: "perl", label: "Perl" },
  pm: { id: "perl", label: "Perl" },
  proto: { id: "protobuf", label: "Protocol Buffers" },
  ps1: { id: "powershell", label: "PowerShell" },
  py: { id: "python", label: "Python" },
  pyw: { id: "python", label: "Python" },
  r: { id: "r", label: "R" },
  rake: { id: "ruby", label: "Ruby" },
  rb: { id: "ruby", label: "Ruby" },
  rs: { id: "rust", label: "Rust" },
  sass: { id: "sass", label: "Sass" },
  scala: { id: "scala", label: "Scala" },
  scm: { id: "scheme", label: "Scheme" },
  scss: { id: "scss", label: "SCSS" },
  sh: { id: "shell", label: "Shell" },
  shader: { id: "shader", label: "Shader" },
  sol: { id: "javascript", label: "Solidity" },
  sql: { id: "sql", label: "SQL" },
  svelte: { id: "html", label: "Svelte" },
  swift: { id: "swift", label: "Swift" },
  toml: { id: "toml", label: "TOML" },
  ts: { id: "typescript", label: "TypeScript" },
  tsx: { id: "tsx", label: "TSX" },
  vb: { id: "vb", label: "Visual Basic" },
  vbs: { id: "vb", label: "VBScript" },
  verilog: { id: "verilog", label: "Verilog" },
  v: { id: "verilog", label: "Verilog" },
  vhd: { id: "vhdl", label: "VHDL" },
  vhdl: { id: "vhdl", label: "VHDL" },
  vue: { id: "html", label: "Vue" },
  xml: { id: "xml", label: "XML" },
  yaml: { id: "yaml", label: "YAML" },
  yml: { id: "yaml", label: "YAML" },
  zsh: { id: "shell", label: "Shell" },
};

const filenameLanguages: Record<string, EditorLanguageInfo> = {
  ".bashrc": { id: "shell", label: "Shell" },
  ".env": { id: "shell", label: "Shell" },
  ".gitignore": { id: "properties", label: "Properties" },
  ".npmrc": { id: "properties", label: "Properties" },
  ".prettierrc": { id: "json", label: "JSON" },
  ".zshrc": { id: "shell", label: "Shell" },
  "dockerfile": { id: "dockerfile", label: "Dockerfile" },
  "makefile": { id: "makefile", label: "Makefile" },
  "nginx.conf": { id: "nginx", label: "Nginx" },
  "rakefile": { id: "ruby", label: "Ruby" },
  "requirements.txt": { id: "properties", label: "Requirements" },
};

const plainTextLanguage: EditorLanguageInfo = { id: "plaintext", label: "Plain text" };

export function detectEditorLanguage(path: string): EditorLanguageInfo {
  const filename = path.split(/[\\/]/).filter(Boolean).pop()?.toLowerCase() ?? "";
  const byFilename = filenameLanguages[filename];
  if (byFilename) {
    return byFilename;
  }
  if (filename.startsWith("dockerfile.")) {
    return filenameLanguages.dockerfile;
  }

  const extension = filename.includes(".") ? filename.split(".").pop() ?? "" : "";
  return extensionLanguages[extension] ?? plainTextLanguage;
}
