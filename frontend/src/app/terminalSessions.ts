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
