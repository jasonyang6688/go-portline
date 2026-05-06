package main

import (
	"archive/tar"
	"bufio"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	pathpkg "path"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode/utf16"

	localterm "TermFlow/internal/local"
	"TermFlow/internal/ssh"
	"TermFlow/internal/store"
	"TermFlow/internal/termexec"
	"TermFlow/internal/wsl"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx       context.Context
	db        *store.Store
	sshMgr    *ssh.Manager
	uploadMu  sync.Mutex
	uploads   map[string]*uploadTransfer
	transferN uint64
}

type uploadTransfer struct {
	id      string
	name    string
	total   int64
	written int64
	pipe    *io.PipeWriter
}

func NewApp() *App {
	return &App{sshMgr: ssh.NewManager(), uploads: make(map[string]*uploadTransfer)}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	dbPath := filepath.Join(os.Getenv("HOME"), ".termflow", "data.db")
	os.MkdirAll(filepath.Dir(dbPath), 0700)
	db, err := store.New(dbPath)
	if err != nil {
		panic(fmt.Sprintf("failed to open db: %v", err))
	}
	a.db = db

	_ = a.db.DeleteDemoData()
	a.ensureSingleLocalConnection(osUser())
	a.ensureSingleLocalWSL()
}

func (a *App) shutdown(_ context.Context) {
	a.db.Close()
}

func (a *App) ensureSingleLocalWSL() {
	if runtime.GOOS != "windows" {
		return
	}

	detected := detectWindowsWSLHosts()
	if len(detected) == 0 {
		return
	}

	conns, err := a.db.ListConnections()
	if err != nil {
		return
	}
	var keptID int64
	for _, c := range conns {
		if isWSLConnection(c) {
			if keptID == 0 {
				keptID = c.ID
				continue
			}
			_ = a.db.ReassignQuickCommands(c.ID, keptID)
			_ = a.db.DeleteConnection(c.ID)
		}
	}
	wslConn := detected[0]
	if keptID > 0 {
		wslConn.ID = keptID
		_, _ = a.db.SaveConnection(wslConn)
		_ = a.db.AttachOrphanQuickCommands(keptID)
		return
	}
	id, err := a.db.SaveConnection(wslConn)
	if err == nil {
		_ = a.db.AttachOrphanQuickCommands(id)
	}
}

func (a *App) ensureSingleLocalConnection(user string) {
	conns, err := a.db.ListConnections()
	if err != nil {
		return
	}
	localConn := defaultLocalConnection(user)
	for _, c := range conns {
		if !isLocalConnection(c) {
			continue
		}
		localConn.ID = c.ID
		_, _ = a.db.SaveConnection(localConn)
		return
	}
	_, _ = a.db.SaveConnection(localConn)
}

func defaultLocalConnection(user string) store.Connection {
	user = strings.TrimSpace(user)
	if user == "" {
		user = "local"
	}
	return store.Connection{
		Name:      "Local Terminal",
		Host:      "localhost",
		Port:      0,
		User:      user,
		Kind:      "local",
		Env:       "dev",
		GroupName: "Local",
	}
}

func isLocalConnection(c store.Connection) bool {
	return c.Kind == "local"
}

func osUser() string {
	if user := strings.TrimSpace(os.Getenv("USER")); user != "" {
		return user
	}
	if user := strings.TrimSpace(os.Getenv("USERNAME")); user != "" {
		return user
	}
	return "local"
}

// ── Connection CRUD ──────────────────────────────────────────────

func (a *App) ListConnections() ([]store.Connection, error) {
	return a.db.ListConnections()
}

func (a *App) SaveConnection(c store.Connection) (int64, error) {
	return a.db.SaveConnection(c)
}

func (a *App) DeleteConnection(id int64) error {
	return a.db.DeleteConnection(id)
}

func (a *App) DetectLocalHosts() []store.Connection {
	if runtime.GOOS == "windows" {
		return detectWindowsWSLHosts()
	}
	if isRunningInsideWSL() {
		user := os.Getenv("USER")
		if user == "" {
			user = "root"
		}
		return []store.Connection{{
			Name:      "WSL Local",
			Host:      "127.0.0.1",
			Port:      22,
			User:      user,
			Kind:      "ssh",
			Env:       "dev",
			GroupName: "Local",
		}}
	}
	return nil
}

func (a *App) SelectPrivateKeyPath() (string, error) {
	home, _ := os.UserHomeDir()
	defaultDir := ""
	if home != "" {
		defaultDir = filepath.Join(home, ".ssh")
	}

	return wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:            "Select SSH private key",
		DefaultDirectory: defaultDir,
		ShowHiddenFiles:  true,
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "SSH private keys", Pattern: "id_*;*.pem;*.key;*"},
		},
	})
}

// ── SSH Sessions ─────────────────────────────────────────────────

type ConnectResult struct {
	SessionID string `json:"sessionId"`
}

type RemoteFile struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	IsDir    bool   `json:"isDir"`
	Size     int64  `json:"size"`
	Modified int64  `json:"modified"`
}

type RemoteListResult struct {
	Path  string       `json:"path"`
	Files []RemoteFile `json:"files"`
}

