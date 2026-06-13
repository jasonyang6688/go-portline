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

type RunCommandInput struct {
	SessionID string `json:"sessionId"`
	Command   string `json:"command"`
	Broadcast bool   `json:"broadcast"`
}

type CommandHistoryFilter struct {
	ConnectionID string `json:"connectionId"`
	SessionID    string `json:"sessionId"`
	Limit        int    `json:"limit"`
}

type SaveCommandHistoryInput struct {
	SessionID      string `json:"sessionId"`
	ConnectionID   string `json:"connectionId"`
	ConnectionName string `json:"connectionName"`
	Command        string `json:"command"`
}

type CommandHistoryEntry struct {
	ID             string    `json:"id"`
	SessionID      string    `json:"sessionId"`
	ConnectionID   string    `json:"connectionId"`
	ConnectionName string    `json:"connectionName"`
	Command        string    `json:"command"`
	CreatedAt      time.Time `json:"createdAt"`
}

type SaveSavedCommandInput struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Command     string   `json:"command"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
}

type SavedCommand struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Command     string    `json:"command"`
	Description string    `json:"description"`
	Tags        []string  `json:"tags"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type AppSettings struct {
	Theme          string `json:"theme"`
	Accent         string `json:"accent"`
	FontSize       int    `json:"fontSize"`
	Transparency   bool   `json:"transparency"`
	Ligatures      bool   `json:"ligatures"`
	CopyOnSelect   bool   `json:"copyOnSelect"`
	SSHAgent       bool   `json:"sshAgent"`
	DefaultKeyPath string `json:"defaultKeyPath"`
	KnownHostsPath string `json:"knownHostsPath"`
}

type FileSide string

const (
	FileSideLocal  FileSide = "local"
	FileSideRemote FileSide = "remote"
)

type FileListInput struct {
	SessionID string   `json:"sessionId"`
	Side      FileSide `json:"side"`
	Path      string   `json:"path"`
}

type FileReadInput struct {
	SessionID string   `json:"sessionId"`
	Side      FileSide `json:"side"`
	Path      string   `json:"path"`
}

type FileSaveInput struct {
	SessionID string   `json:"sessionId"`
	Side      FileSide `json:"side"`
	Path      string   `json:"path"`
	Content   string   `json:"content"`
}

type FileMutationInput struct {
	SessionID string   `json:"sessionId"`
	Side      FileSide `json:"side"`
	Path      string   `json:"path"`
}

type FileRenameInput struct {
	SessionID string   `json:"sessionId"`
	Side      FileSide `json:"side"`
	Path      string   `json:"path"`
	NewPath   string   `json:"newPath"`
}

type FileTransferDirection string

const (
	FileTransferUpload   FileTransferDirection = "upload"
	FileTransferDownload FileTransferDirection = "download"
)

type FileTransferInput struct {
	SessionID  string                `json:"sessionId"`
	Direction  FileTransferDirection `json:"direction"`
	LocalPath  string                `json:"localPath"`
	RemotePath string                `json:"remotePath"`
	Overwrite  bool                  `json:"overwrite"`
}

type FileContent struct {
	Name     string    `json:"name"`
	Path     string    `json:"path"`
	Content  string    `json:"content"`
	Language string    `json:"language"`
	Size     int64     `json:"size"`
	ModTime  time.Time `json:"modTime"`
	IsBinary bool      `json:"isBinary"`
}

type FileTransferResult struct {
	Direction        FileTransferDirection `json:"direction"`
	LocalPath        string                `json:"localPath"`
	RemotePath       string                `json:"remotePath"`
	BytesTransferred int64                 `json:"bytesTransferred"`
}

type FileEntry struct {
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	Size      int64     `json:"size"`
	SizeLabel string    `json:"sizeLabel"`
	ModTime   time.Time `json:"modTime"`
	IsDir     bool      `json:"isDir"`
}

type ProcessMetric struct {
	Name          string  `json:"name"`
	PID           int     `json:"pid"`
	CPUPercent    float64 `json:"cpuPercent"`
	Memory        string  `json:"memory"`
	MemoryPercent float64 `json:"memoryPercent"`
}

type MonitorSnapshot struct {
	SessionID     string          `json:"sessionId"`
	CPUPercent    int             `json:"cpuPercent"`
	MemoryPercent int             `json:"memoryPercent"`
	DiskPercent   int             `json:"diskPercent"`
	LoadAverage   string          `json:"loadAverage"`
	Processes     []ProcessMetric `json:"processes"`
	UpdatedAt     time.Time       `json:"updatedAt"`
}
