import type {
  Connection,
  OpenSessionInput,
  SaveConnectionInput,
  Session,
  TerminalSize,
  TestConnectionInput,
} from "../../features/connections/types";

type WailsEventRuntime = {
  EventsOn?(name: string, callback: (data: unknown) => void): () => void;
};

type WailsAppApi = {
  ListConnections(): Promise<Connection[]>;
  SaveConnection(input: SaveConnectionInput): Promise<Connection>;
  DeleteConnection(id: string): Promise<void>;
  TestConnection(input: TestConnectionInput): Promise<void>;
  OpenSession(input: OpenSessionInput): Promise<Session>;
  CloseSession(sessionId: string): Promise<void>;
  WriteTerminal(sessionId: string, data: string): Promise<void>;
  ResizeTerminal(sessionId: string, size: TerminalSize): Promise<void>;
};

declare global {
  interface Window {
    go?: {
      main?: {
        App?: WailsAppApi;
      };
    };
    runtime?: WailsEventRuntime;
  }
}

function appApi(): WailsAppApi {
  const api = window.go?.main?.App;
  if (!api) {
    throw new Error("Wails backend is not available");
  }
  return api;
}

export function listConnections(): Promise<Connection[]> {
  return appApi().ListConnections();
}

export function saveConnection(input: SaveConnectionInput): Promise<Connection> {
  return appApi().SaveConnection(input);
}

export function deleteConnection(id: string): Promise<void> {
  return appApi().DeleteConnection(id);
}

export function testConnection(input: TestConnectionInput): Promise<void> {
  return appApi().TestConnection(input);
}

export function openSession(input: OpenSessionInput): Promise<Session> {
  return appApi().OpenSession(input);
}

export function closeSession(sessionId: string): Promise<void> {
  return appApi().CloseSession(sessionId);
}

export function writeTerminal(sessionId: string, data: string): Promise<void> {
  return appApi().WriteTerminal(sessionId, data);
}

export function resizeTerminal(sessionId: string, size: TerminalSize): Promise<void> {
  return appApi().ResizeTerminal(sessionId, size);
}

export function onWailsEvent<T>(name: string, callback: (data: T) => void): () => void {
  const on = window.runtime?.EventsOn;
  if (!on) {
    return () => {};
  }
  return on(name, (data: unknown) => callback(data as T));
}
