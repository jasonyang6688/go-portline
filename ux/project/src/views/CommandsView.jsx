const { useState } = React;

const COMMANDS = [
  { id:1, name:'Check nginx status',        cmd:'systemctl status nginx',                       desc:'View nginx service status and recent logs',    scope:'global', tags:['global'],          server:null },
  { id:2, name:'Tail access log',           cmd:'tail -f /var/log/nginx/access.log',            desc:'Stream nginx access log in real-time',         scope:'global', tags:['global','log'],    server:null },
  { id:3, name:'Check disk usage',          cmd:'df -h',                                        desc:'Show disk usage for all mounted filesystems',  scope:'global', tags:['global'],          server:null },
  { id:4, name:'Top processes',             cmd:'htop',                                         desc:'Interactive process viewer',                   scope:'global', tags:['global'],          server:null },
  { id:5, name:'Docker containers',         cmd:'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"', desc:'List running containers with ports', scope:'global', tags:['global','docker'], server:null },
  { id:6, name:'Deploy app',               cmd:'git pull && npm run build && pm2 restart all',  desc:'Pull, build and restart all PM2 processes',    scope:'server', tags:['server','danger'],  server:'prod-01' },
  { id:7, name:'Restart nginx',            cmd:'systemctl restart nginx',                       desc:'Restart nginx web server',                     scope:'server', tags:['server'],           server:'prod-01' },
  { id:8, name:'View error log',           cmd:'tail -n 100 /var/log/nginx/error.log',          desc:'Show last 100 lines of nginx error log',       scope:'server', tags:['server','log'],     server:'prod-01' },
  { id:9, name:'Free memory',             cmd:"sync && echo 3 > /proc/sys/vm/drop_caches",      desc:'Free page cache, dentries and inodes',         scope:'server', tags:['server','danger'],  server:'prod-01' },
  { id:10, name:'Check open ports',       cmd:'ss -tlnp',                                       desc:'Show all listening TCP ports with processes',  scope:'global', tags:['global'],           server:null },
  { id:11, name:'System load',            cmd:'uptime && cat /proc/loadavg',                    desc:'Show system load average and uptime',          scope:'global', tags:['global'],           server:null },
  { id:12, name:'WSL: start dev server',  cmd:'cd ~/projects/go-termflow && wails dev',         desc:'Start TermFlow in dev mode',                   scope:'server', tags:['server'],           server:'Ubuntu 22.04' },
  { id:13, name:'Restart a service',       cmd:'systemctl restart {{service}}',                 desc:'Restart any systemd service by name',          scope:'server', tags:['server','danger'],  server:null },
  { id:14, name:'Tail a log file',         cmd:'tail -n {{lines}} {{file}}',                    desc:'Stream the last N lines of any file',          scope:'global', tags:['global','log'],     server:null },
  { id:15, name:'Open firewall port',      cmd:'ufw allow {{port}}/tcp',                        desc:'Allow inbound TCP traffic on a port',          scope:'server', tags:['server','danger'],  server:null },
];

const NAV = [
  { id:'all',    label:'All Commands',   icon:'list'     },
  { id:'global', label:'Global',         icon:'network'  },
  { id:'server', label:'Server-scoped',  icon:'server'   },
  { id:'log',    label:'Log',            icon:'file'     },
  { id:'docker', label:'Docker',         icon:'terminal' },
  { id:'danger', label:'Destructive',    icon:'shield'   },
];

