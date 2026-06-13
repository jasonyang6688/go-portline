package appsvc

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

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

const maxEditableFileSize = 2 * 1024 * 1024

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

func (s *Service) RunCommand(input domain.RunCommandInput) error {
	if s == nil || s.registry == nil {
		return errRegistryUnavailable
	}
	if s.store == nil {
		return errStoreUnavailable
	}

	command := strings.TrimSpace(input.Command)
	if command == "" {
		return errors.New("command is required")
	}

	sessionsToWrite := []domain.Session{}
	if input.Broadcast {
		sessionsToWrite = s.registry.Sessions()
	} else {
		session, err := s.registry.Snapshot(strings.TrimSpace(input.SessionID))
		if err != nil {
			return err
		}
		sessionsToWrite = append(sessionsToWrite, session)
	}
	if len(sessionsToWrite) == 0 {
		return errors.New("no active sessions")
	}

	for _, session := range sessionsToWrite {
		if err := s.registry.Write(session.ID, command+"\r"); err != nil {
			return err
		}
		if _, err := s.store.SaveCommandHistory(domain.SaveCommandHistoryInput{
			SessionID:      session.ID,
			ConnectionID:   session.ConnectionID,
			ConnectionName: session.Name,
			Command:        command,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) ListCommandHistory(filter domain.CommandHistoryFilter) ([]domain.CommandHistoryEntry, error) {
	if s == nil || s.store == nil {
		return nil, errStoreUnavailable
	}
	return s.store.ListCommandHistory(filter)
}

func (s *Service) ClearCommandHistory(connectionID string) error {
	if s == nil || s.store == nil {
		return errStoreUnavailable
	}
	return s.store.ClearCommandHistory(connectionID)
}

func (s *Service) ListSavedCommands() ([]domain.SavedCommand, error) {
	if s == nil || s.store == nil {
		return nil, errStoreUnavailable
	}
	commands, err := s.store.ListSavedCommands()
	if err != nil {
		return nil, err
	}
	if len(commands) > 0 {
		return commands, nil
	}
	return seedDefaultCommands(s.store)
}

func (s *Service) SaveSavedCommand(input domain.SaveSavedCommandInput) (domain.SavedCommand, error) {
	if s == nil || s.store == nil {
		return domain.SavedCommand{}, errStoreUnavailable
	}
	return s.store.SaveSavedCommand(input)
}

func (s *Service) DeleteSavedCommand(id string) error {
	if s == nil || s.store == nil {
		return errStoreUnavailable
	}
	return s.store.DeleteSavedCommand(id)
}

func (s *Service) GetSettings() (domain.AppSettings, error) {
	if s == nil || s.store == nil {
		return domain.AppSettings{}, errStoreUnavailable
	}
	return s.store.GetSettings()
}

func (s *Service) SaveSettings(input domain.AppSettings) (domain.AppSettings, error) {
	if s == nil || s.store == nil {
		return domain.AppSettings{}, errStoreUnavailable
	}
	return s.store.SaveSettings(input)
}

func (s *Service) ListFiles(input domain.FileListInput) ([]domain.FileEntry, error) {
	if input.Side == "" || input.Side == domain.FileSideLocal {
		return listLocalFiles(input.Path)
	}
	if input.Side != domain.FileSideRemote {
		return nil, fmt.Errorf("unsupported file side %q", input.Side)
	}
	if s == nil || s.registry == nil {
		return nil, errRegistryUnavailable
	}
	sessionID := strings.TrimSpace(input.SessionID)
	if sessionID == "" {
		return nil, errors.New("session id is required")
	}
	path := strings.TrimSpace(input.Path)
	if path == "" {
		path = "."
	}
	return s.registry.ListFiles(sessionID, path)
}

func (s *Service) ReadFile(input domain.FileReadInput) (domain.FileContent, error) {
	path, err := requiredPath(input.Path)
	if err != nil {
		return domain.FileContent{}, err
	}
	if input.Side == "" || input.Side == domain.FileSideLocal {
		return readLocalFile(path)
	}
	if input.Side != domain.FileSideRemote {
		return domain.FileContent{}, fmt.Errorf("unsupported file side %q", input.Side)
	}
	sessionID, err := requiredSessionID(input.SessionID)
	if err != nil {
		return domain.FileContent{}, err
	}
	if s == nil || s.registry == nil {
		return domain.FileContent{}, errRegistryUnavailable
	}
	content, err := s.registry.ReadFile(sessionID, path)
	if err != nil {
		return domain.FileContent{}, err
	}
	return prepareFileContent(content), nil
}

func (s *Service) SaveFile(input domain.FileSaveInput) error {
	path, err := requiredPath(input.Path)
	if err != nil {
		return err
	}
	if input.Side == "" || input.Side == domain.FileSideLocal {
		return os.WriteFile(path, []byte(input.Content), 0o644)
	}
	if input.Side != domain.FileSideRemote {
		return fmt.Errorf("unsupported file side %q", input.Side)
	}
	sessionID, err := requiredSessionID(input.SessionID)
	if err != nil {
		return err
	}
	if s == nil || s.registry == nil {
		return errRegistryUnavailable
	}
	return s.registry.WriteFile(sessionID, path, input.Content)
}

func (s *Service) CreateFolder(input domain.FileMutationInput) error {
	path, err := requiredPath(input.Path)
	if err != nil {
		return err
	}
	if input.Side == "" || input.Side == domain.FileSideLocal {
		return os.MkdirAll(path, 0o755)
	}
	if input.Side != domain.FileSideRemote {
		return fmt.Errorf("unsupported file side %q", input.Side)
	}
	sessionID, err := requiredSessionID(input.SessionID)
	if err != nil {
		return err
	}
	if s == nil || s.registry == nil {
		return errRegistryUnavailable
	}
	return s.registry.CreateFolder(sessionID, path)
}

func (s *Service) RenameFile(input domain.FileRenameInput) error {
	path, err := requiredPath(input.Path)
	if err != nil {
		return err
	}
	newPath, err := requiredPath(input.NewPath)
	if err != nil {
		return err
	}
	if input.Side == "" || input.Side == domain.FileSideLocal {
		return os.Rename(path, newPath)
	}
	if input.Side != domain.FileSideRemote {
		return fmt.Errorf("unsupported file side %q", input.Side)
	}
	sessionID, err := requiredSessionID(input.SessionID)
	if err != nil {
		return err
	}
	if s == nil || s.registry == nil {
		return errRegistryUnavailable
	}
	return s.registry.RenameFile(sessionID, path, newPath)
}

func (s *Service) DeleteFile(input domain.FileMutationInput) error {
	path, err := requiredPath(input.Path)
	if err != nil {
		return err
	}
	if input.Side == "" || input.Side == domain.FileSideLocal {
		return os.RemoveAll(path)
	}
	if input.Side != domain.FileSideRemote {
		return fmt.Errorf("unsupported file side %q", input.Side)
	}
	sessionID, err := requiredSessionID(input.SessionID)
	if err != nil {
		return err
	}
	if s == nil || s.registry == nil {
		return errRegistryUnavailable
	}
	return s.registry.DeleteFile(sessionID, path)
}

func (s *Service) TransferFile(input domain.FileTransferInput) (domain.FileTransferResult, error) {
	sessionID, err := requiredSessionID(input.SessionID)
	if err != nil {
		return domain.FileTransferResult{}, err
	}
	localPath, err := requiredPath(input.LocalPath)
	if err != nil {
		return domain.FileTransferResult{}, fmt.Errorf("local path: %w", err)
	}
	remotePath, err := requiredPath(input.RemotePath)
	if err != nil {
		return domain.FileTransferResult{}, fmt.Errorf("remote path: %w", err)
	}
	if s == nil || s.registry == nil {
		return domain.FileTransferResult{}, errRegistryUnavailable
	}

	var bytesTransferred int64
	switch input.Direction {
	case domain.FileTransferUpload:
		bytesTransferred, err = s.registry.UploadFile(sessionID, localPath, remotePath, input.Overwrite)
	case domain.FileTransferDownload:
		bytesTransferred, err = s.registry.DownloadFile(sessionID, remotePath, localPath, input.Overwrite)
	default:
		return domain.FileTransferResult{}, fmt.Errorf("unsupported transfer direction %q", input.Direction)
	}
	if err != nil {
		return domain.FileTransferResult{}, err
	}
	return domain.FileTransferResult{
		Direction:        input.Direction,
		LocalPath:        localPath,
		RemotePath:       remotePath,
		BytesTransferred: bytesTransferred,
	}, nil
}

func (s *Service) GetMonitorSnapshot(sessionID string) (domain.MonitorSnapshot, error) {
	if s == nil || s.registry == nil {
		return domain.MonitorSnapshot{}, errRegistryUnavailable
	}
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return domain.MonitorSnapshot{}, errors.New("session id is required")
	}
	out, err := s.registry.Run(sessionID, monitorCommand())
	if err != nil {
		return domain.MonitorSnapshot{}, err
	}
	snapshot := parseMonitorSnapshot(sessionID, string(out))
	snapshot.UpdatedAt = time.Now().UTC()
	return snapshot, nil
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

func seedDefaultCommands(store *storage.Store) ([]domain.SavedCommand, error) {
	defaults := []domain.SaveSavedCommandInput{
		{Name: "Check nginx status", Command: "systemctl status nginx", Description: "View nginx service status and recent logs", Tags: []string{"global", "server"}},
		{Name: "Tail access log", Command: "tail -f /var/log/nginx/access.log", Description: "Stream nginx access log in real time", Tags: []string{"global", "log"}},
		{Name: "Check disk usage", Command: "df -h", Description: "Show mounted filesystem usage", Tags: []string{"global"}},
		{Name: "Docker containers", Command: `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`, Description: "List running containers with ports", Tags: []string{"global", "docker"}},
	}
	for _, command := range defaults {
		if _, err := store.SaveSavedCommand(command); err != nil {
			return nil, err
		}
	}
	return store.ListSavedCommands()
}

func listLocalFiles(path string) ([]domain.FileEntry, error) {
	if strings.TrimSpace(path) == "" {
		path = "."
	}
	cleanPath, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(cleanPath)
	if err != nil {
		return nil, err
	}

	files := make([]domain.FileEntry, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			return nil, err
		}
		files = append(files, domain.FileEntry{
			Name:      entry.Name(),
			Path:      filepath.Join(cleanPath, entry.Name()),
			Size:      info.Size(),
			SizeLabel: sizeLabel(info.Size(), entry.IsDir()),
			ModTime:   info.ModTime().UTC(),
			IsDir:     entry.IsDir(),
		})
	}
	sort.Slice(files, func(i, j int) bool {
		if files[i].IsDir != files[j].IsDir {
			return files[i].IsDir
		}
		return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
	})
	return files, nil
}

func readLocalFile(path string) (domain.FileContent, error) {
	info, err := os.Stat(path)
	if err != nil {
		return domain.FileContent{}, err
	}
	if info.IsDir() {
		return domain.FileContent{}, errors.New("cannot read a folder")
	}
	if info.Size() > maxEditableFileSize {
		return domain.FileContent{}, fmt.Errorf("file is too large to edit; limit is %s", sizeLabel(maxEditableFileSize, false))
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return domain.FileContent{}, err
	}
	return prepareFileContent(domain.FileContent{
		Name:    filepath.Base(path),
		Path:    path,
		Content: string(data),
		Size:    info.Size(),
		ModTime: info.ModTime().UTC(),
	}), nil
}

func prepareFileContent(content domain.FileContent) domain.FileContent {
	content.Language = detectLanguage(content.Path)
	data := []byte(content.Content)
	if isBinaryContent(data) {
		content.Content = ""
		content.IsBinary = true
		return content
	}
	if int64(len(data)) > maxEditableFileSize {
		content.Content = ""
		content.IsBinary = true
		return content
	}
	return content
}

func isBinaryContent(data []byte) bool {
	if len(data) == 0 {
		return false
	}
	for _, b := range data {
		if b == 0 {
			return true
		}
	}
	return !utf8.Valid(data)
}

func detectLanguage(path string) string {
	name := strings.ToLower(filepath.Base(path))
	switch name {
	case "dockerfile", "makefile":
		return name
	}
	switch strings.ToLower(filepath.Ext(name)) {
	case ".go":
		return "go"
	case ".ts", ".tsx":
		return "typescript"
	case ".js", ".jsx", ".mjs", ".cjs":
		return "javascript"
	case ".json":
		return "json"
	case ".md", ".markdown":
		return "markdown"
	case ".sh", ".bash", ".zsh":
		return "shell"
	case ".yaml", ".yml":
		return "yaml"
	case ".css":
		return "css"
	case ".html", ".htm":
		return "html"
	case ".py":
		return "python"
	case ".rs":
		return "rust"
	case ".java":
		return "java"
	case ".rb":
		return "ruby"
	case ".sql":
		return "sql"
	case ".toml":
		return "toml"
	case ".xml":
		return "xml"
	default:
		return "text"
	}
}

func requiredPath(path string) (string, error) {
	cleanPath := strings.TrimSpace(path)
	if cleanPath == "" {
		return "", errors.New("path is required")
	}
	return cleanPath, nil
}

func requiredSessionID(sessionID string) (string, error) {
	cleanSessionID := strings.TrimSpace(sessionID)
	if cleanSessionID == "" {
		return "", errors.New("session id is required")
	}
	return cleanSessionID, nil
}

func remoteListCommand(path string) string {
	quotedPath := shellQuote(path)
	return "cd -- " + quotedPath + " && " +
		"for f in .* *; do " +
		"[ \"$f\" = . ] || [ \"$f\" = .. ] || [ -e \"$f\" ] || continue; " +
		"if [ -d \"$f\" ]; then kind=d; size=0; else kind=f; size=$(wc -c < \"$f\" 2>/dev/null | tr -d ' '); fi; " +
		"mod=$(date -u -r \"$f\" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo 1970-01-01T00:00:00Z); " +
		"printf '%s\\t%s\\t%s\\t%s\\n' \"$kind\" \"$f\" \"${size:-0}\" \"$mod\"; " +
		"done"
}

func parseRemoteFiles(basePath string, raw string) ([]domain.FileEntry, error) {
	var files []domain.FileEntry
	for _, line := range strings.Split(raw, "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) < 4 {
			continue
		}
		size, _ := strconv.ParseInt(strings.TrimSpace(parts[2]), 10, 64)
		modTime, err := time.Parse(time.RFC3339, strings.TrimSpace(parts[3]))
		if err != nil {
			modTime = time.Time{}
		}
		name := parts[1]
		isDir := parts[0] == "d"
		files = append(files, domain.FileEntry{
			Name:      name,
			Path:      strings.TrimRight(basePath, "/") + "/" + name,
			Size:      size,
			SizeLabel: sizeLabel(size, isDir),
			ModTime:   modTime,
			IsDir:     isDir,
		})
	}
	sort.Slice(files, func(i, j int) bool {
		if files[i].IsDir != files[j].IsDir {
			return files[i].IsDir
		}
		return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
	})
	return files, nil
}

func monitorCommand() string {
	return `cpu=$(top -bn1 2>/dev/null | awk -F'id,' '/Cpu/ { split($1,a,","); v=a[length(a)]; gsub(/[^0-9.]/,"",v); printf "%.0f", 100-v }'); ` +
		`mem=$(free 2>/dev/null | awk '/Mem:/ { printf "%.0f", ($3/$2)*100 }'); ` +
		`disk=$(df -P / 2>/dev/null | awk 'NR==2 { gsub("%","",$5); print $5 }'); ` +
		`load=$(cat /proc/loadavg 2>/dev/null | awk '{print $1" "$2" "$3"}'); ` +
		`echo cpu=${cpu:-0}; echo mem=${mem:-0}; echo disk=${disk:-0}; echo load=${load:-unknown}; ` +
		`ps -eo comm,pid,pcpu,pmem,rss --sort=-pcpu 2>/dev/null | awk 'NR>1 && NR<8 { printf "proc=%s\t%s\t%s\t%.1fM\t%s\n", $1, $2, $3, $5/1024, $4 }'`
}

func parseMonitorSnapshot(sessionID string, raw string) domain.MonitorSnapshot {
	snapshot := domain.MonitorSnapshot{SessionID: sessionID}
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(line, "cpu="):
			snapshot.CPUPercent = parseIntPercent(strings.TrimPrefix(line, "cpu="))
		case strings.HasPrefix(line, "mem="):
			snapshot.MemoryPercent = parseIntPercent(strings.TrimPrefix(line, "mem="))
		case strings.HasPrefix(line, "disk="):
			snapshot.DiskPercent = parseIntPercent(strings.TrimPrefix(line, "disk="))
		case strings.HasPrefix(line, "load="):
			snapshot.LoadAverage = strings.TrimSpace(strings.TrimPrefix(line, "load="))
		case strings.HasPrefix(line, "proc="):
			parts := strings.Split(strings.TrimPrefix(line, "proc="), "\t")
			if len(parts) < 4 {
				continue
			}
			pid, _ := strconv.Atoi(parts[1])
			cpu, _ := strconv.ParseFloat(parts[2], 64)
			var memPercent float64
			if len(parts) >= 5 {
				memPercent, _ = strconv.ParseFloat(parts[4], 64)
			}
			snapshot.Processes = append(snapshot.Processes, domain.ProcessMetric{
				Name:          parts[0],
				PID:           pid,
				CPUPercent:    cpu,
				Memory:        parts[3],
				MemoryPercent: memPercent,
			})
		}
	}
	if snapshot.LoadAverage == "" {
		snapshot.LoadAverage = "unknown"
	}
	return snapshot
}

func parseIntPercent(value string) int {
	parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil {
		return 0
	}
	if parsed < 0 {
		return 0
	}
	if parsed > 100 {
		return 100
	}
	return int(parsed + 0.5)
}

func sizeLabel(size int64, isDir bool) string {
	if isDir {
		return "--"
	}
	const unit = 1024
	if size < unit {
		return fmt.Sprintf("%d B", size)
	}
	value := float64(size)
	for _, suffix := range []string{"KB", "MB", "GB", "TB"} {
		value /= unit
		if value < unit {
			return fmt.Sprintf("%.1f %s", value, suffix)
		}
	}
	return fmt.Sprintf("%.1f PB", value/unit)
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\\''") + "'"
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
