package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
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

	runner := sshclient.RealRunner{}
	a.store = store
	a.registry = sessions.NewRegistry(runner, appsvc.NewWailsEmitter(ctx))
	a.service = appsvc.NewService(store, a.registry, runner)
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

func (a *App) RecordCommandHistory(sessionID string, command string) error {
	return a.service.RecordCommandHistory(sessionID, command)
}

func (a *App) ResizeTerminal(sessionID string, size domain.TerminalSize) error {
	return a.service.ResizeTerminal(sessionID, size)
}

func (a *App) RunCommand(input domain.RunCommandInput) error {
	return a.service.RunCommand(input)
}

func (a *App) ListCommandHistory(filter domain.CommandHistoryFilter) ([]domain.CommandHistoryEntry, error) {
	return a.service.ListCommandHistory(filter)
}

func (a *App) ClearCommandHistory(connectionID string) error {
	return a.service.ClearCommandHistory(connectionID)
}

func (a *App) ListSavedCommands() ([]domain.SavedCommand, error) {
	return a.service.ListSavedCommands()
}

func (a *App) SaveSavedCommand(input domain.SaveSavedCommandInput) (domain.SavedCommand, error) {
	return a.service.SaveSavedCommand(input)
}

func (a *App) DeleteSavedCommand(id string) error {
	return a.service.DeleteSavedCommand(id)
}

func (a *App) GetSettings() (domain.AppSettings, error) {
	return a.service.GetSettings()
}

func (a *App) SaveSettings(input domain.AppSettings) (domain.AppSettings, error) {
	return a.service.SaveSettings(input)
}

func (a *App) ListFiles(input domain.FileListInput) ([]domain.FileEntry, error) {
	return a.service.ListFiles(input)
}

func (a *App) ReadFile(input domain.FileReadInput) (domain.FileContent, error) {
	return a.service.ReadFile(input)
}

func (a *App) SaveFile(input domain.FileSaveInput) error {
	return a.service.SaveFile(input)
}

func (a *App) CreateFolder(input domain.FileMutationInput) error {
	return a.service.CreateFolder(input)
}

func (a *App) RenameFile(input domain.FileRenameInput) error {
	return a.service.RenameFile(input)
}

func (a *App) DeleteFile(input domain.FileMutationInput) error {
	return a.service.DeleteFile(input)
}

func (a *App) TransferFile(input domain.FileTransferInput) (domain.FileTransferResult, error) {
	return a.service.TransferFile(input)
}

func (a *App) SelectLocalFile() (string, error) {
	if a == nil || a.ctx == nil {
		return "", errors.New("app context is unavailable")
	}
	return wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Select local file to upload",
	})
}

func (a *App) SelectLocalFiles() ([]string, error) {
	if a == nil || a.ctx == nil {
		return nil, errors.New("app context is unavailable")
	}
	return wailsruntime.OpenMultipleFilesDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Select local files to upload",
	})
}

func (a *App) SelectLocalDirectory(title string) (string, error) {
	if a == nil || a.ctx == nil {
		return "", errors.New("app context is unavailable")
	}
	if strings.TrimSpace(title) == "" {
		title = "Select local folder"
	}
	return wailsruntime.OpenDirectoryDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:                title,
		CanCreateDirectories: true,
	})
}

func (a *App) SelectSaveFile(defaultFilename string) (string, error) {
	if a == nil || a.ctx == nil {
		return "", errors.New("app context is unavailable")
	}
	filename := filepath.Base(defaultFilename)
	if filename == "." || filename == string(filepath.Separator) {
		filename = "download"
	}
	return wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:                "Save downloaded file",
		DefaultFilename:      filename,
		CanCreateDirectories: true,
	})
}

func (a *App) GetMonitorSnapshot(sessionID string) (domain.MonitorSnapshot, error) {
	return a.service.GetMonitorSnapshot(sessionID)
}
