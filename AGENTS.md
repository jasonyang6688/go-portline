# Repository Guidelines

## Project Structure & Module Organization

TermFlow is a Wails desktop app with a Go backend and React/Vite frontend. Root files `main.go` and `app.go` define the Wails entry point and app surface. Backend packages live under `internal/`: `appsvc` coordinates application services, `domain` holds shared models, `sessions` manages session state, `sshclient` handles SSH connectivity, and `storage` owns SQLite persistence. Frontend source lives in `frontend/src`, grouped by app shell, feature folders, and shared API wrappers. Wails-generated bindings are in `frontend/wailsjs`; regenerate them through Wails instead of editing by hand. Design prototypes and reference screenshots are in `ux/`, while implementation plans and specs are in `docs/`.

## Build, Test, and Development Commands

- `go test ./...`: runs all Go unit tests.
- `go build ./...`: verifies backend packages compile.
- `wails dev`: starts the desktop app with the Vite dev server.
- `wails build`: builds the packaged desktop app using `wails.json`.
- `cd frontend && npm run build`: builds the React frontend only.
- `cd frontend && npm run dev`: runs Vite for frontend-only iteration.

## Coding Style & Naming Conventions

Format Go code with `gofmt`; use tabs and idiomatic mixedCaps names. Keep package names short and lowercase (`appsvc`, `sshclient`). React components use PascalCase filenames such as `TerminalPane.tsx`; hooks, helpers, and variables use camelCase. Prefer existing feature-folder boundaries and typed API wrappers in `frontend/src/shared/api`. Do not commit generated dependency trees or build artifacts unless the change explicitly concerns them.

## Testing Guidelines

Go tests use the standard `testing` package and live next to implementation files as `*_test.go` (`registry_test.go`, `store_test.go`). Add focused tests for service, session, SSH, and storage behavior before changing contracts. Run `go test ./...` before submitting backend changes. There is no frontend test script currently; validate UI changes with `npm run build` and, for Wails behavior, `wails dev` or `wails build`.

For development, maintenance, and bug fixes, use the user-level `careful-dev-qa` skill at `/Users/delong/.codex/skills/careful-dev-qa`. UI or interaction changes must include headless browser QA that clicks/types through the affected workflow, captures screenshot artifacts, checks console errors, and reports screenshot paths with the final test evidence.

## Commit & Pull Request Guidelines

Recent commits use short imperative subjects, for example `Preserve terminal output across session switches` and `Close the terminal late-event race synchronously`. Follow that style: describe the user-visible or behavioral change, not the implementation chore. Pull requests should include a concise summary, test results, linked issue or plan when applicable, and screenshots or recordings for visible UI changes.

## Agent-Specific Instructions

Before implementing design work from `ux/`, read `ux/README.md` and the referenced prototype files. Treat `frontend/wailsjs` as generated output and keep manual changes focused on source files under `internal/` and `frontend/src/`.
