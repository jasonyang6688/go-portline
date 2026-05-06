# Local Terminal Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an embedded local terminal connection type that reuses TermFlow's existing terminal tabs and Quick Commands.

**Architecture:** Implement a local `ManagedSession` backed by a host shell process, then route `connection.kind === "local"` through it in `App.SSHConnect`. Auto-create one saved local connection at startup so the UI can open it like any other connection.

**Tech Stack:** Go, Wails v2, Vue 3, xterm.js, existing SQLite connection/quick-command storage.

---

### Task 1: Local Connection Detection

**Files:**
- Modify: `app.go`
- Test: `app_local_test.go`

- [ ] **Step 1: Write failing tests**

Create `app_local_test.go` with tests for `defaultLocalConnection`, `isLocalConnection`, and `ensureSingleLocalConnection` using an in-memory store.

- [ ] **Step 2: Verify red**

Run: `go test ./...`

Expected: FAIL because local helpers do not exist.

- [ ] **Step 3: Implement minimal local connection helpers**

Add helpers in `app.go`: `ensureSingleLocalConnection`, `defaultLocalConnection`, `isLocalConnection`, and call the ensure method during startup after WSL detection.

- [ ] **Step 4: Verify green**

Run: `go test ./...`

Expected: PASS.

### Task 2: Local PTY Session

**Files:**
- Create: `internal/local/session.go`
- Create: `internal/local/session_test.go`
- Modify: `app.go`

- [ ] **Step 1: Write failing shell-selection tests**

Test shell selection for darwin, windows, and fallback paths without starting an interactive shell.

- [ ] **Step 2: Verify red**

Run: `go test ./internal/local`

Expected: FAIL because the package does not exist.

- [ ] **Step 3: Implement local session**

Create a local session implementing `Start`, `Write`, `Resize`, `Run`, `RunWithInput`, `RunToWriter`, and `Close`. Use `github.com/creack/pty` for Unix PTY behavior already present in `go.mod`. Use Windows shell process fallback without resize support.

- [ ] **Step 4: Route local connections**

Modify `App.SSHConnect` to call `local.Connect(id)` when `isLocalConnection(c)` is true.

- [ ] **Step 5: Verify green**

Run: `go test ./...`

Expected: PASS.

### Task 3: Frontend Local Connection Support

**Files:**
- Modify: `frontend/src/stores/connections.ts`
- Modify: `frontend/src/components/sidebar/ConnectionSidebar.vue`
- Modify: `frontend/src/components/sidebar/ConnectionItem.vue`
- Modify: `frontend/src/components/sidebar/ModuleSidebar.vue`

- [ ] **Step 1: Update type/display handling**

Treat `kind: "local"` as a first-class connection. Display it as `local shell` instead of `user@host:port`, and do not require SSH password/key fields for local connections.

- [ ] **Step 2: Keep Quick Commands unchanged**

Do not change `quickCommands.ts`; local connection IDs allow existing scoped commands to work.

- [ ] **Step 3: Verify frontend build**

Run: `cd frontend && npm run build`

Expected: PASS.

### Task 4: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run backend tests**

Run: `go test ./...`

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`

Expected: PASS.

- [ ] **Step 3: Report risk**

Report whether Windows embedded PTY resize is supported in this iteration. If not, call it out as a known limitation.
