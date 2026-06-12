package appsvc

import (
	"errors"
	"path/filepath"
	"testing"

	"termflow/internal/domain"
	"termflow/internal/sessions"
	"termflow/internal/sshclient"
	"termflow/internal/storage"
)

type fakeRunner struct {
	connectReqs []sshclient.ConnectRequest
	testReqs    []sshclient.ConnectRequest
	session     sshclient.TerminalSession
	testErr     error
	connectErr  error
}

func (r *fakeRunner) Connect(req sshclient.ConnectRequest) (sshclient.TerminalSession, error) {
	r.connectReqs = append(r.connectReqs, req)
	if r.connectErr != nil {
		return nil, r.connectErr
	}
	return r.session, nil
}

func (r *fakeRunner) Test(req sshclient.ConnectRequest) error {
	r.testReqs = append(r.testReqs, req)
	return r.testErr
}

type fakeTerminalSession struct {
	onData func([]byte)
	onExit func(error)
}

func (s *fakeTerminalSession) Start(_ domain.TerminalSize, onData func([]byte), onExit func(error)) error {
	s.onData = onData
	s.onExit = onExit
	return nil
}

func (s *fakeTerminalSession) Write(string) error { return nil }

func (s *fakeTerminalSession) Resize(domain.TerminalSize) error { return nil }

func (s *fakeTerminalSession) Close() error { return nil }

func TestTestConnectionUsesInjectedRunnerWithStoredConnection(t *testing.T) {
	store := newTestStore(t)
	conn := saveTestConnection(t, store)
	runner := &fakeRunner{}
	service := NewService(store, nil, runner)

	err := service.TestConnection(domain.TestConnectionInput{
		ConnectionID:          " " + conn.ID + " ",
		Password:              "secret",
		InsecureIgnoreHostKey: true,
	})
	if err != nil {
		t.Fatalf("TestConnection() error = %v", err)
	}
	if len(runner.testReqs) != 1 {
		t.Fatalf("runner Test calls = %d, want 1", len(runner.testReqs))
	}

	req := runner.testReqs[0]
	if req.Host != "example.com" ||
		req.Port != 2022 ||
		req.Username != "root" ||
		req.AuthType != domain.AuthKey ||
		req.Password != "secret" ||
		req.KeyPath != "/tmp/id_rsa" ||
		!req.InsecureIgnoreHostKey {
		t.Fatalf("Test request = %#v, want stored connection fields and insecure opt-in", req)
	}
}

func TestTestConnectionUsesTrimmedDirectInput(t *testing.T) {
	store := newTestStore(t)
	runner := &fakeRunner{}
	service := NewService(store, nil, runner)

	err := service.TestConnection(domain.TestConnectionInput{
		Host:                  "  direct.example.com  ",
		Port:                  2200,
		Username:              "  deploy  ",
		AuthType:              domain.AuthPassword,
		Password:              "secret",
		KeyPath:               "  /tmp/direct_key  ",
		InsecureIgnoreHostKey: true,
	})
	if err != nil {
		t.Fatalf("TestConnection() error = %v", err)
	}

	req := runner.testReqs[0]
	if req.Host != "direct.example.com" ||
		req.Username != "deploy" ||
		req.KeyPath != "/tmp/direct_key" ||
		req.Port != 2200 ||
		!req.InsecureIgnoreHostKey {
		t.Fatalf("Test request = %#v, want trimmed direct input", req)
	}
}

func TestTestConnectionValidatesDirectHostAndRunner(t *testing.T) {
	store := newTestStore(t)
	service := NewService(store, nil, &fakeRunner{})

	err := service.TestConnection(domain.TestConnectionInput{Host: "   "})
	if err == nil || err.Error() != "host is required" {
		t.Fatalf("TestConnection() error = %v, want host is required", err)
	}

	err = NewService(store, nil, nil).TestConnection(domain.TestConnectionInput{Host: "example.com"})
	if !errors.Is(err, errRunnerUnavailable) {
		t.Fatalf("TestConnection() error = %v, want runner unavailable", err)
	}
}

func TestOpenSessionForwardsInsecureHostKeyFlag(t *testing.T) {
	store := newTestStore(t)
	conn := saveTestConnection(t, store)
	runner := &fakeRunner{session: &fakeTerminalSession{}}
	registry := sessions.NewRegistry(runner, nil)
	service := NewService(store, registry, runner)

	session, err := service.OpenSession(domain.OpenSessionInput{
		ConnectionID:          conn.ID,
		Password:              "secret",
		Size:                  domain.TerminalSize{Cols: 80, Rows: 24},
		InsecureIgnoreHostKey: true,
	})
	if err != nil {
		t.Fatalf("OpenSession() error = %v", err)
	}
	if session.ID == "" {
		t.Fatal("OpenSession() session ID is empty")
	}
	if len(runner.connectReqs) != 1 {
		t.Fatalf("runner Connect calls = %d, want 1", len(runner.connectReqs))
	}
	if !runner.connectReqs[0].InsecureIgnoreHostKey {
		t.Fatalf("Connect request = %#v, want insecure opt-in", runner.connectReqs[0])
	}
}

func TestWailsEmitterNilSafe(t *testing.T) {
	var nilEmitter *WailsEmitter
	nilEmitter.Emit("event", nil)
	NewWailsEmitter(nil).Emit("event", nil)
}

func newTestStore(t *testing.T) *storage.Store {
	t.Helper()

	store, err := storage.New(filepath.Join(t.TempDir(), "termflow.db"))
	if err != nil {
		t.Fatalf("storage.New() error = %v", err)
	}
	t.Cleanup(func() {
		_ = store.Close()
	})
	return store
}

func saveTestConnection(t *testing.T, store *storage.Store) domain.Connection {
	t.Helper()

	conn, err := store.SaveConnection(domain.SaveConnectionInput{
		Name:     "prod",
		Host:     "example.com",
		Port:     2022,
		Username: "root",
		AuthType: domain.AuthKey,
		KeyPath:  "/tmp/id_rsa",
	})
	if err != nil {
		t.Fatalf("SaveConnection() error = %v", err)
	}
	return conn
}