type RemoteMetrics struct {
	CPUPercent    float64        `json:"cpuPercent"`
	MemoryPercent float64        `json:"memoryPercent"`
	MemoryUsedMB  float64        `json:"memoryUsedMb"`
	MemoryTotalMB float64        `json:"memoryTotalMb"`
	DiskPercent   float64        `json:"diskPercent"`
	LoadAverage   string         `json:"loadAverage"`
	Uptime        string         `json:"uptime"`
	Hostname      string         `json:"hostname"`
	Kernel        string         `json:"kernel"`
	ProcessCount  int            `json:"processCount"`
	DiskUsage     []DiskUsage    `json:"diskUsage"`
	TopProcesses  []ProcessUsage `json:"topProcesses"`
}

type DiskUsage struct {
	Filesystem string  `json:"filesystem"`
	Mount      string  `json:"mount"`
	Used       string  `json:"used"`
	Size       string  `json:"size"`
	Percent    float64 `json:"percent"`
}

type ProcessUsage struct {
	PID     string  `json:"pid"`
	User    string  `json:"user"`
	CPU     float64 `json:"cpu"`
	Memory  float64 `json:"memory"`
	Command string  `json:"command"`
}

type TransferStartResult struct {
	TransferID string `json:"transferId"`
}

type TransferProgress struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Kind       string  `json:"kind"`
	Written    int64   `json:"written"`
	Total      int64   `json:"total"`
	Percent    float64 `json:"percent"`
	Status     string  `json:"status"`
	Error      string  `json:"error,omitempty"`
	SavePath   string  `json:"savePath,omitempty"`
	TargetPath string  `json:"targetPath,omitempty"`
}

func (a *App) SSHConnect(connID int64) (ConnectResult, error) {
	c, err := a.db.GetConnection(connID)
	if err != nil {
		return ConnectResult{}, err
	}
	id := a.sshMgr.NewSessionID()
	var sess ssh.ManagedSession
	if isLocalConnection(c) {
		sess, err = localterm.Connect(id)
	} else if isWSLConnection(c) {
		sess, err = wsl.Connect(id, connectionWSLDistro(c))
	} else {
		sess, err = ssh.Connect(id, ssh.ConnectParams{
			Host:     c.Host,
			Port:     c.Port,
			User:     c.User,
			Password: c.Password,
			KeyPath:  c.KeyPath,
		})
	}
	if err != nil {
		return ConnectResult{}, fmt.Errorf("connect to %s: %w", c.Host, err)
	}
	a.sshMgr.Add(id, sess)
	return ConnectResult{SessionID: id}, nil
}

func isWSLConnection(c store.Connection) bool {
	return c.Kind == "wsl" || c.WSLDistro != "" || strings.HasPrefix(strings.TrimSpace(c.Name), "WSL")
}

func connectionWSLDistro(c store.Connection) string {
	if c.WSLDistro != "" {
		return c.WSLDistro
	}
	if strings.HasPrefix(strings.TrimSpace(c.Name), "WSL") {
		name := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(c.Name), "WSL"))
		name = strings.TrimLeft(name, " -·路")
		if name != "" {
			return strings.TrimSpace(name)
		}
	}
	return c.Host
}

func sanitizeClipboardImageName(name string) string {
	name = strings.TrimSpace(filepath.Base(name))
	if name == "" || name == "." {
		name = "clipboard-image.png"
	}

	var builder strings.Builder
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z':
			builder.WriteRune(r)
		case r >= 'A' && r <= 'Z':
			builder.WriteRune(r)
		case r >= '0' && r <= '9':
			builder.WriteRune(r)
		case r == '.', r == '-', r == '_':
			builder.WriteRune(r)
		default:
			builder.WriteRune('-')
		}
	}

	clean := strings.Trim(builder.String(), ".-")
	if clean == "" {
		return "clipboard-image.png"
	}
	if filepath.Ext(clean) == "" {
		return clean + ".png"
	}
	return clean
}

func (a *App) SSHStart(sessionID string, cols int, rows int) error {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return fmt.Errorf("session %q not found", sessionID)
	}
	return sess.Start(cols, rows, func(data []byte) {
		wailsruntime.EventsEmit(a.ctx, "ssh:data:"+sessionID, base64.StdEncoding.EncodeToString(data))
	}, func(err error) {
		msg := ""
		if err != nil {
			msg = err.Error()
		}
		wailsruntime.EventsEmit(a.ctx, "ssh:exit:"+sessionID, msg)
	})
}

func (a *App) SSHWrite(sessionID string, data string) error {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return fmt.Errorf("session %q not found", sessionID)
	}
	return sess.Write(data)
}

func (a *App) SSHResize(sessionID string, cols int, rows int) error {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return fmt.Errorf("session %q not found", sessionID)
	}
	return sess.Resize(cols, rows)
}

func (a *App) SSHDisconnect(sessionID string) error {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return fmt.Errorf("session %q not found", sessionID)
	}
	err := sess.Close()
	a.sshMgr.Remove(sessionID)
	return err
}

func (a *App) LocalListDir(path string) (RemoteListResult, error) {
	if strings.TrimSpace(path) == "" || strings.TrimSpace(path) == "~" {
		home, err := os.UserHomeDir()
		if err != nil {
			return RemoteListResult{}, err
		}
		path = home
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return RemoteListResult{}, err
	}
	entries, err := os.ReadDir(abs)
	if err != nil {
		return RemoteListResult{}, err
	}

	result := RemoteListResult{Path: abs, Files: make([]RemoteFile, 0, len(entries))}
	dirs := make([]RemoteFile, 0)
	files := make([]RemoteFile, 0)
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		item := RemoteFile{
			Name:     entry.Name(),
			Path:     filepath.Join(abs, entry.Name()),
			IsDir:    entry.IsDir(),
			Size:     info.Size(),
			Modified: info.ModTime().Unix(),
		}
		if item.IsDir {
			dirs = append(dirs, item)
		} else {
			files = append(files, item)
		}
	}
	result.Files = append(result.Files, dirs...)
	result.Files = append(result.Files, files...)
	return result, nil
}

