import { useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { resizeTerminal, writeTerminal } from "../../shared/api/wails";
import type { Session, TerminalSize } from "../connections/types";

interface Props {
  session: Session | null;
  terminalBuffer: string;
  onTerminalSizeChange?(size: TerminalSize): void;
}

export function TerminalPane({ session, terminalBuffer, onTerminalSizeChange }: Props) {
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
      fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.15,
      theme: {
        background: "#101214",
        foreground: "#d7d7cf",
        black: "#0b0d0e",
        red: "#d36c5a",
        green: "#7ea66a",
        yellow: "#c7a96b",
        blue: "#6d8dad",
        magenta: "#936c98",
        cyan: "#62a6a3",
        white: "#d6d1c4",
        brightBlack: "#5a615f",
        brightRed: "#ec8d77",
        brightGreen: "#92c37c",
        brightYellow: "#e4c780",
        brightBlue: "#8cb0d3",
        brightMagenta: "#bc89c4",
        brightCyan: "#87c7c1",
        brightWhite: "#f3efe3",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(hostRef.current);
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
      void resizeTerminal(session.id, size);
    };

    const inputDisposable = terminal.onData((data) => {
      void writeTerminal(session.id, data);
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
  }, [session?.id]);

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
