package appsvc

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

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
	onData         func([]byte)
	onExit         func(error)
	writes         []string
	runs           []string
	runOut         []byte
	files          []domain.FileEntry
	fileContent    domain.FileContent
	savedPath      string
	savedContent   string
	createdFolder  string
	renamedFrom    string
	renamedTo      string
	deletedPath    string
	uploadedLocal  string
	uploadedRemote string
	downloadRemote string
	downloadLocal  string
}

func (s *fakeTerminalSession) Start(_ domain.TerminalSize, onData func([]byte), onExit func(error)) error {
	s.onData = onData
	s.onExit = onExit
	return nil
}

func (s *fakeTerminalSession) Write(data string) error {
	s.writes = append(s.writes, data)
	return nil
}

func (s *fakeTerminalSession) Resize(domain.TerminalSize) error { return nil }

func (s *fakeTerminalSession) Close() error { return nil }

func (s *fakeTerminalSession) Run(command string) ([]byte, error) {
	s.runs = append(s.runs, command)
	return s.runOut, nil
}

func (s *fakeTerminalSession) ListFiles(string) ([]domain.FileEntry, error) {
	return s.files, nil
}

func (s *fakeTerminalSession) ReadFile(string) (domain.FileContent, error) {
	return s.fileContent, nil
}

func (s *fakeTerminalSession) WriteFile(path string, content string) error {
	s.savedPath = path
	s.savedContent = content
	return nil
}

func (s *fakeTerminalSession) CreateFolder(path string) error {
	s.createdFolder = path
	return nil
}

func (s *fakeTerminalSession) RenameFile(path string, newPath string) error {
	s.renamedFrom = path
	s.renamedTo = newPath
	return nil
}

func (s *fakeTerminalSession) DeleteFile(path string) error {
	s.deletedPath = path
	return nil
}

func (s *fakeTerminalSession) UploadFile(localPath string, remotePath string, _ bool) (int64, error) {
	s.uploadedLocal = localPath
	s.uploadedRemote = remotePath
	return 12, nil
}

func (s *fakeTerminalSession) DownloadFile(remotePath string, localPath string, _ bool) (int64, error) {
	s.downloadRemote = remotePath
	s.downloadLocal = localPath
	return 34, nil
}

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

func TestOpenSessionUsesStoredPasswordWhenInputPasswordEmpty(t *testing.T) {
	store := newTestStore(t)
	storedPassword := "stored-test-password"
	conn, err := store.SaveConnection(domain.SaveConnectionInput{
		Name:     "stored-password",
		Host:     "stored.example.com",
		Port:     22,
		Username: "deploy",
		AuthType: domain.AuthPassword,
		Password: storedPassword,
		Group:    "SSH Servers",
	})
	if err != nil {
		t.Fatalf("SaveConnection() error = %v", err)
	}

	runner := &fakeRunner{session: &fakeTerminalSession{}}
	registry := sessions.NewRegistry(runner, nil)
	service := NewService(store, registry, runner)

	if _, err := service.OpenSession(domain.OpenSessionInput{
		ConnectionID:          conn.ID,
		InsecureIgnoreHostKey: true,
	}); err != nil {
		t.Fatalf("OpenSession() error = %v", err)
	}
	if len(runner.connectReqs) != 1 {
		t.Fatalf("runner Connect calls = %d, want 1", len(runner.connectReqs))
	}
	if runner.connectReqs[0].Password != storedPassword {
		t.Fatalf("Connect password = %q, want %q", runner.connectReqs[0].Password, storedPassword)
	}
}

func TestOpenSessionUsesStoredInsecureHostKeyFlag(t *testing.T) {
	store := newTestStore(t)
	conn, err := store.SaveConnection(domain.SaveConnectionInput{
		Name:                  "trusted-host",
		Host:                  "trusted.example.com",
		Port:                  22,
		Username:              "deploy",
		AuthType:              domain.AuthPassword,
		Password:              "secret",
		InsecureIgnoreHostKey: true,
		Group:                 "SSH Servers",
	})
	if err != nil {
		t.Fatalf("SaveConnection() error = %v", err)
	}

	runner := &fakeRunner{session: &fakeTerminalSession{}}
	registry := sessions.NewRegistry(runner, nil)
	service := NewService(store, registry, runner)

	if _, err := service.OpenSession(domain.OpenSessionInput{ConnectionID: conn.ID}); err != nil {
		t.Fatalf("OpenSession() error = %v", err)
	}
	if len(runner.connectReqs) != 1 {
		t.Fatalf("runner Connect calls = %d, want 1", len(runner.connectReqs))
	}
	if !runner.connectReqs[0].InsecureIgnoreHostKey {
		t.Fatalf("Connect request = %#v, want saved insecure host key flag", runner.connectReqs[0])
	}
}

