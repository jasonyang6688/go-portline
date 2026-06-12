package sessions

import (
	"errors"
	"sync"
	"testing"
	"time"

	"termflow/internal/domain"
	"termflow/internal/sshclient"
)

type emitted struct {
	name string
	data any
}

type fakeEmitter struct {
	mu     sync.Mutex
	events []emitted
}

func (e *fakeEmitter) Emit(name string, data any) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.events = append(e.events, emitted{name: name, data: data})
}

func (e *fakeEmitter) snapshot() []emitted {
	e.mu.Lock()
	defer e.mu.Unlock()

	out := make([]emitted, len(e.events))
	copy(out, e.events)
	return out
}

type fakeRunner struct {
	mu      sync.Mutex
	session sshclient.TerminalSession
	err     error
	reqs    []sshclient.ConnectRequest
}

func (r *fakeRunner) Connect(req sshclient.ConnectRequest) (sshclient.TerminalSession, error) {
	r.mu.Lock()
	r.reqs = append(r.reqs, req)
	r.mu.Unlock()

	if r.err != nil {
		return nil, r.err
	}
	return r.session, nil
}

func (r *fakeRunner) Test(sshclient.ConnectRequest) error {
	return r.err
}

func (r *fakeRunner) requests() []sshclient.ConnectRequest {
	r.mu.Lock()
	defer r.mu.Unlock()

	out := make([]sshclient.ConnectRequest, len(r.reqs))
	copy(out, r.reqs)
	return out
}

type fakeSession struct {
	startErr   error
	closeErr   error
	startSize  domain.TerminalSize
	started    bool
	writes     []string
	resizes    []domain.TerminalSize
	closed     bool
	startData  []byte
	onData     func([]byte)
	onExit     func(error)
	closeCalls int
}

func (s *fakeSession) Start(size domain.TerminalSize, onData func([]byte), onExit func(error)) error {
	s.started = true
	s.startSize = size
	s.onData = onData
	s.onExit = onExit
	if s.startErr != nil {
		return s.startErr
	}
	if len(s.startData) > 0 && onData != nil {
		onData(s.startData)
	}
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
	s.closeCalls++
	return s.closeErr
}

func (s *fakeSession) emitExit(err error) {
	if s.onExit != nil {
		s.onExit(err)
	}
}

func (s *fakeSession) emitData(data []byte) {
	if s.onData != nil {
		s.onData(data)
	}
}

