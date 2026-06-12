import type {
  Connection,
  OpenSessionInput,
  SaveConnectionInput,
  Session,
  TerminalSize,
  TestConnectionInput,
} from "../../features/connections/types";

type WailsEventRuntime = {
  EventsOn?(name: string, callback: (...data: unknown[]) => void): unknown;
  EventsOnMultiple?(
    name: string,
    callback: (...data: unknown[]) => void,
    maxCallbacks?: number,
  ): unknown;
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
  const runtime = window.runtime;
  if (!runtime) {
    return () => {};
  }

  const eventCallback = (...data: unknown[]) => callback(data[0] as T);

  if (runtime.EventsOn) {
    const unsubscribe = runtime.EventsOn(name, eventCallback);
    return typeof unsubscribe === "function" ? () => unsubscribe() : () => {};
  }

  if (runtime.EventsOnMultiple) {
    const unsubscribe = runtime.EventsOnMultiple(name, eventCallback, -1);
    return typeof unsubscribe === "function" ? () => unsubscribe() : () => {};
  }

  throw new Error("Wails runtime event API is not available");
}
