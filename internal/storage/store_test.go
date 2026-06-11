package storage

import (
	"path/filepath"
	"testing"

	"termflow/internal/domain"
)

func TestConnectionCRUD(t *testing.T) {
	store, err := New(filepath.Join(t.TempDir(), "termflow.db"))
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	defer store.Close()

	saved, err := store.SaveConnection(domain.SaveConnectionInput{
		Name:     "prod-01",
		Host:     "10.0.1.100",
		Port:     22,
		Username: "root",
		AuthType: domain.AuthKey,
		KeyPath:  "/Users/test/.ssh/id_ed25519",
		Group:    "Production",
		Tags:     []string{"prod", "linux"},
	})
	if err != nil {
		t.Fatalf("SaveConnection() error = %v", err)
	}
	if saved.ID == "" {
		t.Fatal("SaveConnection() returned empty ID")
	}

	list, err := store.ListConnections()
	if err != nil {
		t.Fatalf("ListConnections() error = %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("ListConnections() length = %d, want 1", len(list))
	}
	if list[0].Name != "prod-01" {
		t.Fatalf("stored connection = %+v, want prod-01", list[0])
	}

	updated, err := store.SaveConnection(domain.SaveConnectionInput{
		ID:       saved.ID,
		Name:     "prod-main",
		Host:     "10.0.1.100",
		Port:     2222,
		Username: "deploy",
		AuthType: domain.AuthPassword,
		Group:    "Production",
	})
	if err != nil {
		t.Fatalf("SaveConnection(update) error = %v", err)
	}
	if updated.ID != saved.ID {
		t.Fatalf("updated ID = %q, want %q", updated.ID, saved.ID)
	}

	got, err := store.GetConnection(saved.ID)
	if err != nil {
		t.Fatalf("GetConnection() error = %v", err)
	}
	if got.Name != "prod-main" || got.Port != 2222 || got.Username != "deploy" {
		t.Fatalf("GetConnection() = %+v, want updated values", got)
	}

	if err := store.DeleteConnection(saved.ID); err != nil {
		t.Fatalf("DeleteConnection() error = %v", err)
	}
	list, err = store.ListConnections()
	if err != nil {
		t.Fatalf("ListConnections(after delete) error = %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("ListConnections(after delete) length = %d, want 0", len(list))
	}
}
