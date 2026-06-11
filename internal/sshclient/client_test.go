package sshclient

import (
	"testing"

	"termflow/internal/domain"
)

func TestBuildConfigRejectsMissingAuth(t *testing.T) {
	_, err := buildClientConfig(ConnectRequest{
		Username: "root",
		AuthType: domain.AuthPassword,
	})
	if err == nil {
		t.Fatal("buildClientConfig() error = nil, want missing password error")
	}
}

func TestNormalizeSize(t *testing.T) {
	size := NormalizeSize(domain.TerminalSize{})
	if size.Cols != 120 || size.Rows != 32 {
		t.Fatalf("NormalizeSize(empty) = %+v, want 120x32", size)
	}
}
