package domain

import "time"

type AuthType string

const (
	AuthPassword AuthType = "password"
	AuthKey      AuthType = "key"
	AuthAgent    AuthType = "agent"
)

type SessionStatus string

const (
	SessionConnecting   SessionStatus = "connecting"
	SessionConnected    SessionStatus = "connected"
	SessionDisconnected SessionStatus = "disconnected"
	SessionError        SessionStatus = "error"
	SessionClosed       SessionStatus = "closed"
)

const (
	EventSessionCreated = "session:created"
	EventSessionOutput  = "session:output"
	EventSessionStatus  = "session:status"
	EventSessionError   = "session:error"
	EventSessionClosed  = "session:closed"
)

type Connection struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Host      string    `json:"host"`
	Port      int       `json:"port"`
	Username  string    `json:"username"`
	AuthType  AuthType  `json:"authType"`
	KeyPath   string    `json:"keyPath"`
	Group     string    `json:"group"`
	Tags      []string  `json:"tags"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type SaveConnectionInput struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Host     string   `json:"host"`
	Port     int      `json:"port"`
	Username string   `json:"username"`
	AuthType AuthType `json:"authType"`
	KeyPath  string   `json:"keyPath"`
	Group    string   `json:"group"`
	Tags     []string `json:"tags"`
}

type TestConnectionInput struct {
	ConnectionID          string   `json:"connectionId"`
	Host                  string   `json:"host"`
	Port                  int      `json:"port"`
	Username              string   `json:"username"`
	AuthType              AuthType `json:"authType"`
	Password              string   `json:"password"`
	KeyPath               string   `json:"keyPath"`
	InsecureIgnoreHostKey bool     `json:"insecureIgnoreHostKey"`
}

type OpenSessionInput struct {
	ConnectionID          string       `json:"connectionId"`
	Password              string       `json:"password"`
	Size                  TerminalSize `json:"size"`
	InsecureIgnoreHostKey bool         `json:"insecureIgnoreHostKey"`
}

type Session struct {
	ID           string        `json:"id"`
	ConnectionID string        `json:"connectionId"`
	Name         string        `json:"name"`
	Status       SessionStatus `json:"status"`
	CreatedAt    time.Time     `json:"createdAt"`
	LastActiveAt time.Time     `json:"lastActiveAt"`
}

type TerminalSize struct {
	Cols int `json:"cols"`
	Rows int `json:"rows"`
}

type SessionOutputEvent struct {
	SessionID string `json:"sessionId"`
	Data      string `json:"data"`
}

type SessionStatusEvent struct {
	SessionID string        `json:"sessionId"`
	Status    SessionStatus `json:"status"`
	Message   string        `json:"message"`
}

type SessionErrorEvent struct {
	SessionID string `json:"sessionId"`
	Message   string `json:"message"`
}