func TestOpenWriteResizeCloseHappyPath(t *testing.T) {
	emitter := &fakeEmitter{}
	term := &fakeSession{startData: []byte("hello\r\n")}
	runner := &fakeRunner{session: term}
	reg := NewRegistry(runner, emitter)

	req := OpenRequest{
		Connection: domain.Connection{
			ID:       "c1",
			Name:     "prod",
			Host:     "127.0.0.1",
			Port:     22,
			Username: "root",
			AuthType: domain.AuthPassword,
			KeyPath:  "/keys/prod",
		},
		Password: "secret",
		Size:     domain.TerminalSize{Cols: 100, Rows: 30},
	}

	session, err := reg.Open(req)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}

	if session.ID == "" {
		t.Fatal("Open() session ID is empty")
	}
	if session.ConnectionID != req.Connection.ID {
		t.Fatalf("session.ConnectionID = %q, want %q", session.ConnectionID, req.Connection.ID)
	}
	if session.Name != req.Connection.Name {
		t.Fatalf("session.Name = %q, want %q", session.Name, req.Connection.Name)
	}
	if session.Status != domain.SessionConnected {
		t.Fatalf("session.Status = %q, want %q", session.Status, domain.SessionConnected)
	}
	if session.CreatedAt.IsZero() || session.LastActiveAt.IsZero() {
		t.Fatalf("session timestamps not set: %#v", session)
	}

	connectReqs := runner.requests()
	if len(connectReqs) != 1 {
		t.Fatalf("Connect requests = %d, want 1", len(connectReqs))
	}
	connectReq := connectReqs[0]
	if connectReq.Host != req.Connection.Host ||
		connectReq.Port != req.Connection.Port ||
		connectReq.Username != req.Connection.Username ||
		connectReq.AuthType != req.Connection.AuthType ||
		connectReq.Password != req.Password ||
		connectReq.KeyPath != req.Connection.KeyPath {
		t.Fatalf("Connect request = %#v, want forwarded OpenRequest fields", connectReq)
	}

	ent, err := reg.get(session.ID)
	if err != nil {
		t.Fatalf("get() after open error = %v", err)
	}
	ent.mu.Lock()
	ent.model.LastActiveAt = ent.model.LastActiveAt.Add(-time.Second)
	beforeWrite := ent.model.LastActiveAt
	ent.mu.Unlock()

	if err := reg.Write(session.ID, "ls\r"); err != nil {
		t.Fatalf("Write() error = %v", err)
	}
	term.emitData([]byte("prompt> "))
	if err := reg.Resize(session.ID, domain.TerminalSize{Cols: 80, Rows: 24}); err != nil {
		t.Fatalf("Resize() error = %v", err)
	}
	if err := reg.Close(session.ID); err != nil {
		t.Fatalf("Close() error = %v", err)
	}

	if !term.started {
		t.Fatal("Start() was not called")
	}
	if term.startSize != req.Size {
		t.Fatalf("Start size = %#v, want %#v", term.startSize, req.Size)
	}
	if len(term.writes) != 1 || term.writes[0] != "ls\r" {
		t.Fatalf("writes = %#v, want [\"ls\\\\r\"]", term.writes)
	}
	if len(term.resizes) != 1 || term.resizes[0] != (domain.TerminalSize{Cols: 80, Rows: 24}) {
		t.Fatalf("resizes = %#v, want 80x24", term.resizes)
	}
	if !term.closed {
		t.Fatal("terminal session was not closed")
	}
	if term.closeCalls != 1 {
		t.Fatalf("Close calls = %d, want 1", term.closeCalls)
	}
	ent.mu.Lock()
	afterWrite := ent.model.LastActiveAt
	ent.mu.Unlock()
	if !afterWrite.After(beforeWrite) {
		t.Fatalf("LastActiveAt = %v, want later than %v", afterWrite, beforeWrite)
	}

	events := emitter.snapshot()
	if len(events) != 6 {
		t.Fatalf("events = %#v, want 6 lifecycle events", events)
	}

	created, ok := events[0].data.(domain.Session)
	if events[0].name != domain.EventSessionCreated || !ok || created.ID != session.ID || created.Status != domain.SessionConnected {
		t.Fatalf("event[0] = %#v, want created session", events[0])
	}

	statusConnected, ok := events[1].data.(domain.SessionStatusEvent)
	if events[1].name != domain.EventSessionStatus || !ok || statusConnected.Status != domain.SessionConnected {
		t.Fatalf("event[1] = %#v, want connected status", events[1])
	}

	output, ok := events[2].data.(domain.SessionOutputEvent)
	if events[2].name != domain.EventSessionOutput || !ok || output.Data != "hello\r\n" || output.SessionID != session.ID {
		t.Fatalf("event[2] = %#v, want buffered output event", events[2])
	}

	output, ok = events[3].data.(domain.SessionOutputEvent)
	if events[3].name != domain.EventSessionOutput || !ok || output.Data != "prompt> " || output.SessionID != session.ID {
		t.Fatalf("event[3] = %#v, want live output event", events[3])
	}

	statusClosed, ok := events[4].data.(domain.SessionStatusEvent)
	if events[4].name != domain.EventSessionStatus || !ok || statusClosed.Status != domain.SessionClosed {
		t.Fatalf("event[4] = %#v, want closed status", events[4])
	}

	closed, ok := events[5].data.(map[string]string)
	if events[5].name != domain.EventSessionClosed || !ok || closed["sessionId"] != session.ID {
		t.Fatalf("event[5] = %#v, want closed event", events[5])
	}
}