function NewCommandModal({ onClose, onCreate }) {
  const nameRef = React.useRef(null);
  const [name, setName] = useState('');
  const [cmd, setCmd] = useState('');
  const [desc, setDesc] = useState('');
  const [scope, setScope] = useState('global');
  const [server, setServer] = useState('');

  React.useEffect(() => { nameRef.current && nameRef.current.focus(); }, []);

  const canSave = name.trim() && cmd.trim();
  const submit = () => {
    if (!canSave) return;
    onCreate({
      name: name.trim(),
      cmd: cmd.trim(),
      desc: desc.trim() || 'Custom command',
      scope,
      server: scope === 'server' ? (server.trim() || null) : null,
    });
    onClose();
  };

  return (
    <div className="tf-overlay" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-head-icon"><Icon name="commands" size={15} /></div>
          <div style={{ flex: 1 }}>
            <div className="modal-title">New Command</div>
            <div className="modal-sub">Save a reusable command to your library</div>
          </div>
        </div>
        <div className="modal-body">
          <div className="field">
            <span className="field-label">Name</span>
            <input ref={nameRef} className="field-input" value={name} onChange={e => setName(e.target.value)}
              placeholder="Check nginx status" style={{ fontFamily: 'var(--font-ui)' }}
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <div className="field">
            <span className="field-label">Command</span>
            <input className="field-input" value={cmd} onChange={e => setCmd(e.target.value)}
              placeholder="systemctl status nginx — use {{param}} for prompts"
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <div className="field">
            <span className="field-label">Description <span style={{ textTransform: 'none', color: 'var(--overlay0)', fontWeight: 400 }}>(optional)</span></span>
            <input className="field-input" value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="What does this command do?" style={{ fontFamily: 'var(--font-ui)' }} />
          </div>
          <div className="field-row">
            <div className="field" style={{ flex: 1 }}>
              <span className="field-label">Scope</span>
              <div className="seg-control">
                <button className={`seg-opt${scope === 'global' ? ' on' : ''}`} onClick={() => setScope('global')}>Global</button>
                <button className={`seg-opt${scope === 'server' ? ' on' : ''}`} onClick={() => setScope('server')}>Server</button>
              </div>
            </div>
            {scope === 'server' && (
              <div className="field" style={{ flex: 1 }}>
                <span className="field-label">Server <span style={{ textTransform: 'none', color: 'var(--overlay0)', fontWeight: 400 }}>(optional)</span></span>
                <input className="field-input" value={server} onChange={e => setServer(e.target.value)} placeholder="prod-01" />
              </div>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!canSave} style={{ opacity: canSave ? 1 : 0.45, cursor: canSave ? 'pointer' : 'not-allowed' }} onClick={submit}>Save Command</button>
        </div>
      </div>
    </div>
  );
}

function CommandsView({ activeSession, pinned, onTogglePin, onRunCmd }) {
  const [activeNav, setActiveNav] = useState('all');
  const [search, setSearch] = useState('');
  const [commands, setCommands] = useState(COMMANDS);
  const [showNew, setShowNew] = useState(false);

  const handleCreate = (data) => {
    setCommands(prev => {
      const id = Math.max(0, ...prev.map(c => c.id)) + 1;
      return [{ ...data, id, tags: [data.scope] }, ...prev];
    });
  };

  const counts = {};
  NAV.forEach(n => {
    counts[n.id] = n.id === 'all'
      ? commands.length
      : commands.filter(c => c.tags.includes(n.id)).length;
  });

  const filtered = commands.filter(c => {
    const matchNav = activeNav === 'all' || c.tags.includes(activeNav);
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.cmd.toLowerCase().includes(search.toLowerCase());
    return matchNav && matchSearch;
  });

  const isPinned = (id) => (pinned || []).includes(id);
  const hasParams = (cmd) => /\{\{\w+\}\}/.test(cmd);

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div className="view-header">
        <Icon name="commands" size={16} style={{ color:'var(--accent)' }} />
        <span className="view-header-title">Command Library</span>
        <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
          <Icon name="search" size={13} style={{ position:'absolute', left:'8px', color:'var(--overlay0)', pointerEvents:'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search commands…"
            style={{
              background:'var(--surface0)', border:'1px solid var(--surface1)',
              borderRadius:'var(--r-sm)', padding:'5px 10px 5px 28px',
              fontFamily:'var(--font-ui)', fontSize:'12px', color:'var(--text)',
              outline:'none', width:'200px',
            }}
            onFocus={e => e.target.style.borderColor='var(--accent)'}
            onBlur={e => e.target.style.borderColor='var(--surface1)'}
          />
        </div>
        <button className="view-btn primary" onClick={() => setShowNew(true)}>
          <Icon name="plus" size={13} />New Command
        </button>
      </div>

      {showNew && <NewCommandModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}

      <div className="cmd-wrap">
        {/* Left nav */}
        <div className="cmd-sidebar">
          {NAV.map(n => (
            <div
              key={n.id}
              className={`cmd-nav-item${activeNav === n.id ? ' active' : ''}`}
              onClick={() => setActiveNav(n.id)}
            >
              <Icon name={n.icon} size={14} />
              <span style={{ flex:1 }}>{n.label}</span>
              <span className="cmd-count">{counts[n.id]}</span>
            </div>
          ))}
        </div>

        {/* Command cards */}
        <div className="cmd-grid">
          {filtered.length === 0 && (
            <div style={{ gridColumn:'1/-1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px', color:'var(--overlay0)', gap:'8px' }}>
              <Icon name="search" size={32} />
              <div style={{ fontSize:'13px', fontWeight:600 }}>No commands found</div>
              <div style={{ fontSize:'12px' }}>Try a different search term</div>
            </div>
          )}
          {filtered.map(cmd => (
            <div key={cmd.id} className={`cmd-card${isPinned(cmd.id) ? ' pinned' : ''}`}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:'8px' }}>
                <div className="cmd-card-name" style={{ flex:1 }}>{cmd.name}</div>
                <button
                  className={`cmd-pin${isPinned(cmd.id) ? ' on' : ''}`}
                  onClick={() => onTogglePin && onTogglePin(cmd.id)}
                  title={isPinned(cmd.id) ? 'Pinned to Quick bar — click to remove' : 'Pin to terminal Quick bar'}
                >
                  <Icon name="pin" size={13} />
                </button>
              </div>
              <div className="cmd-card-code" title={cmd.cmd}>{cmd.cmd}</div>
              <div className="cmd-card-desc">{cmd.desc}</div>
              <div className="cmd-card-footer">
                {cmd.tags.map(tag => (
                  <span key={tag} className={`tag tag-${tag === 'danger' ? 'danger' : tag === 'global' ? 'global' : 'server'}`}>{tag}</span>
                ))}
                {hasParams(cmd.cmd) && <span className="tag tag-param">parameterized</span>}
                {cmd.server && (
                  <span style={{ fontSize:'10px', color:'var(--overlay0)', marginLeft:'2px' }}>@{cmd.server}</span>
                )}
                <button
                  className="cmd-run-btn"
                  onClick={() => onRunCmd && onRunCmd(cmd.cmd, cmd.name)}
                >
                  <Icon name="play" size={10} />{hasParams(cmd.cmd) ? 'Run…' : 'Run'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CommandsView, SAVED_COMMANDS: COMMANDS });
