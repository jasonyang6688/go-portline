package sshclient

import (
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pkg/sftp"
	gossh "golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
	"termflow/internal/domain"
)

type ConnectRequest struct {
	Host                  string
	Port                  int
	Username              string
	AuthType              domain.AuthType
	Password              string
	KeyPath               string
	InsecureIgnoreHostKey bool
	HostKeyCallback       gossh.HostKeyCallback
}

type Runner interface {
	Connect(req ConnectRequest) (TerminalSession, error)
	Test(req ConnectRequest) error
}

type TerminalSession interface {
	Start(size domain.TerminalSize, onData func([]byte), onExit func(error)) error
	Write(data string) error
	Resize(size domain.TerminalSize) error
	Run(command string) ([]byte, error)
	ListFiles(path string) ([]domain.FileEntry, error)
	ReadFile(path string) (domain.FileContent, error)
	WriteFile(path string, content string) error
	CreateFolder(path string) error
	RenameFile(path string, newPath string) error
	DeleteFile(path string) error
	UploadFile(localPath string, remotePath string, overwrite bool) (int64, error)
	DownloadFile(remotePath string, localPath string, overwrite bool) (int64, error)
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

	s.mu.Lock()
	switch {
	case s.closed:
		s.mu.Unlock()
		return errors.New("terminal session is closed")
	case s.client == nil:
		s.mu.Unlock()
		return errors.New("terminal session client is unavailable")
	case s.shell != nil || s.stdin != nil:
		s.mu.Unlock()
		return errors.New("terminal session has already started")
	}
	client := s.client
	s.mu.Unlock()

	shell, err := client.NewSession()
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

	if err := shell.Shell(); err != nil {
		_ = shell.Close()
		return err
	}

	s.mu.Lock()
	switch {
	case s.closed || s.client == nil:
		s.mu.Unlock()
		_ = shell.Close()
		return errors.New("terminal session is closed")
	case s.shell != nil || s.stdin != nil:
		s.mu.Unlock()
		_ = shell.Close()
		return errors.New("terminal session has already started")
	}
	s.shell = shell
	s.stdin = stdin
	s.mu.Unlock()

	go copyOutput(stdout, onData)
	go copyOutput(stderr, onData)

	go func() {
		err := shell.Wait()

		s.mu.Lock()
		s.closed = true
		s.shell = nil
		s.stdin = nil
		client := s.client
		s.client = nil
		s.mu.Unlock()

		if client != nil {
			_ = client.Close()
		}
		if onExit != nil {
			onExit(err)
		}
	}()

	return nil
}

