//go:build darwin

package local

/*
#include <stdlib.h>
#include <errno.h>
#include <util.h>

static int termflow_openpty(int *amaster, int *aslave) {
	return openpty(amaster, aslave, NULL, NULL, NULL);
}

static int termflow_errno(void) {
	return errno;
}
*/
import "C"

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"syscall"
	"unsafe"

	"TermFlow/internal/termexec"
)

func (s *Session) startInteractive(shell Shell, cols int, rows int, onData func([]byte), onExit func(error)) error {
	master, slave, err := openPTY()
	if err != nil {
		s.mu.Unlock()
		return err
	}
	if err := setPTYSize(master, cols, rows); err != nil {
		_ = master.Close()
		_ = slave.Close()
		s.mu.Unlock()
		return err
	}

	ctx, cancel := context.WithCancel(context.Background())
	cmd := termexec.CommandContext(ctx, shell.Name, shell.Args...)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	cmd.Stdin = slave
	cmd.Stdout = slave
	cmd.Stderr = slave
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setsid:  true,
		Setctty: true,
		Ctty:    0,
	}
	if err := cmd.Start(); err != nil {
		cancel()
		_ = master.Close()
		_ = slave.Close()
		s.mu.Unlock()
		return err
	}
	_ = slave.Close()

	s.cancel = cancel
	s.cmd = cmd
	s.pty = master
	s.stdin = master
	s.mu.Unlock()

	go copyOutput(master, onData)
	go waitForExit(s, cmdWaiter{wait: cmd.Wait}, onExit)
	return nil
}

func (s *Session) resizeInteractive(cols int, rows int) error {
	s.mu.Lock()
	ptyFile := s.pty
	s.mu.Unlock()
	if ptyFile == nil {
		return nil
	}
	return setPTYSize(ptyFile, cols, rows)
}

func openPTY() (*os.File, *os.File, error) {
	var master C.int
	var slave C.int
	if C.termflow_openpty(&master, &slave) != 0 {
		return nil, nil, fmt.Errorf("open pty: %w", syscall.Errno(C.termflow_errno()))
	}
	return os.NewFile(uintptr(master), "/dev/ptmx"), os.NewFile(uintptr(slave), "/dev/tty"), nil
}

func setPTYSize(file *os.File, cols int, rows int) error {
	if cols <= 0 {
		cols = 120
	}
	if rows <= 0 {
		rows = 32
	}
	size := struct {
		Row    uint16
		Col    uint16
		Xpixel uint16
		Ypixel uint16
	}{Row: uint16(rows), Col: uint16(cols)}
	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL, file.Fd(), uintptr(syscall.TIOCSWINSZ), uintptr(unsafe.Pointer(&size)))
	if errno != 0 {
		return errno
	}
	return nil
}

type cmdWaiter struct {
	wait func() error
}

func (w cmdWaiter) Wait() error {
	return w.wait()
}

var _ io.ReadWriter = (*os.File)(nil)
var _ = exec.ErrNotFound