func (a *App) LocalMkdir(parentPath string, name string) error {
	name = filepath.Base(strings.TrimSpace(name))
	if name == "." || name == "" {
		return fmt.Errorf("folder name is required")
	}
	if strings.TrimSpace(parentPath) == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return err
		}
		parentPath = home
	}
	return os.Mkdir(filepath.Join(parentPath, name), 0755)
}

func (a *App) LocalRename(oldPath string, newName string) error {
	oldPath = strings.TrimSpace(oldPath)
	newName = filepath.Base(strings.TrimSpace(newName))
	if oldPath == "" || newName == "." || newName == "" {
		return fmt.Errorf("path and new name are required")
	}
	return os.Rename(oldPath, filepath.Join(filepath.Dir(oldPath), newName))
}

func (a *App) LocalDelete(path string) error {
	path = strings.TrimSpace(path)
	if path == "" {
		return fmt.Errorf("path is required")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	root := filepath.VolumeName(abs) + string(os.PathSeparator)
	if abs == root || abs == filepath.Dir(abs) {
		return fmt.Errorf("refusing to delete %q", abs)
	}
	return os.RemoveAll(abs)
}

func (a *App) RemoteListDir(sessionID string, path string) (RemoteListResult, error) {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return RemoteListResult{}, fmt.Errorf("session %q not found", sessionID)
	}
	if strings.TrimSpace(path) == "" {
		path = "~"
	}

	cmd := fmt.Sprintf(
		"cd -- %s && printf '__PWD__\\t%%s\\n' \"$PWD\" && { find . -maxdepth 1 -mindepth 1 -type d -printf '%%f\\t%%y\\t%%s\\t%%T@\\n' | sort -f; find . -maxdepth 1 -mindepth 1 ! -type d -printf '%%f\\t%%y\\t%%s\\t%%T@\\n' | sort -f; }",
		shellQuote(path),
	)
	out, err := sess.Run(cmd)
	if err != nil {
		return RemoteListResult{}, fmt.Errorf("list remote dir: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return parseRemoteList(out), nil
}

func (a *App) RemoteMkdir(sessionID string, parentPath string, name string) error {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return fmt.Errorf("session %q not found", sessionID)
	}
	name = strings.TrimSpace(name)
	if name == "" || strings.Contains(name, "/") || strings.Contains(name, "\\") {
		return fmt.Errorf("folder name is required")
	}
	if strings.TrimSpace(parentPath) == "" {
		parentPath = "~"
	}

	cmd := fmt.Sprintf("cd -- %s && mkdir -- %s", shellQuote(parentPath), shellQuote(name))
	out, err := sess.Run(cmd)
	if err != nil {
		return fmt.Errorf("mkdir remote dir: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func (a *App) RemoteRename(sessionID string, oldPath string, newName string) error {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return fmt.Errorf("session %q not found", sessionID)
	}
	oldPath = strings.TrimSpace(oldPath)
	newName = strings.TrimSpace(newName)
	if oldPath == "" {
		return fmt.Errorf("remote path is required")
	}
	if newName == "" || strings.Contains(newName, "/") || strings.Contains(newName, "\\") {
		return fmt.Errorf("new name is required")
	}

	parent := remoteParentPath(oldPath)
	newPath := joinRemotePath(parent, newName)
	out, err := sess.Run(fmt.Sprintf("mv -- %s %s", shellQuote(oldPath), shellQuote(newPath)))
	if err != nil {
		return fmt.Errorf("rename remote item: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func (a *App) RemoteDelete(sessionID string, remotePath string) error {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return fmt.Errorf("session %q not found", sessionID)
	}
	remotePath = strings.TrimSpace(remotePath)
	if remotePath == "" || remotePath == "/" || remotePath == "~" {
		return fmt.Errorf("refusing to delete %q", remotePath)
	}

	out, err := sess.Run("rm -rf -- " + shellQuote(remotePath))
	if err != nil {
		return fmt.Errorf("delete remote item: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func (a *App) RemoteUploadFile(sessionID string, remoteDir string) (RemoteFile, error) {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return RemoteFile{}, fmt.Errorf("session %q not found", sessionID)
	}
	if strings.TrimSpace(remoteDir) == "" {
		remoteDir = "~"
	}

	localPath, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Upload file",
	})
	if err != nil {
		return RemoteFile{}, err
	}
	if localPath == "" {
		return RemoteFile{}, fmt.Errorf("upload canceled")
	}

	file, err := os.Open(localPath)
	if err != nil {
		return RemoteFile{}, err
	}
	defer file.Close()

	name := filepath.Base(localPath)
	cmd := fmt.Sprintf("cd -- %s && cat > %s", shellQuote(remoteDir), shellQuote(name))
	out, err := sess.RunWithInput(cmd, file)
	if err != nil {
		return RemoteFile{}, fmt.Errorf("upload remote file: %w: %s", err, strings.TrimSpace(string(out)))
	}

	list, err := a.RemoteListDir(sessionID, remoteDir)
	if err != nil {
		return RemoteFile{Name: name, Path: joinRemotePath(remoteDir, name)}, nil
	}
	for _, f := range list.Files {
		if f.Name == name {
			return f, nil
		}
	}
	return RemoteFile{Name: name, Path: joinRemotePath(list.Path, name)}, nil
}

func (a *App) RemoteStartUpload(sessionID string, remoteDir string, name string, total int64) (TransferStartResult, error) {
	return a.remoteStartUploadPath(sessionID, remoteDir, name, total, true)
}

func (a *App) RemoteStartUploadPath(sessionID string, remoteDir string, relativePath string, total int64) (TransferStartResult, error) {
	return a.remoteStartUploadPath(sessionID, remoteDir, relativePath, total, false)
}

func (a *App) remoteStartUploadPath(sessionID string, remoteDir string, relativePath string, total int64, baseNameOnly bool) (TransferStartResult, error) {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return TransferStartResult{}, fmt.Errorf("session %q not found", sessionID)
	}
	if strings.TrimSpace(remoteDir) == "" {
		remoteDir = "~"
	}
	cleanPath, err := cleanRelativeRemotePath(relativePath, baseNameOnly)
	if err != nil {
		return TransferStartResult{}, err
	}
	name := cleanPath
	if baseNameOnly {
		name = filepath.Base(cleanPath)
	}
	if name == "." || name == "" {
		return TransferStartResult{}, fmt.Errorf("file name is required")
	}

	reader, writer := io.Pipe()
	id := a.nextTransferID("up")
	transfer := &uploadTransfer{id: id, name: name, total: total, pipe: writer}

	a.uploadMu.Lock()
	a.uploads[id] = transfer
	a.uploadMu.Unlock()
	a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "upload", Total: total, Status: "running"})

	go func() {
		cmd := fmt.Sprintf("cd -- %s && mkdir -p -- %s && cat > %s", shellQuote(remoteDir), shellQuote(pathpkg.Dir(cleanPath)), shellQuote(cleanPath))
		out, err := sess.RunWithInput(cmd, reader)
		reader.Close()
		a.uploadMu.Lock()
		delete(a.uploads, id)
		a.uploadMu.Unlock()
		if err != nil {
			a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "upload", Total: total, Status: "error", Error: fmt.Sprintf("%v: %s", err, strings.TrimSpace(string(out)))})
			return
		}
		a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "upload", Written: total, Total: total, Percent: 100, Status: "done"})
	}()

	return TransferStartResult{TransferID: id}, nil
}

