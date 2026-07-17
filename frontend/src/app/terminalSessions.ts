export type TerminalSessionReconciliation = {
  createIds: string[];
  disposeIds: string[];
};

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
