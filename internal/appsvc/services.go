package appsvc

import (
	"context"
	"errors"
	"strings"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"

	"termflow/internal/domain"
	"termflow/internal/sessions"
	"termflow/internal/sshclient"
	"termflow/internal/storage"
)

var (
	errStoreUnavailable    = errors.New("store is unavailable")
	errRegistryUnavailable = errors.New("session registry is unavailable")
	errRunnerUnavailable   = errors.New("ssh runner is unavailable")
)

type Service struct {
	store    *storage.Store
	registry *sessions.Registry
	runner   sshclient.Runner
}

func NewService(store *storage.Store, registry *sessions.Registry, runner sshclient.Runner) *Service {
	return &Service{store: store, registry: registry, runner: runner}
}

func (s *Service) ListConnections() ([]domain.Connection, error) {
	if s == nil || s.store == nil {
		return nil, errStoreUnavailable
	}
	return s.store.ListConnections()
}

func (s *Service) SaveConnection(input domain.SaveConnectionInput) (domain.Connection, error) {
	if s == nil || s.store == nil {
		return domain.Connection{}, errStoreUnavailable
	}
	return s.store.SaveConnection(input)
}

func (s *Service) DeleteConnection(id string) error {
	if s == nil || s.store == nil {
		return errStoreUnavailable
	}
	return s.store.DeleteConnection(id)
}

func (s *Service) TestConnection(input domain.TestConnectionInput) error {
	if s == nil || s.runner == nil {
		return errRunnerUnavailable
	}
	req, err := s.connectRequest(input)
	if err != nil {
		return err
	}
	return s.runner.Test(req)
}

func (s *Service) OpenSession(input domain.OpenSessionInput) (domain.Session, error) {
	if s == nil || s.store == nil {
		return domain.Session{}, errStoreUnavailable
	}
	if s.registry == nil {
		return domain.Session{}, errRegistryUnavailable
	}

	conn, err := s.store.GetConnection(strings.TrimSpace(input.ConnectionID))
	if err != nil {
		return domain.Session{}, err
	}

	return s.registry.Open(sessions.OpenRequest{
		Connection:            conn,
		Password:              input.Password,
		Size:                  input.Size,
		InsecureIgnoreHostKey: input.InsecureIgnoreHostKey,
	})
}

func (s *Service) CloseSession(sessionID string) error {
	if s == nil || s.registry == nil {
		return errRegistryUnavailable
	}
	return s.registry.Close(sessionID)
}

func (s *Service) WriteTerminal(sessionID string, data string) error {
	if s == nil || s.registry == nil {
		return errRegistryUnavailable
	}
	return s.registry.Write(sessionID, data)
}

func (s *Service) ResizeTerminal(sessionID string, size domain.TerminalSize) error {
	if s == nil || s.registry == nil {
		return errRegistryUnavailable
	}
	return s.registry.Resize(sessionID, size)
}

func (s *Service) connectRequest(input domain.TestConnectionInput) (sshclient.ConnectRequest, error) {
	if s == nil || s.store == nil {
		return sshclient.ConnectRequest{}, errStoreUnavailable
	}

	connectionID := strings.TrimSpace(input.ConnectionID)
	if connectionID != "" {
		conn, err := s.store.GetConnection(connectionID)
		if err != nil {
			return sshclient.ConnectRequest{}, err
		}
		return sshclient.ConnectRequest{
			Host:                  strings.TrimSpace(conn.Host),
			Port:                  conn.Port,
			Username:              strings.TrimSpace(conn.Username),
			AuthType:              conn.AuthType,
			Password:              input.Password,
			KeyPath:               strings.TrimSpace(conn.KeyPath),
			InsecureIgnoreHostKey: input.InsecureIgnoreHostKey,
		}, nil
	}

	host := strings.TrimSpace(input.Host)
	if host == "" {
		return sshclient.ConnectRequest{}, errors.New("host is required")
	}

	return sshclient.ConnectRequest{
		Host:                  host,
		Port:                  input.Port,
		Username:              strings.TrimSpace(input.Username),
		AuthType:              input.AuthType,
		Password:              input.Password,
		KeyPath:               strings.TrimSpace(input.KeyPath),
		InsecureIgnoreHostKey: input.InsecureIgnoreHostKey,
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