func TestOpenConnectFailureDoesNotEmitOrphanSessionEvents(t *testing.T) {
	emitter := &fakeEmitter{}
	reg := NewRegistry(&fakeRunner{err: errors.New("dial failed")}, emitter)

	session, err := reg.Open(OpenRequest{
		Connection: domain.Connection{
			ID:       "c1",
			Name:     "prod",
			Host:     "127.0.0.1",
			Port:     22,
			Username: "root",
			AuthType: domain.AuthPassword,
		},
		Password: "secret",
	})
	if err == nil {
		t.Fatal("Open() error = nil, want dial failed")
	}
	if session != (domain.Session{}) {
		t.Fatalf("Open() session = %#v, want zero value", session)
	}

	events := emitter.snapshot()
	if len(events) != 0 {
		t.Fatalf("events = %#v, want no session-scoped events", events)
	}
}

func TestOpenStartFailureClosesAndRemovesSessionWithoutEmitting(t *testing.T) {
	emitter := &fakeEmitter{}
	term := &fakeSession{
		startErr:  errors.New("start failed"),
		startData: []byte("hello\r\n"),
	}
	reg := NewRegistry(&fakeRunner{session: term}, emitter)

	session, err := reg.Open(OpenRequest{
		Connection: domain.Connection{
			ID:       "c1",
			Name:     "prod",
			Host:     "127.0.0.1",
			Port:     22,
			Username: "root",
			AuthType: domain.AuthPassword,
		},
		Password: "secret",
		Size:     domain.TerminalSize{Cols: 120, Rows: 40},
	})
	if err == nil {
		t.Fatal("Open() error = nil, want start failed")
	}
	if session != (domain.Session{}) {
		t.Fatalf("Open() session = %#v, want zero value", session)
	}
	if !term.closed {
		t.Fatal("terminal session was not closed after Start failure")
	}
	if len(reg.sessions) != 0 {
		t.Fatalf("registry sessions = %d, want 0", len(reg.sessions))
	}

	events := emitter.snapshot()
	if len(events) != 0 {
		t.Fatalf("events = %#v, want no session-scoped events", events)
	}
}

func TestExitCallbackRemovesSessionAndEmitsDisconnected(t *testing.T) {
	emitter := &fakeEmitter{}
	term := &fakeSession{}
	reg := NewRegistry(&fakeRunner{session: term}, emitter)

	session, err := reg.Open(OpenRequest{
		Connection: domain.Connection{
			ID:       "c1",
			Name:     "prod",
			Host:     "127.0.0.1",
			Port:     22,
			Username: "root",
			AuthType: domain.AuthPassword,
		},
		Password: "secret",
		Size:     domain.TerminalSize{Cols: 90, Rows: 20},
	})
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}

	term.emitExit(nil)

	if _, err := reg.get(session.ID); !errors.Is(err, errSessionNotFound) {
		t.Fatalf("get() error = %v, want session not found", err)
	}
	if err := reg.Write(session.ID, "pwd\r"); !errors.Is(err, errSessionNotFound) {
		t.Fatalf("Write() error = %v, want session not found", err)
	}

	events := emitter.snapshot()
	if len(events) != 4 {
		t.Fatalf("events = %#v, want created + connected + disconnected + closed", events)
	}

	disconnected, ok := events[2].data.(domain.SessionStatusEvent)
	if events[2].name != domain.EventSessionStatus || !ok || disconnected.Status != domain.SessionDisconnected {
		t.Fatalf("event[2] = %#v, want disconnected status", events[2])
	}
	closed, ok := events[3].data.(map[string]string)
	if events[3].name != domain.EventSessionClosed || !ok || closed["sessionId"] != session.ID {
		t.Fatalf("event[3] = %#v, want closed event", events[3])
	}
}

func TestCloseThenExitCallbackDoesNotDoubleEmit(t *testing.T) {
	emitter := &fakeEmitter{}
	term := &fakeSession{}
	reg := NewRegistry(&fakeRunner{session: term}, emitter)

	session, err := reg.Open(OpenRequest{
		Connection: domain.Connection{
			ID:       "c1",
			Name:     "prod",
			Host:     "127.0.0.1",
			Port:     22,
			Username: "root",
			AuthType: domain.AuthPassword,
		},
		Password: "secret",
		Size:     domain.TerminalSize{Cols: 90, Rows: 20},
	})
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}

	if err := reg.Close(session.ID); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
	term.emitExit(nil)

	events := emitter.snapshot()
	if len(events) != 4 {
		t.Fatalf("events = %#v, want created + connected + closed status + closed", events)
	}
	if events[2].name != domain.EventSessionStatus {
		t.Fatalf("event[2].name = %q, want %q", events[2].name, domain.EventSessionStatus)
	}
	statusClosed, ok := events[2].data.(domain.SessionStatusEvent)
	if !ok || statusClosed.Status != domain.SessionClosed {
		t.Fatalf("event[2] = %#v, want closed status", events[2])
	}
	if events[3].name != domain.EventSessionClosed {
		t.Fatalf("event[3].name = %q, want %q", events[3].name, domain.EventSessionClosed)
	}
}

