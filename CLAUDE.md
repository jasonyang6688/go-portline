# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is This

TermFlow is a Wails v2 desktop app — an SSH terminal manager. Go backend + React/Vite frontend compiled into a single native macOS binary. The frontend is embedded via `//go:embed all:frontend/dist` in `main.go`.

## Commands

```bash
# Run app with hot-reload (starts Vite dev server automatically)
wails dev

# Build packaged desktop app
wails build

# Go tests only
go test ./...

# Frontend only
cd frontend && npm run build
cd frontend && npm run dev
```

Run a single Go test package: `go test ./internal/appsvc/`

## Architecture

**Go backend** (`app.go` + `internal/`):
- `app.go` — `App` struct with all methods bound to Wails. This is the entire public API surface between frontend and backend.
- `internal/domain/models.go` — all shared types (Connection, Session, TerminalSize, etc.)
- `internal/appsvc/services.go` — business logic layer; all `App` methods delegate here
- `internal/sessions/registry.go` — in-memory session state, maps session IDs to live SSH sessions
- `internal/sshclient/client.go` — SSH dial + PTY; implements an interface so tests can stub it
- `internal/storage/store.go` — SQLite via `modernc.org/sqlite`; connections, command history, settings

**Frontend** (`frontend/src/`):
- `app/App.tsx` — root shell; owns layout and active session/connection state
- `features/connections/` — sidebar list + create/edit modal
- `features/terminal/TerminalPane.tsx` — xterm.js terminal, writes to `WriteTerminal`, listens for Wails events
- `shared/api/wails.ts` — typed wrappers around `frontend/wailsjs` bindings; **all backend calls go through here**

**Wails event bus**: backend pushes terminal output and session lifecycle events via `wailsruntime.EventsEmit`; frontend subscribes with `EventsOn`. The emitter is in `appsvc.WailsEmitter`.

**Wails bindings** (`frontend/wailsjs/`): auto-generated from Go method signatures. Regenerate by running `wails dev` or `wails build` — never edit these files by hand.

## Key Conventions

- Add new backend methods to `App` in `app.go` → implement in `appsvc.Service` → add domain types in `internal/domain/models.go`. After adding a method, Wails regenerates `frontend/wailsjs` on next build; then wrap it in `shared/api/wails.ts`.
- DB schema changes live entirely in `internal/storage/store.go` (uses `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` migration pattern).
- Design prototypes and UX reference assets are in `ux/`; read `ux/README.md` before implementing visual work.
- Commit messages use short imperative subjects describing the user-visible change (e.g., `Preserve terminal output across session switches`).
- UI changes require headless browser QA per the `careful-dev-qa` skill at `/Users/delong/.codex/skills/careful-dev-qa`.
