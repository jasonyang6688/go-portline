const { useState, useEffect, useRef } = React;

const VIEWS = ['terminal', 'files', 'monitor', 'commands', 'settings'];

const INITIAL_SESSIONS = [
{ id: 's1', connId: 'c1', name: 'prod-01', type: 'SSH', status: 'connected', env: 'prod' },
{ id: 's2', connId: 'c5', name: 'Ubuntu 22.04', type: 'WSL', status: 'connected' }];


function TitleBar({ sessions, activeId, onSwitch, onClose, onNew, onOpenPalette, view, theme, onToggleTheme }) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return (
    <header className="titlebar">
      <div className="tb-controls">
        <button className="tb-btn close" title="Close" />
        <button className="tb-btn min" title="Minimize" />
        <button className="tb-btn max" title="Maximize" />
      </div>
      <div className="tb-brand">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect width="18" height="18" rx="4" fill="var(--accent)" opacity="0.15" />
          <path d="M4 13L8 9L4 5" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="10" y1="13" x2="14" y2="13" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        TermFlow
      </div>

      {/* Session tabs in titlebar for terminal/files/monitor views */}
      <div className="tb-tabs" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2px', padding: '0 12px', overflowX: 'auto', overflowY: 'hidden', minWidth: 0 }} data-comment-anchor="4ee6bc4db3-div-31-9">
        {['terminal', 'files', 'monitor'].includes(view) && sessions.length > 0 && (
          <React.Fragment>
          {sessions.map((s) =>
        <div
          key={s.id}
          onClick={() => onSwitch(s.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '3px 10px 3px 8px', borderRadius: 'var(--r-sm)',
            cursor: 'pointer', fontSize: '12px',
            background: activeId === s.id ? 'var(--surface0)' : 'transparent',
            color: activeId === s.id ? 'var(--text)' : 'var(--overlay1)',
            border: activeId === s.id ? '1px solid var(--surface1)' : '1px solid transparent',
            transition: 'all var(--t)', flexShrink: 0
          }}>

              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.status === 'connected' ? (s.env === 'prod' ? 'var(--red)' : 'var(--green)') : 'var(--surface2)', boxShadow: s.status === 'connected' ? `0 0 4px ${s.env === 'prod' ? 'var(--red)' : 'var(--green)'}` : 'none', display: 'inline-block', flexShrink: 0 }} />
              {s.name}
              <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: s.env === 'prod' ? 'rgba(237,135,150,0.18)' : 'var(--surface1)', color: s.env === 'prod' ? 'var(--red)' : 'var(--overlay0)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginLeft: '2px' }}>{s.env === 'prod' ? 'PROD' : s.type}</span>
              <span
            onClick={(e) => {e.stopPropagation();onClose(s.id);}}
            style={{ marginLeft: '2px', fontSize: '13px', color: 'var(--overlay0)', cursor: 'pointer', opacity: 0, transition: 'opacity var(--t)', borderRadius: '3px', padding: '0 2px', lineHeight: 1 }}
            onMouseEnter={(e) => {e.target.style.opacity = 1;e.target.style.color = 'var(--red)';}}
            onMouseLeave={(e) => {e.target.style.opacity = 0;e.target.style.color = 'var(--overlay0)';}}>
            ×</span>
            </div>
        )}
          <button
          onClick={onNew}
          style={{ width: 24, height: 24, borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', color: 'var(--overlay0)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--t)', flexShrink: 0 }}
          onMouseEnter={(e) => {e.target.style.background = 'var(--surface0)';e.target.style.color = 'var(--text)';}}
          onMouseLeave={(e) => {e.target.style.background = 'transparent';e.target.style.color = 'var(--overlay0)';}}>
          +</button>
          </React.Fragment>
        )}
        </div>

      <div className="tb-right">
        <button
          onClick={onOpenPalette}
          title="Command palette (⌘K)"
          style={{ display: 'flex', alignItems: 'center', gap: '7px', height: '24px', padding: '0 8px 0 9px', borderRadius: 'var(--r-sm)', border: '1px solid var(--surface0)', background: 'var(--base)', color: 'var(--overlay1)', cursor: 'pointer', fontSize: '11.5px', fontFamily: 'var(--font-ui)', transition: 'all var(--t)' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--subtext1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--surface0)'; e.currentTarget.style.color = 'var(--overlay1)'; }}>
          <Icon name="search" size={12} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '1px 4px', borderRadius: '3px', background: 'var(--surface0)', color: 'var(--overlay1)' }}>⌘K</span>
        </button>
        <span style={{ fontSize: '11px', color: 'var(--overlay0)', fontFamily: 'var(--font-mono)', padding: '0 8px' }}>{timeStr}</span>
        <button className="tb-icon-btn" title={theme === 'light' ? 'Switch to dark' : 'Switch to light'} onClick={onToggleTheme}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={14} /></button>
        <button className="tb-icon-btn" title="Notifications"><Icon name="bell" size={14} /></button>
        <button className="tb-icon-btn" title="Account"><Icon name="user" size={14} /></button>
      </div>
    </header>);

}

