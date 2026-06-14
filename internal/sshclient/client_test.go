package sshclient

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	gossh "golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
	"termflow/internal/domain"
)

func TestBuildClientConfigRejectsMissingAuth(t *testing.T) {
	_, err := buildClientConfig(ConnectRequest{
		Username: "root",
		AuthType: domain.AuthPassword,
	})
	if err == nil {
		t.Fatal("buildClientConfig() error = nil, want missing password error")
	}
}

func TestBuildClientConfigRejectsMissingKnownHostsByDefault(t *testing.T) {
	setTestHomeDir(t, t.TempDir())

	_, err := buildClientConfig(ConnectRequest{
		Username: "root",
		AuthType: domain.AuthPassword,
		Password: "secret",
	})
	if err == nil {
		t.Fatal("buildClientConfig() error = nil, want known_hosts error")
	}
	if !strings.Contains(err.Error(), "known_hosts") || !strings.Contains(err.Error(), "InsecureIgnoreHostKey") {
		t.Fatalf("buildClientConfig() error = %q, want known_hosts guidance", err)
	}
}

func TestBuildClientConfigAllowsExplicitInsecureOptIn(t *testing.T) {
	setTestHomeDir(t, t.TempDir())

	cfg, err := buildClientConfig(ConnectRequest{
		Username:              "root",
		AuthType:              domain.AuthPassword,
		Password:              "secret",
		InsecureIgnoreHostKey: true,
	})
	if err != nil {
		t.Fatalf("buildClientConfig() error = %v", err)
	}
	if cfg.HostKeyCallback == nil {
		t.Fatal("buildClientConfig() HostKeyCallback = nil")
	}
}

func TestBuildClientConfigUsesKnownHostsByDefault(t *testing.T) {
	home := t.TempDir()
	setTestHomeDir(t, home)

	sshDir := filepath.Join(home, ".ssh")
	if err := os.MkdirAll(sshDir, 0o755); err != nil {
		t.Fatalf("MkdirAll(.ssh) error = %v", err)
	}

	signer := mustNewSigner(t)
	line := knownhosts.Line([]string{"example.com"}, signer.PublicKey()) + "\n"
	if err := os.WriteFile(filepath.Join(sshDir, "known_hosts"), []byte(line), 0o600); err != nil {
		t.Fatalf("WriteFile(known_hosts) error = %v", err)
	}

	cfg, err := buildClientConfig(ConnectRequest{
		Username: "root",
		AuthType: domain.AuthPassword,
		Password: "secret",
	})
	if err != nil {
		t.Fatalf("buildClientConfig() error = %v", err)
	}
	if cfg.HostKeyCallback == nil {
		t.Fatal("buildClientConfig() HostKeyCallback = nil")
	}
}

func TestAuthMethods(t *testing.T) {
	plainPath, encryptedPath, correctPassphrase := writeTestPrivateKeys(t)

	tests := []struct {
		name            string
		req             ConnectRequest
		wantErrContains string
		wantErrIs       error
	}{
		{
			name: "unencrypted key with empty passphrase",
			req: ConnectRequest{
				AuthType: domain.AuthKey,
				KeyPath:  plainPath,
			},
		},
		{
			name: "encrypted key with correct passphrase",
			req: ConnectRequest{
				AuthType: domain.AuthKey,
				KeyPath:  encryptedPath,
				Password: correctPassphrase,
			},
		},
		{
			name: "encrypted key with wrong passphrase",
			req: ConnectRequest{
				AuthType: domain.AuthKey,
				KeyPath:  encryptedPath,
				Password: "wrong-passphrase",
			},
			wantErrContains: "incorrect",
		},
		{
			name: "unencrypted key with non-empty passphrase falls back",
			req: ConnectRequest{
				AuthType: domain.AuthKey,
				KeyPath:  plainPath,
				Password: "unused-passphrase",
			},
		},
		{
			name: "missing key path",
			req: ConnectRequest{
				AuthType: domain.AuthKey,
				KeyPath:  filepath.Join(t.TempDir(), "missing.pem"),
			},
			wantErrIs: os.ErrNotExist,
		},
		{
			name: "unsupported agent auth",
			req: ConnectRequest{
				AuthType: domain.AuthAgent,
			},
			wantErrContains: "not implemented",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			auth, err := authMethods(tt.req)
			if tt.wantErrContains != "" || tt.wantErrIs != nil {
				if err == nil {
					t.Fatalf("authMethods() error = nil, want error")
				}
				if tt.wantErrContains != "" && !strings.Contains(strings.ToLower(err.Error()), tt.wantErrContains) {
					t.Fatalf("authMethods() error = %q, want substring %q", err, tt.wantErrContains)
				}
				if tt.wantErrIs != nil && !errors.Is(err, tt.wantErrIs) {
					t.Fatalf("authMethods() error = %v, want errors.Is(_, %v)", err, tt.wantErrIs)
				}

				var missingErr *gossh.PassphraseMissingError
				if tt.name == "encrypted key with wrong passphrase" && errors.As(err, &missingErr) {
					t.Fatalf("authMethods() error = %T, want preserved wrong-passphrase error", err)
				}
				return
			}

			if err != nil {
				t.Fatalf("authMethods() error = %v", err)
			}
			if len(auth) != 1 {
				t.Fatalf("authMethods() len = %d, want 1", len(auth))
			}
		})
	}
}

