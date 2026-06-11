# TermFlow Desktop MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first installable TermFlow desktop MVP path: Wails app, Go SSH backend, React/xterm.js UI, persistent SSH connections, and a real interactive SSH terminal.

**Architecture:** Keep the existing Wails v2 application surface for the first implementation because the repository already has Wails v2 build configuration, Go SSH dependencies, SQLite, and generated runtime bindings in Git history. Replace the deleted Vue frontend with a React/TypeScript frontend and organize Go code into small domain, storage, SSH, session, and app service modules. Use Wails bound methods for control calls and Wails runtime events for terminal output/status streaming.

**Tech Stack:** Go, Wails v2, `golang.org/x/crypto/ssh`, `modernc.org/sqlite`, React, TypeScript, Vite, `@xterm/xterm`, `@xterm/addon-fit`, Playwright/browser QA.

---

## Current Repository State

The working tree currently shows many tracked app files as deleted, including `go.mod`, `main.go`, `app.go`, `wails.json`, `frontend/`, and `internal/`. Do not blindly stage all changes. Each implementation task must recreate or modify only the files listed for that task, then run `git status --short <paths>` before committing.

The old tracked app was Wails v2 + Vue. The MVP keeps Wails v2 for delivery speed, but replaces the frontend with React to match the approved design.

## File Structure

Create or replace these files:

```text
go.mod
main.go
app.go
wails.json
internal/domain/models.go
internal/storage/store.go
internal/storage/store_test.go
internal/sshclient/client.go
internal/sshclient/client_test.go
internal/sessions/registry.go
internal/sessions/registry_test.go
internal/appsvc/services.go
frontend/package.json
frontend/index.html
frontend/tsconfig.json
frontend/tsconfig.node.json
frontend/vite.config.ts
frontend/src/main.tsx
frontend/src/app/App.tsx
frontend/src/app/styles.css
frontend/src/shared/api/wails.ts
frontend/src/features/connections/types.ts
frontend/src/features/connections/ConnectionSidebar.tsx
frontend/src/features/connections/ConnectionModal.tsx
frontend/src/features/terminal/TerminalPane.tsx
frontend/src/features/sessions/SessionTabs.tsx
frontend/src/features/status/StatusBar.tsx
artifacts/browser-qa/termflow-mvp/probe.mjs
```

Keep these old modules out of the SSH terminal MVP unless a named follow-up plan revives them:

```text
internal/local
internal/wsl
internal/termexec
frontend/src/components/files
frontend/src/components/commands
frontend/src/components/settings
```

## Task 1: Recreate Minimal Wails/Go Skeleton

**Files:**

- Create: `go.mod`
- Create: `main.go`
- Create: `app.go`
- Create: `wails.json`

- [ ] **Step 1: Write `go.mod`**

```go
module TermFlow

go 1.25.0

require (
	github.com/google/uuid v1.6.0
	github.com/wailsapp/wails/v2 v2.12.0
	golang.org/x/crypto v0.41.0
	modernc.org/sqlite v1.49.1
)
```

- [ ] **Step 2: Write `wails.json`**

```json
{
  "$schema": "https://wails.io/schemas/config.v2.json",
  "name": "TermFlow",
  "outputfilename": "TermFlow",
  "frontend:install": "npm install",
  "frontend:build": "npm run build",
  "frontend:dev:watcher": "npm run dev",
  "frontend:dev:serverUrl": "auto",
  "author": {
    "name": "jason",
    "email": "developer@larcoo.com"
  }
}
```

- [ ] **Step 3: Write `main.go`**

```go
package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()
	if err := wails.Run(buildAppOptions(app)); err != nil {
		log.Fatal(err)
	}
}

func buildAppOptions(app *App) *options.App {
	return &options.App{
		Title:  "TermFlow",
		Width:  1280,
		Height: 800,
		MinWidth:  960,
		MinHeight: 640,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 24, G: 25, B: 38, A: 1},
		Mac: &mac.Options{
			DisableZoom: false,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		Bind: []interface{}{
			app,
		},
	}
}
```

- [ ] **Step 4: Write `app.go`**

```go
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"TermFlow/internal/appsvc"
	"TermFlow/internal/domain"
	"TermFlow/internal/sessions"
	"TermFlow/internal/sshclient"
	"TermFlow/internal/storage"
)

type App struct {
	ctx      context.Context
	store    *storage.Store
	registry *sessions.Registry
	service  *appsvc.Service
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	dbPath, err := defaultDBPath()
	if err != nil {
		panic(err)
	}
	if err := os.MkdirAll(filepath.Dir(dbPath), 0700); err != nil {
		panic(fmt.Sprintf("create app data directory: %v", err))
	}

	store, err := storage.New(dbPath)
	if err != nil {
		panic(fmt.Sprintf("open TermFlow store: %v", err))
	}

	a.store = store
	a.registry = sessions.NewRegistry(sshclient.RealRunner{}, appsvc.NewWailsEmitter(ctx))
	a.service = appsvc.NewService(store, a.registry)
}

func (a *App) shutdown(context.Context) {
	if a.registry != nil {
		a.registry.CloseAll()
	}
	if a.store != nil {
		_ = a.store.Close()
	}
}

func defaultDBPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		home, homeErr := os.UserHomeDir()
		if homeErr != nil {
			return "", homeErr
		}
		dir = filepath.Join(home, ".termflow")
	} else {
		dir = filepath.Join(dir, "TermFlow")
	}
	return filepath.Join(dir, "termflow.db"), nil
}

func (a *App) ListConnections() ([]domain.Connection, error) {
	return a.service.ListConnections()
}

func (a *App) SaveConnection(input domain.SaveConnectionInput) (domain.Connection, error) {
	return a.service.SaveConnection(input)
}

func (a *App) DeleteConnection(id string) error {
	return a.service.DeleteConnection(id)
}

func (a *App) TestConnection(input domain.TestConnectionInput) error {
	return a.service.TestConnection(input)
}

func (a *App) OpenSession(input domain.OpenSessionInput) (domain.Session, error) {
	return a.service.OpenSession(input)
}

func (a *App) CloseSession(sessionID string) error {
	return a.service.CloseSession(sessionID)
}

func (a *App) WriteTerminal(sessionID string, data string) error {
	return a.service.WriteTerminal(sessionID, data)
}

func (a *App) ResizeTerminal(sessionID string, size domain.TerminalSize) error {
	return a.service.ResizeTerminal(sessionID, size)
}
```

- [ ] **Step 5: Verify skeleton compiles far enough to expose missing internal packages**

Run: `go test ./...`

Expected: FAIL with import errors for `TermFlow/internal/appsvc`, `domain`, `sessions`, `sshclient`, and `storage`.

- [ ] **Step 6: Commit skeleton**

```bash
git add go.mod main.go app.go wails.json
git commit -m "Restore TermFlow Wails shell"
```

## Task 2: Add Domain Models And Event Contracts

**Files:**

- Create: `internal/domain/models.go`

- [ ] **Step 1: Write `internal/domain/models.go`**

