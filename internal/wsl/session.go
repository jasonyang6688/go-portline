package wsl

import (
	"context"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"sync"
	"time"

	"TermFlow/internal/termexec"
)

type Session struct {
	ID     string
	Distro string

	mu     sync.Mutex
	cancel context.CancelFunc
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	closed bool
}

func Connect(id string, distro string) (*Session, error) {
	if distro == "" {
		return nil, fmt.Errorf("wsl distro is required")
	}
	return &Session{ID: id, Distro: distro}, nil
}

func (s *Session) Start(cols int, rows int, colorScheme string, onData func([]byte), onExit func(error)) error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return fmt.Errorf("session %s is closed", s.ID)
	}
	if s.cmd != nil {
		s.mu.Unlock()
		return nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	cmd := termexec.CommandContext(ctx, "wsl.exe", "-d", s.Distro, "--cd", "~", "--exec", "sh", "-lc", wslShellCommand(cols, rows, colorScheme))
	stdin, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		s.mu.Unlock()
		return err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		s.mu.Unlock()
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		s.mu.Unlock()
		return err
	}
	if err := cmd.Start(); err != nil {
		cancel()
		s.mu.Unlock()
		return err
	}

	s.cancel = cancel
	s.cmd = cmd
	s.stdin = stdin
	s.mu.Unlock()

	go copyOutput(stdout, onData)
	go copyOutput(stderr, onData)
	go func() {
		err := cmd.Wait()
		s.mu.Lock()
		s.closed = true
		s.mu.Unlock()
		if onExit != nil {
			onExit(err)
		}
	}()

	return nil
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
	return nil
}

func (s *Session) Run(command string) ([]byte, error) {
	return s.RunWithInput(command, nil)
}

func (s *Session) RunWithInput(command string, input io.Reader) ([]byte, error) {
	if s.Distro == "" {
		return nil, fmt.Errorf("wsl distro is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	cmd := termexec.CommandContext(ctx, "wsl.exe", "-d", s.Distro, "--cd", "~", "--exec", "sh", "-lc", command)
	if input != nil {
		cmd.Stdin = input
	}
	return cmd.CombinedOutput()
}

func (s *Session) RunToWriter(command string, output io.Writer, onWrite func(int)) ([]byte, error) {
	if s.Distro == "" {
		return nil, fmt.Errorf("wsl distro is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	cmd := termexec.CommandContext(ctx, "wsl.exe", "-d", s.Distro, "--cd", "~", "--exec", "sh", "-lc", command)
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

func wslShellCommand(cols int, rows int, colorScheme string) string {
	if cols <= 0 {
		cols = 120
	}
	if rows <= 0 {
		rows = 32
	}

	colorFGBG := "15;0"
	if strings.EqualFold(strings.TrimSpace(colorScheme), "light") {
		colorFGBG = "0;15"
		colorScheme = "light"
	} else {
		colorScheme = "dark"
	}

	inner := fmt.Sprintf("TERM=xterm-256color; COLORTERM=truecolor; TERM_PROGRAM=TermFlow; COLORFGBG=%s; TERMFLOW_COLOR_SCHEME=%s; export TERM COLORTERM TERM_PROGRAM COLORFGBG TERMFLOW_COLOR_SCHEME; stty rows %d cols %d 2>/dev/null; exec ${SHELL:-/bin/bash} -i", colorFGBG, colorScheme, rows, cols)
	return fmt.Sprintf("if command -v script >/dev/null 2>&1; then exec script -qfec %q /dev/null; fi; %s", inner, inner)
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

func (s *Session) Close() error {
	s.mu.Lock()
	s.closed = true
	cancel := s.cancel
	stdin := s.stdin
	process := (*exec.Cmd)(nil)
	if s.cmd != nil {
		process = s.cmd
	}
	s.mu.Unlock()

	if stdin != nil {
		_ = stdin.Close()
	}
	if cancel != nil {
		cancel()
	}
	if process != nil && process.Process != nil {
		return process.Process.Kill()
	}
	return nil
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
