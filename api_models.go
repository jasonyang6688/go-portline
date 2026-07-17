package main

import (
	"time"

	"termflow/internal/domain"
)

type APIConnection struct {
	ID                    string   `json:"id"`
	Name                  string   `json:"name"`
	Host                  string   `json:"host"`
	Port                  int      `json:"port"`
	Username              string   `json:"username"`
	AuthType              string   `json:"authType"`
	Password              string   `json:"password"`
	KeyPath               string   `json:"keyPath"`
	InsecureIgnoreHostKey bool     `json:"insecureIgnoreHostKey"`
	Group                 string   `json:"group"`
	Tags                  []string `json:"tags"`
	CreatedAt             string   `json:"createdAt"`
	UpdatedAt             string   `json:"updatedAt"`
}

type APISession struct {
	ID           string `json:"id"`
	ConnectionID string `json:"connectionId"`
	Name         string `json:"name"`
	Status       string `json:"status"`
	CreatedAt    string `json:"createdAt"`
	LastActiveAt string `json:"lastActiveAt"`
}

type APICommandHistoryEntry struct {
	ID             string `json:"id"`
	SessionID      string `json:"sessionId"`
	ConnectionID   string `json:"connectionId"`
	ConnectionName string `json:"connectionName"`
	Command        string `json:"command"`
	CreatedAt      string `json:"createdAt"`
}

type APIMonitorHistoryEntry struct {
	ID            string `json:"id"`
	SessionID     string `json:"sessionId"`
	ConnectionID  string `json:"connectionId"`
	CPUPercent    int    `json:"cpuPercent"`
	MemoryPercent int    `json:"memoryPercent"`
	DiskPercent   int    `json:"diskPercent"`
	LoadAverage   string `json:"loadAverage"`
	AlertLevel    string `json:"alertLevel"`
	CreatedAt     string `json:"createdAt"`
}

