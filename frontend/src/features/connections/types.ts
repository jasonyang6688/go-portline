export type AuthType = "password" | "key" | "agent";

export type SessionStatus = "connecting" | "connected" | "disconnected" | "error" | "closed";

export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  keyPath: string;
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
  keyPath: string;
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

export const SESSION_CREATED_EVENT = "session:created";
export const SESSION_OUTPUT_EVENT = "session:output";
export const SESSION_STATUS_EVENT = "session:status";
export const SESSION_ERROR_EVENT = "session:error";
export const SESSION_CLOSED_EVENT = "session:closed";