```go
package domain

import "time"

type AuthType string

const (
	AuthPassword AuthType = "password"
	AuthKey      AuthType = "key"
	AuthAgent    AuthType = "agent"
)

type SessionStatus string

const (
	SessionConnecting    SessionStatus = "connecting"
	SessionConnected     SessionStatus = "connected"
	SessionDisconnected  SessionStatus = "disconnected"
	SessionError         SessionStatus = "error"
	SessionClosed        SessionStatus = "closed"
)

const (
	EventSessionCreated = "session:created"
	EventSessionOutput  = "session:output"
	EventSessionStatus  = "session:status"
	EventSessionError   = "session:error"
	EventSessionClosed  = "session:closed"
)

type Connection struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Host      string    `json:"host"`
	Port      int       `json:"port"`
	Username  string    `json:"username"`
	AuthType  AuthType  `json:"authType"`
	KeyPath   string    `json:"keyPath"`
	Group     string    `json:"group"`
	Tags      []string  `json:"tags"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type SaveConnectionInput struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Host     string   `json:"host"`
	Port     int      `json:"port"`
	Username string   `json:"username"`
	AuthType AuthType `json:"authType"`
	KeyPath  string   `json:"keyPath"`
	Group    string   `json:"group"`
	Tags     []string `json:"tags"`
}

type TestConnectionInput struct {
	ConnectionID string   `json:"connectionId"`
	Host         string   `json:"host"`
	Port         int      `json:"port"`
	Username     string   `json:"username"`
	AuthType     AuthType `json:"authType"`
	Password     string   `json:"password"`
	KeyPath      string   `json:"keyPath"`
}

type OpenSessionInput struct {
	ConnectionID string       `json:"connectionId"`
	Password     string       `json:"password"`
	Size         TerminalSize `json:"size"`
}

type Session struct {
	ID           string        `json:"id"`
	ConnectionID string        `json:"connectionId"`
	Name         string        `json:"name"`
	Status       SessionStatus `json:"status"`
	CreatedAt    time.Time     `json:"createdAt"`
	LastActiveAt time.Time     `json:"lastActiveAt"`
}

type TerminalSize struct {
	Cols int `json:"cols"`
	Rows int `json:"rows"`
}

type SessionOutputEvent struct {
	SessionID string `json:"sessionId"`
	Data      string `json:"data"`
}

type SessionStatusEvent struct {
	SessionID string        `json:"sessionId"`
	Status    SessionStatus `json:"status"`
	Message   string        `json:"message"`
}

type SessionErrorEvent struct {
	SessionID string `json:"sessionId"`
	Message   string `json:"message"`
}
```

- [ ] **Step 2: Run package tests**

Run: `go test ./internal/domain`

Expected: PASS with `[no test files]`.

- [ ] **Step 3: Commit domain models**

```bash
git add internal/domain/models.go
git commit -m "Define TermFlow domain contracts"
```

## Task 3: Add SQLite Connection Storage

**Files:**

- Create: `internal/storage/store.go`
- Create: `internal/storage/store_test.go`

- [ ] **Step 1: Write failing storage tests**

Create `internal/storage/store_test.go`:

```go
package storage

import (
	"path/filepath"
	"testing"

	"TermFlow/internal/domain"
)