func TestAddress(t *testing.T) {
	tests := []struct {
		name string
		req  ConnectRequest
		want string
	}{
		{
			name: "default port",
			req: ConnectRequest{
				Host: "example.com",
			},
			want: "example.com:22",
		},
		{
			name: "custom port",
			req: ConnectRequest{
				Host: "example.com",
				Port: 2222,
			},
			want: "example.com:2222",
		},
		{
			name: "ipv6 literal",
			req: ConnectRequest{
				Host: "2001:db8::1",
				Port: 2222,
			},
			want: "[2001:db8::1]:2222",
		},
		{
			name: "ipv4 literal",
			req: ConnectRequest{
				Host: "192.0.2.10",
				Port: 2222,
			},
			want: "192.0.2.10:2222",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := address(tt.req); got != tt.want {
				t.Fatalf("address() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestRealSessionStartAfterCloseReturnsError(t *testing.T) {
	session := &realSession{}

	if err := session.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}

	err := session.Start(domain.TerminalSize{}, nil, nil)
	if err == nil {
		t.Fatal("Start() error = nil, want closed session error")
	}
	if !strings.Contains(err.Error(), "closed") {
		t.Fatalf("Start() error = %q, want closed session message", err)
	}
}

func TestNormalizeSize(t *testing.T) {
	size := NormalizeSize(domain.TerminalSize{})
	if size.Cols != 120 || size.Rows != 32 {
		t.Fatalf("NormalizeSize(empty) = %+v, want 120x32", size)
	}
}

func TestCopyOutputCopiesChunkData(t *testing.T) {
	var chunks [][]byte

	copyOutput(&chunkReader{chunks: [][]byte{
		[]byte("ab"),
		[]byte("cd"),
	}}, func(data []byte) {
		chunks = append(chunks, data)
	})

	if len(chunks) != 2 {
		t.Fatalf("copyOutput() chunk count = %d, want 2", len(chunks))
	}
	if string(chunks[0]) != "ab" {
		t.Fatalf("copyOutput() first chunk = %q, want %q", chunks[0], "ab")
	}
	if string(chunks[1]) != "cd" {
		t.Fatalf("copyOutput() second chunk = %q, want %q", chunks[1], "cd")
	}
}

func TestRelativeRemotePathRejectsPrefixSiblings(t *testing.T) {
	relativePath, err := relativeRemotePath("/srv/app", "/srv/app/assets/main.css")
	if err != nil {
		t.Fatalf("relativeRemotePath() error = %v", err)
	}
	if relativePath != "assets/main.css" {
		t.Fatalf("relativePath = %q, want assets/main.css", relativePath)
	}

	if _, err := relativeRemotePath("/srv/app", "/srv/application/config.yml"); err == nil {
		t.Fatal("relativeRemotePath() error = nil, want sibling prefix rejection")
	}
}

type chunkReader struct {
	chunks [][]byte
	index  int
}

func (r *chunkReader) Read(dst []byte) (int, error) {
	if r.index >= len(r.chunks) {
		return 0, io.EOF
	}

	chunk := r.chunks[r.index]
	r.index++
	copy(dst, chunk)
	return len(chunk), nil
}

func setTestHomeDir(t *testing.T, home string) {
	t.Helper()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
}

func writeTestPrivateKeys(t *testing.T) (string, string, string) {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}

	keyBytes := x509.MarshalPKCS1PrivateKey(key)
	plainPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: keyBytes,
	})

	passphrase := "correct horse battery staple"
	encryptedBlock, err := x509.EncryptPEMBlock(rand.Reader, "RSA PRIVATE KEY", keyBytes, []byte(passphrase), x509.PEMCipherAES256)
	if err != nil {
		t.Fatalf("EncryptPEMBlock() error = %v", err)
	}
	encryptedPEM := pem.EncodeToMemory(encryptedBlock)

	dir := t.TempDir()
	plainPath := filepath.Join(dir, "plain.pem")
	if err := os.WriteFile(plainPath, plainPEM, 0o600); err != nil {
		t.Fatalf("WriteFile(plain.pem) error = %v", err)
	}

	encryptedPath := filepath.Join(dir, "encrypted.pem")
	if err := os.WriteFile(encryptedPath, encryptedPEM, 0o600); err != nil {
		t.Fatalf("WriteFile(encrypted.pem) error = %v", err)
	}

	return plainPath, encryptedPath, passphrase
}

func mustNewSigner(t *testing.T) gossh.Signer {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}

	signer, err := gossh.NewSignerFromKey(key)
	if err != nil {
		t.Fatalf("NewSignerFromKey() error = %v", err)
	}

	return signer
}
