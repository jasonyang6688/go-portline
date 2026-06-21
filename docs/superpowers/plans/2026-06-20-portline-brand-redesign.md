# Portline Brand Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the user-visible TermFlow branding with Portline and install a custom terminal/port app icon.

**Architecture:** Keep the change scoped to metadata, visible React UI, HTML favicon, and the Wails icon source asset. Internal Go module names, storage paths, event protocol constants, and generated Wails bindings stay unchanged to avoid unnecessary migration risk.

**Tech Stack:** Go/Wails v2, React/Vite, TypeScript, standard shell checks, Node-based asset generation for deterministic icon output.

---

### Task 1: Brand Verification Check

**Files:**
- Test: one-off shell/Node command only.

- [ ] **Step 1: Run the failing brand check before implementation**

Run:

```bash
node - <<'NODE'
const fs = require("fs");
const checks = [
  ["wails.json", /"name": "Portline"/],
  ["wails.json", /"outputfilename": "Portline"/],
  ["main.go", /Title:\s+"Portline"/],
  ["frontend/index.html", /<title>Portline<\/title>/],
  ["frontend/src/app/App.tsx", />\s*Portline\s*</],
  ["frontend/src/features/status/StatusBar.tsx", /Portline v0\.1\.4/],
];
const failures = checks.filter(([file, pattern]) => !pattern.test(fs.readFileSync(file, "utf8")));
if (failures.length) {
  console.error("Brand checks failed:");
  for (const [file, pattern] of failures) console.error(`- ${file}: missing ${pattern}`);
  process.exit(1);
}
console.log("Brand checks passed");
NODE
```

Expected: FAIL because source files still say `TermFlow`.

### Task 2: Update Brand Text And Metadata

**Files:**
- Modify: `wails.json`
- Modify: `main.go`
- Modify: `frontend/index.html`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/features/status/StatusBar.tsx`

- [ ] **Step 1: Replace user-visible metadata and labels**

Change:

```text
TermFlow -> Portline
```

Only in the files listed above. Do not replace internal protocol strings such as `TermFlowCwd`, storage paths, package names, generated files, or design/spec history.

- [ ] **Step 2: Update the favicon**

Replace the inline favicon in `frontend/index.html` with a compact Portline SVG data URL using a dark rounded square, cyan port-line mark, and warm cursor accent.

- [ ] **Step 3: Re-run the brand check**

Run the command from Task 1.

Expected: PASS.

### Task 3: Generate Portline App Icon

**Files:**
- Modify: `build/appicon.png`

- [ ] **Step 1: Generate a deterministic 1024x1024 PNG**

Use an existing local image-capable runtime if available. The icon should be a dark rounded-square macOS-style mark with a cyan connection/port shape and a small warm cursor underline.

- [ ] **Step 2: Verify the PNG dimensions**

Run:

```bash
file build/appicon.png
sips -g pixelWidth -g pixelHeight build/appicon.png
```

Expected: PNG image, 1024 by 1024.

### Task 4: Project Verification

**Files:**
- No intended source edits.

- [ ] **Step 1: Run Go tests**

Run:

```bash
go test ./...
```

Expected: exit 0.

- [ ] **Step 2: Run Go build**

Run:

```bash
go build ./...
```

Expected: exit 0.

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: exit 0. Generated `frontend/dist` changes may appear because this repo currently has dirty build artifacts; do not stage unrelated generated files unless explicitly requested.

### Task 5: Headless Browser QA

**Files:**
- Create: `artifacts/qa/<timestamp>-portline-brand.png`

- [ ] **Step 1: Start Vite preview/dev server**

Run:

```bash
cd frontend && npm run dev -- --host 127.0.0.1
```

Use an available port printed by Vite.

- [ ] **Step 2: Use a headless browser to inspect the UI**

Open the app URL, click at least one visible toolbar/control to exercise the shell, verify:

- `document.title` is `Portline`.
- The titlebar brand includes `Portline`.
- The status bar includes `Portline v0.1.4`.
- The favicon link contains the custom Portline data URL.
- There are no console errors.

- [ ] **Step 3: Capture a screenshot**

Save a screenshot to:

```text
artifacts/qa/<timestamp>-portline-brand.png
```

Expected: screenshot shows the Portline brand in the app shell.

### Task 6: Final Review

**Files:**
- No intended source edits.

- [ ] **Step 1: Review the diff**

Run:

```bash
git diff -- wails.json main.go frontend/index.html frontend/src/app/App.tsx frontend/src/features/status/StatusBar.tsx build/appicon.png docs/superpowers/plans/2026-06-20-portline-brand-redesign.md
```

Expected: only scoped branding, icon, and plan changes.

- [ ] **Step 2: Report verification evidence**

Final response must include changed files, verification commands, browser QA scenario, screenshot path, and known limits.