func TestConnectionCRUD(t *testing.T) {
	store, err := New(filepath.Join(t.TempDir(), "termflow.db"))
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	defer store.Close()

	saved, err := store.SaveConnection(domain.SaveConnectionInput{
		Name:     "prod-01",
		Host:     "10.0.1.100",
		Port:     22,
		Username: "root",
		AuthType: domain.AuthKey,
		KeyPath:  "/Users/test/.ssh/id_ed25519",
		Group:    "Production",
		Tags:     []string{"prod", "linux"},
	})
	if err != nil {
		t.Fatalf("SaveConnection() error = %v", err)
	}
	if saved.ID == "" {
		t.Fatal("SaveConnection() returned empty ID")
	}

	list, err := store.ListConnections()
	if err != nil {
		t.Fatalf("ListConnections() error = %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("ListConnections() length = %d, want 1", len(list))
	}
	if list[0].Name != "prod-01" {
		t.Fatalf("stored connection = %+v, want prod-01", list[0])
	}

	updated, err := store.SaveConnection(domain.SaveConnectionInput{
		ID:       saved.ID,
		Name:     "prod-main",
		Host:     "10.0.1.100",
		Port:     2222,
		Username: "deploy",
		AuthType: domain.AuthPassword,
		Group:    "Production",
	})
	if err != nil {
		t.Fatalf("SaveConnection(update) error = %v", err)
	}
	if updated.ID != saved.ID {
		t.Fatalf("updated ID = %q, want %q", updated.ID, saved.ID)
	}

	got, err := store.GetConnection(saved.ID)
	if err != nil {
		t.Fatalf("GetConnection() error = %v", err)
	}
	if got.Name != "prod-main" || got.Port != 2222 || got.Username != "deploy" {
		t.Fatalf("GetConnection() = %+v, want updated values", got)
	}

	if err := store.DeleteConnection(saved.ID); err != nil {
		t.Fatalf("DeleteConnection() error = %v", err)
	}
	list, err = store.ListConnections()
	if err != nil {
		t.Fatalf("ListConnections(after delete) error = %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("ListConnections(after delete) length = %d, want 0", len(list))
	}
}
```

- [ ] **Step 2: Run failing storage test**

Run: `go test ./internal/storage`

Expected: FAIL because `New`, `Store` are undefined.

- [ ] **Step 3: Add storage implementation**

Create `internal/storage/store.go`:

```go
package storage

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"TermFlow/internal/domain"
	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS connections (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	host TEXT NOT NULL,
	port INTEGER NOT NULL,
	username TEXT NOT NULL,
	auth_type TEXT NOT NULL,
	key_path TEXT NOT NULL DEFAULT '',
	group_name TEXT NOT NULL DEFAULT '',
	tags_json TEXT NOT NULL DEFAULT '[]',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);`

type Store struct {
	db *sql.DB
}

func New(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *Store) ListConnections() ([]domain.Connection, error) {
	rows, err := s.db.Query(`SELECT id,name,host,port,username,auth_type,key_path,group_name,tags_json,created_at,updated_at FROM connections ORDER BY group_name, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.Connection
	for rows.Next() {
		conn, err := scanConnection(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, conn)
	}
	return out, rows.Err()
}

func (s *Store) GetConnection(id string) (domain.Connection, error) {
	row := s.db.QueryRow(`SELECT id,name,host,port,username,auth_type,key_path,group_name,tags_json,created_at,updated_at FROM connections WHERE id=?`, id)
	return scanConnection(row)
}

func (s *Store) SaveConnection(input domain.SaveConnectionInput) (domain.Connection, error) {
	if err := validateConnection(input); err != nil {
		return domain.Connection{}, err
	}

	now := time.Now().UTC()
	id := strings.TrimSpace(input.ID)
	if id == "" {
		id = uuid.NewString()
	}
	tags, err := json.Marshal(input.Tags)
	if err != nil {
		return domain.Connection{}, err
	}

	if input.ID == "" {
		_, err = s.db.Exec(
			`INSERT INTO connections (id,name,host,port,username,auth_type,key_path,group_name,tags_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
			id, input.Name, input.Host, normalizedPort(input.Port), input.Username, normalizedAuth(input.AuthType), input.KeyPath, input.Group, string(tags), now.Format(time.RFC3339Nano), now.Format(time.RFC3339Nano),
		)
	} else {
		_, err = s.db.Exec(
			`UPDATE connections SET name=?,host=?,port=?,username=?,auth_type=?,key_path=?,group_name=?,tags_json=?,updated_at=? WHERE id=?`,
			input.Name, input.Host, normalizedPort(input.Port), input.Username, normalizedAuth(input.AuthType), input.KeyPath, input.Group, string(tags), now.Format(time.RFC3339Nano), id,
		)
	}
	if err != nil {
		return domain.Connection{}, err
	}
	return s.GetConnection(id)
}

func (s *Store) DeleteConnection(id string) error {
	res, err := s.db.Exec(`DELETE FROM connections WHERE id=?`, strings.TrimSpace(id))
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

type scanner interface {
	Scan(dest ...any) error
}

func scanConnection(row scanner) (domain.Connection, error) {
	var c domain.Connection
	var auth string
	var tagsJSON string
	var created string
	var updated string
	if err := row.Scan(&c.ID, &c.Name, &c.Host, &c.Port, &c.Username, &auth, &c.KeyPath, &c.Group, &tagsJSON, &created, &updated); err != nil {
		return domain.Connection{}, err
	}
	c.AuthType = domain.AuthType(auth)
	if err := json.Unmarshal([]byte(tagsJSON), &c.Tags); err != nil {
		return domain.Connection{}, err
	}
	var err error
	c.CreatedAt, err = time.Parse(time.RFC3339Nano, created)
	if err != nil {
		return domain.Connection{}, err
	}
	c.UpdatedAt, err = time.Parse(time.RFC3339Nano, updated)
	if err != nil {
		return domain.Connection{}, err
	}
	return c, nil
}

func validateConnection(input domain.SaveConnectionInput) error {
	if strings.TrimSpace(input.Name) == "" {
		return errors.New("connection name is required")
	}
	if strings.TrimSpace(input.Host) == "" {
		return errors.New("host is required")
	}
	if strings.TrimSpace(input.Username) == "" {
		return errors.New("username is required")
	}
	if normalizedPort(input.Port) <= 0 || normalizedPort(input.Port) > 65535 {
		return fmt.Errorf("port must be between 1 and 65535")
	}
	return nil
}

func normalizedPort(port int) int {
	if port == 0 {
		return 22
	}
	return port
}

func normalizedAuth(auth domain.AuthType) domain.AuthType {
	if auth == "" {
		return domain.AuthPassword
	}
	return auth
}
```

- [ ] **Step 4: Run storage tests**

Run: `go test ./internal/storage`

Expected: PASS.

- [ ] **Step 5: Commit storage**

```bash
git add internal/storage/store.go internal/storage/store_test.go
git commit -m "Persist SSH connection definitions"
```

## Task 4: Add SSH Runner Interface And Real Implementation

**Files:**

- Create: `internal/sshclient/client.go`
- Create: `internal/sshclient/client_test.go`

- [ ] **Step 1: Write SSH client tests for validation**

Create `internal/sshclient/client_test.go`:

```go
package sshclient

import (
	"testing"

	"TermFlow/internal/domain"
)

func TestBuildConfigRejectsMissingAuth(t *testing.T) {
	_, err := buildClientConfig(ConnectRequest{
		Username: "root",
		AuthType: domain.AuthPassword,
	})
	if err == nil {
		t.Fatal("buildClientConfig() error = nil, want missing password error")
	}
}

func TestNormalizeSize(t *testing.T) {
	size := NormalizeSize(domain.TerminalSize{})
	if size.Cols != 120 || size.Rows != 32 {
		t.Fatalf("NormalizeSize(empty) = %+v, want 120x32", size)
	}
}
```

- [ ] **Step 2: Run failing SSH client tests**

Run: `go test ./internal/sshclient`

Expected: FAIL because package implementation is missing.

- [ ] **Step 3: Add SSH client implementation**

Create `internal/sshclient/client.go`:

```go
package sshclient

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"

	"TermFlow/internal/domain"
	gossh "golang.org/x/crypto/ssh"
)

type ConnectRequest struct {
	Host     string
	Port     int
	Username string
	AuthType domain.AuthType
	Password string
	KeyPath  string
}

type Runner interface {
	Connect(req ConnectRequest) (TerminalSession, error)
	Test(req ConnectRequest) error
}

type TerminalSession interface {
	Start(size domain.TerminalSize, onData func([]byte), onExit func(error)) error
	Write(data string) error
	Resize(size domain.TerminalSize) error
	Close() error
}

type RealRunner struct{}

func (RealRunner) Connect(req ConnectRequest) (TerminalSession, error) {
	cfg, err := buildClientConfig(req)
	if err != nil {
		return nil, err
	}
	client, err := gossh.Dial("tcp", address(req), cfg)
	if err != nil {
		return nil, err
	}
	return &realSession{client: client}, nil
}

func (r RealRunner) Test(req ConnectRequest) error {
	session, err := r.Connect(req)
	if err != nil {
		return err
	}
	return session.Close()
}

type realSession struct {
	client *gossh.Client
	mu     sync.Mutex
	shell  *gossh.Session
	stdin  io.WriteCloser
	closed bool
}

func (s *realSession) Start(size domain.TerminalSize, onData func([]byte), onExit func(error)) error {
	size = NormalizeSize(size)
	shell, err := s.client.NewSession()
	if err != nil {
		return err
	}

	modes := gossh.TerminalModes{
		gossh.ECHO:          1,
		gossh.TTY_OP_ISPEED: 14400,
		gossh.TTY_OP_OSPEED: 14400,
	}
	if err := shell.RequestPty("xterm-256color", size.Rows, size.Cols, modes); err != nil {
		_ = shell.Close()
		return err
	}

	stdin, err := shell.StdinPipe()
	if err != nil {
		_ = shell.Close()
		return err
	}
	stdout, err := shell.StdoutPipe()
	if err != nil {
		_ = shell.Close()
		return err
	}
	stderr, err := shell.StderrPipe()
	if err != nil {
		_ = shell.Close()
		return err
	}

	s.mu.Lock()
	s.shell = shell
	s.stdin = stdin
	s.mu.Unlock()

	go copyOutput(stdout, onData)
	go copyOutput(stderr, onData)

	if err := shell.Shell(); err != nil {
		_ = shell.Close()
		return err
	}

	go func() {
		err := shell.Wait()
		s.mu.Lock()
		s.closed = true
		s.mu.Unlock()
		if onExit != nil {
			onExit(err)
		}
	}()

	return nil
}

func (s *realSession) Write(data string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return errors.New("terminal session is closed")
	}
	if s.stdin == nil {
		return errors.New("terminal session has not started")
	}
	_, err := io.WriteString(s.stdin, data)
	return err
}

func (s *realSession) Resize(size domain.TerminalSize) error {
	size = NormalizeSize(size)
	s.mu.Lock()
	shell := s.shell
	s.mu.Unlock()
	if shell == nil {
		return nil
	}
	return shell.WindowChange(size.Rows, size.Cols)
}

func (s *realSession) Close() error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil
	}
	s.closed = true
	shell := s.shell
	client := s.client
	s.mu.Unlock()
	if shell != nil {
		_ = shell.Close()
	}
	if client != nil {
		return client.Close()
	}
	return nil
}

func buildClientConfig(req ConnectRequest) (*gossh.ClientConfig, error) {
	auth, err := authMethods(req)
	if err != nil {
		return nil, err
	}
	return &gossh.ClientConfig{
		User:            strings.TrimSpace(req.Username),
		Auth:            auth,
		HostKeyCallback: gossh.InsecureIgnoreHostKey(),
		Timeout:         12 * time.Second,
	}, nil
}

func authMethods(req ConnectRequest) ([]gossh.AuthMethod, error) {
	switch req.AuthType {
	case domain.AuthKey:
		if strings.TrimSpace(req.KeyPath) == "" {
			return nil, errors.New("private key path is required")
		}
		key, err := os.ReadFile(req.KeyPath)
		if err != nil {
			return nil, err
		}
		signer, err := gossh.ParsePrivateKeyWithPassphrase(key, []byte(req.Password))
		if err != nil {
			signer, err = gossh.ParsePrivateKey(key)
			if err != nil {
				return nil, err
			}
		}
		return []gossh.AuthMethod{gossh.PublicKeys(signer)}, nil
	case domain.AuthAgent:
		return nil, errors.New("ssh agent auth is not implemented in MVP")
	default:
		if req.Password == "" {
			return nil, errors.New("password is required")
		}
		return []gossh.AuthMethod{gossh.Password(req.Password)}, nil
	}
}

func address(req ConnectRequest) string {
	port := req.Port
	if port == 0 {
		port = 22
	}
	return fmt.Sprintf("%s:%d", req.Host, port)
}

func NormalizeSize(size domain.TerminalSize) domain.TerminalSize {
	if size.Cols <= 0 {
		size.Cols = 120
	}
	if size.Rows <= 0 {
		size.Rows = 32
	}
	return size
}

func copyOutput(r io.Reader, onData func([]byte)) {
	buf := make([]byte, 32*1024)
	for {
		n, err := r.Read(buf)
		if n > 0 && onData != nil {
			chunk := make([]byte, n)
			copy(chunk, buf[:n])
			onData(chunk)
		}
		if err != nil {
			return
		}
	}
}
```

- [ ] **Step 4: Run SSH client tests**

Run: `go test ./internal/sshclient`

Expected: PASS.

- [ ] **Step 5: Commit SSH runner**

```bash
git add internal/sshclient/client.go internal/sshclient/client_test.go
git commit -m "Add SSH terminal runner"
```

## Task 5: Add Session Registry With Event Emission

**Files:**

- Create: `internal/sessions/registry.go`
- Create: `internal/sessions/registry_test.go`

- [ ] **Step 1: Write registry tests with fake runner**

Create `internal/sessions/registry_test.go`:

```go
package sessions

import (
	"errors"
	"sync"
	"testing"

	"TermFlow/internal/domain"
	"TermFlow/internal/sshclient"
)

type fakeEmitter struct {
	mu     sync.Mutex
	events []emitted
}

type emitted struct {
	name string
	data any
}

func (e *fakeEmitter) Emit(name string, data any) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.events = append(e.events, emitted{name: name, data: data})
}

type fakeRunner struct {
	session *fakeSession
	err     error
}

func (r fakeRunner) Connect(sshclient.ConnectRequest) (sshclient.TerminalSession, error) {
	if r.err != nil {
		return nil, r.err
	}
	return r.session, nil
}

func (r fakeRunner) Test(sshclient.ConnectRequest) error { return r.err }

type fakeSession struct {
	writes  []string
	resizes []domain.TerminalSize
	closed  bool
	onData  func([]byte)
	onExit  func(error)
}

func (s *fakeSession) Start(size domain.TerminalSize, onData func([]byte), onExit func(error)) error {
	s.onData = onData
	s.onExit = onExit
	onData([]byte("hello\r\n"))
	return nil
}

func (s *fakeSession) Write(data string) error {
	s.writes = append(s.writes, data)
	return nil
}

func (s *fakeSession) Resize(size domain.TerminalSize) error {
	s.resizes = append(s.resizes, size)
	return nil
}

func (s *fakeSession) Close() error {
	s.closed = true
	return nil
}

func TestOpenWriteResizeClose(t *testing.T) {
	emitter := &fakeEmitter{}
	term := &fakeSession{}
	reg := NewRegistry(fakeRunner{session: term}, emitter)

	session, err := reg.Open(OpenRequest{
		Connection: domain.Connection{ID: "c1", Name: "prod", Host: "127.0.0.1", Port: 22, Username: "root", AuthType: domain.AuthPassword},
		Password: "secret",
		Size:     domain.TerminalSize{Cols: 100, Rows: 30},
	})
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}

	if err := reg.Write(session.ID, "ls\r"); err != nil {
		t.Fatalf("Write() error = %v", err)
	}
	if err := reg.Resize(session.ID, domain.TerminalSize{Cols: 80, Rows: 24}); err != nil {
		t.Fatalf("Resize() error = %v", err)
	}
	if err := reg.Close(session.ID); err != nil {
		t.Fatalf("Close() error = %v", err)
	}

	if len(term.writes) != 1 || term.writes[0] != "ls\r" {
		t.Fatalf("writes = %#v, want ls", term.writes)
	}
	if len(term.resizes) != 1 || term.resizes[0].Cols != 80 {
		t.Fatalf("resizes = %#v, want 80x24", term.resizes)
	}
	if !term.closed {
		t.Fatal("session was not closed")
	}
	if len(emitter.events) < 3 {
		t.Fatalf("events = %#v, want created/output/status events", emitter.events)
	}
}

func TestOpenEmitsErrorWhenConnectFails(t *testing.T) {
	emitter := &fakeEmitter{}
	reg := NewRegistry(fakeRunner{err: errors.New("dial failed")}, emitter)

	_, err := reg.Open(OpenRequest{
		Connection: domain.Connection{ID: "c1", Name: "prod", Host: "127.0.0.1", Port: 22, Username: "root", AuthType: domain.AuthPassword},
		Password: "secret",
	})
	if err == nil {
		t.Fatal("Open() error = nil, want dial failed")
	}
	if len(emitter.events) == 0 {
		t.Fatal("expected error event")
	}
}
```

- [ ] **Step 2: Run failing registry tests**

Run: `go test ./internal/sessions`

Expected: FAIL because registry implementation is missing.

- [ ] **Step 3: Add registry implementation**

Create `internal/sessions/registry.go`:

```go
package sessions

import (
	"errors"
	"sync"
	"time"

	"TermFlow/internal/domain"
	"TermFlow/internal/sshclient"
	"github.com/google/uuid"
)

type Emitter interface {
	Emit(name string, data any)
}

type OpenRequest struct {
	Connection domain.Connection
	Password   string
	Size       domain.TerminalSize
}

type Registry struct {
	runner   sshclient.Runner
	emitter  Emitter
	mu       sync.RWMutex
	sessions map[string]*entry
}

type entry struct {
	model   domain.Session
	term    sshclient.TerminalSession
	created time.Time
}

func NewRegistry(runner sshclient.Runner, emitter Emitter) *Registry {
	return &Registry{
		runner:   runner,
		emitter:  emitter,
		sessions: make(map[string]*entry),
	}
}

func (r *Registry) Open(req OpenRequest) (domain.Session, error) {
	id := uuid.NewString()
	now := time.Now().UTC()
	model := domain.Session{
		ID:           id,
		ConnectionID: req.Connection.ID,
		Name:         req.Connection.Name,
		Status:       domain.SessionConnecting,
		CreatedAt:    now,
		LastActiveAt: now,
	}
	r.emit(domain.EventSessionStatus, domain.SessionStatusEvent{SessionID: id, Status: domain.SessionConnecting, Message: "connecting"})

	term, err := r.runner.Connect(sshclient.ConnectRequest{
		Host:     req.Connection.Host,
		Port:     req.Connection.Port,
		Username: req.Connection.Username,
		AuthType: req.Connection.AuthType,
		Password: req.Password,
		KeyPath:  req.Connection.KeyPath,
	})
	if err != nil {
		r.emit(domain.EventSessionError, domain.SessionErrorEvent{SessionID: id, Message: err.Error()})
		r.emit(domain.EventSessionStatus, domain.SessionStatusEvent{SessionID: id, Status: domain.SessionError, Message: err.Error()})
		return domain.Session{}, err
	}

	model.Status = domain.SessionConnected
	ent := &entry{model: model, term: term, created: now}
	r.mu.Lock()
	r.sessions[id] = ent
	r.mu.Unlock()

	if err := term.Start(req.Size, func(data []byte) {
		r.emit(domain.EventSessionOutput, domain.SessionOutputEvent{SessionID: id, Data: string(data)})
	}, func(err error) {
		r.onExit(id, err)
	}); err != nil {
		_ = term.Close()
		r.mu.Lock()
		delete(r.sessions, id)
		r.mu.Unlock()
		r.emit(domain.EventSessionError, domain.SessionErrorEvent{SessionID: id, Message: err.Error()})
		r.emit(domain.EventSessionStatus, domain.SessionStatusEvent{SessionID: id, Status: domain.SessionError, Message: err.Error()})
		return domain.Session{}, err
	}

	r.emit(domain.EventSessionCreated, model)
	r.emit(domain.EventSessionStatus, domain.SessionStatusEvent{SessionID: id, Status: domain.SessionConnected, Message: "connected"})
	return model, nil
}

func (r *Registry) Write(sessionID string, data string) error {
	ent, err := r.get(sessionID)
	if err != nil {
		return err
	}
	ent.model.LastActiveAt = time.Now().UTC()
	return ent.term.Write(data)
}

func (r *Registry) Resize(sessionID string, size domain.TerminalSize) error {
	ent, err := r.get(sessionID)
	if err != nil {
		return err
	}
	return ent.term.Resize(size)
}

func (r *Registry) Close(sessionID string) error {
	ent, err := r.remove(sessionID)
	if err != nil {
		return err
	}
	err = ent.term.Close()
	r.emit(domain.EventSessionStatus, domain.SessionStatusEvent{SessionID: sessionID, Status: domain.SessionClosed, Message: "closed"})
	r.emit(domain.EventSessionClosed, map[string]string{"sessionId": sessionID})
	return err
}

func (r *Registry) CloseAll() {
	r.mu.Lock()
	ids := make([]string, 0, len(r.sessions))
	for id := range r.sessions {
		ids = append(ids, id)
	}
	r.mu.Unlock()
	for _, id := range ids {
		_ = r.Close(id)
	}
}

func (r *Registry) onExit(sessionID string, exitErr error) {
	_, _ = r.remove(sessionID)
	status := domain.SessionDisconnected
	message := "disconnected"
	if exitErr != nil {
		message = exitErr.Error()
	}
	r.emit(domain.EventSessionStatus, domain.SessionStatusEvent{SessionID: sessionID, Status: status, Message: message})
	r.emit(domain.EventSessionClosed, map[string]string{"sessionId": sessionID})
}

func (r *Registry) get(sessionID string) (*entry, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ent := r.sessions[sessionID]
	if ent == nil {
		return nil, errors.New("session not found")
	}
	return ent, nil
}

func (r *Registry) remove(sessionID string) (*entry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ent := r.sessions[sessionID]
	if ent == nil {
		return nil, errors.New("session not found")
	}
	delete(r.sessions, sessionID)
	return ent, nil
}

func (r *Registry) emit(name string, data any) {
	if r.emitter != nil {
		r.emitter.Emit(name, data)
	}
}
```

- [ ] **Step 4: Run registry tests**

Run: `go test ./internal/sessions`

Expected: PASS.

- [ ] **Step 5: Commit registry**

```bash
git add internal/sessions/registry.go internal/sessions/registry_test.go
git commit -m "Manage SSH terminal sessions"
```

## Task 6: Add App Services And Wails Event Emitter

**Files:**

- Create: `internal/appsvc/services.go`

- [ ] **Step 1: Write `internal/appsvc/services.go`**

```go
package appsvc

import (
	"context"
	"errors"
	"strings"

	"TermFlow/internal/domain"
	"TermFlow/internal/sessions"
	"TermFlow/internal/sshclient"
	"TermFlow/internal/storage"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type Service struct {
	store    *storage.Store
	registry *sessions.Registry
}

func NewService(store *storage.Store, registry *sessions.Registry) *Service {
	return &Service{store: store, registry: registry}
}

func (s *Service) ListConnections() ([]domain.Connection, error) {
	return s.store.ListConnections()
}

func (s *Service) SaveConnection(input domain.SaveConnectionInput) (domain.Connection, error) {
	return s.store.SaveConnection(input)
}

func (s *Service) DeleteConnection(id string) error {
	return s.store.DeleteConnection(id)
}

func (s *Service) TestConnection(input domain.TestConnectionInput) error {
	req, err := s.connectRequest(input)
	if err != nil {
		return err
	}
	return sshclient.RealRunner{}.Test(req)
}

func (s *Service) OpenSession(input domain.OpenSessionInput) (domain.Session, error) {
	conn, err := s.store.GetConnection(strings.TrimSpace(input.ConnectionID))
	if err != nil {
		return domain.Session{}, err
	}
	return s.registry.Open(sessions.OpenRequest{
		Connection: conn,
		Password:   input.Password,
		Size:       input.Size,
	})
}

func (s *Service) CloseSession(sessionID string) error {
	return s.registry.Close(sessionID)
}

func (s *Service) WriteTerminal(sessionID string, data string) error {
	return s.registry.Write(sessionID, data)
}

func (s *Service) ResizeTerminal(sessionID string, size domain.TerminalSize) error {
	return s.registry.Resize(sessionID, size)
}

func (s *Service) connectRequest(input domain.TestConnectionInput) (sshclient.ConnectRequest, error) {
	if strings.TrimSpace(input.ConnectionID) != "" {
		conn, err := s.store.GetConnection(input.ConnectionID)
		if err != nil {
			return sshclient.ConnectRequest{}, err
		}
		return sshclient.ConnectRequest{
			Host:     conn.Host,
			Port:     conn.Port,
			Username: conn.Username,
			AuthType: conn.AuthType,
			Password: input.Password,
			KeyPath:  conn.KeyPath,
		}, nil
	}
	if strings.TrimSpace(input.Host) == "" {
		return sshclient.ConnectRequest{}, errors.New("host is required")
	}
	return sshclient.ConnectRequest{
		Host:     input.Host,
		Port:     input.Port,
		Username: input.Username,
		AuthType: input.AuthType,
		Password: input.Password,
		KeyPath:  input.KeyPath,
	}, nil
}

type WailsEmitter struct {
	ctx context.Context
}

func NewWailsEmitter(ctx context.Context) *WailsEmitter {
	return &WailsEmitter{ctx: ctx}
}

func (e *WailsEmitter) Emit(name string, data any) {
	if e == nil || e.ctx == nil {
		return
	}
	wailsruntime.EventsEmit(e.ctx, name, data)
}
```

- [ ] **Step 2: Run backend tests**

Run: `go test ./internal/...`

Expected: PASS.

- [ ] **Step 3: Run full Go tests**

Run: `go test ./...`

Expected: PASS.

- [ ] **Step 4: Commit app service**

```bash
git add internal/appsvc/services.go app.go
git commit -m "Expose SSH terminal services to Wails"
```

## Task 7: Replace Frontend With React/Vite/xterm Shell

**Files:**

- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/app/App.tsx`
- Create: `frontend/src/app/styles.css`

- [ ] **Step 1: Write `frontend/package.json`**

```json
{
  "name": "termflow-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "@xterm/addon-fit": "^0.11.0",
    "@xterm/xterm": "^6.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "typescript": "^5.7.3",
    "vite": "^6.0.7"
  }
}
```

- [ ] **Step 2: Write Vite and TS config files**

Create `frontend/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TermFlow</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `frontend/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

Create `frontend/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
  },
});
```

- [ ] **Step 3: Write initial React entry and app shell**

Create `frontend/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@xterm/xterm/css/xterm.css';
import './app/styles.css';
import { App } from './app/App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Create `frontend/src/app/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ConnectionSidebar } from '../features/connections/ConnectionSidebar';
import { ConnectionModal } from '../features/connections/ConnectionModal';
import { SessionTabs } from '../features/sessions/SessionTabs';
import { TerminalPane } from '../features/terminal/TerminalPane';
import { StatusBar } from '../features/status/StatusBar';
import { listConnections, openSession, saveConnection } from '../shared/api/wails';
import type { Connection, Session } from '../features/connections/types';

