import { useCallback, useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { resizeTerminal, writeTerminal } from "../../shared/api/wails";
import type { Session, TerminalSize } from "../connections/types";

interface Props {
  session: Session | null;
  terminalBuffer: string;
  themeMode: "dark" | "light";
  layoutKey?: string;
  onTerminalSizeChange?(size: TerminalSize): void;
  onFullscreenChange?(sessionId: string, fullscreen: boolean): void;
  onCommandCommit?(command: string): void;
}

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

export function TerminalPane({ session, terminalBuffer, themeMode, layoutKey, onTerminalSizeChange, onFullscreenChange, onCommandCommit }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const lastSentSizeRef = useRef<TerminalSize | null>(null);
  const lastWrittenBufferRef = useRef("");
  const sizeChangeRef = useRef<Props["onTerminalSizeChange"]>(onTerminalSizeChange);
  const fullscreenChangeRef = useRef<Props["onFullscreenChange"]>(onFullscreenChange);
  const commandCommitRef = useRef<Props["onCommandCommit"]>(onCommandCommit);
  const fullscreenRef = useRef(false);
  const pendingCommandRef = useRef("");
  const scheduleFitRef = useRef<(() => void) | null>(null);
  const fitAfterLayoutRef = useRef<(() => void) | null>(null);

  const focusTerminal = useCallback(() => {
    terminalRef.current?.focus();
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
    if (!session || !hostRef.current) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.65,
      theme: themeMode === "light" ? LIGHT_TERMINAL_THEME : DARK_TERMINAL_THEME,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(hostRef.current);
    hostRef.current.querySelector("textarea")?.setAttribute("name", "xterm-terminal-input");
    terminal.focus();

    terminalRef.current = terminal;
    lastSentSizeRef.current = null;
    lastWrittenBufferRef.current = "";
    fullscreenRef.current = false;
    pendingCommandRef.current = "";
    let fitFrameId: number | null = null;

    const syncFullscreenState = () => {
      const fullscreen = terminal.buffer.active.type === "alternate";
      if (fullscreenRef.current === fullscreen) {
        return;
      }
      fullscreenRef.current = fullscreen;
      fullscreenChangeRef.current?.(session.id, fullscreen);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          syncTerminalSize();
          terminal.focus();
        });
      });
    };

    const syncTerminalSize = () => {
      fitAddon.fit();
      const size = { cols: terminal.cols, rows: terminal.rows };
      if (size.cols <= 0 || size.rows <= 0) {
        return;
      }
      const lastSentSize = lastSentSizeRef.current;
      if (lastSentSize?.cols === size.cols && lastSentSize.rows === size.rows) {
        return;
      }
      lastSentSizeRef.current = size;
      sizeChangeRef.current?.(size);
      try {
        void resizeTerminal(session.id, size).catch(() => {});
      } catch {
        // The browser-only preview has no Wails runtime.
      }
    };

    const scheduleTerminalFit = () => {
      if (fitFrameId !== null) {
        return;
      }
      fitFrameId = window.requestAnimationFrame(() => {
        fitFrameId = null;
        syncTerminalSize();
      });
    };
    scheduleFitRef.current = scheduleTerminalFit;
    fitAfterLayoutRef.current = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          syncTerminalSize();
          terminal.focus();
        });
      });
    };

    const inputDisposable = terminal.onData((data) => {
      if (!fullscreenRef.current && !data.startsWith("\u001b")) {
        for (const char of data) {
          if (char === "\r" || char === "\n") {
            const command = pendingCommandRef.current.trim();
            pendingCommandRef.current = "";
            if (command) {
              commandCommitRef.current?.(command);
            }
            continue;
          }
          if (char === "\u0003") {
            pendingCommandRef.current = "";
            continue;
          }
          if (char === "\u007f" || char === "\b") {
            pendingCommandRef.current = pendingCommandRef.current.slice(0, -1);
            continue;
          }
          if (char === "\u0015") {
            pendingCommandRef.current = "";
            continue;
          }
          if (char >= " ") {
            pendingCommandRef.current += char;
          }
        }
      }
      try {
        void writeTerminal(session.id, data).catch(() => {});
      } catch {
        // The browser-only preview has no Wails runtime.
      }
    });
    const writeParsedDisposable = terminal.onWriteParsed(syncFullscreenState);

    const resizeObserver = new ResizeObserver(() => {
      scheduleTerminalFit();
    });
    resizeObserver.observe(hostRef.current);

    scheduleTerminalFit();
    const settledFrameId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(syncTerminalSize);
    });

    return () => {
      if (fitFrameId !== null) {
        window.cancelAnimationFrame(fitFrameId);
      }
      window.cancelAnimationFrame(settledFrameId);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      writeParsedDisposable.dispose();
      if (fullscreenRef.current) {
        fullscreenChangeRef.current?.(session.id, false);
      }
      terminalRef.current = null;
      lastSentSizeRef.current = null;
      lastWrittenBufferRef.current = "";
      fullscreenRef.current = false;
      pendingCommandRef.current = "";
      scheduleFitRef.current = null;
      fitAfterLayoutRef.current = null;
      terminal.dispose();
    };
  }, [session?.id, themeMode]);

  useEffect(() => {
    fitAfterLayoutRef.current?.();
  }, [layoutKey]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!session || !terminal) {
      return;
    }

    const previousBuffer = lastWrittenBufferRef.current;
    if (terminalBuffer === previousBuffer) {
      return;
    }

    if (terminalBuffer.startsWith(previousBuffer)) {
      terminal.write(terminalBuffer.slice(previousBuffer.length), () => {
        scheduleFitRef.current?.();
      });
    } else {
      terminal.reset();
      terminal.write(terminalBuffer, () => {
        scheduleFitRef.current?.();
      });
    }
    lastWrittenBufferRef.current = terminalBuffer;
  }, [session, terminalBuffer]);

  if (!session) {
    return (
      <div className="terminal-empty-state" role="status" aria-live="polite">
        <strong>No active SSH session</strong>
        <span>Create or open a connection from the sidebar to start streaming shell output.</span>
      </div>
    );
  }

  return (
    <div className="terminal-canvas" onPointerDown={focusTerminal}>
      <div className="terminal-host" ref={hostRef} />
    </div>
  );
}