func (a *App) RemoteWriteUploadChunk(transferID string, encoded string, done bool) error {
	a.uploadMu.Lock()
	transfer, ok := a.uploads[transferID]
	a.uploadMu.Unlock()
	if !ok {
		return fmt.Errorf("upload transfer %q not found", transferID)
	}

	if encoded != "" {
		chunk, err := base64.StdEncoding.DecodeString(encoded)
		if err != nil {
			return err
		}
		if _, err := transfer.pipe.Write(chunk); err != nil {
			return err
		}
		transfer.written += int64(len(chunk))
		a.emitTransfer(TransferProgress{
			ID:      transfer.id,
			Name:    transfer.name,
			Kind:    "upload",
			Written: transfer.written,
			Total:   transfer.total,
			Percent: transferPercent(transfer.written, transfer.total),
			Status:  "running",
		})
	}
	if done {
		return transfer.pipe.Close()
	}
	return nil
}

func (a *App) RemoteUploadLocalFile(sessionID string, localPath string, remoteDir string) (TransferStartResult, error) {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return TransferStartResult{}, fmt.Errorf("session %q not found", sessionID)
	}
	if strings.TrimSpace(remoteDir) == "" {
		remoteDir = "~"
	}
	localPath = strings.TrimSpace(localPath)
	info, err := os.Stat(localPath)
	if err != nil {
		return TransferStartResult{}, err
	}
	if info.IsDir() {
		return a.remoteUploadLocalDir(sess, localPath, remoteDir, info)
	}

	file, err := os.Open(localPath)
	if err != nil {
		return TransferStartResult{}, err
	}

	name := filepath.Base(localPath)
	targetPath := joinRemotePath(remoteDir, name)
	id := a.nextTransferID("up")
	a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "upload", Total: info.Size(), Status: "running", TargetPath: targetPath})

	go func() {
		defer file.Close()
		var written int64
		cmd := fmt.Sprintf("cd -- %s && cat > %s", shellQuote(remoteDir), shellQuote(name))
		out, err := sess.RunWithInput(cmd, progressReader{reader: file, onRead: func(n int) {
			written += int64(n)
			a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "upload", Written: written, Total: info.Size(), Percent: transferPercent(written, info.Size()), Status: "running", TargetPath: targetPath})
		}})
		if err != nil {
			a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "upload", Written: written, Total: info.Size(), Percent: transferPercent(written, info.Size()), Status: "error", Error: fmt.Sprintf("%v: %s", err, strings.TrimSpace(string(out))), TargetPath: targetPath})
			return
		}
		a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "upload", Written: info.Size(), Total: info.Size(), Percent: 100, Status: "done", TargetPath: targetPath})
	}()

	return TransferStartResult{TransferID: id}, nil
}

