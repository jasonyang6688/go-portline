//go:build !darwin

package local

import (
	"context"
	"os"
	"os/exec"

	"TermFlow/internal/termexec"
)

func (s *Session) startInteractive(shell Shell, cols int, rows int, onData func([]byte), onExit func(error)) error {
	ctx, cancel := context.WithCancel(context.Background())
	cmd := commandContext(ctx, shell)
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
	go waitForExit(s, cmdWaiter{wait: cmd.Wait}, onExit)
	return nil
}

func (s *Session) resizeInteractive(cols int, rows int) error {
	return nil
}

func commandContext(ctx context.Context, shell Shell) *exec.Cmd {
	cmd := termexec.CommandContext(ctx, shell.Name, shell.Args...)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	return cmd
}

type cmdWaiter struct {
	wait func() error
}

func (w cmdWaiter) Wait() error {
	return w.wait()
}
