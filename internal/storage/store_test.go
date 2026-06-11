package storage

import (
	"database/sql"
	"errors"
	"path/filepath"
	"reflect"
	"testing"

	"termflow/internal/domain"
)

func TestConnectionCRUD(t *testing.T) {
	store := newTestStore(t)

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
	if saved.CreatedAt.IsZero() {
		t.Fatal("SaveConnection() returned zero CreatedAt")
	}
	if saved.UpdatedAt.IsZero() {
		t.Fatal("SaveConnection() returned zero UpdatedAt")
	}
	if !reflect.DeepEqual(saved.Tags, []string{"prod", "linux"}) {
		t.Fatalf("SaveConnection() tags = %#v, want %#v", saved.Tags, []string{"prod", "linux"})
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
	if !reflect.DeepEqual(list[0].Tags, []string{"prod", "linux"}) {
		t.Fatalf("ListConnections() tags = %#v, want %#v", list[0].Tags, []string{"prod", "linux"})
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
	if updated.CreatedAt.IsZero() || updated.UpdatedAt.IsZero() {
		t.Fatalf("updated connection timestamps = created %v updated %v, want non-zero", updated.CreatedAt, updated.UpdatedAt)
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

func TestSaveConnectionNilTagsStoredAsEmptyArray(t *testing.T) {
	store := newTestStore(t)

	saved, err := store.SaveConnection(domain.SaveConnectionInput{
		Name:     "staging-01",
		Host:     "10.0.2.10",
		Port:     22,
		Username: "deploy",
	})
	if err != nil {
		t.Fatalf("SaveConnection() error = %v", err)
	}
	if saved.Tags == nil {
		t.Fatal("SaveConnection() tags = nil, want empty slice")
	}
	if len(saved.Tags) != 0 {
		t.Fatalf("SaveConnection() tags length = %d, want 0", len(saved.Tags))
	}

	tagsJSON := rawTagsJSON(t, store, saved.ID)
	if tagsJSON != "[]" {
		t.Fatalf("stored tags_json = %q, want []", tagsJSON)
	}

	got, err := store.GetConnection(saved.ID)
	if err != nil {
		t.Fatalf("GetConnection() error = %v", err)
	}
	if got.Tags == nil {
		t.Fatal("GetConnection() tags = nil, want empty slice")
	}
	if len(got.Tags) != 0 {
		t.Fatalf("GetConnection() tags length = %d, want 0", len(got.Tags))
	}
}

func TestSaveConnectionWhitespaceOnlyIDCreatesRecord(t *testing.T) {
	store := newTestStore(t)

	saved, err := store.SaveConnection(domain.SaveConnectionInput{
		ID:       "  \n\t  ",
		Name:     "qa-01",
		Host:     "10.0.3.20",
		Port:     22,
		Username: "qa",
	})
	if err != nil {
		t.Fatalf("SaveConnection() error = %v", err)
	}
	if saved.ID == "" {
		t.Fatal("SaveConnection() returned empty ID for whitespace-only input ID")
	}

	list, err := store.ListConnections()
	if err != nil {
		t.Fatalf("ListConnections() error = %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("ListConnections() length = %d, want 1", len(list))
	}
	if list[0].ID != saved.ID {
		t.Fatalf("created ID = %q, want %q", list[0].ID, saved.ID)
	}
}

func TestSaveConnectionUpdateMissingIDReturnsError(t *testing.T) {
	store := newTestStore(t)

	_, err := store.SaveConnection(domain.SaveConnectionInput{
		ID:       "missing-id",
		Name:     "missing",
		Host:     "10.0.4.30",
		Port:     22,
		Username: "ghost",
	})
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("SaveConnection() error = %v, want %v", err, sql.ErrNoRows)
	}
}

func newTestStore(t *testing.T) *Store {
	t.Helper()

	store, err := New(filepath.Join(t.TempDir(), "termflow.db"))
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	t.Cleanup(func() {
		if err := store.Close(); err != nil {
			t.Fatalf("Close() error = %v", err)
		}
	})
	return store
}

func rawTagsJSON(t *testing.T, store *Store, id string) string {
	t.Helper()

	var tagsJSON string
	if err := store.db.QueryRow(`SELECT tags_json FROM connections WHERE id=?`, id).Scan(&tagsJSON); err != nil {
		t.Fatalf("QueryRow(tags_json) error = %v", err)
	}
	return tagsJSON
}