func (a *App) remoteUploadLocalDir(sess ssh.ManagedSession, localPath string, remoteDir string, info os.FileInfo) (TransferStartResult, error) {
	total, err := localDirRegularFileSize(localPath)
	if err != nil {
		return TransferStartResult{}, err
	}
	name := info.Name()
	targetPath := joinRemotePath(remoteDir, name)
	id := a.nextTransferID("up")
	a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "upload", Total: total, Status: "running", TargetPath: targetPath})

	go func() {
		reader, writer := io.Pipe()
		errCh := make(chan error, 1)
		var written int64

		go func() {
			errCh <- writeLocalDirTar(localPath, name, writer, func(n int) {
				written += int64(n)
				a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "upload", Written: written, Total: total, Percent: transferPercent(written, total), Status: "running", TargetPath: targetPath})
			})
		}()

		cmd := fmt.Sprintf("cd -- %s && tar -xf -", shellQuote(remoteDir))
		out, runErr := sess.RunWithInput(cmd, reader)
		_ = reader.Close()
		tarErr := <-errCh
		if runErr != nil {
			a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "upload", Written: written, Total: total, Percent: transferPercent(written, total), Status: "error", Error: fmt.Sprintf("%v: %s", runErr, strings.TrimSpace(string(out))), TargetPath: targetPath})
			return
		}
		if tarErr != nil {
			a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "upload", Written: written, Total: total, Percent: transferPercent(written, total), Status: "error", Error: tarErr.Error(), TargetPath: targetPath})
			return
		}
		a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "upload", Written: total, Total: total, Percent: 100, Status: "done", TargetPath: targetPath})
	}()

	return TransferStartResult{TransferID: id}, nil
}

func (a *App) RemoteDownloadFile(sessionID string, remotePath string, name string) (string, error) {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return "", fmt.Errorf("session %q not found", sessionID)
	}
	if strings.TrimSpace(remotePath) == "" {
		return "", fmt.Errorf("remote path is required")
	}
	if strings.TrimSpace(name) == "" {
		name = filepath.Base(remotePath)
	}

	savePath, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:           "Download file",
		DefaultFilename: name,
	})
	if err != nil {
		return "", err
	}
	if savePath == "" {
		return "", fmt.Errorf("download canceled")
	}

	out, err := sess.Run("cat -- " + shellQuote(remotePath))
	if err != nil {
		return "", fmt.Errorf("download remote file: %w: %s", err, strings.TrimSpace(string(out)))
	}
	if err := os.WriteFile(savePath, out, 0600); err != nil {
		return "", err
	}
	return savePath, nil
}

func (a *App) RemoteDownloadToDir(sessionID string, remotePath string, localDir string, name string, size int64) (TransferStartResult, error) {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return TransferStartResult{}, fmt.Errorf("session %q not found", sessionID)
	}
	if strings.TrimSpace(remotePath) == "" {
		return TransferStartResult{}, fmt.Errorf("remote path is required")
	}
	if strings.TrimSpace(localDir) == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return TransferStartResult{}, err
		}
		localDir = home
	}
	if strings.TrimSpace(name) == "" {
		name = filepath.Base(remotePath)
	}
	if err := os.MkdirAll(localDir, 0755); err != nil {
		return TransferStartResult{}, err
	}

	savePath := filepath.Join(localDir, filepath.Base(name))
	file, err := os.Create(savePath)
	if err != nil {
		return TransferStartResult{}, err
	}

	id := a.nextTransferID("down")
	a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "download", Total: size, Status: "running", SavePath: savePath})
	go func() {
		defer file.Close()
		var written int64
		out, err := sess.RunToWriter("cat -- "+shellQuote(remotePath), file, func(n int) {
			written += int64(n)
			a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "download", Written: written, Total: size, Percent: transferPercent(written, size), Status: "running", SavePath: savePath})
		})
		if err != nil {
			a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "download", Written: written, Total: size, Percent: transferPercent(written, size), Status: "error", Error: fmt.Sprintf("%v: %s", err, strings.TrimSpace(string(out))), SavePath: savePath})
			return
		}
		a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "download", Written: size, Total: size, Percent: 100, Status: "done", SavePath: savePath})
	}()

	return TransferStartResult{TransferID: id}, nil
}