func TestRunCommandWritesTerminalAndRecordsHistory(t *testing.T) {
	store := newTestStore(t)
	conn := saveTestConnection(t, store)
	term := &fakeTerminalSession{}
	runner := &fakeRunner{session: term}
	registry := sessions.NewRegistry(runner, nil)
	service := NewService(store, registry, runner)
	session, err := service.OpenSession(domain.OpenSessionInput{
		ConnectionID:          conn.ID,
		Password:              "secret",
		InsecureIgnoreHostKey: true,
	})
	if err != nil {
		t.Fatalf("OpenSession() error = %v", err)
	}

	if err := service.RunCommand(domain.RunCommandInput{SessionID: session.ID, Command: "  uptime  "}); err != nil {
		t.Fatalf("RunCommand() error = %v", err)
	}
	if len(term.writes) != 1 || term.writes[0] != "uptime\r" {
		t.Fatalf("terminal writes = %#v, want uptime carriage return", term.writes)
	}

	history, err := service.ListCommandHistory(domain.CommandHistoryFilter{ConnectionID: conn.ID, Limit: 10})
	if err != nil {
		t.Fatalf("ListCommandHistory() error = %v", err)
	}
	if len(history) != 1 || history[0].Command != "uptime" || history[0].SessionID != session.ID {
		t.Fatalf("history = %#v, want recorded uptime for session", history)
	}
}

func TestListSavedCommandsReturnsStoredCommandsOnly(t *testing.T) {
	store := newTestStore(t)
	service := NewService(store, nil, nil)

	commands, err := service.ListSavedCommands()
	if err != nil {
		t.Fatalf("ListSavedCommands(empty) error = %v", err)
	}
	if len(commands) != 0 {
		t.Fatalf("commands length = %d, want no implicit defaults", len(commands))
	}

	saved, err := service.SaveSavedCommand(domain.SaveSavedCommandInput{
		Name:        "Check disk",
		Command:     "df -h",
		Description: "Show mounted filesystem usage",
		Tags:        []string{"global"},
	})
	if err != nil {
		t.Fatalf("SaveSavedCommand() error = %v", err)
	}

	commands, err = service.ListSavedCommands()
	if err != nil {
		t.Fatalf("ListSavedCommands(saved) error = %v", err)
	}
	if len(commands) != 1 || commands[0].ID != saved.ID || commands[0].Command != "df -h" {
		t.Fatalf("commands = %#v, want only saved command", commands)
	}
}

func TestRecordCommandHistoryUsesSessionConnection(t *testing.T) {
	store := newTestStore(t)
	conn := saveTestConnection(t, store)
	term := &fakeTerminalSession{}
	runner := &fakeRunner{session: term}
	registry := sessions.NewRegistry(runner, nil)
	service := NewService(store, registry, runner)
	session, err := service.OpenSession(domain.OpenSessionInput{
		ConnectionID:          conn.ID,
		Password:              "secret",
		InsecureIgnoreHostKey: true,
	})
	if err != nil {
		t.Fatalf("OpenSession() error = %v", err)
	}

	if err := service.RecordCommandHistory(session.ID, "  whoami  "); err != nil {
		t.Fatalf("RecordCommandHistory() error = %v", err)
	}

	history, err := service.ListCommandHistory(domain.CommandHistoryFilter{ConnectionID: conn.ID, Limit: 10})
	if err != nil {
		t.Fatalf("ListCommandHistory() error = %v", err)
	}
	if len(history) != 1 || history[0].Command != "whoami" || history[0].ConnectionName != session.Name {
		t.Fatalf("history = %#v, want recorded whoami for session connection", history)
	}
}

