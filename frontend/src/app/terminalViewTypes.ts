export type TerminalDock = "monitor" | "files" | "history" | null;

export type PendingCwdSync = {
  sessionId: string;
  output: string;
  timeoutId: number;
};
