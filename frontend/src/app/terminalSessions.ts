export type TerminalSessionReconciliation = {
  createIds: string[];
  disposeIds: string[];
};

export function addSessionIfMissing<T extends { id: string }>(sessions: readonly T[], session: T): T[] {
  return sessions.some((item) => item.id === session.id) ? [...sessions] : [...sessions, session];
}

export function canInteractWithSession(session: { status: string } | null | undefined): boolean {
  return session?.status === "connected";
}

export function openedSessionStatusMessage(name: string, status: string): string {
  return status === "connected" ? `Connected to ${name}` : `Session ${status}: ${name}`;
}

export type TerminalSessionPrimaryAction = "close" | "reconnect" | "reconnecting" | "disabled";

export function terminalSessionPrimaryAction(
  status: string | null | undefined,
  reconnecting: boolean,
): TerminalSessionPrimaryAction {
  if (status === "disconnected" || status === "error") {
    return reconnecting ? "reconnecting" : "reconnect";
  }
  return status === "connected" ? "close" : "disabled";
}

export function shouldStageReconnectedSession(
  reconnectingConnectionId: string | null | undefined,
  session: { connectionId: string },
): boolean {
  return Boolean(reconnectingConnectionId && reconnectingConnectionId === session.connectionId);
}

export function latestReconnectedSession<T extends { id: string; status: string }>(
  stagedSessions: ReadonlyMap<string, T>,
  returnedSession: T,
): T {
  const stagedSession = stagedSessions.get(returnedSession.id);
  return stagedSession && stagedSession.status !== "connected" ? stagedSession : returnedSession;
}

export function replaceReconnectedSession<T extends { id: string }>(
  sessions: readonly T[],
  previousSessionId: string,
  replacement: T,
): T[] {
  const previousIndex = sessions.findIndex((session) => session.id === previousSessionId);
  const existingReplacement = sessions.find((session) => session.id === replacement.id) ?? replacement;
  const withoutPreviousOrReplacement = sessions.filter(
    (session) => session.id !== previousSessionId && session.id !== replacement.id,
  );
  const replacementIndex = previousIndex < 0
    ? withoutPreviousOrReplacement.length
    : Math.min(previousIndex, withoutPreviousOrReplacement.length);
  return [
    ...withoutPreviousOrReplacement.slice(0, replacementIndex),
    existingReplacement,
    ...withoutPreviousOrReplacement.slice(replacementIndex),
  ];
}

export function rekeyReconnectedTerminalBuffer(
  buffers: Readonly<Record<string, string>>,
  previousSessionId: string,
  replacementSessionId: string,
): Record<string, string> {
  const previousBuffer = buffers[previousSessionId] ?? "";
  const replacementBuffer = buffers[replacementSessionId] ?? "";
  const next = { ...buffers };
  delete next[previousSessionId];
  next[replacementSessionId] = previousBuffer
    ? `${previousBuffer}\r\n[reconnected]\r\n${replacementBuffer}`
    : replacementBuffer;
  return next;
}

export function reconcileTerminalSessions(
  existingSessionIds: Iterable<string>,
  nextSessions: readonly { id: string }[],
): TerminalSessionReconciliation {
  const existingIds = new Set(existingSessionIds);
  const nextIds = new Set(nextSessions.map((session) => session.id));

  return {
    createIds: nextSessions.filter((session) => !existingIds.has(session.id)).map((session) => session.id),
    disposeIds: [...existingIds].filter((sessionId) => !nextIds.has(sessionId)),
  };
}
