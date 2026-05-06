package local

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

	"TermFlow/internal/termexec"
)

type Shell struct {
	Name string
	Args []string
}

type Session struct {
	ID string

	mu     sync.Mutex
	cancel context.CancelFunc
	cmd    *exec.Cmd
	pty    *os.File
	stdin  io.WriteCloser
	closed bool
}

func Connect(id string) (*Session, error) {
	shell := DefaultShell(runtime.GOOS, os.Getenv, executableExists)
	if shell.Name == "" {
		return nil, fmt.Errorf("no local shell found")
	}
	return &Session{ID: id}, nil
}

func (s *Session) Start(cols int, rows int, onData func([]byte), onExit func(error)) error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return fmt.Errorf("session %s is closed", s.ID)
	}
	if s.cmd != nil {
		s.mu.Unlock()
		return nil
	}

	shell := DefaultShell(runtime.GOOS, os.Getenv, executableExists)
	if shell.Name == "" {
		s.mu.Unlock()
		return fmt.Errorf("no local shell found")
	}

	return s.startInteractive(shell, cols, rows, onData, onExit)
}

func (s *Session) Write(data string) error {
	s.mu.Lock()
	stdin := s.stdin
	closed := s.closed
	s.mu.Unlock()

	if closed {
		return fmt.Errorf("session %s is closed", s.ID)
	}
	if stdin == nil {
		return fmt.Errorf("session %s shell is not started", s.ID)
	}
	_, err := io.WriteString(stdin, data)
	return err
}

func (s *Session) Resize(cols int, rows int) error {
	return s.resizeInteractive(cols, rows)
}

func (s *Session) Run(command string) ([]byte, error) {
	return s.RunWithInput(command, nil)
}

func (s *Session) RunWithInput(command string, input io.Reader) ([]byte, error) {
	shell := commandShell(runtime.GOOS, os.Getenv, executableExists, command)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	cmd := termexec.CommandContext(ctx, shell.Name, shell.Args...)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	if input != nil {
		cmd.Stdin = input
	}
	return cmd.CombinedOutput()
}

func (s *Session) RunToWriter(command string, output io.Writer, onWrite func(int)) ([]byte, error) {
	shell := commandShell(runtime.GOOS, os.Getenv, executableExists, command)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	cmd := termexec.CommandContext(ctx, shell.Name, shell.Args...)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}

	var stderrText strings.Builder
	errCh := make(chan error, 2)
	go func() {
		errCh <- copyWithProgress(output, stdout, onWrite)
	}()
	go func() {
		_, err := io.Copy(&stderrText, stderr)
		errCh <- err
	}()

	copyErr := <-errCh
	stderrErr := <-errCh
	waitErr := cmd.Wait()
	if copyErr != nil {
		return []byte(stderrText.String()), copyErr
	}
	if stderrErr != nil {
		return []byte(stderrText.String()), stderrErr
	}
	if waitErr != nil {
		return []byte(stderrText.String()), waitErr
	}
	return []byte(stderrText.String()), nil
}

func (s *Session) Close() error {
	s.mu.Lock()
	s.closed = true
	cancel := s.cancel
	stdin := s.stdin
	cmd := s.cmd
	ptyFile := s.pty
	s.mu.Unlock()

	if stdin != nil {
		_ = stdin.Close()
	}
	if ptyFile != nil {
		_ = ptyFile.Close()
	}
	if cancel != nil {
		cancel()
	}
	if cmd != nil && cmd.Process != nil {
		return cmd.Process.Kill()
	}
	return nil
}

func DefaultShell(goos string, getenv func(string) string, exists func(string) bool) Shell {
	switch goos {
	case "windows":
		if exists("powershell.exe") {
			return Shell{Name: "powershell.exe", Args: []string{"-NoLogo", "-NoExit"}}
		}
		return Shell{Name: "cmd.exe"}
	case "darwin":
		if shell := strings.TrimSpace(getenv("SHELL")); shell != "" {
			return Shell{Name: shell, Args: []string{"-l"}}
		}
		if exists("/bin/zsh") {
			return Shell{Name: "/bin/zsh", Args: []string{"-l"}}
		}
		return Shell{Name: "/bin/sh"}
	default:
		if shell := strings.TrimSpace(getenv("SHELL")); shell != "" {
			return Shell{Name: shell, Args: []string{"-l"}}
		}
		if exists("/bin/bash") {
			return Shell{Name: "/bin/bash", Args: []string{"-l"}}
		}
		return Shell{Name: "/bin/sh"}
	}
}

func commandShell(goos string, getenv func(string) string, exists func(string) bool, command string) Shell {
	if goos == "windows" {
		if exists("powershell.exe") {
			return Shell{Name: "powershell.exe", Args: []string{"-NoLogo", "-NoProfile", "-Command", command}}
		}
		return Shell{Name: "cmd.exe", Args: []string{"/C", command}}
	}
	shell := DefaultShell(goos, getenv, exists)
	return Shell{Name: shell.Name, Args: []string{"-lc", command}}
}

func executableExists(path string) bool {
	if strings.Contains(path, string(os.PathSeparator)) {
		info, err := os.Stat(path)
		return err == nil && !info.IsDir()
	}
	_, err := exec.LookPath(path)
	return err == nil
}

func copyOutput(reader io.Reader, onData func([]byte)) {
	buf := make([]byte, 4096)
	for {
		n, err := reader.Read(buf)
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

func copyWithProgress(dst io.Writer, src io.Reader, onWrite func(int)) error {
	buf := make([]byte, 32*1024)
	for {
		n, readErr := src.Read(buf)
		if n > 0 {
			written, writeErr := dst.Write(buf[:n])
			if written > 0 && onWrite != nil {
				onWrite(written)
			}
			if writeErr != nil {
				return writeErr
			}
			if written != n {
				return io.ErrShortWrite
			}
		}
		if readErr != nil {
			if readErr == io.EOF {
				return nil
			}
			return readErr
		}
	}
}

type waiter interface {
	Wait() error
}

func waitForExit(s *Session, w waiter, onExit func(error)) {
	err := w.Wait()
	s.mu.Lock()
	s.closed = true
	s.mu.Unlock()
	if onExit != nil {
		onExit(err)
	}
}