func (s *realSession) Write(data string) error {
	s.mu.Lock()
	closed := s.closed
	stdin := s.stdin
	s.mu.Unlock()

	if closed {
		return errors.New("terminal session is closed")
	}
	if stdin == nil {
		return errors.New("terminal session has not started")
	}

	_, err := io.WriteString(stdin, data)
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

func (s *realSession) Run(command string) ([]byte, error) {
	s.mu.Lock()
	closed := s.closed
	client := s.client
	s.mu.Unlock()

	if closed {
		return nil, errors.New("terminal session is closed")
	}
	if client == nil {
		return nil, errors.New("terminal session client is unavailable")
	}

	session, err := client.NewSession()
	if err != nil {
		return nil, err
	}
	defer session.Close()

	return session.CombinedOutput(command)
}

func (s *realSession) ListFiles(rawPath string) ([]domain.FileEntry, error) {
	client, err := s.newSFTPClient()
	if err != nil {
		return nil, err
	}
	defer client.Close()

	cleanPath := cleanRemotePath(rawPath)
	entries, err := client.ReadDir(cleanPath)
	if err != nil {
		return nil, err
	}

	files := make([]domain.FileEntry, 0, len(entries))
	for _, entry := range entries {
		files = append(files, domain.FileEntry{
			Name:      entry.Name(),
			Path:      path.Join(cleanPath, entry.Name()),
			Size:      entry.Size(),
			SizeLabel: sizeLabel(entry.Size(), entry.IsDir()),
			ModTime:   entry.ModTime().UTC(),
			IsDir:     entry.IsDir(),
		})
	}
	sortFileEntries(files)
	return files, nil
}

func (s *realSession) ReadFile(rawPath string) (domain.FileContent, error) {
	client, err := s.newSFTPClient()
	if err != nil {
		return domain.FileContent{}, err
	}
	defer client.Close()

	cleanPath := cleanRemotePath(rawPath)
	info, err := client.Stat(cleanPath)
	if err != nil {
		return domain.FileContent{}, err
	}
	if info.IsDir() {
		return domain.FileContent{}, errors.New("cannot read a folder")
	}

	file, err := client.Open(cleanPath)
	if err != nil {
		return domain.FileContent{}, err
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return domain.FileContent{}, err
	}
	return domain.FileContent{
		Name:    path.Base(cleanPath),
		Path:    cleanPath,
		Content: string(data),
		Size:    info.Size(),
		ModTime: info.ModTime().UTC(),
	}, nil
}

func (s *realSession) WriteFile(rawPath string, content string) error {
	client, err := s.newSFTPClient()
	if err != nil {
		return err
	}
	defer client.Close()

	cleanPath := cleanRemotePath(rawPath)
	file, err := client.OpenFile(cleanPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = io.WriteString(file, content)
	return err
}

func (s *realSession) CreateFolder(rawPath string) error {
	client, err := s.newSFTPClient()
	if err != nil {
		return err
	}
	defer client.Close()

	return client.MkdirAll(cleanRemotePath(rawPath))
}

func (s *realSession) RenameFile(rawPath string, newRawPath string) error {
	client, err := s.newSFTPClient()
	if err != nil {
		return err
	}
	defer client.Close()

	return client.Rename(cleanRemotePath(rawPath), cleanRemotePath(newRawPath))
}

func (s *realSession) DeleteFile(rawPath string) error {
	client, err := s.newSFTPClient()
	if err != nil {
		return err
	}
	defer client.Close()

	cleanPath := cleanRemotePath(rawPath)
	info, err := client.Stat(cleanPath)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return client.Remove(cleanPath)
	}
	return removeRemoteDirectory(client, cleanPath)
}

func (s *realSession) UploadFile(localPath string, remotePath string, overwrite bool) (int64, error) {
	client, err := s.newSFTPClient()
	if err != nil {
		return 0, err
	}
	defer client.Close()

	source, err := os.Open(strings.TrimSpace(localPath))
	if err != nil {
		return 0, err
	}
	defer source.Close()

	info, err := source.Stat()
	if err != nil {
		return 0, err
	}

	cleanRemotePath := cleanRemotePath(remotePath)
	if info.IsDir() {
		return uploadLocalDirectory(client, strings.TrimSpace(localPath), cleanRemotePath, overwrite)
	}
	if !overwrite {
		if _, err := client.Stat(cleanRemotePath); err == nil {
			return 0, errors.New("remote file already exists")
		} else if !os.IsNotExist(err) {
			return 0, err
		}
	}
	if err := client.MkdirAll(path.Dir(cleanRemotePath)); err != nil {
		return 0, err
	}

	destination, err := client.OpenFile(cleanRemotePath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY)
	if err != nil {
		return 0, err
	}
	defer destination.Close()

	return io.Copy(destination, source)
}

func (s *realSession) DownloadFile(remotePath string, localPath string, overwrite bool) (int64, error) {
	client, err := s.newSFTPClient()
	if err != nil {
		return 0, err
	}
	defer client.Close()

	cleanRemotePath := cleanRemotePath(remotePath)
	source, err := client.Open(cleanRemotePath)
	if err != nil {
		return 0, err
	}
	defer source.Close()

	info, err := source.Stat()
	if err != nil {
		return 0, err
	}

	cleanLocalPath := strings.TrimSpace(localPath)
	if info.IsDir() {
		return downloadRemoteDirectory(client, cleanRemotePath, cleanLocalPath, overwrite)
	}
	if !overwrite {
		if _, err := os.Stat(cleanLocalPath); err == nil {
			return 0, errors.New("local file already exists")
		} else if !os.IsNotExist(err) {
			return 0, err
		}
	}
	if err := os.MkdirAll(filepath.Dir(cleanLocalPath), 0o755); err != nil {
		return 0, err
	}

	destination, err := os.OpenFile(cleanLocalPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
	if err != nil {
		return 0, err
	}
	defer destination.Close()

	return io.Copy(destination, source)
}

func (s *realSession) Close() error {
	s.mu.Lock()
	shell := s.shell
	client := s.client
	s.closed = true
	s.stdin = nil
	s.shell = nil
	s.client = nil
	s.mu.Unlock()

	if shell != nil {
		_ = shell.Close()
	}
	if client != nil {
		return client.Close()
	}

	return nil
}

func (s *realSession) newSFTPClient() (*sftp.Client, error) {
	s.mu.Lock()
	closed := s.closed
	client := s.client
	s.mu.Unlock()

	if closed {
		return nil, errors.New("terminal session is closed")
	}
	if client == nil {
		return nil, errors.New("terminal session client is unavailable")
	}
	return sftp.NewClient(client)
}

func cleanRemotePath(rawPath string) string {
	cleaned := strings.TrimSpace(rawPath)
	if cleaned == "" {
		return "."
	}
	return path.Clean(cleaned)
}

func removeRemoteDirectory(client *sftp.Client, root string) error {
	var files []string
	var directories []string
	walker := client.Walk(root)
	for walker.Step() {
		if err := walker.Err(); err != nil {
			return err
		}
		currentPath := walker.Path()
		if currentPath == root {
			continue
		}
		if walker.Stat().IsDir() {
			directories = append(directories, currentPath)
			continue
		}
		files = append(files, currentPath)
	}

	for _, file := range files {
		if err := client.Remove(file); err != nil {
			return err
		}
	}
	for i := len(directories) - 1; i >= 0; i-- {
		if err := client.RemoveDirectory(directories[i]); err != nil {
			return err
		}
	}
	return client.RemoveDirectory(root)
}

func uploadLocalDirectory(client *sftp.Client, localRoot string, remoteRoot string, overwrite bool) (int64, error) {
	if localRoot == "" {
		return 0, errors.New("local path is required")
	}
	if !overwrite {
		if _, err := client.Stat(remoteRoot); err == nil {
			return 0, errors.New("remote folder already exists")
		} else if !os.IsNotExist(err) {
			return 0, err
		}
	}
	if err := client.MkdirAll(remoteRoot); err != nil {
		return 0, err
	}

	var bytesTransferred int64
	err := filepath.WalkDir(localRoot, func(currentPath string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if currentPath == localRoot {
			return nil
		}
		relativePath, err := filepath.Rel(localRoot, currentPath)
		if err != nil {
			return err
		}
		remotePath := path.Join(remoteRoot, filepath.ToSlash(relativePath))
		if entry.IsDir() {
			return client.MkdirAll(remotePath)
		}

		source, err := os.Open(currentPath)
		if err != nil {
			return err
		}

		if err := client.MkdirAll(path.Dir(remotePath)); err != nil {
			_ = source.Close()
			return err
		}
		destination, err := client.OpenFile(remotePath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY)
		if err != nil {
			_ = source.Close()
			return err
		}

		copied, err := io.Copy(destination, source)
		closeErr := errors.Join(destination.Close(), source.Close())
		if err != nil {
			return err
		}
		if closeErr != nil {
			return closeErr
		}
		bytesTransferred += copied
		return nil
	})
	if err != nil {
		return 0, err
	}
	return bytesTransferred, nil
}

func downloadRemoteDirectory(client *sftp.Client, remoteRoot string, localRoot string, overwrite bool) (int64, error) {
	if strings.TrimSpace(localRoot) == "" {
		return 0, errors.New("local path is required")
	}
	if !overwrite {
		if _, err := os.Stat(localRoot); err == nil {
			return 0, errors.New("local folder already exists")
		} else if !os.IsNotExist(err) {
			return 0, err
		}
	}
	if err := os.MkdirAll(localRoot, 0o755); err != nil {
		return 0, err
	}

	var bytesTransferred int64
	walker := client.Walk(remoteRoot)
	for walker.Step() {
		if err := walker.Err(); err != nil {
			return 0, err
		}
		currentPath := walker.Path()
		if currentPath == remoteRoot {
			continue
		}
		relativePath, err := relativeRemotePath(remoteRoot, currentPath)
		if err != nil {
			return 0, err
		}
		localPath := filepath.Join(localRoot, filepath.FromSlash(relativePath))
		if walker.Stat().IsDir() {
			if err := os.MkdirAll(localPath, 0o755); err != nil {
				return 0, err
			}
			continue
		}

		source, err := client.Open(currentPath)
		if err != nil {
			return 0, err
		}
		if err := os.MkdirAll(filepath.Dir(localPath), 0o755); err != nil {
			_ = source.Close()
			return 0, err
		}
		destination, err := os.OpenFile(localPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
		if err != nil {
			_ = source.Close()
			return 0, err
		}
		copied, copyErr := io.Copy(destination, source)
		closeErr := errors.Join(destination.Close(), source.Close())
		if copyErr != nil {
			return 0, copyErr
		}
		if closeErr != nil {
			return 0, closeErr
		}
		bytesTransferred += copied
	}
	return bytesTransferred, nil
}

func relativeRemotePath(root string, currentPath string) (string, error) {
	if currentPath == root || !strings.HasPrefix(currentPath, root+"/") {
		return "", fmt.Errorf("remote path %q is outside %q", currentPath, root)
	}
	return strings.TrimPrefix(currentPath, root+"/"), nil
}

func sortFileEntries(files []domain.FileEntry) {
	sort.Slice(files, func(i, j int) bool {
		if files[i].IsDir != files[j].IsDir {
			return files[i].IsDir
		}
		return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
	})
}

func sizeLabel(size int64, isDir bool) string {
	if isDir {
		return "folder"
	}
	if size < 1024 {
		return fmt.Sprintf("%d B", size)
	}
	units := []string{"KB", "MB", "GB", "TB"}
	value := float64(size) / 1024
	for _, unit := range units {
		if value < 1024 {
			return fmt.Sprintf("%.1f %s", value, unit)
		}
		value /= 1024
	}
	return fmt.Sprintf("%.1f PB", value)
}

func buildClientConfig(req ConnectRequest) (*gossh.ClientConfig, error) {
	auth, err := authMethods(req)
	if err != nil {
		return nil, err
	}

	hostKeyCallback, err := hostKeyCallback(req)
	if err != nil {
		return nil, err
	}

	return &gossh.ClientConfig{
		User:            strings.TrimSpace(req.Username),
		Auth:            auth,
		HostKeyCallback: hostKeyCallback,
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

		if req.Password == "" {
			signer, err := gossh.ParsePrivateKey(key)
			if err != nil {
				return nil, err
			}

			return []gossh.AuthMethod{gossh.PublicKeys(signer)}, nil
		}

		signer, err := gossh.ParsePrivateKeyWithPassphrase(key, []byte(req.Password))
		if err != nil {
			plainSigner, plainErr := gossh.ParsePrivateKey(key)
			if plainErr != nil {
				return nil, err
			}
			signer = plainSigner
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

func hostKeyCallback(req ConnectRequest) (gossh.HostKeyCallback, error) {
	if req.HostKeyCallback != nil {
		return req.HostKeyCallback, nil
	}
	if req.InsecureIgnoreHostKey {
		return gossh.InsecureIgnoreHostKey(), nil
	}

	path, err := defaultKnownHostsPath()
	if err != nil {
		return nil, err
	}

	callback, err := knownhosts.New(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf(
				"ssh host key verification requires a known_hosts file at %s; create it, provide HostKeyCallback, or set InsecureIgnoreHostKey for development-only connections: %w",
				path,
				err,
			)
		}

		return nil, fmt.Errorf("load known_hosts from %s: %w", path, err)
	}

	return callback, nil
}

func defaultKnownHostsPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf(
			"ssh host key verification requires ~/.ssh/known_hosts; provide HostKeyCallback or set InsecureIgnoreHostKey for development-only connections: %w",
			err,
		)
	}
	if strings.TrimSpace(home) == "" {
		return "", errors.New(
			"ssh host key verification requires ~/.ssh/known_hosts; provide HostKeyCallback or set InsecureIgnoreHostKey for development-only connections",
		)
	}

	return filepath.Join(home, ".ssh", "known_hosts"), nil
}

func address(req ConnectRequest) string {
	port := req.Port
	if port == 0 {
		port = 22
	}

	return net.JoinHostPort(req.Host, strconv.Itoa(port))
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
