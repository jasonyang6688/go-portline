package sshclient

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

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

	shell, err := s.client.NewSession()
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
	if s.closed {
		s.mu.Unlock()
		_ = shell.Close()
		return errors.New("terminal session is closed")
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
		s.mu.Unlock()

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

func (s *realSession) Close() error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil
	}

	s.closed = true
	shell := s.shell
	s.stdin = nil
	s.shell = nil
	client := s.client
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

	return fmt.Sprintf("%s:%d", req.Host, port)
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
