import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import {
  copyTerminalSelection,
  pasteClipboardToTerminal,
  terminalClipboardShortcutAction,
} from "../../app/terminalClipboard";
import { shouldUseTerminalKeyboardFallback, terminalKeyDataFromKeyboardEvent } from "../../app/terminalKeyboard";
import { resolveTerminalWrite } from "../../app/terminalReplay";
import { reconcileTerminalSessions } from "../../app/terminalSessions";
import { resizeTerminal, writeTerminal } from "../../shared/api/wails";
import type { Session, TerminalSize } from "../connections/types";

interface Props {
  activeSessionId: string | null;
  sessions: Session[];
  terminalBuffers: Record<string, string>;
  themeMode: "dark" | "light";
  layoutKey?: string;
  onTerminalSizeChange?(size: TerminalSize): void;
  onFullscreenChange?(sessionId: string, fullscreen: boolean): void;
  onCommandCommit?(command: string): void;
}

type Disposable = {
  dispose(): void;
};

type TerminalEntry = {
  terminal: Terminal;
  fitAddon: FitAddon;
  resizeObserver: ResizeObserver;
  clipboardDisposable: Disposable;
  inputDisposable: Disposable;
  writeParsedDisposable: Disposable;
  lastSentSize: TerminalSize | null;
  lastWrittenBuffer: string;
  fullscreen: boolean;
  pendingCommand: string;
  fitFrameId: number | null;
  settledFrameId: number | null;
};

const DARK_TERMINAL_THEME = {
  background: "#0b0d14",
  foreground: "#cad3f5",
  cursor: "#f4dbd6",
  cursorAccent: "#0b0d14",
  selectionBackground: "#3b4261",
  selectionForeground: "#f4dbd6",
  black: "#181926",
  red: "#ed8796",
  green: "#a6da95",
  yellow: "#eed49f",
  blue: "#8aadf4",
  magenta: "#c6a0f6",
  cyan: "#91d7e3",
  white: "#cad3f5",
  brightBlack: "#5b6078",
  brightRed: "#ed8796",
  brightGreen: "#a6da95",
  brightYellow: "#eed49f",
  brightBlue: "#8aadf4",
  brightMagenta: "#f5bde6",
  brightCyan: "#8bd5ca",
  brightWhite: "#f4dbd6",
};

const LIGHT_TERMINAL_THEME = {
  background: "#eff1f5",
  foreground: "#5c5f77",
  cursor: "#1e66f5",
  cursorAccent: "#ffffff",
  selectionBackground: "#1e66f5",
  selectionForeground: "#ffffff",
  black: "#5c5f77",
  red: "#d20f39",
  green: "#40a02b",
  yellow: "#df8e1d",
  blue: "#1e66f5",
  magenta: "#8839ef",
  cyan: "#179299",
  white: "#4c4f69",
  brightBlack: "#9ca0b0",
  brightRed: "#d20f39",
  brightGreen: "#40a02b",
  brightYellow: "#df8e1d",
  brightBlue: "#1e66f5",
  brightMagenta: "#8839ef",
  brightCyan: "#04a5e5",
  brightWhite: "#4c4f69",
};

const MINIMUM_TERMINAL_CONTRAST_RATIO = 4.5;