func TestRunCommandBroadcastsToAllSessions(t *testing.T) {
	store := newTestStore(t)
	connA := saveTestConnection(t, store)
	connB, err := store.SaveConnection(domain.SaveConnectionInput{
		Name:     "staging",
		Host:     "staging.example.com",
		Port:     22,
		Username: "deploy",
		AuthType: domain.AuthPassword,
	})
	if err != nil {
		t.Fatalf("SaveConnection(staging) error = %v", err)
	}

	termA := &fakeTerminalSession{}
	termB := &fakeTerminalSession{}
	runner := &fakeRunner{session: termA}
	registry := sessions.NewRegistry(runner, nil)
	service := NewService(store, registry, runner)
	sessionA, err := service.OpenSession(domain.OpenSessionInput{ConnectionID: connA.ID, Password: "secret", InsecureIgnoreHostKey: true})
	if err != nil {
		t.Fatalf("OpenSession(A) error = %v", err)
	}
	runner.session = termB
	if _, err := service.OpenSession(domain.OpenSessionInput{ConnectionID: connB.ID, Password: "secret", InsecureIgnoreHostKey: true}); err != nil {
		t.Fatalf("OpenSession(B) error = %v", err)
	}

	if err := service.RunCommand(domain.RunCommandInput{SessionID: sessionA.ID, Command: "hostname", Broadcast: true}); err != nil {
		t.Fatalf("RunCommand(broadcast) error = %v", err)
	}
	if len(termA.writes) != 1 || termA.writes[0] != "hostname\r" {
		t.Fatalf("termA writes = %#v, want hostname", termA.writes)
	}
	if len(termB.writes) != 1 || termB.writes[0] != "hostname\r" {
		t.Fatalf("termB writes = %#v, want hostname", termB.writes)
	}
}

func TestListFilesUsesSFTPFileListing(t *testing.T) {
	store := newTestStore(t)
	conn := saveTestConnection(t, store)
	term := &fakeTerminalSession{files: []domain.FileEntry{{
		Name:      "app",
		Path:      "/var/www/app",
		SizeLabel: "folder",
		IsDir:     true,
	}, {
		Name:      "nginx.conf",
		Path:      "/var/www/nginx.conf",
		Size:      847,
		SizeLabel: "847 B",
		ModTime:   time.Date(2026, 6, 12, 1, 3, 3, 0, time.UTC),
	}}}
	runner := &fakeRunner{session: term}
	registry := sessions.NewRegistry(runner, nil)
	service := NewService(store, registry, runner)
	session, err := service.OpenSession(domain.OpenSessionInput{ConnectionID: conn.ID, Password: "secret", InsecureIgnoreHostKey: true})
	if err != nil {
		t.Fatalf("OpenSession() error = %v", err)
	}

	files, err := service.ListFiles(domain.FileListInput{SessionID: session.ID, Side: domain.FileSideRemote, Path: "/var/www"})
	if err != nil {
		t.Fatalf("ListFiles(remote) error = %v", err)
	}
	if len(files) != 2 || !files[0].IsDir || files[1].Name != "nginx.conf" || files[1].Size != 847 {
		t.Fatalf("files = %#v, want SFTP listing", files)
	}
}