func (a *App) RemoteReadTextFile(sessionID string, remotePath string) (string, error) {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return "", fmt.Errorf("session %q not found", sessionID)
	}
	if strings.TrimSpace(remotePath) == "" {
		return "", fmt.Errorf("remote path is required")
	}

	cmd := "python3 - <<'PY' " + shellQuote(remotePath) + "\n" +
		"import pathlib, sys\n" +
		"p = pathlib.Path(sys.argv[1])\n" +
		"data = p.read_bytes()\n" +
		"if len(data) > 262144:\n" +
		"    raise SystemExit('file is larger than 256 KiB')\n" +
		"sys.stdout.write(data.decode('utf-8'))\n" +
		"PY"
	out, err := sess.Run(cmd)
	if err != nil {
		return "", fmt.Errorf("read remote file: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}

func (a *App) RemoteWriteTextFile(sessionID string, remotePath string, content string) error {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return fmt.Errorf("session %q not found", sessionID)
	}
	if strings.TrimSpace(remotePath) == "" {
		return fmt.Errorf("remote path is required")
	}
	if len(content) > 262144 {
		return fmt.Errorf("file is larger than 256 KiB")
	}

	cmd := "cat > " + shellQuote(remotePath)
	out, err := sess.RunWithInput(cmd, strings.NewReader(content))
	if err != nil {
		return fmt.Errorf("write remote file: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func (a *App) RemoteStartDownload(sessionID string, remotePath string, name string, size int64) (TransferStartResult, error) {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return TransferStartResult{}, fmt.Errorf("session %q not found", sessionID)
	}
	if strings.TrimSpace(remotePath) == "" {
		return TransferStartResult{}, fmt.Errorf("remote path is required")
	}
	if strings.TrimSpace(name) == "" {
		name = filepath.Base(remotePath)
	}

	savePath, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:           "Download file",
		DefaultFilename: name,
	})
	if err != nil {
		return TransferStartResult{}, err
	}
	if savePath == "" {
		return TransferStartResult{}, fmt.Errorf("download canceled")
	}

	file, err := os.Create(savePath)
	if err != nil {
		return TransferStartResult{}, err
	}

	id := a.nextTransferID("down")
	a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "download", Total: size, Status: "running"})
	go func() {
		defer file.Close()
		var written int64
		out, err := sess.RunToWriter("cat -- "+shellQuote(remotePath), file, func(n int) {
			written += int64(n)
			a.emitTransfer(TransferProgress{
				ID:       id,
				Name:     name,
				Kind:     "download",
				Written:  written,
				Total:    size,
				Percent:  transferPercent(written, size),
				Status:   "running",
				SavePath: savePath,
			})
		})
		if err != nil {
			a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "download", Written: written, Total: size, Percent: transferPercent(written, size), Status: "error", Error: fmt.Sprintf("%v: %s", err, strings.TrimSpace(string(out))), SavePath: savePath})
			return
		}
		a.emitTransfer(TransferProgress{ID: id, Name: name, Kind: "download", Written: size, Total: size, Percent: 100, Status: "done", SavePath: savePath})
	}()

	return TransferStartResult{TransferID: id}, nil
}

func (a *App) RemoteStartDownloadDir(sessionID string, remotePath string, name string) (TransferStartResult, error) {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return TransferStartResult{}, fmt.Errorf("session %q not found", sessionID)
	}
	remotePath = strings.TrimSpace(remotePath)
	if remotePath == "" {
		return TransferStartResult{}, fmt.Errorf("remote path is required")
	}
	if strings.TrimSpace(name) == "" {
		name = pathpkg.Base(strings.TrimRight(remotePath, "/"))
	}
	name = pathpkg.Base(strings.TrimRight(name, "/"))
	if name == "." || name == "/" || name == "" {
		name = "download"
	}
	defaultName := name + ".tar"

	savePath, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:           "Download folder",
		DefaultFilename: defaultName,
	})
	if err != nil {
		return TransferStartResult{}, err
	}
	if savePath == "" {
		return TransferStartResult{}, fmt.Errorf("download canceled")
	}

	file, err := os.Create(savePath)
	if err != nil {
		return TransferStartResult{}, err
	}

	parent := remoteParentPath(remotePath)
	base := pathpkg.Base(strings.TrimRight(remotePath, "/"))
	cmd := "tar -C " + shellQuote(parent) + " -cf - -- " + shellQuote(base)

	id := a.nextTransferID("down")
	a.emitTransfer(TransferProgress{ID: id, Name: defaultName, Kind: "download", Status: "running", SavePath: savePath})
	go func() {
		defer file.Close()
		var written int64
		out, err := sess.RunToWriter(cmd, file, func(n int) {
			written += int64(n)
			a.emitTransfer(TransferProgress{
				ID:       id,
				Name:     defaultName,
				Kind:     "download",
				Written:  written,
				Percent:  0,
				Status:   "running",
				SavePath: savePath,
			})
		})
		if err != nil {
			a.emitTransfer(TransferProgress{ID: id, Name: defaultName, Kind: "download", Written: written, Percent: 0, Status: "error", Error: fmt.Sprintf("%v: %s", err, strings.TrimSpace(string(out))), SavePath: savePath})
			return
		}
		a.emitTransfer(TransferProgress{ID: id, Name: defaultName, Kind: "download", Written: written, Percent: 100, Status: "done", SavePath: savePath})
	}()

	return TransferStartResult{TransferID: id}, nil
}

