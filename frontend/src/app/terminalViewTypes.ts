export type TerminalDock = "monitor" | "files" | "history" | null;

export type PendingCwdSync = {
  sessionId: string;
  output: string;
  timeoutId: number;
};

export type SessionReconnectInput = {
  password: string;
  insecureIgnoreHostKey: boolean;
};

export type SessionReconnectInputStore = Map<string, SessionReconnectInput>;

export type SessionReconnectAttempt = {
  sessionId: string;
  connectionId: string;
};
