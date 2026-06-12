import { useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

export default function App() {
  const terminalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!terminalRef.current) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
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
    terminal.open(terminalRef.current);

    const writeBanner = () => {
      fitAddon.fit();
      terminal.writeln("\u001b[1;37mTermFlow shell ready\u001b[0m");
      terminal.writeln("");
      terminal.writeln("\u001b[38;5;180mNo active SSH sessions.\u001b[0m");
      terminal.writeln("Open a saved connection to start a terminal stream.");
      terminal.writeln("");
      terminal.writeln("\u001b[38;5;109mWaiting for an SSH session.\u001b[0m");
      terminal.write("\r\n$ ");
    };

    writeBanner();

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      terminal.dispose();
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="titlebar__brand">
          <span className="titlebar__app">TermFlow</span>
          <span className="titlebar__badge">SSH Workspace</span>
        </div>
        <div className="titlebar__meta">
          <span>No workspace selected</span>
          <span>No active session</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="rail" aria-label="Primary navigation">
          <button className="rail__item rail__item--active" type="button" aria-label="Terminal" title="Terminal">
            T
          </button>
          <button className="rail__item" type="button" aria-label="Connections" title="Connections" disabled>
            C
          </button>
          <button className="rail__item" type="button" aria-label="Files" title="Files" disabled>
            F
          </button>
          <button className="rail__item" type="button" aria-label="Settings" title="Settings" disabled>
            S
          </button>
        </aside>

        <aside className="sidebar">
          <section className="panel-card">
            <div className="panel-card__header">
              <h1>Connections</h1>
              <span className="panel-card__hint">0 configured</span>
            </div>
            <div className="empty-state">
              <strong>No connections yet</strong>
              <p>Saved hosts will appear here after a connection is added.</p>
            </div>
          </section>

          <section className="panel-card">
            <div className="panel-card__header">
              <h2>Sidebar</h2>
              <span className="panel-card__hint">Session queue</span>
            </div>
            <ul className="stack-list">
              <li>Recent sessions will appear here.</li>
              <li>Connection groups will organize saved hosts.</li>
              <li>Session details will update as terminals open.</li>
            </ul>
          </section>
        </aside>

        <main className="main-pane">
          <div className="tabs" aria-label="Session tabs">
            <span className="tab tab--active" aria-current="page">
              Welcome
            </span>
            <span className="tab">
              No session
            </span>
            <button className="tab tab--ghost" type="button" aria-label="New session" title="New session" disabled>
              +
            </button>
          </div>

          <section className="terminal-panel">
            <div className="terminal-panel__header">
              <div>
                <strong>Terminal</strong>
                <span className="terminal-panel__subtle">No SSH session attached</span>
              </div>
              <div className="terminal-panel__stats">
                <span>Shell idle</span>
                <span>Rows/Cols: auto-fit</span>
              </div>
            </div>
            <div className="terminal-panel__body">
              <div className="terminal-canvas" ref={terminalRef} />
            </div>
          </section>
        </main>
      </div>

      <footer className="statusbar">
        <span>Ready</span>
        <span>No connections configured</span>
        <span>No terminal activity</span>
      </footer>
    </div>
  );
}