func (a *App) RemoteMetrics(sessionID string) (RemoteMetrics, error) {
	sess, ok := a.sshMgr.Get(sessionID)
	if !ok {
		return RemoteMetrics{}, fmt.Errorf("session %q not found", sessionID)
	}

	cmd := strings.Join([]string{
		`cpu="$(vmstat 1 2 2>/dev/null | awk 'END { if (NF >= 15) print 100 - $15; else print 0 }')"`,
		`mem="$(awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{if(t>0) printf "%.1f\t%.1f\t%.1f", (t-a)*100/t, (t-a)/1024, t/1024; else printf "0\t0\t0"}' /proc/meminfo 2>/dev/null)"`,
		`disk="$(df -P / 2>/dev/null | awk 'NR==2{gsub("%","",$5); print $5}')"`,
		`load="$(cut -d ' ' -f1-3 /proc/loadavg 2>/dev/null)"`,
		`host="$(hostname 2>/dev/null)"`,
		`kernel="$(uname -sr 2>/dev/null)"`,
		`uptime="$(uptime -p 2>/dev/null | sed 's/^up //')"`,
		`procs="$(ps -e --no-headers 2>/dev/null | wc -l | tr -d ' ')"`,
		`printf 'cpu\t%s\nmem\t%s\ndisk\t%s\nload\t%s\nhost\t%s\nkernel\t%s\nuptime\t%s\nprocs\t%s\n' "$cpu" "$mem" "$disk" "$load" "$host" "$kernel" "$uptime" "$procs"`,
		`df -hP 2>/dev/null | awk 'NR>1 && $6 ~ /^\// {gsub("%","",$5); printf "diskrow\t%s\t%s\t%s\t%s\t%s\n", $1, $6, $3, $2, $5}' | head -n 8`,
		`ps -eo pid,user,pcpu,pmem,comm --sort=-pcpu 2>/dev/null | awk 'NR>1 && NR<=9 {printf "proc\t%s\t%s\t%s\t%s\t%s\n", $1, $2, $3, $4, $5}'`,
	}, "; ")
	out, err := sess.Run(cmd)
	if err != nil {
		return RemoteMetrics{}, fmt.Errorf("remote metrics: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return parseRemoteMetrics(out), nil
}

// ── Quick Commands ───────────────────────────────────────────────

func (a *App) ListQuickCommands() ([]store.QuickCommand, error) {
	return a.db.ListQuickCommands()
}

func (a *App) SaveQuickCommand(q store.QuickCommand) error {
	return a.db.SaveQuickCommand(q)
}

func (a *App) DeleteQuickCommand(id int64) error {
	return a.db.DeleteQuickCommand(id)
}

func (a *App) SaveClipboardImage(name string, encoded string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	if len(data) == 0 {
		return "", fmt.Errorf("clipboard image is empty")
	}

	name = sanitizeClipboardImageName(name)
	dir := filepath.Join(os.Getenv("HOME"), ".termflow", "clipboard")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}

	path := filepath.Join(dir, fmt.Sprintf("%s-%s", time.Now().Format("20060102-150405"), name))
	if err := os.WriteFile(path, data, 0600); err != nil {
		return "", err
	}
	return path, nil
}

func parseRemoteList(out []byte) RemoteListResult {
	result := RemoteListResult{Files: []RemoteFile{}}
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		parts := strings.Split(scanner.Text(), "\t")
		if len(parts) == 2 && parts[0] == "__PWD__" {
			result.Path = parts[1]
			continue
		}
		if len(parts) < 4 {
			continue
		}
		size, _ := strconv.ParseInt(parts[2], 10, 64)
		modifiedFloat, _ := strconv.ParseFloat(parts[3], 64)
		result.Files = append(result.Files, RemoteFile{
			Name:     parts[0],
			Path:     joinRemotePath(result.Path, parts[0]),
			IsDir:    parts[1] == "d",
			Size:     size,
			Modified: int64(modifiedFloat),
		})
	}
	return result
}

func parseRemoteMetrics(out []byte) RemoteMetrics {
	var metrics RemoteMetrics
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		parts := strings.SplitN(scanner.Text(), "\t", 2)
		if len(parts) != 2 {
			continue
		}
		switch parts[0] {
		case "cpu":
			metrics.CPUPercent, _ = strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
		case "mem":
			memParts := strings.Split(parts[1], "\t")
			if len(memParts) > 0 {
				metrics.MemoryPercent, _ = strconv.ParseFloat(strings.TrimSpace(memParts[0]), 64)
			}
			if len(memParts) > 1 {
				metrics.MemoryUsedMB, _ = strconv.ParseFloat(strings.TrimSpace(memParts[1]), 64)
			}
			if len(memParts) > 2 {
				metrics.MemoryTotalMB, _ = strconv.ParseFloat(strings.TrimSpace(memParts[2]), 64)
			}
		case "disk":
			metrics.DiskPercent, _ = strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
		case "load":
			metrics.LoadAverage = strings.TrimSpace(parts[1])
		case "host":
			metrics.Hostname = strings.TrimSpace(parts[1])
		case "kernel":
			metrics.Kernel = strings.TrimSpace(parts[1])
		case "uptime":
			metrics.Uptime = strings.TrimSpace(parts[1])
		case "procs":
			metrics.ProcessCount, _ = strconv.Atoi(strings.TrimSpace(parts[1]))
		case "diskrow":
			row := strings.Split(parts[1], "\t")
			if len(row) >= 5 {
				percent, _ := strconv.ParseFloat(strings.TrimSpace(row[4]), 64)
				metrics.DiskUsage = append(metrics.DiskUsage, DiskUsage{
					Filesystem: row[0],
					Mount:      row[1],
					Used:       row[2],
					Size:       row[3],
					Percent:    percent,
				})
			}
		case "proc":
			row := strings.Split(parts[1], "\t")
			if len(row) >= 5 {
				cpu, _ := strconv.ParseFloat(strings.TrimSpace(row[2]), 64)
				mem, _ := strconv.ParseFloat(strings.TrimSpace(row[3]), 64)
				metrics.TopProcesses = append(metrics.TopProcesses, ProcessUsage{
					PID:     row[0],
					User:    row[1],
					CPU:     cpu,
					Memory:  mem,
					Command: row[4],
				})
			}
		}
	}
	return metrics
}

func shellQuote(value string) string {
	if value == "~" {
		return value
	}
	return "'" + strings.ReplaceAll(value, "'", "'\\''") + "'"
}

func joinRemotePath(parent string, name string) string {
	if parent == "" || parent == "/" {
		return "/" + name
	}
	return strings.TrimRight(parent, "/") + "/" + name
}

func remoteParentPath(path string) string {
	trimmed := strings.TrimRight(path, "/")
	if trimmed == "" || trimmed == "/" {
		return "/"
	}
	index := strings.LastIndex(trimmed, "/")
	if index <= 0 {
		return "/"
	}
	return trimmed[:index]
}

