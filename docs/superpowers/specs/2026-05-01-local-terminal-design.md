# Local Terminal Connection Design

## Goal

TermFlow should open the host machine's default terminal shell inside the existing terminal panel, using the same tabs, input path, resize path, and Quick Commands workflow as SSH and WSL sessions.

## Scope

- Add a `local` connection kind.
- Auto-create one saved local connection on app startup.
- Start an embedded PTY-backed local shell for that connection.
- Use `$SHELL` on macOS and Unix-like systems, falling back to `/bin/zsh` on macOS and `/bin/sh` elsewhere.
- Use PowerShell on Windows, falling back to `cmd.exe`.
- Keep Quick Commands unchanged: global commands and connection-scoped commands continue to work because local terminal sessions use normal connection IDs.

## Architecture

The backend already routes terminal operations through `ssh.ManagedSession`. A new `internal/local` package will implement that interface for local processes. `App.SSHConnect` will become a session factory that selects SSH, WSL, or local based on `store.Connection.Kind`.

The frontend already treats terminal sessions generically by session ID. It only needs connection type metadata for display and local connection creation/editing. No separate local terminal API is needed.

## Data Model

`connections.kind` already exists. The new value is `local`.

Local connections use:

- `name`: `Local Terminal`
- `host`: `localhost`
- `port`: `0`
- `user`: current OS user
- `kind`: `local`
- `env`: `dev`
- `group_name`: `Local`

## Error Handling

If no shell executable can be found, connecting the local terminal returns a clear error. If the local process exits, the existing `ssh:exit:<sessionId>` event marks the terminal closed.

## Testing

Backend tests cover default shell selection and local connection detection without requiring an interactive desktop app. Full PTY behavior is verified by `go test ./...` and frontend integration by `cd frontend && npm run build`.
