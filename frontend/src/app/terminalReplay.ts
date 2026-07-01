export type TerminalWrite =
  | { kind: "noop"; data: "" }
  | { kind: "append"; data: string }
  | { kind: "reset"; data: string };

interface AppendTerminalDataOptions {
  maxLength: number;
  preserveReplayContext: boolean;
}

export function appendTerminalData(buffer: string, data: string, options: AppendTerminalDataOptions): string {
  const next = buffer + data;
  if (options.preserveReplayContext || next.length <= options.maxLength) {
    return next;
  }
  return next.slice(next.length - options.maxLength);
}

export function resolveTerminalWrite(previousBuffer: string, nextBuffer: string): TerminalWrite {
  if (nextBuffer === previousBuffer) {
    return { kind: "noop", data: "" };
  }
  if (nextBuffer.startsWith(previousBuffer)) {
    return { kind: "append", data: nextBuffer.slice(previousBuffer.length) };
  }

  const overlap = longestSuffixPrefixOverlap(previousBuffer, nextBuffer);
  if (overlap > 0) {
    return { kind: "append", data: nextBuffer.slice(overlap) };
  }

  return { kind: "reset", data: nextBuffer };
}

export function canWriteShellCommand(sessionId: string | null | undefined, fullscreenSessions: Record<string, boolean>): boolean {
  return Boolean(sessionId && !fullscreenSessions[sessionId]);
}

export function shouldPreserveTerminalReplayContext(
  data: string,
  sessionId: string,
  fullscreenSessions: Record<string, boolean>,
): boolean {
  return fullscreenSessions[sessionId] === true || entersAlternateScreen(data);
}

function longestSuffixPrefixOverlap(left: string, right: string): number {
  const maxOverlap = Math.min(left.length, right.length);
  for (let length = maxOverlap; length > 0; length -= 1) {
    if (left.endsWith(right.slice(0, length))) {
      return length;
    }
  }
  return 0;
}

function entersAlternateScreen(data: string): boolean {
  return data.includes("\u001b[?1049h") || data.includes("\u001b[?1047h") || data.includes("\u001b[?47h");
}
