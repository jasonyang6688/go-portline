package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"termflow/internal/appsvc"
	"termflow/internal/domain"
	"termflow/internal/sessions"
	"termflow/internal/sshclient"
	"termflow/internal/storage"
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
		dir = filepath.Join(home, ".config")
	}
	return filepath.Join(dir, "TermFlow", "termflow.db"), nil
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
