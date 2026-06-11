# TermFlow Desktop MVP Design

Date: 2026-06-11

## Goal

Build the first real desktop MVP for TermFlow: a FinalShell-like cross-platform SSH terminal manager that can run on macOS and Windows. The MVP focuses on a reliable SSH terminal path before adding SFTP, host monitoring, command libraries, cloud sync, or plugin systems.

The `ux/` bundle is the visual and interaction reference. The production app should preserve the TermFlow look, but the terminal area must be backed by real SSH session events rather than static terminal text.

## Confirmed Scope

The first phase is a real desktop application, not a standalone HTML demo.

Confirmed choices:

- Desktop shell: Wails
- Backend language: Go
- Frontend: React + TypeScript + xterm.js
- MVP priority: SSH terminal first
- Architecture style: simple modular MVP with clear service boundaries, not a full plugin system

## Non-Goals For MVP

- Real SFTP file manager
- Server monitoring collection
- Cloud sync
- Multi-user/team collaboration
- Extension/plugin marketplace
- Web or remote browser access
- Persistent password storage

The UI may reserve navigation slots for future SFTP, monitor, command library, and settings features, but those features should not block the first SSH terminal milestone.

## Architecture

TermFlow uses three layers.

### Desktop Shell

Wails owns the application window, build/package workflow, native desktop integration, and the Go-to-frontend bridge.

The MVP should support development runs on macOS first and keep Windows packaging in the project structure from the start.

### Go Backend Core

Go is the real backend core. It owns SSH connections, PTY sessions, terminal IO, session lifecycle, and local persistence.

Initial services:

- `ConnectionService`: create, list, update, delete, and test SSH connection definitions
- `SessionService`: open, close, and inspect SSH sessions
- `TerminalService`: write terminal input, resize remote PTY, and route output
- `EventBus`: publish session output, status, errors, and close events to the frontend
- `Storage`: persist local connection and app settings data

Control operations are exposed as Wails service methods. Streaming data is sent with Wails events.

### Frontend App

The frontend is a production React app that uses `xterm.js` for the terminal. It should be organized around feature modules rather than a single large component.

Initial frontend areas:

- App shell
- Connection sidebar
- Session tabs
- Terminal workspace
- Status bar
- Connection modal
- Settings entry shell
- Shared UI primitives based on the `ux/` visual system

The frontend holds UI state and `sessionId` references. It does not own SSH clients or remote process state.

## Backend Module Boundaries

Recommended Go layout:

```text
internal/app
internal/domain
internal/events
internal/sessions
internal/ssh
internal/storage
```

`internal/app` starts Wails, registers services, wires dependencies, and handles application lifecycle.

`internal/domain` contains pure data models and constants. It should not depend on Wails, database packages, or SSH libraries.

`internal/storage` contains persistence interfaces and implementations. SQLite is recommended for MVP because later connection groups, command history, settings, and audit records will fit naturally.

`internal/ssh` wraps SSH client behavior, PTY allocation, keepalive, resize, and graceful close.

`internal/sessions` owns the runtime session registry. It maps session IDs to active SSH PTY sessions, controls goroutine lifetimes, writes stdin, resizes PTYs, and closes sessions.

`internal/events` defines event names and payload structures so backend and frontend share stable contracts.

## Data Model

```go
type Connection struct {
    ID        string
    Name      string
    Host      string
    Port      int
    Username  string
    AuthType  string // key | password | agent
    KeyPath   string
    Group     string
    Tags      []string
    CreatedAt time.Time
    UpdatedAt time.Time
}

type Session struct {
    ID           string
    ConnectionID string
    Name         string
    Status       SessionStatus
    CreatedAt    time.Time
    LastActiveAt time.Time
}

type TerminalSize struct {
    Cols int
    Rows int
}
```

`ConnectionID` and `SessionID` are the long-term anchors for future SFTP, monitoring, command execution, and terminal history.

## Event Contract

Initial event names:

- `session:created`
- `session:output`
- `session:status`
- `session:error`
- `session:closed`

Terminal output events should include `sessionId` and byte/string payload data. Status and error events should include enough context for the frontend to show actionable UI states.

## MVP Functional Requirements

### Desktop Startup

- App launches in Wails dev mode.
- Main window loads the TermFlow UI.
- Window title identifies TermFlow.
- Shell supports macOS and keeps Windows build requirements in view.

### Connection Management

- User can create, edit, delete, and list SSH connections.
- Connection fields: name, host, port, username, auth type, key path where applicable.
- User can test a connection and see success or a clear failure reason.
- Connections persist locally.
- Passwords are not persisted in MVP.
- Private key contents are not stored; only key paths may be stored.

### SSH Terminal

- Opening a connection creates a backend session.
- Backend allocates a remote PTY.
- Frontend renders output through xterm.js.
- Keyboard input writes to the remote session stdin.
- Terminal resize sends rows/cols to the backend PTY.
- User can close a session.
- Session states are visible: connecting, connected, disconnected, error, closed.

### UI

- First screen follows the `ux/` TermFlow design.
- Required visible areas: activity rail, connection sidebar, session tabs, terminal panel, status bar.
- Dark theme is primary.
- Light theme remains an extension point.
- Terminal content is driven by real session events, not static sample output.

## Error Handling

- Authentication failure shows a clear SSH auth error.
- Network timeout marks the session as `error` and allows retry.
- Remote disconnect marks the session as `disconnected`.
- Closing the frontend window triggers backend session cleanup.
- Terminal resize failures are logged and surfaced non-fatally.
- Backend goroutines are tied to cancellable contexts to avoid leaks.

## Test Strategy

Go unit tests:

- Connection store CRUD
- Session registry lifecycle
- Event payload serialization
- Terminal resize validation

Go integration tests:

- Use a mock SSH/session runner to verify stdin/stdout bridge behavior.
- Verify session close cancels goroutines and emits close/status events.

Frontend tests:

- Connection form state and validation
- Session tab state transitions
- Terminal event append behavior
- Error banner/status rendering

Browser QA:

- Start the Wails or frontend dev server.
- Check for critical console errors.
- Open the main screen and capture screenshots.
- Exercise connection modal, session tab UI, terminal shell UI, and theme toggle.
- Compare the visible shell against the `ux/` reference for layout regressions.

Manual acceptance:

- Use one real SSH host to verify login, command input/output, resize, and disconnect.

## Implementation Notes

The first implementation plan should avoid overbuilding a plugin architecture. Use interfaces where they protect testability or isolate external systems, especially storage and SSH session running. Do not introduce abstractions for future SFTP or monitoring until those features are implemented.

The visual implementation should reuse the `ux/` design language, but production code should be structured as maintainable React/TypeScript modules rather than copying the prototype file structure wholesale.