function StatusBar({ sessions, activeId, view, connections }) {
  const activeS = sessions.find((s) => s.id === activeId);
  const conn = activeS ? (connections || []).find((c) => c.id === activeS.connId) : null;
  return (
    <footer className="statusbar">
      <div className="sb-seg">
        <Icon name="terminal" size={11} />
        TermFlow v0.1.4
      </div>
      {activeS &&
      <>
          <div className="sb-seg">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(13,15,20,0.7)', display: 'inline-block' }} />
            {activeS.name}
            {activeS.env === 'prod' && <span className="sb-env">PROD</span>}
          </div>
          {conn?.host &&
        <div className="sb-seg">
              <Icon name="network" size={11} />
              {conn.user}@{conn.host}:{conn.port || 22}
            </div>
        }
        </>
      }
      <div className="sb-seg" style={{ marginLeft: 'auto', borderLeft: '1px solid rgba(13,15,20,0.15)', borderRight: 'none' }}>
        {sessions.filter((s) => s.status === 'connected').length} sessions
      </div>
      <div className="sb-seg" style={{ borderRight: 'none' }}>
        <Icon name="shield" size={11} />
        Encrypted
      </div>
    </footer>);

}

function AccountView() {
  const stats = [
  { label: 'Saved Connections', value: '6', icon: 'server' },
  { label: 'Active Sessions', value: '2', icon: 'terminal' },
  { label: 'Saved Commands', value: '12', icon: 'commands' },
  { label: 'SSH Keys', value: '3', icon: 'key' }];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="view-header">
        <Icon name="user" size={16} style={{ color: 'var(--accent)' }} />
        <span className="view-header-title">Account</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px', maxWidth: '720px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '28px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--blue), var(--mauve))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 700, color: '#fff' }}>JY</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>Jason Yang</div>
            <div style={{ fontSize: '13px', color: 'var(--overlay1)' }}>jason@termflow.dev</div>
            <div style={{ fontSize: '11px', color: 'var(--green)', marginTop: '4px' }}>● Local profile · TermFlow v0.1.4</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '28px' }}>
          {stats.map((s) =>
          <div key={s.label} style={{ background: 'var(--mantle)', border: '1px solid var(--surface0)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
              <Icon name={s.icon} size={15} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
              <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--overlay1)' }}>{s.label}</div>
            </div>
          )}
        </div>
        <div style={{ background: 'var(--mantle)', border: '1px solid var(--surface0)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          {[
          { l: 'Export configuration', d: 'Save all connections and commands to a file', icon: 'download' },
          { l: 'Import configuration', d: 'Restore from a backup file', icon: 'upload' },
          { l: 'Sync settings', d: 'Keep settings across devices', icon: 'refresh' }].
          map((r, i, arr) =>
          <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--surface0)' : 'none', cursor: 'pointer', transition: 'background 140ms' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--base)'}
          onMouseLeave={(e) => e.currentTarget.style.background = ''}>

              <Icon name={r.icon} size={15} style={{ color: 'var(--overlay1)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: 'var(--subtext1)' }}>{r.l}</div>
                <div style={{ fontSize: '11px', color: 'var(--overlay0)' }}>{r.d}</div>
              </div>
              <Icon name="chevronRight" size={14} style={{ color: 'var(--overlay0)' }} />
            </div>
          )}
        </div>
      </div>
    </div>);

}

