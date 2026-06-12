import { useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import {
  onWailsEvent,
  resizeTerminal,
  writeTerminal,
} from "../../shared/api/wails";
import type {
  Session,
  SessionOutputEvent,
  SessionStatusEvent,
  TerminalSize,
} from "../connections/types";
import {
  SESSION_OUTPUT_EVENT,
  SESSION_STATUS_EVENT,
} from "../connections/types";

interface Props {
  session: Session | null;
  onTerminalSizeChange?(size: TerminalSize): void;
}

function formatStatusMessage(event: SessionStatusEvent): string {
  const detail = event.message.trim();
  return detail ? `[${event.status}] ${detail}` : `[${event.status}]`;
}

export function TerminalPane({ session, onTerminalSizeChange }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
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

    const syncTerminalSize = () => {
      fitAddon.fit();
      const size = { cols: terminal.cols, rows: terminal.rows };
      if (size.cols <= 0 || size.rows <= 0) {
        return;
      }
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
      terminal.dispose();
    };
  }, [session?.id]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const offOutput = onWailsEvent<SessionOutputEvent>(SESSION_OUTPUT_EVENT, (event) => {
      if (event.sessionId === session.id) {
        terminalRef.current?.write(event.data);
      }
    });
    const offStatus = onWailsEvent<SessionStatusEvent>(SESSION_STATUS_EVENT, (event) => {
      if (event.sessionId !== session.id) {
        return;
      }
      terminalRef.current?.writeln(`\r\n\u001b[38;5;245m${formatStatusMessage(event)}\u001b[0m`);
    });

    return () => {
      offOutput();
      offStatus();
    };
  }, [session?.id]);

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
