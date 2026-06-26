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
		Name:                  "prod-01",
		Host:                  "10.0.1.100",
		Port:                  22,
		Username:              "root",
		AuthType:              domain.AuthKey,
		Password:              "secret",
		KeyPath:               "/Users/test/.ssh/id_ed25519",
		InsecureIgnoreHostKey: true,
		Group:                 "Production",
		Tags:                  []string{"prod", "linux"},
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
	if saved.Password != "secret" {
		t.Fatalf("SaveConnection() password = %q, want secret", saved.Password)
	}
	if !saved.InsecureIgnoreHostKey {
		t.Fatal("SaveConnection() insecure ignore host key = false, want true")
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
		ID:                    saved.ID,
		Name:                  "prod-main",
		Host:                  "10.0.1.100",
		Port:                  2222,
		Username:              "deploy",
		AuthType:              domain.AuthPassword,
		Password:              "new-secret",
		InsecureIgnoreHostKey: false,
		Group:                 "Production",
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
	if got.Password != "new-secret" {
		t.Fatalf("GetConnection() password = %q, want new-secret", got.Password)
	}
	if got.InsecureIgnoreHostKey {
		t.Fatal("GetConnection() insecure ignore host key = true, want false after update")
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

func TestCommandHistoryCRUD(t *testing.T) {
	store := newTestStore(t)

	first, err := store.SaveCommandHistory(domain.SaveCommandHistoryInput{
		SessionID:      "s1",
		ConnectionID:   "c1",
		ConnectionName: "prod-01",
		Command:        "  uptime  ",
	})
	if err != nil {
		t.Fatalf("SaveCommandHistory(first) error = %v", err)
	}
	second, err := store.SaveCommandHistory(domain.SaveCommandHistoryInput{
		SessionID:      "s1",
		ConnectionID:   "c1",
		ConnectionName: "prod-01",
		Command:        "df -h",
	})
	if err != nil {
		t.Fatalf("SaveCommandHistory(second) error = %v", err)
	}
	if first.ID == "" || second.ID == "" || first.ID == second.ID {
		t.Fatalf("history IDs = (%q, %q), want distinct non-empty IDs", first.ID, second.ID)
	}
	if first.Command != "uptime" {
		t.Fatalf("first command = %q, want trimmed uptime", first.Command)
	}

	history, err := store.ListCommandHistory(domain.CommandHistoryFilter{ConnectionID: "c1", Limit: 10})
	if err != nil {
		t.Fatalf("ListCommandHistory() error = %v", err)
	}
	if len(history) != 2 {
		t.Fatalf("history length = %d, want 2", len(history))
	}
	if history[0].Command != "df -h" || history[1].Command != "uptime" {
		t.Fatalf("history order = %#v, want newest first", history)
	}

	if err := store.ClearCommandHistory("c1"); err != nil {
		t.Fatalf("ClearCommandHistory() error = %v", err)
	}
	history, err = store.ListCommandHistory(domain.CommandHistoryFilter{ConnectionID: "c1", Limit: 10})
	if err != nil {
		t.Fatalf("ListCommandHistory(after clear) error = %v", err)
	}
	if len(history) != 0 {
		t.Fatalf("history length after clear = %d, want 0", len(history))
	}
}

func TestMonitorHistoryCRUD(t *testing.T) {
	store := newTestStore(t)

	first, err := store.SaveMonitorHistory(domain.SaveMonitorHistoryInput{
		SessionID:     "s1",
		ConnectionID:  "c1",
		CPUPercent:    42,
		MemoryPercent: 61,
		DiskPercent:   77,
		LoadAverage:   "1.20 1.10 1.02",
		AlertLevel:    "ok",
	})
	if err != nil {
		t.Fatalf("SaveMonitorHistory(first) error = %v", err)
	}
	second, err := store.SaveMonitorHistory(domain.SaveMonitorHistoryInput{
		SessionID:     "s1",
		ConnectionID:  "c1",
		CPUPercent:    91,
		MemoryPercent: 88,
		DiskPercent:   92,
		LoadAverage:   "8.00 6.00 4.00",
		AlertLevel:    "critical",
	})
	if err != nil {
		t.Fatalf("SaveMonitorHistory(second) error = %v", err)
	}
	if first.ID == "" || second.ID == "" || first.ID == second.ID {
		t.Fatalf("monitor history IDs = (%q, %q), want distinct non-empty IDs", first.ID, second.ID)
	}

	history, err := store.ListMonitorHistory(domain.MonitorHistoryFilter{ConnectionID: "c1", Limit: 1})
	if err != nil {
		t.Fatalf("ListMonitorHistory() error = %v", err)
	}
	if len(history) != 1 {
		t.Fatalf("history length = %d, want 1", len(history))
	}
	if history[0].ID != second.ID || history[0].AlertLevel != "critical" || history[0].CPUPercent != 91 {
		t.Fatalf("latest monitor history = %#v, want second critical sample", history[0])
	}
}

func TestSavedCommandCRUD(t *testing.T) {
	store := newTestStore(t)

	saved, err := store.SaveSavedCommand(domain.SaveSavedCommandInput{
		Name:        "Check disk",
		Command:     "df -h",
		Description: "Show disk usage",
		Tags:        []string{"global", "server"},
		SortOrder:   10,
	})
	if err != nil {
		t.Fatalf("SaveSavedCommand(create) error = %v", err)
	}
	if saved.ID == "" {
		t.Fatal("SaveSavedCommand(create) ID is empty")
	}
	if !reflect.DeepEqual(saved.Tags, []string{"global", "server"}) {
		t.Fatalf("saved tags = %#v, want global/server", saved.Tags)
	}
	if saved.SortOrder != 10 {
		t.Fatalf("saved sort order = %d, want 10", saved.SortOrder)
	}

	updated, err := store.SaveSavedCommand(domain.SaveSavedCommandInput{
		ID:          saved.ID,
		Name:        "Check filesystem",
		Command:     "df -hT",
		Description: "Show disk usage with filesystem type",
		Tags:        []string{"global"},
		SortOrder:   2,
	})
	if err != nil {
		t.Fatalf("SaveSavedCommand(update) error = %v", err)
	}
	if updated.ID != saved.ID || updated.Name != "Check filesystem" || updated.Command != "df -hT" || updated.SortOrder != 2 {
		t.Fatalf("updated command = %#v, want same ID and changed fields", updated)
	}

	commands, err := store.ListSavedCommands()
	if err != nil {
		t.Fatalf("ListSavedCommands() error = %v", err)
	}
	if len(commands) != 1 || commands[0].Name != "Check filesystem" {
		t.Fatalf("commands = %#v, want updated command", commands)
	}

	if err := store.DeleteSavedCommand(saved.ID); err != nil {
		t.Fatalf("DeleteSavedCommand() error = %v", err)
	}
	commands, err = store.ListSavedCommands()
	if err != nil {
		t.Fatalf("ListSavedCommands(after delete) error = %v", err)
	}
	if len(commands) != 0 {
		t.Fatalf("commands length after delete = %d, want 0", len(commands))
	}
}

func TestSavedCommandsListBySortOrder(t *testing.T) {
	store := newTestStore(t)

	third, err := store.SaveSavedCommand(domain.SaveSavedCommandInput{
		Name:      "Third",
		Command:   "echo third",
		Tags:      []string{"global"},
		SortOrder: 30,
	})
	if err != nil {
		t.Fatalf("SaveSavedCommand(third) error = %v", err)
	}
	first, err := store.SaveSavedCommand(domain.SaveSavedCommandInput{
		Name:      "First",
		Command:   "echo first",
		Tags:      []string{"global"},
		SortOrder: 10,
	})
	if err != nil {
		t.Fatalf("SaveSavedCommand(first) error = %v", err)
	}
	second, err := store.SaveSavedCommand(domain.SaveSavedCommandInput{
		Name:      "Second",
		Command:   "echo second",
		Tags:      []string{"global"},
		SortOrder: 20,
	})
	if err != nil {
		t.Fatalf("SaveSavedCommand(second) error = %v", err)
	}

	commands, err := store.ListSavedCommands()
	if err != nil {
		t.Fatalf("ListSavedCommands() error = %v", err)
	}
	got := []string{commands[0].ID, commands[1].ID, commands[2].ID}
	want := []string{first.ID, second.ID, third.ID}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("command order = %#v, want %#v", got, want)
	}
}

func TestSettingsRoundTrip(t *testing.T) {
	store := newTestStore(t)

	defaults, err := store.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings(defaults) error = %v", err)
	}
	if defaults.Theme == "" || defaults.FontSize == 0 || defaults.DefaultKeyPath == "" {
		t.Fatalf("default settings = %#v, want populated defaults", defaults)
	}

	saved, err := store.SaveSettings(domain.AppSettings{
		Theme:          "dark",
		Accent:         "#8aadf4",
		FontSize:       15,
		Transparency:   true,
		Ligatures:      false,
		CopyOnSelect:   true,
		SSHAgent:       true,
		DefaultKeyPath: "~/.ssh/custom",
		KnownHostsPath: "~/.ssh/known_hosts",
	})
	if err != nil {
		t.Fatalf("SaveSettings() error = %v", err)
	}
	if saved.Theme != "dark" || saved.FontSize != 15 || !saved.Transparency {
		t.Fatalf("saved settings = %#v, want requested settings", saved)
	}

	got, err := store.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings(saved) error = %v", err)
	}
	if got != saved {
		t.Fatalf("GetSettings() = %#v, want %#v", got, saved)
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