func TestCloseAllClosesEverySessionOnce(t *testing.T) {
	emitter := &fakeEmitter{}
	termA := &fakeSession{}
	termB := &fakeSession{}
	runner := &fakeRunner{session: termA}
	reg := NewRegistry(runner, emitter)

	sessionA, err := reg.Open(OpenRequest{
		Connection: domain.Connection{
			ID:       "c1",
			Name:     "prod-a",
			Host:     "127.0.0.1",
			Port:     22,
			Username: "root",
			AuthType: domain.AuthPassword,
		},
		Password: "secret",
		Size:     domain.TerminalSize{Cols: 90, Rows: 20},
	})
	if err != nil {
		t.Fatalf("Open() sessionA error = %v", err)
	}

	runner.session = termB
	sessionB, err := reg.Open(OpenRequest{
		Connection: domain.Connection{
			ID:       "c2",
			Name:     "prod-b",
			Host:     "127.0.0.2",
			Port:     22,
			Username: "admin",
			AuthType: domain.AuthPassword,
		},
		Password: "secret",
		Size:     domain.TerminalSize{Cols: 100, Rows: 24},
	})
	if err != nil {
		t.Fatalf("Open() sessionB error = %v", err)
	}

	reg.CloseAll()

	if !termA.closed || !termB.closed {
		t.Fatalf("closed flags = (%v, %v), want both true", termA.closed, termB.closed)
	}
	if termA.closeCalls != 1 || termB.closeCalls != 1 {
		t.Fatalf("close calls = (%d, %d), want both 1", termA.closeCalls, termB.closeCalls)
	}
	if _, err := reg.get(sessionA.ID); !errors.Is(err, errSessionNotFound) {
		t.Fatalf("get(sessionA) error = %v, want session not found", err)
	}
	if _, err := reg.get(sessionB.ID); !errors.Is(err, errSessionNotFound) {
		t.Fatalf("get(sessionB) error = %v, want session not found", err)
	}

	events := emitter.snapshot()
	if len(events) != 8 {
		t.Fatalf("events = %#v, want two created/connected pairs and two close pairs", events)
	}

	closedCounts := map[string]int{}
	closedStatusCounts := map[string]int{}
	for _, event := range events {
		switch event.name {
		case domain.EventSessionStatus:
			status, ok := event.data.(domain.SessionStatusEvent)
			if ok && status.Status == domain.SessionClosed {
				closedStatusCounts[status.SessionID]++
			}
		case domain.EventSessionClosed:
			closed, ok := event.data.(map[string]string)
			if ok {
				closedCounts[closed["sessionId"]]++
			}
		}
	}

	if closedStatusCounts[sessionA.ID] != 1 || closedStatusCounts[sessionB.ID] != 1 {
		t.Fatalf("closed status counts = %#v, want one per session", closedStatusCounts)
	}
	if closedCounts[sessionA.ID] != 1 || closedCounts[sessionB.ID] != 1 {
		t.Fatalf("closed event counts = %#v, want one per session", closedCounts)
	}
}

func TestMissingSessionOperationsReturnError(t *testing.T) {
	reg := NewRegistry(&fakeRunner{}, nil)

	if err := reg.Write("missing", "ls\r"); !errors.Is(err, errSessionNotFound) {
		t.Fatalf("Write() error = %v, want session not found", err)
	}
	if err := reg.Resize("missing", domain.TerminalSize{Cols: 80, Rows: 24}); !errors.Is(err, errSessionNotFound) {
		t.Fatalf("Resize() error = %v, want session not found", err)
	}
	if err := reg.Close("missing"); !errors.Is(err, errSessionNotFound) {
		t.Fatalf("Close() error = %v, want session not found", err)
	}
}
