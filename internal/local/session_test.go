package local

import (
	"strings"
	"testing"
	"time"
)

func TestDefaultShellForDarwinUsesShellEnv(t *testing.T) {
	shell := DefaultShell("darwin", func(key string) string {
		if key == "SHELL" {
			return "/opt/homebrew/bin/fish"
		}
		return ""
	}, func(path string) bool { return false })

	if shell.Name != "/opt/homebrew/bin/fish" {
		t.Fatalf("Name = %q, want /opt/homebrew/bin/fish", shell.Name)
	}
	if len(shell.Args) != 1 || shell.Args[0] != "-l" {
		t.Fatalf("Args = %#v, want [-l]", shell.Args)
	}
}

func TestDefaultShellForDarwinFallsBackToZsh(t *testing.T) {
	shell := DefaultShell("darwin", func(string) string { return "" }, func(path string) bool {
		return path == "/bin/zsh"
	})

	if shell.Name != "/bin/zsh" {
		t.Fatalf("Name = %q, want /bin/zsh", shell.Name)
	}
}

func TestDefaultShellForWindowsPrefersPowerShell(t *testing.T) {
	shell := DefaultShell("windows", func(string) string { return "" }, func(path string) bool {
		return path == "powershell.exe"
	})

	if shell.Name != "powershell.exe" {
		t.Fatalf("Name = %q, want powershell.exe", shell.Name)
	}
	if len(shell.Args) != 2 || shell.Args[0] != "-NoLogo" || shell.Args[1] != "-NoExit" {
		t.Fatalf("Args = %#v, want [-NoLogo -NoExit]", shell.Args)
	}
}

func TestDefaultShellForWindowsFallsBackToCmd(t *testing.T) {
	shell := DefaultShell("windows", func(string) string { return "" }, func(string) bool { return false })

	if shell.Name != "cmd.exe" {
		t.Fatalf("Name = %q, want cmd.exe", shell.Name)
	}
}

func TestSessionStartAcceptsInputAndEmitsOutput(t *testing.T) {
	t.Setenv("SHELL", "/bin/sh")
	session, err := Connect("test-local")
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()

	output := make(chan string, 16)
	exit := make(chan struct{})
	if err := session.Start(80, 24, func(data []byte) {
		output <- string(data)
	}, func(error) {
		close(exit)
	}); err != nil {
		t.Fatal(err)
	}
	if err := session.Write("echo TERMFLOW_LOCAL_OK\nexit\n"); err != nil {
		t.Fatal(err)
	}

	var combined strings.Builder
	deadline := time.After(3 * time.Second)
	for {
		select {
		case chunk := <-output:
			combined.WriteString(chunk)
			if strings.Contains(combined.String(), "TERMFLOW_LOCAL_OK") {
				return
			}
		case <-exit:
			if strings.Contains(combined.String(), "TERMFLOW_LOCAL_OK") {
				return
			}
			t.Fatalf("session exited before marker; output: %q", combined.String())
		case <-deadline:
			t.Fatalf("timed out waiting for marker; output: %q", combined.String())
		}
	}
}
