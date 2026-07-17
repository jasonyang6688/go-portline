export type AuthType = "password" | "key" | "agent";

export type SessionStatus = "connecting" | "connected" | "disconnected" | "error" | "closed";

export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  password: string;
  keyPath: string;
  insecureIgnoreHostKey: boolean;
  group: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SaveConnectionInput {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  password: string;
  keyPath: string;
  insecureIgnoreHostKey: boolean;
  group: string;
  tags: string[];
}

export interface TestConnectionInput {
  connectionId: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  password: string;
  keyPath: string;
  insecureIgnoreHostKey: boolean;
}

export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface OpenSessionInput {
  connectionId: string;
  password: string;
  size: TerminalSize;
  insecureIgnoreHostKey: boolean;
}

export interface Session {
  id: string;
  connectionId: string;
  name: string;
  status: SessionStatus;
  createdAt: string;
  lastActiveAt: string;
}

export interface SessionOutputEvent {
  sessionId: string;
  data: string;
}

export interface SessionStatusEvent {
  sessionId: string;
  status: SessionStatus;
  message: string;
}

export interface SessionErrorEvent {
  sessionId: string;
  message: string;
}

export interface SessionClosedEvent {
  sessionId: string;
}

export interface RunCommandInput {
  sessionId: string;
  command: string;
  broadcast: boolean;
}

export interface CommandHistoryFilter {
  connectionId?: string;
  sessionId?: string;
  limit?: number;
}

export interface CommandHistoryEntry {
  id: string;
  sessionId: string;
  connectionId: string;
  connectionName: string;
  command: string;
  createdAt: string;
}

export interface SavedCommand {
  id: string;
  name: string;
  command: string;
  description: string;
  tags: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveSavedCommandInput {
  id?: string;
  name: string;
  command: string;
  description: string;
  tags: string[];
  sortOrder?: number;
}

export interface AppSettings {
  theme: "dark" | "light" | string;
  accent: string;
  fontSize: number;
  transparency: boolean;
  ligatures: boolean;
  copyOnSelect: boolean;
  sshAgent: boolean;
  defaultKeyPath: string;
  knownHostsPath: string;
}

export interface FileListInput {
  sessionId?: string;
  side: "local" | "remote";
  path: string;
}

export interface FileReadInput {
  sessionId?: string;
  side: "local" | "remote";
  path: string;
}

export interface FileSaveInput {
  sessionId?: string;
  side: "local" | "remote";
  path: string;
  content: string;
}

export interface FileMutationInput {
  sessionId?: string;
  side: "local" | "remote";
  path: string;
}

export interface FileRenameInput {
  sessionId?: string;
  side: "local" | "remote";
  path: string;
  newPath: string;
}

export interface FileTransferInput {
  sessionId: string;
  direction: "upload" | "download";
  localPath: string;
  remotePath: string;
  overwrite: boolean;
}

export interface FileContent {
  name: string;
  path: string;
  content: string;
  language: string;
  size: number;
  modTime: string;
  isBinary: boolean;
}

export interface FileTransferResult {
  direction: "upload" | "download";
  localPath: string;
  remotePath: string;
  bytesTransferred: number;
}

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  sizeLabel: string;
  modTime: string;
  owner: string;
  group: string;
  isDir: boolean;
}

export interface ProcessMetric {
  name: string;
  pid: number;
  cpuPercent: number;
  memory: string;
  memoryPercent: number;
}

export interface FileSystemMetric {
  filesystem: string;
  type: string;
  mount: string;
  percent: number;
  totalLabel: string;
  usedLabel: string;
  availableLabel: string;
}

export interface NetworkInterfaceMetric {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxLabel: string;
  txLabel: string;
}

export interface MonitorSnapshot {
  sessionId: string;
  cpuPercent: number;
  cpuIdlePercent: number;
  cpuCores: number;
  memoryPercent: number;
  memoryTotalLabel: string;
  memoryUsedLabel: string;
  memoryAvailableLabel: string;
  diskPercent: number;
  diskTotalLabel: string;
  diskUsedLabel: string;
  diskAvailableLabel: string;
  loadAverage: string;
  processes: ProcessMetric[];
  filesystems: FileSystemMetric[];
  networkInterfaces: NetworkInterfaceMetric[];
  updatedAt: string;
}

export interface MonitorHistoryFilter {
  connectionId?: string;
  sessionId?: string;
  limit?: number;
}

export interface MonitorHistoryEntry {
  id: string;
  sessionId: string;
  connectionId: string;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  loadAverage: string;
  alertLevel: "ok" | "warn" | "critical" | string;
  createdAt: string;
}

export const SESSION_CREATED_EVENT = "session:created";
export const SESSION_OUTPUT_EVENT = "session:output";
export const SESSION_STATUS_EVENT = "session:status";
export const SESSION_ERROR_EVENT = "session:error";
export const SESSION_CLOSED_EVENT = "session:closed";
