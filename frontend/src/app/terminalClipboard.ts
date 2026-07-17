type TerminalClipboardEvent = {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
};

type ClipboardLike = {
  readText?: () => Promise<string>;
  writeText?: (text: string) => Promise<void>;
};

type PasteTarget = {
  focus(): void;
  paste(text: string): void;
};

export type TerminalClipboardAction = "copy" | "paste";

export function terminalClipboardShortcutAction(
  event: TerminalClipboardEvent,
  hasSelection: boolean,
): TerminalClipboardAction | null {
  if (event.altKey) {
    return null;
  }

  const key = event.key.toLowerCase();
  if (key === "c") {
    if (event.metaKey || (event.ctrlKey && (event.shiftKey || hasSelection))) {
      return "copy";
    }
    return null;
  }

  if (key === "v" && (event.metaKey || event.ctrlKey)) {
    return "paste";
  }

  return null;
}

export async function copyTerminalSelection(selection: string, clipboard: ClipboardLike | undefined): Promise<boolean> {
  if (!selection || !clipboard?.writeText) {
    return false;
  }
  await clipboard.writeText(selection);
  return true;
}

export async function pasteClipboardToTerminal(terminal: PasteTarget, clipboard: ClipboardLike | undefined): Promise<boolean> {
  if (!clipboard?.readText) {
    return false;
  }
  const text = await clipboard.readText();
  if (!text) {
    return false;
  }
  terminal.focus();
  terminal.paste(text);
  return true;
}
