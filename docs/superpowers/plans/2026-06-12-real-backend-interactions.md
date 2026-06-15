# Real Backend Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace terminal-page prototype data with real Wails-backed interactions for terminal input, command history/library, settings, files, and monitoring.

**Architecture:** Extend the existing Go domain/service/storage/Wails layers with focused persistence APIs and session-scoped shell execution helpers. Keep the React UI shape intact, swapping static arrays for typed Wails calls and routing command entry into the real PTY.

**Tech Stack:** Go, Wails v2, SQLite via `modernc.org/sqlite`, React/Vite/TypeScript, xterm.js.

---

### Task 1: Backend Data Contracts And Storage

**Files:**
- Modify: `internal/domain/models.go`
- Modify: `internal/storage/store.go`
- Test: `internal/storage/store_test.go`

- [ ] **Step 1: Write failing storage tests**

Add tests for command history append/list/clear, command library CRUD, and settings save/load. The tests should call new `Store` methods that do not exist yet and fail at compile time.

- [ ] **Step 2: Implement schema and store methods**

Add SQLite tables for `command_history`, `saved_commands`, and `settings`, then implement typed methods with validation and deterministic ordering.

- [ ] **Step 3: Run storage tests**

Run: `go test ./internal/storage`
Expected: PASS.

### Task 2: Service And Wails API Surface

**Files:**
- Modify: `internal/appsvc/services.go`
- Modify: `app.go`
- Test: `internal/appsvc/services_test.go`

- [ ] **Step 1: Write failing service tests**

Cover command execution writing `command + "\r"` to one or all active sessions, command history recording, settings round trip, and shell-backed monitor/file helpers.

- [ ] **Step 2: Implement service methods and App wrappers**

Expose methods for command history/library/settings plus `RunCommand`, `ListFiles`, and `GetMonitorSnapshot`.

- [ ] **Step 3: Run service tests**

Run: `go test ./internal/appsvc`
Expected: PASS.

### Task 3: Frontend API And Real UI Wiring

**Files:**
- Modify: `frontend/src/features/connections/types.ts`
- Modify: `frontend/src/shared/api/wails.ts`
- Modify: `frontend/src/app/App.tsx`

- [ ] **Step 1: Add TypeScript contracts**

Mirror the new Go JSON contracts in frontend types and Wails wrappers.

- [ ] **Step 2: Wire terminal and panels**

Render `TerminalPane` for the real terminal output, send typed command-row submissions through Wails, support broadcast, load command history/library/settings, fetch file and monitor data for the active session, and keep offline preview fallback.

- [ ] **Step 3: Build frontend**

Run: `cd frontend && npm run build`
Expected: PASS.

### Task 4: Full Verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Run backend suite**

Run: `go test ./...`
Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: PASS.
