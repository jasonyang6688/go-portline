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
      terminal.writeln("Create a connection to start a terminal stream.");
      terminal.writeln("");
      terminal.writeln("\u001b[38;5;109mTask 8/9 will wire backend sessions, tabs, and events.\u001b[0m");
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
          <span className="titlebar__badge">Shell Prototype</span>
        </div>
        <div className="titlebar__meta">
          <span>Workspace: local</span>
          <span>Transport: offline</span>
          <span>Sessions: 0</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="rail" aria-label="Primary navigation">
          <button className="rail__item rail__item--active" type="button">
            T
          </button>
          <button className="rail__item" type="button">
            C
          </button>
          <button className="rail__item" type="button">
            F
          </button>
          <button className="rail__item" type="button">
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
              <p>Saved hosts, credential helpers, and quick actions arrive in Task 8.</p>
            </div>
          </section>

          <section className="panel-card">
            <div className="panel-card__header">
              <h2>Sidebar</h2>
              <span className="panel-card__hint">Placeholder</span>
            </div>
            <ul className="stack-list">
              <li>Recent sessions will appear here.</li>
              <li>File and tunnel tools remain unmounted.</li>
              <li>Backend status is intentionally absent.</li>
            </ul>
          </section>
        </aside>

        <main className="main-pane">
          <div className="tabs">
            <button className="tab tab--active" type="button">
              Welcome
            </button>
            <button className="tab" type="button">
              No session
            </button>
            <button className="tab tab--ghost" type="button">
              +
            </button>
          </div>

          <section className="terminal-panel">
            <div className="terminal-panel__header">
              <div>
                <strong>Terminal</strong>
                <span className="terminal-panel__subtle">Ready for backend session attachment</span>
              </div>
              <div className="terminal-panel__stats">
                <span>Shell: idle</span>
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
        <span>State: shell-only UI</span>
        <span>Next: Wails bridge and session manager</span>
        <span>Build target: frontend/dist</span>
      </footer>
    </div>
  );
}