export function TerminalPane({
  activeSessionId,
  sessions,
  terminalBuffers,
  themeMode,
  layoutKey,
  onTerminalSizeChange,
  onFullscreenChange,
  onCommandCommit,
}: Props) {
  const hostRefs = useRef(new Map<string, HTMLDivElement>());
  const terminalEntriesRef = useRef(new Map<string, TerminalEntry>());
  const activeSessionIdRef = useRef<string | null>(activeSessionId);
  const sizeChangeRef = useRef<Props["onTerminalSizeChange"]>(onTerminalSizeChange);
  const fullscreenChangeRef = useRef<Props["onFullscreenChange"]>(onFullscreenChange);
  const commandCommitRef = useRef<Props["onCommandCommit"]>(onCommandCommit);
  const [contextMenu, setContextMenu] = useState<{ sessionId: string; x: number; y: number; canCopy: boolean } | null>(
    null,
  );

  const focusTerminal = useCallback(() => {
    const activeSession = activeSessionIdRef.current;
    if (!activeSession) {
      return;
    }
    terminalEntriesRef.current.get(activeSession)?.terminal.focus();
  }, []);

  const clipboard = () => (typeof navigator === "undefined" ? undefined : navigator.clipboard);

  const copySessionSelection = useCallback(async (sessionId: string) => {
    const entry = terminalEntriesRef.current.get(sessionId);
    if (!entry) {
      return false;
    }
    const copied = await copyTerminalSelection(entry.terminal.getSelection(), clipboard());
    if (copied) {
      entry.terminal.clearSelection();
      entry.terminal.focus();
    }
    return copied;
  }, []);

  const pasteToSession = useCallback(async (sessionId: string) => {
    const entry = terminalEntriesRef.current.get(sessionId);
    if (!entry) {
      return false;
    }
    return pasteClipboardToTerminal(entry.terminal, clipboard());
  }, []);

  const setHostRef = useCallback((sessionId: string, host: HTMLDivElement | null) => {
    if (host) {
      hostRefs.current.set(sessionId, host);
      return;
    }
    hostRefs.current.delete(sessionId);
  }, []);

  useEffect(() => {
    sizeChangeRef.current = onTerminalSizeChange;
  }, [onTerminalSizeChange]);

  useEffect(() => {
    fullscreenChangeRef.current = onFullscreenChange;
  }, [onFullscreenChange]);

  useEffect(() => {
    commandCommitRef.current = onCommandCommit;
  }, [onCommandCommit]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const writeToSession = useCallback((sessionId: string, data: string) => {
    try {
      void writeTerminal(sessionId, data).catch(() => {});
    } catch {
      // The browser-only preview has no Wails runtime.
    }
  }, []);

  const disposeTerminalEntry = useCallback((sessionId: string) => {
    const entry = terminalEntriesRef.current.get(sessionId);
    if (!entry) {
      return;
    }
    if (entry.fitFrameId !== null) {
      window.cancelAnimationFrame(entry.fitFrameId);
    }
    if (entry.settledFrameId !== null) {
      window.cancelAnimationFrame(entry.settledFrameId);
    }
    entry.resizeObserver.disconnect();
    entry.clipboardDisposable.dispose();
    entry.inputDisposable.dispose();
    entry.writeParsedDisposable.dispose();
    if (entry.fullscreen) {
      fullscreenChangeRef.current?.(sessionId, false);
    }
    entry.terminal.dispose();
    terminalEntriesRef.current.delete(sessionId);
  }, []);

  const syncTerminalSize = useCallback((sessionId: string) => {
    if (activeSessionIdRef.current !== sessionId) {
      return;
    }
    const entry = terminalEntriesRef.current.get(sessionId);
    if (!entry) {
      return;
    }
    entry.fitAddon.fit();
    const size = { cols: entry.terminal.cols, rows: entry.terminal.rows };
    if (size.cols <= 0 || size.rows <= 0) {
      return;
    }
    const lastSentSize = entry.lastSentSize;
    if (lastSentSize?.cols === size.cols && lastSentSize.rows === size.rows) {
      return;
    }
    entry.lastSentSize = size;
    sizeChangeRef.current?.(size);
    try {
      void resizeTerminal(sessionId, size).catch(() => {});
    } catch {
      // The browser-only preview has no Wails runtime.
    }
  }, []);

  const scheduleTerminalFit = useCallback((sessionId: string) => {
    const entry = terminalEntriesRef.current.get(sessionId);
    if (!entry || entry.fitFrameId !== null) {
      return;
    }
    entry.fitFrameId = window.requestAnimationFrame(() => {
      entry.fitFrameId = null;
      syncTerminalSize(sessionId);
    });
  }, [syncTerminalSize]);

  const fitAfterLayout = useCallback((sessionId: string) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        syncTerminalSize(sessionId);
        if (activeSessionIdRef.current === sessionId) {
          terminalEntriesRef.current.get(sessionId)?.terminal.focus();
        }
      });
    });
  }, [syncTerminalSize]);

  const createTerminalEntry = useCallback((session: Session, host: HTMLDivElement) => {
    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.65,
      minimumContrastRatio: MINIMUM_TERMINAL_CONTRAST_RATIO,
      theme: themeMode === "light" ? LIGHT_TERMINAL_THEME : DARK_TERMINAL_THEME,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);
    host.querySelector("textarea")?.setAttribute("name", "xterm-terminal-input");

    const entry = {
      terminal,
      fitAddon,
      resizeObserver: undefined as unknown as ResizeObserver,
      clipboardDisposable: undefined as unknown as Disposable,
      inputDisposable: undefined as unknown as Disposable,
      writeParsedDisposable: undefined as unknown as Disposable,
      lastSentSize: null,
      lastWrittenBuffer: "",
      fullscreen: false,
      pendingCommand: "",
      fitFrameId: null,
      settledFrameId: null,
    };

    const syncFullscreenState = () => {
      const fullscreen = entry.terminal.buffer.active.type === "alternate";
      if (entry.fullscreen === fullscreen) {
        return;
      }
      entry.fullscreen = fullscreen;
      fullscreenChangeRef.current?.(session.id, fullscreen);
      fitAfterLayout(session.id);
    };

    entry.inputDisposable = terminal.onData((data) => {
      if (!entry.fullscreen && !data.startsWith("\u001b")) {
        for (const char of data) {
          if (char === "\r" || char === "\n") {
            const command = entry.pendingCommand.trim();
            entry.pendingCommand = "";
            if (command) {
              commandCommitRef.current?.(command);
            }
            continue;
          }
          if (char === "\u0003") {
            entry.pendingCommand = "";
            continue;
          }
          if (char === "\u007f" || char === "\b") {
            entry.pendingCommand = entry.pendingCommand.slice(0, -1);
            continue;
          }
          if (char === "\u0015") {
            entry.pendingCommand = "";
            continue;
          }
          if (char >= " ") {
            entry.pendingCommand += char;
          }
        }
      }
      writeToSession(session.id, data);
    });
    entry.writeParsedDisposable = terminal.onWriteParsed(syncFullscreenState);

    const handleCopy = (event: ClipboardEvent) => {
      const selection = terminal.getSelection();
      if (!selection || !event.clipboardData) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.clipboardData.setData("text/plain", selection);
      terminal.clearSelection();
      terminal.focus();
    };

    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text/plain");
      if (!text) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      terminal.focus();
      terminal.paste(text);
    };

    const handleClipboardKeyDown = (event: KeyboardEvent) => {
      const action = terminalClipboardShortcutAction(event, Boolean(terminal.getSelection()));
      if (!action) {
        return;
      }
      const supportsClipboard =
        action === "copy" ? Boolean(clipboard()?.writeText) : Boolean(clipboard()?.readText);
      if (!supportsClipboard) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (action === "copy") {
        void copySessionSelection(session.id).catch(() => {});
      } else {
        void pasteToSession(session.id).catch(() => {});
      }
    };

    host.addEventListener("copy", handleCopy);
    host.addEventListener("paste", handlePaste);
    host.addEventListener("keydown", handleClipboardKeyDown, true);
    entry.clipboardDisposable = {
      dispose() {
        host.removeEventListener("copy", handleCopy);
        host.removeEventListener("paste", handlePaste);
        host.removeEventListener("keydown", handleClipboardKeyDown, true);
      },
    };

    entry.resizeObserver = new ResizeObserver(() => {
      scheduleTerminalFit(session.id);
    });
    entry.resizeObserver.observe(host);
    terminalEntriesRef.current.set(session.id, entry);
    scheduleTerminalFit(session.id);
    entry.settledFrameId = window.requestAnimationFrame(() => {
      entry.settledFrameId = null;
      window.requestAnimationFrame(() => syncTerminalSize(session.id));
    });
  }, [copySessionSelection, fitAfterLayout, pasteToSession, scheduleTerminalFit, syncTerminalSize, themeMode, writeToSession]);

  const registerTerminalHost = useCallback((session: Session, host: HTMLDivElement | null) => {
    setHostRef(session.id, host);
    if (!host || terminalEntriesRef.current.has(session.id)) {
      return;
    }
    createTerminalEntry(session, host);
  }, [createTerminalEntry, setHostRef]);

  useLayoutEffect(() => {
    const sessionsById = new Map(sessions.map((session) => [session.id, session]));
    const { createIds, disposeIds } = reconcileTerminalSessions(terminalEntriesRef.current.keys(), sessions);
    disposeIds.forEach(disposeTerminalEntry);

    for (const sessionId of createIds) {
      const session = sessionsById.get(sessionId);
      const host = hostRefs.current.get(sessionId);
      if (session && host) {
        createTerminalEntry(session, host);
      }
    }

    const theme = themeMode === "light" ? LIGHT_TERMINAL_THEME : DARK_TERMINAL_THEME;
    for (const entry of terminalEntriesRef.current.values()) {
      entry.terminal.options.theme = theme;
    }
  }, [createTerminalEntry, disposeTerminalEntry, sessions, themeMode]);

  useEffect(() => () => {
    for (const sessionId of [...terminalEntriesRef.current.keys()]) {
      disposeTerminalEntry(sessionId);
    }
  }, [disposeTerminalEntry]);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }
    fitAfterLayout(activeSessionId);
  }, [activeSessionId, fitAfterLayout, layoutKey]);

  useEffect(() => {
    const handleFullscreenKeyDown = (event: KeyboardEvent) => {
      const sessionId = activeSessionIdRef.current;
      if (!sessionId) {
        return;
      }
      const entry = terminalEntriesRef.current.get(sessionId);
      if (!entry?.fullscreen || !shouldUseTerminalKeyboardFallback(event.target)) {
        return;
      }
      const data = terminalKeyDataFromKeyboardEvent(event);
      if (!data) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      entry.terminal.focus();
      writeToSession(sessionId, data);
    };

    window.addEventListener("keydown", handleFullscreenKeyDown, true);
    return () => window.removeEventListener("keydown", handleFullscreenKeyDown, true);
  }, [writeToSession]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const dismiss = () => setContextMenu(null);
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismiss);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismiss);
    };
  }, [contextMenu]);

  const handleCanvasPointerDown = useCallback(() => {
    setContextMenu(null);
    focusTerminal();
  }, [focusTerminal]);

  const handleTerminalContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) {
      return;
    }
    const entry = terminalEntriesRef.current.get(sessionId);
    if (!entry) {
      return;
    }
    event.preventDefault();
    setContextMenu({
      sessionId,
      x: event.clientX,
      y: event.clientY,
      canCopy: Boolean(entry.terminal.getSelection()),
    });
  }, []);

  useEffect(() => {
    for (const [sessionId, entry] of terminalEntriesRef.current.entries()) {
      const terminalBuffer = terminalBuffers[sessionId] ?? "";
      const previousBuffer = entry.lastWrittenBuffer;
      const write = resolveTerminalWrite(previousBuffer, terminalBuffer);
      if (write.kind === "noop") {
        continue;
      }

      if (write.kind === "append") {
        entry.terminal.write(write.data, () => {
          scheduleTerminalFit(sessionId);
        });
      } else {
        entry.terminal.reset();
        entry.terminal.write(write.data, () => {
          scheduleTerminalFit(sessionId);
        });
      }
      entry.lastWrittenBuffer = terminalBuffer;
    }
  }, [scheduleTerminalFit, sessions, terminalBuffers]);

  if (!activeSessionId || sessions.length === 0) {
    return (
      <div className="terminal-empty-state" role="status" aria-live="polite">
        <strong>No active SSH session</strong>
        <span>Create or open a connection from the sidebar to start streaming shell output.</span>
      </div>
    );
  }

  return (
    <>
      <div className="terminal-canvas" onContextMenu={handleTerminalContextMenu} onPointerDown={handleCanvasPointerDown}>
        {sessions.map((session) => (
          <div
            aria-hidden={session.id !== activeSessionId}
            className={`terminal-host${session.id === activeSessionId ? " terminal-host--active" : ""}`}
            data-session-id={session.id}
            key={session.id}
            ref={(host) => registerTerminalHost(session, host)}
          />
        ))}
      </div>
      {contextMenu ? (
        <div
          className="terminal-clipboard-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            disabled={!contextMenu.canCopy}
            onClick={() => {
              void copySessionSelection(contextMenu.sessionId);
              setContextMenu(null);
            }}
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => {
              void pasteToSession(contextMenu.sessionId);
              setContextMenu(null);
            }}
          >
            Paste
          </button>
        </div>
      ) : null}
    </>
  );
}
