import { useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { resizeTerminal, writeTerminal } from "../../shared/api/wails";
import type { Session, TerminalSize } from "../connections/types";

interface Props {
  session: Session | null;
  terminalBuffer: string;
  themeMode: "dark" | "light";
  onTerminalSizeChange?(size: TerminalSize): void;
}

const DARK_TERMINAL_THEME = {
  background: "#0b0d14",
  foreground: "#cad3f5",
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

export function TerminalPane({ session, terminalBuffer, themeMode, onTerminalSizeChange }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const lastSentSizeRef = useRef<TerminalSize | null>(null);
  const lastWrittenBufferRef = useRef("");
  const sizeChangeRef = useRef<Props["onTerminalSizeChange"]>(onTerminalSizeChange);

  useEffect(() => {
    sizeChangeRef.current = onTerminalSizeChange;
  }, [onTerminalSizeChange]);

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

    const inputDisposable = terminal.onData((data) => {
      try {
        void writeTerminal(session.id, data).catch(() => {});
      } catch {
        // The browser-only preview has no Wails runtime.
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      syncTerminalSize();
    });
    resizeObserver.observe(hostRef.current);

    const frameId = window.requestAnimationFrame(syncTerminalSize);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      terminalRef.current = null;
      lastSentSizeRef.current = null;
      lastWrittenBufferRef.current = "";
      terminal.dispose();
    };
  }, [session?.id, themeMode]);

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
      terminal.write(terminalBuffer.slice(previousBuffer.length));
    } else {
      terminal.reset();
      terminal.write(terminalBuffer);
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

  return <div className="terminal-canvas" ref={hostRef} />;
}
