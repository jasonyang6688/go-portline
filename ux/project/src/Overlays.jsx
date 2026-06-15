const { useState, useEffect, useRef } = React;

/* ════════════════════════════════════════════
   NEW CONNECTION MODAL
   ════════════════════════════════════════════ */
function NewConnectionModal({ open, initial, onClose, onCreate }) {
  const editing = !!initial;
  const [type, setType] = useState('SSH');
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [user, setUser] = useState('root');
  const [port, setPort] = useState('22');
  const [auth, setAuth] = useState('Password');
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('~/.ssh/id_ed25519');
  const [passphrase, setPassphrase] = useState('');
  const [savePw, setSavePw] = useState(true);
  const nameRef = useRef(null);

  useEffect(() => {
    if (open) {
      const i = initial || {};
      setType(i.type === 'wsl' ? 'WSL' : 'SSH');
      setName(i.name || '');
      setHost(i.host || '');
      setUser(i.user || 'root');
      setPort(i.port ? String(i.port) : '22');
      setAuth(i.auth || 'Password');
      setPassword(''); setPassphrase('');
      setKeyPath(i.keyPath || '~/.ssh/id_ed25519');
      setSavePw(true);
      setTimeout(() => nameRef.current && nameRef.current.focus(), 60);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isSSH = type === 'SSH';
  const canSave = name.trim() && (!isSSH || host.trim());

  const submit = () => {
    if (!canSave) return;
    onCreate({
      id: initial ? initial.id : null,
      name: name.trim(),
      host: isSSH ? host.trim() : null,
      user: isSSH ? (user.trim() || 'root') : 'jason',
      port: isSSH ? (parseInt(port, 10) || 22) : null,
      type: isSSH ? 'ssh' : 'wsl',
      auth, keyPath, savePw,
    });
    onClose();
  };

  return (
    <div className="tf-overlay" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-head-icon"><Icon name={editing ? 'edit' : 'server'} size={15} /></div>
          <div style={{ flex: 1 }}>
            <div className="modal-title">{editing ? 'Edit Connection' : 'New Connection'}</div>
            <div className="modal-sub">{editing ? 'Update this host in your address book' : 'Add a host to your address book and open it'}</div>
          </div>
          <button className="tf-icon-btn" onClick={onClose}><Icon name="close" size={15} /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <span className="field-label">Type</span>
            <div className="seg-control">
              {['SSH', 'WSL'].map(t => (
                <button key={t} className={`seg-opt${type === t ? ' on' : ''}`} onClick={() => setType(t)}>{t}</button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">{isSSH ? 'Name / Label' : 'Distribution'}</span>
            <input ref={nameRef} className="field-input" value={name} onChange={e => setName(e.target.value)}
              placeholder={isSSH ? 'prod-db-01' : 'Ubuntu 24.04'}
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          {isSSH && (
            <>
              <div className="field">
                <span className="field-label">Host</span>
                <input className="field-input" value={host} onChange={e => setHost(e.target.value)}
                  placeholder="10.0.1.120 or db.example.com"
                  onKeyDown={e => e.key === 'Enter' && submit()} />
              </div>
              <div className="field-row">
                <div className="field" style={{ flex: 2 }}>
                  <span className="field-label">User</span>
                  <input className="field-input" value={user} onChange={e => setUser(e.target.value)} placeholder="root" />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <span className="field-label">Port</span>
                  <input className="field-input" value={port} onChange={e => setPort(e.target.value.replace(/[^0-9]/g, ''))} placeholder="22" />
                </div>
              </div>
              <div className="field">
                <span className="field-label">Authentication</span>
                <div className="seg-control">
                  {['Password', 'SSH Key', 'Agent'].map(a => (
                    <button key={a} className={`seg-opt${auth === a ? ' on' : ''}`} onClick={() => setAuth(a)}>{a}</button>
                  ))}
                </div>
              </div>

              {/* Auth-specific fields */}
              {auth === 'Password' && (
                <div className="field">
                  <span className="field-label">Password</span>
                  <input className="field-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={editing ? '•••••••• (unchanged)' : 'Account password'}
                    onKeyDown={e => e.key === 'Enter' && submit()} />
                  <label className="auth-check">
                    <input type="checkbox" checked={savePw} onChange={e => setSavePw(e.target.checked)} />
                    Save password to keychain
                  </label>
                </div>
              )}
              {auth === 'SSH Key' && (
                <>
                  <div className="field">
                    <span className="field-label">Private key file</span>
                    <input className="field-input" value={keyPath} onChange={e => setKeyPath(e.target.value)}
                      placeholder="~/.ssh/id_ed25519" />
                  </div>
                  <div className="field">
                    <span className="field-label">Passphrase <span style={{ textTransform: 'none', color: 'var(--overlay0)', fontWeight: 400 }}>(optional)</span></span>
                    <input className="field-input" type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)}
                      placeholder="Leave blank if the key has none"
                      onKeyDown={e => e.key === 'Enter' && submit()} />
                  </div>
                </>
              )}
              {auth === 'Agent' && (
                <div className="auth-note">
                  <Icon name="key" size={14} />
                  <span>Authentication is delegated to your running SSH agent — identities loaded with <code>ssh-add</code> will be offered automatically. No secret is stored by TermFlow.</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!canSave} style={{ opacity: canSave ? 1 : 0.45, cursor: canSave ? 'pointer' : 'not-allowed' }} onClick={submit}>
            {editing ? 'Save changes' : 'Save & Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   ⌘K COMMAND PALETTE
   ════════════════════════════════════════════ */
const PAL_VIEWS = [
  { id: 'terminal', label: 'Terminal', icon: 'terminal' },
  { id: 'files',    label: 'File Manager', icon: 'files' },
  { id: 'monitor',  label: 'Monitor', icon: 'monitor' },
  { id: 'commands', label: 'Command Library', icon: 'commands' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

function CommandPalette({ open, onClose, connections, commands, onConnect, onRunCommand, onNavigate, onNewConnection }) {
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery(''); setSel(0);
      setTimeout(() => inputRef.current && inputRef.current.focus(), 40);
    }
  }, [open]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const match = (s) => !q || (s || '').toLowerCase().includes(q);

  // Build flat, ordered item list
  const items = [];
  items.push({ section: 'Actions', type: 'action', title: 'New connection…', sub: 'Add an SSH host or WSL distro', icon: 'plus', run: () => { onClose(); onNewConnection(); } });
  (connections || []).forEach(c => items.push({
    section: 'Connections', type: 'conn', title: c.name,
    sub: c.host ? `${c.user}@${c.host}:${c.port || 22}` : (c.type === 'wsl' ? 'WSL distribution' : ''),
    tag: c.type === 'wsl' ? 'WSL' : 'SSH', icon: c.type === 'wsl' ? 'terminal' : 'server',
    run: () => { onClose(); onConnect(c); },
  }));
  (commands || []).forEach(c => items.push({
    section: 'Run command', type: 'cmd', title: c.name, sub: c.cmd,
    tag: c.tags && c.tags.includes('danger') ? 'DANGER' : null, icon: 'play',
    run: () => { onClose(); onRunCommand(c.cmd); },
  }));
  PAL_VIEWS.forEach(v => items.push({
    section: 'Go to', type: 'nav', title: v.label, sub: null, icon: v.icon,
    run: () => { onClose(); onNavigate(v.id); },
  }));

  const filtered = items.filter(it => match(it.title) || match(it.sub) || match(it.tag));
  const clampedSel = Math.min(sel, Math.max(0, filtered.length - 1));

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[clampedSel] && filtered[clampedSel].run(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  // group consecutively for section headers
  let lastSection = null;

  return (
    <div className="tf-overlay" onMouseDown={onClose}>
      <div className="palette-card" onMouseDown={e => e.stopPropagation()}>
        <div className="pal-search">
          <Icon name="search" size={17} />
          <input
            ref={inputRef}
            className="pal-input"
            value={query}
            onChange={e => { setQuery(e.target.value); setSel(0); }}
            onKeyDown={onKey}
            placeholder="Search connections, commands, views…"
            spellCheck={false}
          />
          <span className="pal-kbd">ESC</span>
        </div>

        <div className="pal-list" ref={listRef}>
          {filtered.length === 0 && <div className="pal-empty">No matches for “{query}”</div>}
          {filtered.map((it, i) => {
            const showHeader = it.section !== lastSection;
            lastSection = it.section;
            return (
              <React.Fragment key={i}>
                {showHeader && <div className="pal-section">{it.section}</div>}
                <div
                  className={`pal-item${i === clampedSel ? ' sel' : ''}`}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => it.run()}
                >
                  <span className="pal-item-icon"><Icon name={it.icon} size={14} /></span>
                  <div className="pal-item-main">
                    <div className="pal-item-title">{it.title}</div>
                    {it.sub && <div className="pal-item-sub">{it.sub}</div>}
                  </div>
                  {it.tag && <span className="pal-item-tag" style={it.tag === 'DANGER' ? { color: 'var(--red)' } : {}}>{it.tag}</span>}
                  <span className="pal-enter"><Icon name="enter" size={12} />enter</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <div className="pal-foot">
          <span><span className="k">↑↓</span> navigate</span>
          <span><span className="k">↵</span> select</span>
          <span><span className="k">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   PARAMETER FILL-IN MODAL  (for {{param}} commands)
   ════════════════════════════════════════════ */
function previewTokens(cmd, vals) {
  const parts = [];
  let last = 0, m;
  const re = /\{\{(\w+)\}\}/g;
  while ((m = re.exec(cmd))) {
    if (m.index > last) parts.push(cmd.slice(last, m.index));
    const p = m[1], val = vals[p];
    parts.push(<span key={m.index} className={`pp-tok${val ? ' filled' : ''}`}>{val || p}</span>);
    last = m.index + m[0].length;
  }
  if (last < cmd.length) parts.push(cmd.slice(last));
  return parts;
}

function ParamModal({ req, onClose, onSubmit }) {
  const [vals, setVals] = useState({});
  const firstRef = useRef(null);

  useEffect(() => {
    if (req) {
      const init = {};
      req.params.forEach(p => init[p] = '');
      setVals(init);
      setTimeout(() => firstRef.current && firstRef.current.focus(), 60);
    }
  }, [req]);

  useEffect(() => {
    if (!req) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [req, onClose]);

  if (!req) return null;

  const ready = req.params.every(p => vals[p] && vals[p].trim());
  const filled = req.cmd.replace(/\{\{(\w+)\}\}/g, (m, p) => (vals[p] && vals[p].trim()) ? vals[p].trim() : `{{${p}}}`);
  const submit = () => { if (ready) onSubmit(filled); };

  return (
    <div className="tf-overlay" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-head-icon"><Icon name="play" size={14} /></div>
          <div style={{ flex: 1 }}>
            <div className="modal-title">{req.name}</div>
            <div className="modal-sub">This command needs {req.params.length} value{req.params.length > 1 ? 's' : ''} before it runs</div>
          </div>
          <button className="tf-icon-btn" onClick={onClose}><Icon name="close" size={15} /></button>
        </div>

        <div className="modal-body">
          {req.params.map((p, i) => (
            <div className="field" key={p}>
              <span className="field-label">{p}</span>
              <input
                ref={i === 0 ? firstRef : null}
                className="field-input"
                value={vals[p] || ''}
                onChange={e => setVals(v => ({ ...v, [p]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder={`Enter ${p}…`}
                spellCheck={false}
              />
            </div>
          ))}
          <div className="param-preview">
            <span className="pp-label">Preview</span>
            <code className="pp-code">{previewTokens(req.cmd, vals)}</code>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!ready} style={{ opacity: ready ? 1 : 0.45, cursor: ready ? 'pointer' : 'not-allowed' }} onClick={submit}>
            Run in terminal
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { NewConnectionModal, CommandPalette, ParamModal });

/* ════════════════════════════════════════════
   FILE EDITOR MODAL
   ════════════════════════════════════════════ */
function FileEditorModal({ file, onClose, onSave }) {
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (file) { setText(file.content || ''); setDirty(false); }
  }, [file]);

  useEffect(() => {
    if (!file) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); onSave(text); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, text, onClose, onSave]);

  if (!file) return null;
  const lines = text.split('\n').length;

  return (
    <div className="tf-overlay" onMouseDown={onClose}>
      <div className="editor-card" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-head-icon"><Icon name="file" size={14} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="modal-title">{file.name}{dirty && <span style={{ color: 'var(--yellow)', marginLeft: 6 }}>●</span>}</div>
            <div className="modal-sub" style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.path}</div>
          </div>
          <button className="tf-icon-btn" onClick={onClose}><Icon name="close" size={15} /></button>
        </div>
        <textarea
          className="editor-area"
          value={text}
          spellCheck={false}
          onChange={e => { setText(e.target.value); setDirty(true); }}
          autoFocus
        />
        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: 'var(--overlay1)', fontFamily: 'var(--font-mono)' }}>{lines} lines · ⌘S to save</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={() => onSave(text)}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { NewConnectionModal, CommandPalette, ParamModal, FileEditorModal });