type APISavedCommand struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Command     string   `json:"command"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	SortOrder   int      `json:"sortOrder"`
	CreatedAt   string   `json:"createdAt"`
	UpdatedAt   string   `json:"updatedAt"`
}

type APIFileContent struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	Content  string `json:"content"`
	Language string `json:"language"`
	Size     int64  `json:"size"`
	ModTime  string `json:"modTime"`
	IsBinary bool   `json:"isBinary"`
}

type APIFileEntry struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	SizeLabel string `json:"sizeLabel"`
	ModTime   string `json:"modTime"`
	Owner     string `json:"owner"`
	Group     string `json:"group"`
	IsDir     bool   `json:"isDir"`
}

type APIMonitorSnapshot struct {
	SessionID            string                          `json:"sessionId"`
	CPUPercent           int                             `json:"cpuPercent"`
	CPUIdlePercent       int                             `json:"cpuIdlePercent"`
	CPUCores             int                             `json:"cpuCores"`
	MemoryPercent        int                             `json:"memoryPercent"`
	MemoryTotalLabel     string                          `json:"memoryTotalLabel"`
	MemoryUsedLabel      string                          `json:"memoryUsedLabel"`
	MemoryAvailableLabel string                          `json:"memoryAvailableLabel"`
	DiskPercent          int                             `json:"diskPercent"`
	DiskTotalLabel       string                          `json:"diskTotalLabel"`
	DiskUsedLabel        string                          `json:"diskUsedLabel"`
	DiskAvailableLabel   string                          `json:"diskAvailableLabel"`
	LoadAverage          string                          `json:"loadAverage"`
	Processes            []domain.ProcessMetric          `json:"processes"`
	Filesystems          []domain.FileSystemMetric       `json:"filesystems"`
	NetworkInterfaces    []domain.NetworkInterfaceMetric `json:"networkInterfaces"`
	UpdatedAt            string                          `json:"updatedAt"`
}

func apiTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339Nano)
}

func apiConnection(c domain.Connection) APIConnection {
	return APIConnection{
		ID:                    c.ID,
		Name:                  c.Name,
		Host:                  c.Host,
		Port:                  c.Port,
		Username:              c.Username,
		AuthType:              string(c.AuthType),
		Password:              c.Password,
		KeyPath:               c.KeyPath,
		InsecureIgnoreHostKey: c.InsecureIgnoreHostKey,
		Group:                 c.Group,
		Tags:                  c.Tags,
		CreatedAt:             apiTime(c.CreatedAt),
		UpdatedAt:             apiTime(c.UpdatedAt),
	}
}

func apiConnections(items []domain.Connection) []APIConnection {
	result := make([]APIConnection, 0, len(items))
	for _, item := range items {
		result = append(result, apiConnection(item))
	}
	return result
}

func apiSession(s domain.Session) APISession {
	return APISession{
		ID:           s.ID,
		ConnectionID: s.ConnectionID,
		Name:         s.Name,
		Status:       string(s.Status),
		CreatedAt:    apiTime(s.CreatedAt),
		LastActiveAt: apiTime(s.LastActiveAt),
	}
}

func apiCommandHistoryEntry(entry domain.CommandHistoryEntry) APICommandHistoryEntry {
	return APICommandHistoryEntry{
		ID:             entry.ID,
		SessionID:      entry.SessionID,
		ConnectionID:   entry.ConnectionID,
		ConnectionName: entry.ConnectionName,
		Command:        entry.Command,
		CreatedAt:      apiTime(entry.CreatedAt),
	}
}

func apiCommandHistory(items []domain.CommandHistoryEntry) []APICommandHistoryEntry {
	result := make([]APICommandHistoryEntry, 0, len(items))
	for _, item := range items {
		result = append(result, apiCommandHistoryEntry(item))
	}
	return result
}

func apiMonitorHistoryEntry(entry domain.MonitorHistoryEntry) APIMonitorHistoryEntry {
	return APIMonitorHistoryEntry{
		ID:            entry.ID,
		SessionID:     entry.SessionID,
		ConnectionID:  entry.ConnectionID,
		CPUPercent:    entry.CPUPercent,
		MemoryPercent: entry.MemoryPercent,
		DiskPercent:   entry.DiskPercent,
		LoadAverage:   entry.LoadAverage,
		AlertLevel:    entry.AlertLevel,
		CreatedAt:     apiTime(entry.CreatedAt),
	}
}

func apiMonitorHistory(items []domain.MonitorHistoryEntry) []APIMonitorHistoryEntry {
	result := make([]APIMonitorHistoryEntry, 0, len(items))
	for _, item := range items {
		result = append(result, apiMonitorHistoryEntry(item))
	}
	return result
}

func apiSavedCommand(command domain.SavedCommand) APISavedCommand {
	return APISavedCommand{
		ID:          command.ID,
		Name:        command.Name,
		Command:     command.Command,
		Description: command.Description,
		Tags:        command.Tags,
		SortOrder:   command.SortOrder,
		CreatedAt:   apiTime(command.CreatedAt),
		UpdatedAt:   apiTime(command.UpdatedAt),
	}
}

func apiSavedCommands(items []domain.SavedCommand) []APISavedCommand {
	result := make([]APISavedCommand, 0, len(items))
	for _, item := range items {
		result = append(result, apiSavedCommand(item))
	}
	return result
}

func apiFileContent(file domain.FileContent) APIFileContent {
	return APIFileContent{
		Name:     file.Name,
		Path:     file.Path,
		Content:  file.Content,
		Language: file.Language,
		Size:     file.Size,
		ModTime:  apiTime(file.ModTime),
		IsBinary: file.IsBinary,
	}
}

func apiFileEntry(file domain.FileEntry) APIFileEntry {
	return APIFileEntry{
		Name:      file.Name,
		Path:      file.Path,
		Size:      file.Size,
		SizeLabel: file.SizeLabel,
		ModTime:   apiTime(file.ModTime),
		Owner:     file.Owner,
		Group:     file.Group,
		IsDir:     file.IsDir,
	}
}

func apiFileEntries(items []domain.FileEntry) []APIFileEntry {
	result := make([]APIFileEntry, 0, len(items))
	for _, item := range items {
		result = append(result, apiFileEntry(item))
	}
	return result
}

func apiMonitorSnapshot(snapshot domain.MonitorSnapshot) APIMonitorSnapshot {
	return APIMonitorSnapshot{
		SessionID:            snapshot.SessionID,
		CPUPercent:           snapshot.CPUPercent,
		CPUIdlePercent:       snapshot.CPUIdlePercent,
		CPUCores:             snapshot.CPUCores,
		MemoryPercent:        snapshot.MemoryPercent,
		MemoryTotalLabel:     snapshot.MemoryTotalLabel,
		MemoryUsedLabel:      snapshot.MemoryUsedLabel,
		MemoryAvailableLabel: snapshot.MemoryAvailableLabel,
		DiskPercent:          snapshot.DiskPercent,
		DiskTotalLabel:       snapshot.DiskTotalLabel,
		DiskUsedLabel:        snapshot.DiskUsedLabel,
		DiskAvailableLabel:   snapshot.DiskAvailableLabel,
		LoadAverage:          snapshot.LoadAverage,
		Processes:            snapshot.Processes,
		Filesystems:          snapshot.Filesystems,
		NetworkInterfaces:    snapshot.NetworkInterfaces,
		UpdatedAt:            apiTime(snapshot.UpdatedAt),
	}
}