func TestLocalFileOperationsReadSaveCreateRenameDelete(t *testing.T) {
	service := NewService(nil, nil, nil)
	root := t.TempDir()
	filePath := filepath.Join(root, "main.go")
	if err := os.WriteFile(filePath, []byte("package main\n"), 0o644); err != nil {
		t.Fatalf("WriteFile() setup error = %v", err)
	}

	content, err := service.ReadFile(domain.FileReadInput{Side: domain.FileSideLocal, Path: filePath})
	if err != nil {
		t.Fatalf("ReadFile(local) error = %v", err)
	}
	if content.Content != "package main\n" || content.Language != "go" || content.IsBinary {
		t.Fatalf("content = %#v, want Go text content", content)
	}

	if err := service.SaveFile(domain.FileSaveInput{Side: domain.FileSideLocal, Path: filePath, Content: "package edited\n"}); err != nil {
		t.Fatalf("SaveFile(local) error = %v", err)
	}
	saved, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("ReadFile(saved) error = %v", err)
	}
	if string(saved) != "package edited\n" {
		t.Fatalf("saved content = %q, want edited package", string(saved))
	}

	folderPath := filepath.Join(root, "nested", "folder")
	if err := service.CreateFolder(domain.FileMutationInput{Side: domain.FileSideLocal, Path: folderPath}); err != nil {
		t.Fatalf("CreateFolder(local) error = %v", err)
	}
	if info, err := os.Stat(folderPath); err != nil || !info.IsDir() {
		t.Fatalf("created folder stat = %#v, %v", info, err)
	}

	lowercaseFolderPath := filepath.Join(root, "lowercase-folder")
	if err := service.CreateFolder(domain.FileMutationInput{Side: domain.FileSideLocal, Path: lowercaseFolderPath}); err != nil {
		t.Fatalf("CreateFolder(local lowercase) error = %v", err)
	}
	files, err := service.ListFiles(domain.FileListInput{Side: domain.FileSideLocal, Path: root})
	if err != nil {
		t.Fatalf("ListFiles(local) error = %v", err)
	}
	foundLowercaseFolder := false
	for _, file := range files {
		if file.Name == "lowercase-folder" && file.IsDir {
			foundLowercaseFolder = true
			break
		}
	}
	if !foundLowercaseFolder {
		t.Fatalf("ListFiles(local) missing lowercase-folder directory: %#v", files)
	}

	renamedLowercaseFolderPath := filepath.Join(root, "renamed-lowercase-folder")
	if err := service.RenameFile(domain.FileRenameInput{Side: domain.FileSideLocal, Path: lowercaseFolderPath, NewPath: renamedLowercaseFolderPath}); err != nil {
		t.Fatalf("RenameFile(local lowercase folder) error = %v", err)
	}
	files, err = service.ListFiles(domain.FileListInput{Side: domain.FileSideLocal, Path: root})
	if err != nil {
		t.Fatalf("ListFiles(local after rename) error = %v", err)
	}
	foundRenamedLowercaseFolder := false
	for _, file := range files {
		if file.Name == "renamed-lowercase-folder" && file.IsDir {
			foundRenamedLowercaseFolder = true
			break
		}
	}
	if !foundRenamedLowercaseFolder {
		t.Fatalf("ListFiles(local) missing renamed-lowercase-folder directory: %#v", files)
	}

	newPath := filepath.Join(root, "renamed.go")
	if err := service.RenameFile(domain.FileRenameInput{Side: domain.FileSideLocal, Path: filePath, NewPath: newPath}); err != nil {
		t.Fatalf("RenameFile(local) error = %v", err)
	}
	if _, err := os.Stat(newPath); err != nil {
		t.Fatalf("renamed file missing: %v", err)
	}

	if err := service.DeleteFile(domain.FileMutationInput{Side: domain.FileSideLocal, Path: newPath}); err != nil {
		t.Fatalf("DeleteFile(local) error = %v", err)
	}
	if _, err := os.Stat(newPath); !os.IsNotExist(err) {
		t.Fatalf("deleted file stat error = %v, want not exist", err)
	}
}

func TestRemoteFileOperationsUseActiveSessionSFTP(t *testing.T) {
	store := newTestStore(t)
	conn := saveTestConnection(t, store)
	term := &fakeTerminalSession{fileContent: domain.FileContent{
		Name:    "app.ts",
		Path:    "/srv/app.ts",
		Content: "const ok = true;\n",
		Size:    17,
		ModTime: time.Now().UTC(),
	}}
	runner := &fakeRunner{session: term}
	registry := sessions.NewRegistry(runner, nil)
	service := NewService(store, registry, runner)
	session, err := service.OpenSession(domain.OpenSessionInput{ConnectionID: conn.ID, Password: "secret", InsecureIgnoreHostKey: true})
	if err != nil {
		t.Fatalf("OpenSession() error = %v", err)
	}

	content, err := service.ReadFile(domain.FileReadInput{SessionID: session.ID, Side: domain.FileSideRemote, Path: "/srv/app.ts"})
	if err != nil {
		t.Fatalf("ReadFile(remote) error = %v", err)
	}
	if content.Language != "typescript" || content.Content != "const ok = true;\n" {
		t.Fatalf("remote content = %#v, want TypeScript content", content)
	}

	if err := service.SaveFile(domain.FileSaveInput{SessionID: session.ID, Side: domain.FileSideRemote, Path: "/srv/app.ts", Content: "const ok = false;\n"}); err != nil {
		t.Fatalf("SaveFile(remote) error = %v", err)
	}
	if term.savedPath != "/srv/app.ts" || term.savedContent != "const ok = false;\n" {
		t.Fatalf("saved remote = %q %q", term.savedPath, term.savedContent)
	}

	if err := service.CreateFolder(domain.FileMutationInput{SessionID: session.ID, Side: domain.FileSideRemote, Path: "/srv/new"}); err != nil {
		t.Fatalf("CreateFolder(remote) error = %v", err)
	}
	if term.createdFolder != "/srv/new" {
		t.Fatalf("createdFolder = %q, want /srv/new", term.createdFolder)
	}

	if err := service.RenameFile(domain.FileRenameInput{SessionID: session.ID, Side: domain.FileSideRemote, Path: "/srv/old", NewPath: "/srv/new-name"}); err != nil {
		t.Fatalf("RenameFile(remote) error = %v", err)
	}
	if term.renamedFrom != "/srv/old" || term.renamedTo != "/srv/new-name" {
		t.Fatalf("renamed = %q -> %q", term.renamedFrom, term.renamedTo)
	}

	if err := service.DeleteFile(domain.FileMutationInput{SessionID: session.ID, Side: domain.FileSideRemote, Path: "/srv/new-name"}); err != nil {
		t.Fatalf("DeleteFile(remote) error = %v", err)
	}
	if term.deletedPath != "/srv/new-name" {
		t.Fatalf("deletedPath = %q, want /srv/new-name", term.deletedPath)
	}
}