function App() {
  const [view, setView] = useState('terminal');
  const [sessions, setSessions] = useState(INITIAL_SESSIONS);
  const [activeId, setActiveId] = useState('s1');
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeConnId, setActiveConnId] = useState('c1');
  const [theme, setTheme] = useState('light');
  const [connGroups, setConnGroups] = useState(() => window.CONNECTIONS || []);
  const [connModal, setConnModal] = useState({ open: false, initial: null });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingCmd, setPendingCmd] = useState(null);
  const [paramReq, setParamReq] = useState(null);
  const [editFile, setEditFile] = useState(null);
  const [pinned, setPinned] = useState(() => {
    const s = localStorage.getItem('tf-pinned');
    return s ? JSON.parse(s) : [3, 5, 13, 7, 14];
  });
  useEffect(() => { localStorage.setItem('tf-pinned', JSON.stringify(pinned)); }, [pinned]);
  const togglePin = (id) => setPinned((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const pinnedCommands = (window.SAVED_COMMANDS || [])
    .filter((c) => pinned.includes(c.id))
    .sort((a, b) => pinned.indexOf(a.id) - pinned.indexOf(b.id));

  const flatConns = connGroups.flatMap((g) => g.children);

  // ⌘K / Ctrl+K command palette · ⌘B toggles the connections sidebar
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleSidebarRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Persist + apply theme
  useEffect(() => {
    const saved = localStorage.getItem('tf-theme');
    if (saved) setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tf-theme', theme);
  }, [theme]);

  // Persist sidebar width
  useEffect(() => {
    const saved = localStorage.getItem('tf-sidebar-w');
    if (saved) setSidebarWidth(+saved);
  }, []);
  useEffect(() => {
    localStorage.setItem('tf-sidebar-w', sidebarWidth);
  }, [sidebarWidth]);

  const handleConnect = (conn) => {
    setActiveConnId(conn.id);
    const existing = sessions.find((s) => s.connId === conn.id);
    if (existing) {
      setActiveId(existing.id);
      if (!['terminal', 'files', 'monitor'].includes(view)) setView('terminal');
      return;
    }
    const newSession = {
      id: 's' + Date.now(),
      connId: conn.id,
      name: conn.name,
      type: conn.type === 'wsl' ? 'WSL' : 'SSH',
      host: conn.host,
      user: conn.user,
      env: conn.env,
      status: 'connected'
    };
    setSessions((prev) => [...prev, newSession]);
    setActiveId(newSession.id);
    if (!['terminal', 'files', 'monitor'].includes(view)) setView('terminal');
  };

  const handleClose = (id) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  };

  const handleDisconnect = (id) => {
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'disconnected' } : s));
  };
  const handleReconnect = (id) => {
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'connected' } : s));
  };

  const openNewConn = () => setConnModal({ open: true, initial: null });
  const openEditConn = (conn) => setConnModal({ open: true, initial: conn });

  const saveConnection = (form) => {
    if (form.id) {
      // edit existing
      setConnGroups((groups) => groups.map((g) => ({
        ...g,
        children: g.children.map((c) => c.id === form.id
          ? { ...c, name: form.name, host: form.host, user: form.user, port: form.port, auth: form.auth, keyPath: form.keyPath }
          : c),
      })));
      setSessions((prev) => prev.map((s) => s.connId === form.id
        ? { ...s, name: form.name, host: form.host, user: form.user } : s));
      return;
    }
    const conn = {
      id: 'c' + Date.now(),
      name: form.name,
      host: form.host,
      user: form.user,
      port: form.port,
      auth: form.auth,
      keyPath: form.keyPath,
      type: form.type === 'wsl' ? 'wsl' : undefined,
      status: 'connected',
      os: 'ubuntu',
    };
    const targetGroup = form.type === 'wsl' ? 'g-wsl' : 'g-ssh';
    setConnGroups((groups) => groups.map((g) =>
      g.id === targetGroup ? { ...g, children: [...g.children, conn] } : g
    ));
    handleConnect(conn);
  };

  const deleteConnection = (conn) => {
    setConnGroups((groups) => groups.map((g) => ({ ...g, children: g.children.filter((c) => c.id !== conn.id) })));
    // close any sessions bound to it
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.connId !== conn.id);
      if (!remaining.find((s) => s.id === activeId)) {
        setActiveId(remaining.length ? remaining[remaining.length - 1].id : null);
      }
      return remaining;
    });
  };

  const runInTerminal = (cmd) => {
    setView('terminal');
    setPendingCmd(cmd);
  };

  // Param-aware: if a command has {{placeholders}}, ask for values first
  const requestRun = (cmdStr, name) => {
    const params = [...new Set([...cmdStr.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
    if (params.length) setParamReq({ cmd: cmdStr, name: name || cmdStr, params });
    else runInTerminal(cmdStr);
  };

  // Terminal view is terminal-first: connections sidebar hidden by default, ⌘B brings it back
  const [termSidebarOpen, setTermSidebarOpen] = useState(() => localStorage.getItem('tf-term-sb') === '1');
  const toggleSidebar = () => {
    if (view === 'terminal') {
      setTermSidebarOpen((o) => { localStorage.setItem('tf-term-sb', o ? '0' : '1'); return !o; });
    } else {
      setSidebarCollapsed((v) => !v);
    }
  };
  const toggleSidebarRef = useRef(toggleSidebar);
  toggleSidebarRef.current = toggleSidebar;

  const hidesSidebar = view === 'settings' || view === 'user' || (view === 'terminal' && !termSidebarOpen);
  const showSidebar = !hidesSidebar && !sidebarCollapsed;
  const effectiveSidebarW = sidebarWidth;

  return (
    <div className="app">
      <TitleBar
        sessions={sessions}
        activeId={activeId}
        onSwitch={setActiveId}
        onClose={handleClose}
        onNew={openNewConn}
        onOpenPalette={() => setPaletteOpen(true)}
        view={view}
        theme={theme}
        onToggleTheme={() => setTheme((t) => t === 'light' ? 'dark' : 'light')} />


      <div className="app-body">
        <ActivityBar
          activeView={view}
          onViewChange={setView}
          onToggleSidebar={toggleSidebar} />


        {showSidebar &&
        <Sidebar
          view={view}
          groups={connGroups}
          onConnect={handleConnect}
          onNewConnection={openNewConn}
          onEditConnection={openEditConn}
          onDeleteConnection={deleteConnection}
          activeConnId={activeConnId}
          sidebarWidth={effectiveSidebarW} />
        }


        <main className="main-area">
          <div className="fade-in" key={view} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {view === 'terminal' &&
            <TerminalView
              sessions={sessions}
              activeId={activeId}
              onSwitch={setActiveId}
              onClose={handleClose}
              onNew={openNewConn}
              injectCmd={pendingCmd}
              onInjected={() => setPendingCmd(null)}
              pinnedCommands={pinnedCommands}
              onRequestRun={requestRun}
              onManage={() => setView('commands')}
              onDisconnect={handleDisconnect}
              onReconnect={handleReconnect}
              onEditFile={setEditFile}
              onOpenMonitorView={() => setView('monitor')} />

            }
            {view === 'files' &&
            <FilesView activeSession={sessions.find((s) => s.id === activeId)} onEditFile={setEditFile} />
            }
            {view === 'monitor' &&
            <MonitorView activeSession={sessions.find((s) => s.id === activeId)} />
            }
            {view === 'commands' &&
            <CommandsView
              activeSession={sessions.find((s) => s.id === activeId)}
              pinned={pinned}
              onTogglePin={togglePin}
              onRunCmd={requestRun} />
            }
            {view === 'settings' &&
            <SettingsView
              sidebarWidth={sidebarWidth}
              onSidebarWidthChange={setSidebarWidth} />

            }
            {view === 'user' && <AccountView />}
          </div>
        </main>
      </div>

      <StatusBar sessions={sessions} activeId={activeId} view={view} connections={flatConns} />

      <NewConnectionModal
        open={connModal.open}
        initial={connModal.initial}
        onClose={() => setConnModal({ open: false, initial: null })}
        onCreate={saveConnection} />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        connections={flatConns}
        commands={window.SAVED_COMMANDS || []}
        onConnect={handleConnect}
        onRunCommand={requestRun}
        onNavigate={setView}
        onNewConnection={openNewConn} />

      <ParamModal
        req={paramReq}
        onClose={() => setParamReq(null)}
        onSubmit={(filled) => { setParamReq(null); runInTerminal(filled); }} />

      <FileEditorModal
        file={editFile}
        onClose={() => setEditFile(null)}
        onSave={() => setEditFile(null)} />
    </div>);

}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);