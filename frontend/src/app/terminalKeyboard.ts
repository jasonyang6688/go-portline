type TerminalKeyboardEvent = {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
};

const SPECIAL_KEY_DATA: Record<string, string> = {
  ArrowDown: "\u001b[B",
  ArrowLeft: "\u001b[D",
  ArrowRight: "\u001b[C",
  ArrowUp: "\u001b[A",
  Backspace: "\u007f",
  Delete: "\u001b[3~",
  End: "\u001b[F",
  Enter: "\r",
  Escape: "\u001b",
  Home: "\u001b[H",
  Insert: "\u001b[2~",
  PageDown: "\u001b[6~",
  PageUp: "\u001b[5~",
  Tab: "\t",
};

const FUNCTION_KEY_DATA: Record<string, string> = {
  F1: "\u001bOP",
  F2: "\u001bOQ",
  F3: "\u001bOR",
  F4: "\u001bOS",
  F5: "\u001b[15~",
  F6: "\u001b[17~",
  F7: "\u001b[18~",
  F8: "\u001b[19~",
  F9: "\u001b[20~",
  F10: "\u001b[21~",
  F11: "\u001b[23~",
  F12: "\u001b[24~",
};

export function terminalKeyDataFromKeyboardEvent(event: TerminalKeyboardEvent): string | null {
  if (event.metaKey) {
    return null;
  }

  const special = SPECIAL_KEY_DATA[event.key] ?? FUNCTION_KEY_DATA[event.key];
  if (special) {
    return event.altKey ? `\u001b${special}` : special;
  }

  if (event.key.length !== 1) {
    return null;
  }

  if (event.ctrlKey) {
    const upper = event.key.toUpperCase();
    if (upper >= "A" && upper <= "Z") {
      return String.fromCharCode(upper.charCodeAt(0) - 64);
    }
    return null;
  }

  return event.altKey ? `\u001b${event.key}` : event.key;
}

export function shouldUseTerminalKeyboardFallback(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return true;
  }
  if (target.closest(".xterm")) {
    return false;
  }
  if (target.closest("input, textarea, select, [contenteditable='true']")) {
    return false;
  }
  return true;
}
