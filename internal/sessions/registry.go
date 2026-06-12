package sessions

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"

	"termflow/internal/domain"
	"termflow/internal/sshclient"
)

var errSessionNotFound = errors.New("session not found")

type Emitter interface {
	Emit(name string, data any)
}

type OpenRequest struct {
	Connection            domain.Connection
	Password              string
	Size                  domain.TerminalSize
	InsecureIgnoreHostKey bool
}

type Registry struct {
	runner   sshclient.Runner
	emitter  Emitter
	mu       sync.RWMutex
	sessions map[string]*entry
}

type entry struct {
	mu    sync.Mutex
	model domain.Session
	term  sshclient.TerminalSession
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

	term, err := r.runner.Connect(sshclient.ConnectRequest{
		Host:                  req.Connection.Host,
		Port:                  req.Connection.Port,
		Username:              req.Connection.Username,
		AuthType:              req.Connection.AuthType,
		Password:              req.Password,
		KeyPath:               req.Connection.KeyPath,
		InsecureIgnoreHostKey: req.InsecureIgnoreHostKey,
	})
	if err != nil {
		return domain.Session{}, err
	}

	model.Status = domain.SessionConnected
	ent := &entry{
		model: model,
		term:  term,
	}
	r.mu.Lock()
	r.sessions[id] = ent
	r.mu.Unlock()

	var startState struct {
		mu       sync.Mutex
		ready    bool
		failed   bool
		exited   bool
		exitErr  error
		buffered []string
	}

	emitOutput := func(payload string) {
		r.emit(domain.EventSessionOutput, domain.SessionOutputEvent{
			SessionID: id,
			Data:      payload,
		})
	}

	if err := term.Start(req.Size, func(data []byte) {
		payload := string(data)

		startState.mu.Lock()
		defer startState.mu.Unlock()

		if startState.failed {
			return
		}
		if !startState.ready {
			startState.buffered = append(startState.buffered, payload)
			return
		}
		emitOutput(payload)
	}, func(exitErr error) {
		startState.mu.Lock()
		if startState.failed {
			startState.mu.Unlock()
			return
		}
		if !startState.ready {
			startState.exited = true
			startState.exitErr = exitErr
			startState.mu.Unlock()
			return
		}
		startState.mu.Unlock()

		r.onExit(id, exitErr)
	}); err != nil {
		startState.mu.Lock()
		startState.failed = true
		startState.buffered = nil
		startState.mu.Unlock()

		_ = term.Close()
		_, _ = r.remove(id)
		return domain.Session{}, err
	}

	r.emit(domain.EventSessionCreated, model)
	r.emit(domain.EventSessionStatus, domain.SessionStatusEvent{
		SessionID: id,
		Status:    domain.SessionConnected,
		Message:   "connected",
	})

	startState.mu.Lock()
	for _, payload := range startState.buffered {
		emitOutput(payload)
	}
	startState.buffered = nil
	startState.ready = true
	exited := startState.exited
	exitErr := startState.exitErr
	startState.mu.Unlock()

	if exited {
		r.onExit(id, exitErr)
	}

	return model, nil
}

func (r *Registry) Write(sessionID string, data string) error {
	ent, err := r.get(sessionID)
	if err != nil {
		return err
	}
	if err := ent.term.Write(data); err != nil {
		return err
	}
	ent.mu.Lock()
	ent.model.LastActiveAt = time.Now().UTC()
	ent.mu.Unlock()
	return nil
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

	closeErr := ent.term.Close()
	r.emit(domain.EventSessionStatus, domain.SessionStatusEvent{
		SessionID: sessionID,
		Status:    domain.SessionClosed,
		Message:   "closed",
	})
	r.emit(domain.EventSessionClosed, map[string]string{"sessionId": sessionID})

	return closeErr
}

func (r *Registry) CloseAll() {
	r.mu.RLock()
	ids := make([]string, 0, len(r.sessions))
	for id := range r.sessions {
		ids = append(ids, id)
	}
	r.mu.RUnlock()

	for _, id := range ids {
		_ = r.Close(id)
	}
}

func (r *Registry) onExit(sessionID string, exitErr error) {
	if _, err := r.remove(sessionID); err != nil {
		return
	}

	message := "disconnected"
	if exitErr != nil {
		message = exitErr.Error()
	}

	r.emit(domain.EventSessionStatus, domain.SessionStatusEvent{
		SessionID: sessionID,
		Status:    domain.SessionDisconnected,
		Message:   message,
	})
	r.emit(domain.EventSessionClosed, map[string]string{"sessionId": sessionID})
}

func (r *Registry) get(sessionID string) (*entry, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	ent := r.sessions[sessionID]
	if ent == nil {
		return nil, errSessionNotFound
	}
	return ent, nil
}

func (r *Registry) remove(sessionID string) (*entry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	ent := r.sessions[sessionID]
	if ent == nil {
		return nil, errSessionNotFound
	}

	delete(r.sessions, sessionID)
	return ent, nil
}

func (r *Registry) emit(name string, data any) {
	if r.emitter == nil {
		return
	}
	r.emitter.Emit(name, data)
}