func cleanRelativeRemotePath(value string, baseNameOnly bool) (string, error) {
	value = strings.ReplaceAll(strings.TrimSpace(value), "\\", "/")
	if baseNameOnly {
		value = pathpkg.Base(value)
	}
	cleaned := pathpkg.Clean(value)
	if cleaned == "." || cleaned == "/" || cleaned == "" || strings.HasPrefix(cleaned, "../") || cleaned == ".." || pathpkg.IsAbs(cleaned) {
		return "", fmt.Errorf("file path is required")
	}
	return cleaned, nil
}

func localDirRegularFileSize(root string) (int64, error) {
	var total int64
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.Type().IsRegular() {
			info, err := entry.Info()
			if err != nil {
				return err
			}
			total += info.Size()
		}
		return nil
	})
	return total, err
}

func writeLocalDirTar(root string, baseName string, writer *io.PipeWriter, onRead func(int)) error {
	tw := tar.NewWriter(writer)
	closeWithError := func(err error) error {
		_ = tw.Close()
		if err != nil {
			_ = writer.CloseWithError(err)
			return err
		}
		if err := writer.Close(); err != nil {
			return err
		}
		return nil
	}

	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() && !entry.Type().IsRegular() {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		tarName := filepath.ToSlash(filepath.Join(baseName, rel))
		if rel == "." {
			tarName = baseName
		}
		if entry.IsDir() {
			tarName = strings.TrimRight(tarName, "/") + "/"
		}
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = tarName
		if err := tw.WriteHeader(header); err != nil {
			return err
		}
		if !entry.Type().IsRegular() {
			return nil
		}
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		_, err = io.Copy(tw, progressReader{reader: file, onRead: onRead})
		closeErr := file.Close()
		if err != nil {
			return err
		}
		if closeErr != nil {
			return closeErr
		}
		return err
	})
	if err != nil {
		return closeWithError(err)
	}
	if err := tw.Close(); err != nil {
		_ = writer.CloseWithError(err)
		return err
	}
	return writer.Close()
}

func (a *App) nextTransferID(prefix string) string {
	n := atomic.AddUint64(&a.transferN, 1)
	return fmt.Sprintf("%s-%d", prefix, n)
}

func (a *App) emitTransfer(progress TransferProgress) {
	if progress.Percent == 0 && progress.Written > 0 {
		progress.Percent = transferPercent(progress.Written, progress.Total)
	}
	wailsruntime.EventsEmit(a.ctx, "transfer:progress", progress)
}

func transferPercent(written int64, total int64) float64 {
	if total <= 0 {
		return 0
	}
	percent := float64(written) * 100 / float64(total)
	if percent > 100 {
		return 100
	}
	if percent < 0 {
		return 0
	}
	return percent
}

type progressReader struct {
	reader io.Reader
	onRead func(int)
}

func (r progressReader) Read(p []byte) (int, error) {
	n, err := r.reader.Read(p)
	if n > 0 && r.onRead != nil {
		r.onRead(n)
	}
	return n, err
}

func detectWindowsWSLHosts() []store.Connection {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	out, err := termexec.CommandContext(ctx, "wsl.exe", "-l", "-q").Output()
	if err != nil {
		return nil
	}

	names := parseWSLDistros(out)
	if len(names) > 1 {
		names = names[:1]
	}
	hosts := make([]store.Connection, 0, len(names))
	for _, name := range names {
		user := detectWSLUser(name)
		if user == "" {
			user = os.Getenv("USERNAME")
		}
		if user == "" {
			user = "root"
		}
		hosts = append(hosts, store.Connection{
			Name:      "WSL - " + name,
			Host:      name,
			Port:      0,
			User:      user,
			Kind:      "wsl",
			WSLDistro: name,
			Env:       "dev",
			GroupName: "Local",
		})
	}
	return hosts
}

func detectWSLUser(distro string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	out, err := termexec.CommandContext(ctx, "wsl.exe", "-d", distro, "sh", "-lc", "whoami").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(decodeCommandOutput(out))
}

func parseWSLDistros(out []byte) []string {
	decoded := decodeCommandOutput(out)
	lines := strings.FieldsFunc(decoded, func(r rune) bool {
		return r == '\n' || r == '\r'
	})

	var names []string
	for _, line := range lines {
		name := strings.TrimSpace(strings.TrimSuffix(line, "\x00"))
		name = strings.TrimPrefix(name, "*")
		name = strings.TrimSpace(name)
		if name == "" || strings.EqualFold(name, "Windows Subsystem for Linux Distributions:") {
			continue
		}
		names = append(names, name)
	}
	return names
}

func decodeCommandOutput(out []byte) string {
	hasNull := false
	for _, b := range out {
		if b == 0 {
			hasNull = true
			break
		}
	}
	if !hasNull {
		return string(out)
	}

	if len(out)%2 != 0 {
		out = out[:len(out)-1]
	}
	u16 := make([]uint16, 0, len(out)/2)
	for i := 0; i+1 < len(out); i += 2 {
		v := uint16(out[i]) | uint16(out[i+1])<<8
		if v == 0xfeff {
			continue
		}
		u16 = append(u16, v)
	}
	return string(utf16.Decode(u16))
}

func isRunningInsideWSL() bool {
	data, err := os.ReadFile("/proc/version")
	if err != nil {
		return false
	}
	version := strings.ToLower(string(data))
	return strings.Contains(version, "microsoft") || strings.Contains(version, "wsl")
}