func TestTransferFileUsesSFTPDirection(t *testing.T) {
	store := newTestStore(t)
	conn := saveTestConnection(t, store)
	term := &fakeTerminalSession{}
	runner := &fakeRunner{session: term}
	registry := sessions.NewRegistry(runner, nil)
	service := NewService(store, registry, runner)
	session, err := service.OpenSession(domain.OpenSessionInput{ConnectionID: conn.ID, Password: "secret", InsecureIgnoreHostKey: true})
	if err != nil {
		t.Fatalf("OpenSession() error = %v", err)
	}

	uploaded, err := service.TransferFile(domain.FileTransferInput{
		SessionID:  session.ID,
		Direction:  domain.FileTransferUpload,
		LocalPath:  "/tmp/app.log",
		RemotePath: "/var/log/app.log",
		Overwrite:  true,
	})
	if err != nil {
		t.Fatalf("TransferFile(upload) error = %v", err)
	}
	if uploaded.BytesTransferred != 12 || term.uploadedLocal != "/tmp/app.log" || term.uploadedRemote != "/var/log/app.log" {
		t.Fatalf("uploaded = %#v, term = %#v", uploaded, term)
	}

	downloaded, err := service.TransferFile(domain.FileTransferInput{
		SessionID:  session.ID,
		Direction:  domain.FileTransferDownload,
		LocalPath:  "/tmp/nginx.conf",
		RemotePath: "/etc/nginx/nginx.conf",
		Overwrite:  true,
	})
	if err != nil {
		t.Fatalf("TransferFile(download) error = %v", err)
	}
	if downloaded.BytesTransferred != 34 || term.downloadRemote != "/etc/nginx/nginx.conf" || term.downloadLocal != "/tmp/nginx.conf" {
		t.Fatalf("downloaded = %#v, term = %#v", downloaded, term)
	}
}

func TestMonitorSnapshotUsesSessionCommandOutput(t *testing.T) {
	store := newTestStore(t)
	conn := saveTestConnection(t, store)
	term := &fakeTerminalSession{
		runOut: []byte("cpu=18\nmem=62\ndisk=41\nload=0.62 0.58 0.49\nproc=nginx\t1235\t4.1\t5.8M\n"),
	}
	runner := &fakeRunner{session: term}
	registry := sessions.NewRegistry(runner, nil)
	service := NewService(store, registry, runner)
	session, err := service.OpenSession(domain.OpenSessionInput{ConnectionID: conn.ID, Password: "secret", InsecureIgnoreHostKey: true})
	if err != nil {
		t.Fatalf("OpenSession() error = %v", err)
	}

	snapshot, err := service.GetMonitorSnapshot(session.ID)
	if err != nil {
		t.Fatalf("GetMonitorSnapshot() error = %v", err)
	}
	if snapshot.CPUPercent != 18 || snapshot.MemoryPercent != 62 || snapshot.DiskPercent != 41 || snapshot.LoadAverage != "0.62 0.58 0.49" {
		t.Fatalf("snapshot = %#v, want parsed metrics", snapshot)
	}
	if len(snapshot.Processes) != 1 || snapshot.Processes[0].Name != "nginx" || snapshot.Processes[0].PID != 1235 {
		t.Fatalf("snapshot processes = %#v, want nginx", snapshot.Processes)
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