export function App() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState('Ready');

  useEffect(() => {
    listConnections()
      .then(setConnections)
      .catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
  }, []);

  async function handleSaveConnection(input: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>) {
    const saved = await saveConnection(input);
    setConnections((current) => {
      const exists = current.some((item) => item.id === saved.id);
      return exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved];
    });
    setModalOpen(false);
  }

  async function handleOpen(connection: Connection, password: string) {
    setStatus(`Connecting to ${connection.name}`);
    const session = await openSession({ connectionId: connection.id, password, size: { cols: 120, rows: 32 } });
    setSessions((current) => [...current, session]);
    setActiveSessionId(session.id);
    setStatus(`Connected to ${connection.name}`);
  }

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;

  return (
    <div className="tf-app">
      <header className="tf-titlebar">
        <div className="tf-window-controls"><span /><span /><span /></div>
        <strong>TermFlow</strong>
        <div className="tf-titlebar-spacer" />
        <span className="tf-kbd">⌘K</span>
      </header>
      <div className="tf-body">
        <nav className="tf-rail">
          <button className="active" title="Terminal">⌁</button>
          <button title="Files">▣</button>
          <button title="Monitor">⌬</button>
          <button title="Settings">⚙</button>
        </nav>
        <ConnectionSidebar
          connections={connections}
          onCreate={() => setModalOpen(true)}
          onOpen={handleOpen}
        />
        <main className="tf-main">
          <SessionTabs
            sessions={sessions}
            activeSessionId={activeSessionId}
            onActivate={setActiveSessionId}
          />
          <TerminalPane session={activeSession} />
        </main>
      </div>
      <StatusBar status={status} sessions={sessions} />
      {modalOpen && (
        <ConnectionModal
          onCancel={() => setModalOpen(false)}
          onSave={handleSaveConnection}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write first CSS pass**

Create `frontend/src/app/styles.css`:

```css
:root {
  --crust: #181926;
  --mantle: #1e2030;
  --base: #24273a;
  --surface0: #363a4f;
  --surface1: #494d64;
  --overlay0: #6e738d;
  --overlay1: #8087a2;
  --subtext0: #a5adcb;
  --subtext1: #b8c0e0;
  --text: #cad3f5;
  --blue: #8aadf4;
  --green: #a6da95;
  --red: #ed8796;
  --yellow: #eed49f;
  --accent: var(--blue);
  --font-ui: Inter, "Plus Jakarta Sans", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Cascadia Code", monospace;
}

* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  background: var(--crust);
  color: var(--text);
  font-family: var(--font-ui);
  overflow: hidden;
}
button, input, select {
  font: inherit;
}

.tf-app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--crust);
}
.tf-titlebar {
  height: 36px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  border-bottom: 1px solid var(--surface0);
  background: var(--crust);
}
.tf-window-controls {
  display: flex;
  gap: 6px;
}
.tf-window-controls span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.tf-window-controls span:nth-child(1) { background: var(--red); }
.tf-window-controls span:nth-child(2) { background: var(--yellow); }
.tf-window-controls span:nth-child(3) { background: var(--green); }
.tf-titlebar-spacer { flex: 1; }
.tf-kbd {
  border: 1px solid var(--surface0);
  border-radius: 4px;
  padding: 2px 6px;
  color: var(--overlay1);
  font-family: var(--font-mono);
  font-size: 11px;
}
.tf-body {
  min-height: 0;
  flex: 1;
  display: flex;
}
.tf-rail {
  width: 48px;
  border-right: 1px solid var(--surface0);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
}
.tf-rail button {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--overlay1);
  cursor: pointer;
}
.tf-rail button.active {
  color: var(--accent);
  background: rgba(138, 173, 244, 0.15);
}
.tf-sidebar {
  width: 248px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--surface0);
  background: var(--mantle);
}
.tf-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.tf-statusbar {
  height: 24px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 12px;
  background: var(--accent);
  color: #11131b;
  font-size: 12px;
}
.tf-statusbar .right {
  margin-left: auto;
}
```

- [ ] **Step 5: Run frontend install**

Run: `npm install --prefix frontend`

Expected: installs dependencies and creates `frontend/package-lock.json`.

- [ ] **Step 6: Run frontend build to surface missing feature components**

Run: `npm run build --prefix frontend`

Expected: FAIL because feature component files are not created yet.

- [ ] **Step 7: Commit frontend shell files**

```bash
git add frontend/package.json frontend/package-lock.json frontend/index.html frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts frontend/src/main.tsx frontend/src/app/App.tsx frontend/src/app/styles.css
git commit -m "Create React TermFlow shell"
```

## Task 8: Add Frontend API Types And Connection UI

**Files:**

- Create: `frontend/src/shared/api/wails.ts`
- Create: `frontend/src/features/connections/types.ts`
- Create: `frontend/src/features/connections/ConnectionSidebar.tsx`
- Create: `frontend/src/features/connections/ConnectionModal.tsx`
- Create: `frontend/src/features/sessions/SessionTabs.tsx`
- Create: `frontend/src/features/status/StatusBar.tsx`

- [ ] **Step 1: Write frontend types**

Create `frontend/src/features/connections/types.ts`:

```ts
export type AuthType = 'password' | 'key' | 'agent';

export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  keyPath: string;
  group: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface Session {
  id: string;
  connectionId: string;
  name: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'closed';
  createdAt: string;
  lastActiveAt: string;
}

export interface OpenSessionInput {
  connectionId: string;
  password: string;
  size: TerminalSize;
}
```

- [ ] **Step 2: Write Wails API wrapper**

Create `frontend/src/shared/api/wails.ts`:

```ts
import type { Connection, OpenSessionInput, Session, TerminalSize } from '../../features/connections/types';

type SaveConnectionInput = Omit<Connection, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          ListConnections(): Promise<Connection[]>;
          SaveConnection(input: SaveConnectionInput): Promise<Connection>;
          DeleteConnection(id: string): Promise<void>;
          TestConnection(input: unknown): Promise<void>;
          OpenSession(input: OpenSessionInput): Promise<Session>;
          CloseSession(sessionId: string): Promise<void>;
          WriteTerminal(sessionId: string, data: string): Promise<void>;
          ResizeTerminal(sessionId: string, size: TerminalSize): Promise<void>;
        };
      };
    };
    runtime?: {
      EventsOn(name: string, callback: (data: unknown) => void): () => void;
    };
  }
}

function appApi() {
  const api = window.go?.main?.App;
  if (!api) {
    throw new Error('Wails backend is not available');
  }
  return api;
}

export function listConnections() {
  return appApi().ListConnections();
}

export function saveConnection(input: SaveConnectionInput) {
  return appApi().SaveConnection(input);
}

export function openSession(input: OpenSessionInput) {
  return appApi().OpenSession(input);
}

export function writeTerminal(sessionId: string, data: string) {
  return appApi().WriteTerminal(sessionId, data);
}

export function resizeTerminal(sessionId: string, size: TerminalSize) {
  return appApi().ResizeTerminal(sessionId, size);
}

export function onWailsEvent<T>(name: string, callback: (data: T) => void) {
  if (!window.runtime?.EventsOn) {
    return () => {};
  }
  return window.runtime.EventsOn(name, (data: unknown) => callback(data as T));
}
```

- [ ] **Step 3: Write connection sidebar**

Create `frontend/src/features/connections/ConnectionSidebar.tsx`:

```tsx
import { useState } from 'react';
import type { Connection } from './types';

interface Props {
  connections: Connection[];
  onCreate(): void;
  onOpen(connection: Connection, password: string): void;
}

export function ConnectionSidebar({ connections, onCreate, onOpen }: Props) {
  const [passwordById, setPasswordById] = useState<Record<string, string>>({});

  return (
    <aside className="tf-sidebar">
      <div className="tf-sidebar-header">
        <span>Connections</span>
        <button onClick={onCreate}>+</button>
      </div>
      <div className="tf-connection-list">
        {connections.length === 0 && (
          <div className="tf-empty">
            <strong>No connections</strong>
            <span>Create an SSH connection to start a terminal session.</span>
          </div>
        )}
        {connections.map((connection) => (
          <div className="tf-connection" key={connection.id}>
            <div className="tf-connection-main">
              <span className="dot" />
              <strong>{connection.name}</strong>
              <small>{connection.username}@{connection.host}:{connection.port}</small>
            </div>
            {connection.authType === 'password' && (
              <input
                type="password"
                value={passwordById[connection.id] ?? ''}
                onChange={(event) => setPasswordById((current) => ({ ...current, [connection.id]: event.target.value }))}
              />
            )}
            <button onClick={() => onOpen(connection, passwordById[connection.id] ?? '')}>Open</button>
          </div>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Write connection modal**

Create `frontend/src/features/connections/ConnectionModal.tsx`:

```tsx
import { FormEvent, useState } from 'react';
import type { AuthType, Connection } from './types';

interface Props {
  onCancel(): void;
  onSave(input: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>): Promise<void>;
}

export function ConnectionModal({ onCancel, onSave }: Props) {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [authType, setAuthType] = useState<AuthType>('password');
  const [keyPath, setKeyPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        name,
        host,
        port,
        username,
        authType,
        keyPath,
        group: 'SSH Servers',
        tags: [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tf-modal-backdrop">
      <form className="tf-modal" onSubmit={submit}>
        <header>
          <strong>New SSH Connection</strong>
          <button type="button" onClick={onCancel}>×</button>
        </header>
        {error && <div className="tf-error">{error}</div>}
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Host<input value={host} onChange={(e) => setHost(e.target.value)} required /></label>
        <label>Port<input type="number" min={1} max={65535} value={port} onChange={(e) => setPort(Number(e.target.value))} required /></label>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
        <label>Auth
          <select value={authType} onChange={(e) => setAuthType(e.target.value as AuthType)}>
            <option value="password">Password</option>
            <option value="key">Private key</option>
          </select>
        </label>
        {authType === 'key' && (
          <label>Private key path<input value={keyPath} onChange={(e) => setKeyPath(e.target.value)} /></label>
        )}
        <footer>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" disabled={saving}>{saving ? 'Saving' : 'Save'}</button>
        </footer>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Write session tabs and status bar**

Create `frontend/src/features/sessions/SessionTabs.tsx`:

```tsx
import type { Session } from '../connections/types';

interface Props {
  sessions: Session[];
  activeSessionId: string | null;
  onActivate(sessionId: string): void;
}

export function SessionTabs({ sessions, activeSessionId, onActivate }: Props) {
  return (
    <div className="tf-tabs">
      {sessions.length === 0 && <span className="tf-tab muted">No active session</span>}
      {sessions.map((session) => (
        <button
          key={session.id}
          className={`tf-tab ${session.id === activeSessionId ? 'active' : ''}`}
          onClick={() => onActivate(session.id)}
        >
          <span className={`status ${session.status}`} />
          {session.name}
        </button>
      ))}
    </div>
  );
}
```

Create `frontend/src/features/status/StatusBar.tsx`:

```tsx
import type { Session } from '../connections/types';

interface Props {
  status: string;
  sessions: Session[];
}

export function StatusBar({ status, sessions }: Props) {
  const connected = sessions.filter((session) => session.status === 'connected').length;
  return (
    <footer className="tf-statusbar">
      <span>TermFlow v0.1.0</span>
      <span>{status}</span>
      <span className="right">{connected} sessions</span>
      <span>Encrypted</span>
    </footer>
  );
}
```

- [ ] **Step 6: Add CSS for new UI components**

Append to `frontend/src/app/styles.css`:

```css
.tf-sidebar-header {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--surface0);
  color: var(--overlay1);
  text-transform: uppercase;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.tf-sidebar-header button,
.tf-connection button,
.tf-modal button {
  border: 1px solid var(--surface1);
  border-radius: 5px;
  background: var(--surface0);
  color: var(--text);
  cursor: pointer;
}
.tf-connection-list {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 8px;
}
.tf-empty {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 8px;
  color: var(--overlay1);
  font-size: 12px;
}
.tf-connection {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  color: var(--subtext1);
}
.tf-connection:hover {
  background: var(--surface0);
}
.tf-connection-main {
  display: grid;
  grid-template-columns: 8px 1fr;
  gap: 4px 8px;
  align-items: center;
}
.tf-connection-main .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
}
.tf-connection-main small {
  grid-column: 2;
  color: var(--overlay1);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
}
.tf-connection input,
.tf-modal input,
.tf-modal select {
  width: 100%;
  min-height: 32px;
  border: 1px solid var(--surface0);
  border-radius: 5px;
  background: var(--base);
  color: var(--text);
  padding: 0 8px;
}
.tf-tabs {
  height: 38px;
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--surface0);
  background: var(--mantle);
}
.tf-tab {
  min-width: 150px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-right: 1px solid var(--surface0);
  background: transparent;
  color: var(--overlay1);
  padding: 0 12px;
}
.tf-tab.active {
  background: var(--base);
  color: var(--text);
}
.tf-tab.muted {
  min-width: 0;
  padding: 0 14px;
}
.tf-tab .status {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--overlay0);
}
.tf-tab .status.connected { background: var(--green); }
.tf-tab .status.error { background: var(--red); }
.tf-modal-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
  background: rgba(8, 10, 15, 0.56);
}
.tf-modal {
  width: 440px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--surface1);
  border-radius: 10px;
  background: var(--mantle);
  padding: 16px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
}
.tf-modal header,
.tf-modal footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.tf-modal label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: var(--overlay1);
  font-size: 12px;
}
.tf-error {
  border: 1px solid rgba(237, 135, 150, 0.35);
  border-radius: 6px;
  color: var(--red);
  background: rgba(237, 135, 150, 0.12);
  padding: 8px;
}
```

- [ ] **Step 7: Run frontend build**

Run: `npm run build --prefix frontend`

Expected: FAIL because `TerminalPane.tsx` is not created yet.

- [ ] **Step 8: Commit connection UI**

```bash
git add frontend/src/shared/api/wails.ts frontend/src/features/connections/types.ts frontend/src/features/connections/ConnectionSidebar.tsx frontend/src/features/connections/ConnectionModal.tsx frontend/src/features/sessions/SessionTabs.tsx frontend/src/features/status/StatusBar.tsx frontend/src/app/styles.css
git commit -m "Add TermFlow connection workspace UI"
```

## Task 9: Add xterm Terminal Pane And Event Bridge

**Files:**

- Create: `frontend/src/features/terminal/TerminalPane.tsx`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/app/styles.css`

- [ ] **Step 1: Write `TerminalPane.tsx`**

Create `frontend/src/features/terminal/TerminalPane.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { Session } from '../connections/types';
import { onWailsEvent, resizeTerminal, writeTerminal } from '../../shared/api/wails';

interface SessionOutputEvent {
  sessionId: string;
  data: string;
}

interface SessionStatusEvent {
  sessionId: string;
  status: Session['status'];
  message: string;
}

interface Props {
  session: Session | null;
}

export function TerminalPane({ session }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"JetBrains Mono", "Cascadia Code", monospace',
      fontSize: 13,
      theme: {
        background: '#0b0d14',
        foreground: '#cad3f5',
        cursor: '#8aadf4',
        black: '#181926',
        red: '#ed8796',
        green: '#a6da95',
        yellow: '#eed49f',
        blue: '#8aadf4',
        magenta: '#c6a0f6',
        cyan: '#8bd5ca',
        white: '#cad3f5',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    const dataDisposable = term.onData((data) => {
      if (session) {
        void writeTerminal(session.id, data);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      if (session) {
        void resizeTerminal(session.id, { cols: term.cols, rows: term.rows });
      }
    });
    resizeObserver.observe(hostRef.current);

    return () => {
      dataDisposable.dispose();
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [session?.id]);

  useEffect(() => {
    const offOutput = onWailsEvent<SessionOutputEvent>('session:output', (event) => {
      if (event.sessionId === session?.id) {
        termRef.current?.write(event.data);
      }
    });
    const offStatus = onWailsEvent<SessionStatusEvent>('session:status', (event) => {
      if (event.sessionId === session?.id && event.message) {
        termRef.current?.writeln(`\r\n\x1b[90m[${event.status}] ${event.message}\x1b[0m`);
      }
    });
    return () => {
      offOutput();
      offStatus();
    };
  }, [session?.id]);

  if (!session) {
    return (
      <section className="tf-terminal-empty">
        <strong>No active SSH session</strong>
        <span>Create or open a connection from the left sidebar.</span>
      </section>
    );
  }

  return (
    <section className="tf-terminal-wrap">
      <div className="tf-terminal-toolbar">
        <span className="live-dot" />
        <span>{session.name}</span>
        <span className="session-state">{session.status}</span>
      </div>
      <div className="tf-terminal-host" ref={hostRef} />
    </section>
  );
}
```

- [ ] **Step 2: Append terminal styles**

Append to `frontend/src/app/styles.css`:

```css
.tf-terminal-wrap {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #0b0d14;
}
.tf-terminal-toolbar {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-bottom: 1px solid #1a1c24;
  color: var(--subtext0);
  font-family: var(--font-mono);
  font-size: 12px;
}
.tf-terminal-toolbar .live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 5px var(--green);
}
.session-state {
  margin-left: auto;
  color: var(--overlay1);
}
.tf-terminal-host {
  min-height: 0;
  flex: 1;
  padding: 10px 12px;
}
.tf-terminal-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--overlay1);
  background: #0b0d14;
}
.xterm {
  height: 100%;
}
.xterm-viewport {
  overflow-y: auto;
}
```

- [ ] **Step 3: Run frontend build**

Run: `npm run build --prefix frontend`

Expected: PASS.

- [ ] **Step 4: Run full Go tests**

Run: `go test ./...`

Expected: PASS.

- [ ] **Step 5: Run Wails build smoke**

Run: `wails build`

Expected: PASS and produces a TermFlow app binary under `build/bin` or the Wails v2 default output path.

- [ ] **Step 6: Commit terminal frontend**

```bash
git add frontend/src/features/terminal/TerminalPane.tsx frontend/src/app/styles.css
git commit -m "Render real SSH sessions with xterm"
```

## Task 10: Add Browser QA Probe

**Files:**

- Create: `artifacts/browser-qa/termflow-mvp/probe.mjs`

- [ ] **Step 1: Write Playwright probe**

Create `artifacts/browser-qa/termflow-mvp/probe.mjs`:

```js
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
const outDir = path.resolve('artifacts/browser-qa/termflow-mvp');
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});

const failedRequests = [];
page.on('requestfailed', (request) => {
  failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
});

await page.goto(baseURL, { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(outDir, 'desktop-shell.png'), fullPage: true });

await page.getByText('No connections').waitFor({ timeout: 5000 });
await page.getByRole('button', { name: '+' }).click();
await page.getByText('New SSH Connection').waitFor({ timeout: 5000 });
await page.screenshot({ path: path.join(outDir, 'connection-modal.png'), fullPage: true });

await page.getByLabel('Name').fill('local-test');
await page.getByLabel('Host').fill('127.0.0.1');
await page.getByLabel('Port').fill('22');
await page.getByLabel('Username').fill('tester');
await page.screenshot({ path: path.join(outDir, 'connection-form-filled.png'), fullPage: true });

await browser.close();

if (consoleErrors.length || failedRequests.length) {
  console.error(JSON.stringify({ consoleErrors, failedRequests }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  screenshots: [
    'artifacts/browser-qa/termflow-mvp/desktop-shell.png',
    'artifacts/browser-qa/termflow-mvp/connection-modal.png',
    'artifacts/browser-qa/termflow-mvp/connection-form-filled.png'
  ]
}, null, 2));
```

- [ ] **Step 2: Start frontend dev server**

Run: `npm run dev --prefix frontend`

Expected: Vite dev server prints a local URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 3: Run browser QA**

Run in a second shell: `QA_BASE_URL=http://127.0.0.1:5173 node artifacts/browser-qa/termflow-mvp/probe.mjs`

Expected: PASS with JSON `{ "ok": true, ... }` and screenshots written under `artifacts/browser-qa/termflow-mvp/`.

- [ ] **Step 4: Commit QA probe**

```bash
git add artifacts/browser-qa/termflow-mvp/probe.mjs
git commit -m "Add TermFlow MVP browser QA probe"
```

## Task 11: Final Verification

**Files:**

- Read: `git status --short`
- Read: `docs/superpowers/specs/2026-06-11-termflow-desktop-mvp-design.md`

- [ ] **Step 1: Run Go tests**

Run: `go test ./...`

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run: `npm run build --prefix frontend`

Expected: PASS.

- [ ] **Step 3: Run Wails build**

Run: `wails build`

Expected: PASS.

- [ ] **Step 4: Run browser QA probe**

Run with frontend dev server active: `QA_BASE_URL=http://127.0.0.1:5173 node artifacts/browser-qa/termflow-mvp/probe.mjs`

Expected: PASS.

- [ ] **Step 5: Manual SSH acceptance**

Use a reachable SSH host:

1. Create a connection with host, port, username, and password or private key path.
2. Open the connection.
3. Confirm terminal output appears in xterm.js.
4. Run `pwd`, `ls`, and `exit`.
5. Confirm session status changes after exit.

Expected: command input/output works and session closes without leaving the UI stuck in connected state.

- [ ] **Step 6: Check worktree before final report**

Run: `git status --short`

Expected: only intentional files remain modified or untracked. Do not stage unrelated existing deletions unless the implementation intentionally replaced those paths.

## Risks And Decisions

- Wails v2 is kept for first delivery because the repo already has Wails v2 config. A Wails v3 migration can be planned after the SSH terminal loop is stable.
- `ssh.InsecureIgnoreHostKey` is acceptable only for MVP connection testing. Add known-host verification before broader release.
- Passwords are accepted at connection/session time and are not persisted.
- The old Vue app modules are not restored unless needed for the MVP. This avoids reintroducing SFTP/monitor/command-library scope before the terminal path is stable.
