package storage

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"termflow/internal/domain"

	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS connections (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	host TEXT NOT NULL,
	port INTEGER NOT NULL,
	username TEXT NOT NULL,
	auth_type TEXT NOT NULL,
	password TEXT NOT NULL DEFAULT '',
	key_path TEXT NOT NULL DEFAULT '',
	insecure_ignore_host_key INTEGER NOT NULL DEFAULT 0,
	group_name TEXT NOT NULL DEFAULT '',
	tags_json TEXT NOT NULL DEFAULT '[]',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS command_history (
	id TEXT PRIMARY KEY,
	session_id TEXT NOT NULL,
	connection_id TEXT NOT NULL,
	connection_name TEXT NOT NULL,
	command TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_command_history_connection_created
ON command_history(connection_id, created_at DESC);

CREATE TABLE IF NOT EXISTS saved_commands (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	command TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	tags_json TEXT NOT NULL DEFAULT '[]',
	sort_order INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
	key TEXT PRIMARY KEY,
	value_json TEXT NOT NULL,
	updated_at TEXT NOT NULL
);`

type Store struct {
	db *sql.DB
}

func New(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := ensureConnectionPasswordColumn(db); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := ensureConnectionInsecureHostKeyColumn(db); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := ensureSavedCommandSortOrderColumn(db); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func ensureConnectionPasswordColumn(db *sql.DB) error {
	return ensureColumn(db, "connections", "password", `ALTER TABLE connections ADD COLUMN password TEXT NOT NULL DEFAULT ''`)
}

func ensureConnectionInsecureHostKeyColumn(db *sql.DB) error {
	return ensureColumn(db, "connections", "insecure_ignore_host_key", `ALTER TABLE connections ADD COLUMN insecure_ignore_host_key INTEGER NOT NULL DEFAULT 0`)
}

func ensureSavedCommandSortOrderColumn(db *sql.DB) error {
	return ensureColumn(db, "saved_commands", "sort_order", `ALTER TABLE saved_commands ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`)
}

func ensureColumn(db *sql.DB, tableName string, columnName string, alterSQL string) error {
	rows, err := db.Query(fmt.Sprintf(`PRAGMA table_info(%s)`, tableName))
	if err != nil {
		return err
	}
	defer rows.Close()

	hasColumn := false
	for rows.Next() {
		var cid int
		var name string
		var columnType string
		var notNull int
		var defaultValue sql.NullString
		var primaryKey int
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); err != nil {
			return err
		}
		if name == columnName {
			hasColumn = true
			break
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if hasColumn {
		return nil
	}

	_, err = db.Exec(alterSQL)
	return err
}

func (s *Store) ListConnections() ([]domain.Connection, error) {
	rows, err := s.db.Query(`SELECT id,name,host,port,username,auth_type,password,key_path,insecure_ignore_host_key,group_name,tags_json,created_at,updated_at FROM connections ORDER BY group_name, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.Connection
	for rows.Next() {
		conn, err := scanConnection(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, conn)
	}
	return out, rows.Err()
}

func (s *Store) GetConnection(id string) (domain.Connection, error) {
	row := s.db.QueryRow(`SELECT id,name,host,port,username,auth_type,password,key_path,insecure_ignore_host_key,group_name,tags_json,created_at,updated_at FROM connections WHERE id=?`, id)
	return scanConnection(row)
}

func (s *Store) SaveConnection(input domain.SaveConnectionInput) (domain.Connection, error) {
	if err := validateConnection(input); err != nil {
		return domain.Connection{}, err
	}

	now := time.Now().UTC()
	id := strings.TrimSpace(input.ID)
	isCreate := id == ""
	if isCreate {
		generatedID, err := newID()
		if err != nil {
			return domain.Connection{}, err
		}
		id = generatedID
	}
	tagsValue := input.Tags
	if tagsValue == nil {
		tagsValue = []string{}
	}
	tags, err := json.Marshal(tagsValue)
	if err != nil {
		return domain.Connection{}, err
	}

	if isCreate {
		_, err = s.db.Exec(
			`INSERT INTO connections (id,name,host,port,username,auth_type,password,key_path,insecure_ignore_host_key,group_name,tags_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			id, input.Name, input.Host, normalizedPort(input.Port), input.Username, normalizedAuth(input.AuthType), input.Password, input.KeyPath, boolToInt(input.InsecureIgnoreHostKey), input.Group, string(tags), now.Format(time.RFC3339Nano), now.Format(time.RFC3339Nano),
		)
	} else {
		var res sql.Result
		res, err = s.db.Exec(
			`UPDATE connections SET name=?,host=?,port=?,username=?,auth_type=?,password=?,key_path=?,insecure_ignore_host_key=?,group_name=?,tags_json=?,updated_at=? WHERE id=?`,
			input.Name, input.Host, normalizedPort(input.Port), input.Username, normalizedAuth(input.AuthType), input.Password, input.KeyPath, boolToInt(input.InsecureIgnoreHostKey), input.Group, string(tags), now.Format(time.RFC3339Nano), id,
		)
		if err == nil {
			var affected int64
			affected, err = res.RowsAffected()
			if err == nil && affected == 0 {
				err = sql.ErrNoRows
			}
		}
	}
	if err != nil {
		return domain.Connection{}, err
	}
	return s.GetConnection(id)
}

func (s *Store) DeleteConnection(id string) error {
	res, err := s.db.Exec(`DELETE FROM connections WHERE id=?`, strings.TrimSpace(id))
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) SaveCommandHistory(input domain.SaveCommandHistoryInput) (domain.CommandHistoryEntry, error) {
	command := strings.TrimSpace(input.Command)
	if command == "" {
		return domain.CommandHistoryEntry{}, errors.New("command is required")
	}
	if strings.TrimSpace(input.SessionID) == "" {
		return domain.CommandHistoryEntry{}, errors.New("session id is required")
	}
	if strings.TrimSpace(input.ConnectionID) == "" {
		return domain.CommandHistoryEntry{}, errors.New("connection id is required")
	}

	id, err := newID()
	if err != nil {
		return domain.CommandHistoryEntry{}, err
	}
	now := time.Now().UTC()
	entry := domain.CommandHistoryEntry{
		ID:             id,
		SessionID:      strings.TrimSpace(input.SessionID),
		ConnectionID:   strings.TrimSpace(input.ConnectionID),
		ConnectionName: strings.TrimSpace(input.ConnectionName),
		Command:        command,
		CreatedAt:      now,
	}
	_, err = s.db.Exec(
		`INSERT INTO command_history (id,session_id,connection_id,connection_name,command,created_at) VALUES (?,?,?,?,?,?)`,
		entry.ID, entry.SessionID, entry.ConnectionID, entry.ConnectionName, entry.Command, entry.CreatedAt.Format(time.RFC3339Nano),
	)
	if err != nil {
		return domain.CommandHistoryEntry{}, err
	}
	return entry, nil
}

func (s *Store) ListCommandHistory(filter domain.CommandHistoryFilter) ([]domain.CommandHistoryEntry, error) {
	limit := filter.Limit
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	query := `SELECT id,session_id,connection_id,connection_name,command,created_at FROM command_history`
	var where []string
	var args []any
	if strings.TrimSpace(filter.ConnectionID) != "" {
		where = append(where, "connection_id=?")
		args = append(args, strings.TrimSpace(filter.ConnectionID))
	}
	if strings.TrimSpace(filter.SessionID) != "" {
		where = append(where, "session_id=?")
		args = append(args, strings.TrimSpace(filter.SessionID))
	}
	if len(where) > 0 {
		query += " WHERE " + strings.Join(where, " AND ")
	}
	query += " ORDER BY created_at DESC LIMIT ?"
	args = append(args, limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.CommandHistoryEntry
	for rows.Next() {
		entry, err := scanCommandHistory(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, entry)
	}
	return out, rows.Err()
}

func (s *Store) ClearCommandHistory(connectionID string) error {
	_, err := s.db.Exec(`DELETE FROM command_history WHERE connection_id=?`, strings.TrimSpace(connectionID))
	return err
}

func (s *Store) ListSavedCommands() ([]domain.SavedCommand, error) {
	rows, err := s.db.Query(`SELECT id,name,command,description,tags_json,sort_order,created_at,updated_at FROM saved_commands ORDER BY sort_order ASC, name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.SavedCommand
	for rows.Next() {
		command, err := scanSavedCommand(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, command)
	}
	return out, rows.Err()
}

func (s *Store) SaveSavedCommand(input domain.SaveSavedCommandInput) (domain.SavedCommand, error) {
	if strings.TrimSpace(input.Name) == "" {
		return domain.SavedCommand{}, errors.New("command name is required")
	}
	if strings.TrimSpace(input.Command) == "" {
		return domain.SavedCommand{}, errors.New("command is required")
	}

	now := time.Now().UTC()
	id := strings.TrimSpace(input.ID)
	isCreate := id == ""
	if isCreate {
		generatedID, err := newID()
		if err != nil {
			return domain.SavedCommand{}, err
		}
		id = generatedID
	}
	tagsValue := input.Tags
	if tagsValue == nil {
		tagsValue = []string{}
	}
	tags, err := json.Marshal(tagsValue)
	if err != nil {
		return domain.SavedCommand{}, err
	}

	if isCreate {
		_, err = s.db.Exec(
			`INSERT INTO saved_commands (id,name,command,description,tags_json,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`,
			id,
			strings.TrimSpace(input.Name),
			strings.TrimSpace(input.Command),
			strings.TrimSpace(input.Description),
			string(tags),
			input.SortOrder,
			now.Format(time.RFC3339Nano),
			now.Format(time.RFC3339Nano),
		)
	} else {
		var res sql.Result
		res, err = s.db.Exec(
			`UPDATE saved_commands SET name=?,command=?,description=?,tags_json=?,sort_order=?,updated_at=? WHERE id=?`,
			strings.TrimSpace(input.Name),
			strings.TrimSpace(input.Command),
			strings.TrimSpace(input.Description),
			string(tags),
			input.SortOrder,
			now.Format(time.RFC3339Nano),
			id,
		)
		if err == nil {
			var affected int64
			affected, err = res.RowsAffected()
			if err == nil && affected == 0 {
				err = sql.ErrNoRows
			}
		}
	}
	if err != nil {
		return domain.SavedCommand{}, err
	}
	return s.getSavedCommand(id)
}

func (s *Store) DeleteSavedCommand(id string) error {
	res, err := s.db.Exec(`DELETE FROM saved_commands WHERE id=?`, strings.TrimSpace(id))
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) GetSettings() (domain.AppSettings, error) {
	var raw string
	err := s.db.QueryRow(`SELECT value_json FROM settings WHERE key='app'`).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return defaultSettings(), nil
	}
	if err != nil {
		return domain.AppSettings{}, err
	}

	var settings domain.AppSettings
	if err := json.Unmarshal([]byte(raw), &settings); err != nil {
		return domain.AppSettings{}, err
	}
	return normalizeSettings(settings), nil
}

func (s *Store) SaveSettings(input domain.AppSettings) (domain.AppSettings, error) {
	settings := normalizeSettings(input)
	raw, err := json.Marshal(settings)
	if err != nil {
		return domain.AppSettings{}, err
	}
	_, err = s.db.Exec(
		`INSERT INTO settings (key,value_json,updated_at) VALUES ('app',?,?)
		 ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`,
		string(raw),
		time.Now().UTC().Format(time.RFC3339Nano),
	)
	if err != nil {
		return domain.AppSettings{}, err
	}
	return settings, nil
}

func (s *Store) getSavedCommand(id string) (domain.SavedCommand, error) {
	row := s.db.QueryRow(`SELECT id,name,command,description,tags_json,sort_order,created_at,updated_at FROM saved_commands WHERE id=?`, id)
	return scanSavedCommand(row)
}

type scanner interface {
	Scan(dest ...any) error
}

func scanConnection(row scanner) (domain.Connection, error) {
	var c domain.Connection
	var auth string
	var insecureIgnoreHostKey int
	var tagsJSON string
	var created string
	var updated string
	if err := row.Scan(&c.ID, &c.Name, &c.Host, &c.Port, &c.Username, &auth, &c.Password, &c.KeyPath, &insecureIgnoreHostKey, &c.Group, &tagsJSON, &created, &updated); err != nil {
		return domain.Connection{}, err
	}
	c.AuthType = domain.AuthType(auth)
	c.InsecureIgnoreHostKey = insecureIgnoreHostKey != 0
	if err := json.Unmarshal([]byte(tagsJSON), &c.Tags); err != nil {
		return domain.Connection{}, err
	}
	var err error
	c.CreatedAt, err = time.Parse(time.RFC3339Nano, created)
	if err != nil {
		return domain.Connection{}, err
	}
	c.UpdatedAt, err = time.Parse(time.RFC3339Nano, updated)
	if err != nil {
		return domain.Connection{}, err
	}
	return c, nil
}

func scanCommandHistory(row scanner) (domain.CommandHistoryEntry, error) {
	var entry domain.CommandHistoryEntry
	var created string
	if err := row.Scan(&entry.ID, &entry.SessionID, &entry.ConnectionID, &entry.ConnectionName, &entry.Command, &created); err != nil {
		return domain.CommandHistoryEntry{}, err
	}
	var err error
	entry.CreatedAt, err = time.Parse(time.RFC3339Nano, created)
	if err != nil {
		return domain.CommandHistoryEntry{}, err
	}
	return entry, nil
}

func scanSavedCommand(row scanner) (domain.SavedCommand, error) {
	var command domain.SavedCommand
	var tagsJSON string
	var sortOrder int
	var created string
	var updated string
	if err := row.Scan(&command.ID, &command.Name, &command.Command, &command.Description, &tagsJSON, &sortOrder, &created, &updated); err != nil {
		return domain.SavedCommand{}, err
	}
	if err := json.Unmarshal([]byte(tagsJSON), &command.Tags); err != nil {
		return domain.SavedCommand{}, err
	}
	command.SortOrder = sortOrder
	var err error
	command.CreatedAt, err = time.Parse(time.RFC3339Nano, created)
	if err != nil {
		return domain.SavedCommand{}, err
	}
	command.UpdatedAt, err = time.Parse(time.RFC3339Nano, updated)
	if err != nil {
		return domain.SavedCommand{}, err
	}
	return command, nil
}

func validateConnection(input domain.SaveConnectionInput) error {
	if strings.TrimSpace(input.Name) == "" {
		return errors.New("connection name is required")
	}
	if strings.TrimSpace(input.Host) == "" {
		return errors.New("host is required")
	}
	if strings.TrimSpace(input.Username) == "" {
		return errors.New("username is required")
	}
	if normalizedPort(input.Port) <= 0 || normalizedPort(input.Port) > 65535 {
		return fmt.Errorf("port must be between 1 and 65535")
	}
	return nil
}

func normalizedPort(port int) int {
	if port == 0 {
		return 22
	}
	return port
}

func normalizedAuth(auth domain.AuthType) domain.AuthType {
	if auth == "" {
		return domain.AuthPassword
	}
	return auth
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func newID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}

func defaultSettings() domain.AppSettings {
	return domain.AppSettings{
		Theme:          "light",
		Accent:         "#8aadf4",
		FontSize:       13,
		Ligatures:      true,
		CopyOnSelect:   true,
		SSHAgent:       true,
		DefaultKeyPath: "~/.ssh/id_ed25519",
		KnownHostsPath: "~/.ssh/known_hosts",
	}
}

func normalizeSettings(input domain.AppSettings) domain.AppSettings {
	defaults := defaultSettings()
	if strings.TrimSpace(input.Theme) == "" {
		input.Theme = defaults.Theme
	}
	if strings.TrimSpace(input.Accent) == "" {
		input.Accent = defaults.Accent
	}
	if input.FontSize <= 0 {
		input.FontSize = defaults.FontSize
	}
	if input.FontSize < 10 {
		input.FontSize = 10
	}
	if input.FontSize > 24 {
		input.FontSize = 24
	}
	if strings.TrimSpace(input.DefaultKeyPath) == "" {
		input.DefaultKeyPath = defaults.DefaultKeyPath
	}
	if strings.TrimSpace(input.KnownHostsPath) == "" {
		input.KnownHostsPath = defaults.KnownHostsPath
	}
	return input
}
