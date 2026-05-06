package main

import (
	"testing"

	"TermFlow/internal/store"
)

func TestDefaultLocalConnectionUsesCurrentUser(t *testing.T) {
	conn := defaultLocalConnection("alice")

	if conn.Name != "Local Terminal" {
		t.Fatalf("Name = %q, want Local Terminal", conn.Name)
	}
	if conn.Host != "localhost" {
		t.Fatalf("Host = %q, want localhost", conn.Host)
	}
	if conn.Port != 0 {
		t.Fatalf("Port = %d, want 0", conn.Port)
	}
	if conn.User != "alice" {
		t.Fatalf("User = %q, want alice", conn.User)
	}
	if conn.Kind != "local" {
		t.Fatalf("Kind = %q, want local", conn.Kind)
	}
	if conn.GroupName != "Local" {
		t.Fatalf("GroupName = %q, want Local", conn.GroupName)
	}
}

func TestIsLocalConnection(t *testing.T) {
	cases := []struct {
		name string
		conn store.Connection
		want bool
	}{
		{name: "kind local", conn: store.Connection{Kind: "local"}, want: true},
		{name: "other kind", conn: store.Connection{Kind: "ssh"}, want: false},
		{name: "empty kind", conn: store.Connection{}, want: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isLocalConnection(tc.conn); got != tc.want {
				t.Fatalf("isLocalConnection() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestEnsureSingleLocalConnectionCreatesOneConnection(t *testing.T) {
	db, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	app := &App{db: db}
	app.ensureSingleLocalConnection("alice")
	app.ensureSingleLocalConnection("alice")

	conns, err := db.ListConnections()
	if err != nil {
		t.Fatal(err)
	}

	var locals []store.Connection
	for _, conn := range conns {
		if isLocalConnection(conn) {
			locals = append(locals, conn)
		}
	}
	if len(locals) != 1 {
		t.Fatalf("local connection count = %d, want 1", len(locals))
	}
	if locals[0].User != "alice" {
		t.Fatalf("local user = %q, want alice", locals[0].User)
	}
}
