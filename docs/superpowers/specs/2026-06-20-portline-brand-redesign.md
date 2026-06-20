# Portline Brand Redesign

## Decision

Rename the user-facing product from **TermFlow** to **Portline** and replace the default Wails app icon with a custom terminal/port mark.

The rename is scoped to user-visible surfaces:

- Wails app name and output filename.
- Window title.
- Browser title and favicon.
- In-app titlebar brand.
- Status bar brand/version label.
- macOS packaged app icon source.

The Go module path, package names, storage directory, and internal protocol constants remain unchanged unless a later task explicitly asks for a full repository rename.

## Brand Direction

Portline should feel like a focused SSH and terminal workspace for operators and developers. The name combines ports, remote hosts, and command-line workflows. It is short enough for a titlebar, readable in the macOS dock, and specific enough to be less generic than TermFlow.

The visual mark is a compact rounded-square app icon:

- Dark terminal base, matching the existing app shell.
- Cyan/teal port-line shape for connection and flow.
- Small warm command cursor/accent to keep it recognizably terminal-oriented.
- Strong silhouette at small sizes, replacing the current default Wails "W" icon.

## UI Integration

The in-app brand should stay restrained. The titlebar uses a small custom logo mark followed by `Portline`; the status bar uses `›_ Portline v0.1.4` or an equivalent compact label. No landing-page or explanatory UI is added.

The existing Catppuccin-style dark/light terminal UI remains the product identity foundation. The redesign only changes brand surfaces and icon assets.

## Implementation Boundary

The implementation should update source-controlled app metadata and source UI, then regenerate or rebuild generated artifacts only through the project tooling.

Expected files include:

- `wails.json`
- `main.go`
- `frontend/index.html`
- `frontend/src/app/App.tsx`
- `frontend/src/features/status/StatusBar.tsx`
- `build/appicon.png`

Generated bindings under `frontend/wailsjs` must not be edited manually.

## Verification

Run:

- `go test ./...`
- `go build ./...`
- `cd frontend && npm run build`

Because this touches visible UI, run headless browser QA against the frontend or app shell. Verify the titlebar and status bar show `Portline`, the favicon is updated, the console has no runtime errors, and capture a screenshot artifact.

## Open Constraints

This spec does not include trademark/domain research. If Portline is later prepared for public distribution, do a naming availability check before release.
