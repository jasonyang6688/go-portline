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
	key_path TEXT NOT NULL DEFAULT '',
	group_name TEXT NOT NULL DEFAULT '',
	tags_json TEXT NOT NULL DEFAULT '[]',
	created_at TEXT NOT NULL,
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
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *Store) ListConnections() ([]domain.Connection, error) {
	rows, err := s.db.Query(`SELECT id,name,host,port,username,auth_type,key_path,group_name,tags_json,created_at,updated_at FROM connections ORDER BY group_name, name`)
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
	row := s.db.QueryRow(`SELECT id,name,host,port,username,auth_type,key_path,group_name,tags_json,created_at,updated_at FROM connections WHERE id=?`, id)
	return scanConnection(row)
}

func (s *Store) SaveConnection(input domain.SaveConnectionInput) (domain.Connection, error) {
	if err := validateConnection(input); err != nil {
		return domain.Connection{}, err
	}

	now := time.Now().UTC()
	id := strings.TrimSpace(input.ID)
	if id == "" {
		generatedID, err := newID()
		if err != nil {
			return domain.Connection{}, err
		}
		id = generatedID
	}
	tags, err := json.Marshal(input.Tags)
	if err != nil {
		return domain.Connection{}, err
	}

	if input.ID == "" {
		_, err = s.db.Exec(
			`INSERT INTO connections (id,name,host,port,username,auth_type,key_path,group_name,tags_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
			id, input.Name, input.Host, normalizedPort(input.Port), input.Username, normalizedAuth(input.AuthType), input.KeyPath, input.Group, string(tags), now.Format(time.RFC3339Nano), now.Format(time.RFC3339Nano),
		)
	} else {
		_, err = s.db.Exec(
			`UPDATE connections SET name=?,host=?,port=?,username=?,auth_type=?,key_path=?,group_name=?,tags_json=?,updated_at=? WHERE id=?`,
			input.Name, input.Host, normalizedPort(input.Port), input.Username, normalizedAuth(input.AuthType), input.KeyPath, input.Group, string(tags), now.Format(time.RFC3339Nano), id,
		)
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

type scanner interface {
	Scan(dest ...any) error
}

func scanConnection(row scanner) (domain.Connection, error) {
	var c domain.Connection
	var auth string
	var tagsJSON string
	var created string
	var updated string
	if err := row.Scan(&c.ID, &c.Name, &c.Host, &c.Port, &c.Username, &auth, &c.KeyPath, &c.Group, &tagsJSON, &created, &updated); err != nil {
		return domain.Connection{}, err
	}
	c.AuthType = domain.AuthType(auth)
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

func newID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}
