const { useState, useRef } = React;

const CONNECTIONS = [
  {
    id: 'g-ssh', label: 'SSH Servers', icon: 'server',
    children: [
      { id: 'c1', name: 'prod-01', host: '10.0.1.100', user: 'root', port: 22, status: 'connected', os: 'ubuntu', env: 'prod' },
      { id: 'c2', name: 'staging-02', host: '10.0.1.101', user: 'deploy', port: 22, status: 'idle', os: 'centos', env: 'staging' },
      { id: 'c3', name: 'dev-server', host: '192.168.1.50', user: 'ubuntu', port: 22, status: 'idle', os: 'debian' },
      { id: 'c4', name: 'backup-01', host: '10.0.1.200', user: 'ops', port: 2222, status: 'idle', os: 'ubuntu' },
    ],
  },
  {
    id: 'g-wsl', label: 'WSL',
    children: [
      { id: 'c5', name: 'Ubuntu 22.04', type: 'wsl', status: 'connected' },
      { id: 'c6', name: 'Debian 12', type: 'wsl', status: 'idle' },
    ],
  },
];

function Sidebar({ view, groups, onConnect, onNewConnection, onEditConnection, onDeleteConnection, activeConnId, sidebarWidth }) {
  const [openGroups, setOpenGroups] = useState({ 'g-ssh': true, 'g-wsl': true });
  const [search, setSearch] = useState('');
  const [hovered, setHovered] = useState(null);
  const [manageMode, setManageMode] = useState(false);

  const toggleGroup = (id) => setOpenGroups(g => ({ ...g, [id]: !g[id] }));

  const src = groups || CONNECTIONS;
  const filtered = search
    ? src.map(g => ({ ...g, children: g.children.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.host || '').includes(search)) })).filter(g => g.children.length > 0)
    : src;

  return (
    <aside className="sidebar" style={{ width: sidebarWidth }}>
      <div className="sb-header">
        <span className="sb-title">Connections</span>
        <button className="sb-action" title="New connection" onClick={onNewConnection}>
          <Icon name="plus" size={12} />
        </button>
        <button className="sb-action" title="Refresh" onClick={() => {}}>
          <Icon name="refresh" size={12} />
        </button>
      </div>

      <div className="sb-search">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search connections…"
        />
      </div>

      <div className="sb-scroll">
        {filtered.map(group => (
          <div key={group.id}>
            <div className="sb-group-hdr" onClick={() => toggleGroup(group.id)}>
              <span className="sb-group-arrow" style={{ transform: openGroups[group.id] ? 'rotate(90deg)' : 'none', display:'inline-block', transition:'transform 140ms ease' }}>›</span>
              <Icon name={group.icon || 'server'} size={12} />
              {group.label}
              <span style={{ marginLeft:'auto', fontSize:'10px', background:'var(--surface0)', color:'var(--overlay0)', padding:'1px 5px', borderRadius:'8px', fontWeight:600 }}>
                {group.children.length}
              </span>
            </div>
            {openGroups[group.id] && group.children.map(conn => (
              <div
                key={conn.id}
                className={`sb-item${activeConnId === conn.id ? ' active' : ''}${manageMode ? ' managing' : ''}`}
                onClick={() => manageMode ? onEditConnection(conn) : onConnect(conn)}
                onMouseEnter={() => setHovered(conn.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className={`sb-dot ${conn.status === 'connected' ? 'on' : conn.status === 'busy' ? 'busy' : 'off'}`} />
                <span className="sb-item-name">{conn.name}</span>
                {manageMode
                  ? <span className="sb-row-actions">
                      <button className="sb-row-btn" title="Edit" onClick={e => { e.stopPropagation(); onEditConnection(conn); }}><Icon name="edit" size={12} /></button>
                      <button className="sb-row-btn danger" title="Delete" onClick={e => { e.stopPropagation(); onDeleteConnection(conn); }}><Icon name="trash" size={12} /></button>
                    </span>
                  : conn.type === 'wsl'
                    ? <span className="sb-badge wsl">WSL</span>
                    : hovered === conn.id
                      ? <span style={{fontSize:'10px',color:'var(--overlay0)',fontFamily:'var(--font-mono)'}}>{conn.port||22}</span>
                      : null
                }
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="sb-footer">
        <button className="sb-footer-btn primary" onClick={onNewConnection}>
          <Icon name="plus" size={12} />
          New
        </button>
        <button className={`sb-footer-btn${manageMode ? ' active' : ''}`} onClick={() => setManageMode(m => !m)}>
          <Icon name={manageMode ? 'close' : 'edit'} size={12} />
          {manageMode ? 'Done' : 'Manage'}
        </button>
      </div>
    </aside>
  );
}

function ActivityBar({ activeView, onViewChange, onToggleSidebar }) {
  const navItems = [
    { id: 'terminal',  icon: 'terminal',  label: 'Terminal'     },
    { id: 'files',     icon: 'files',     label: 'File Manager' },
    { id: 'monitor',   icon: 'monitor',   label: 'Monitor'      },
    { id: 'commands',  icon: 'commands',  label: 'Commands'     },
  ];
  const bottomItems = [
    { id: 'settings', icon: 'settings', label: 'Settings' },
    { id: 'user',     icon: 'user',     label: 'Account'  },
  ];
  return (
    <nav className="actbar">
      <button className="act-btn" title="Toggle Sidebar" onClick={onToggleSidebar} style={{ marginBottom: 12 }}>
        <Icon name="sidebar" size={17} />
      </button>
      {navItems.map(item => (
        <button
          key={item.id}
          className={`act-btn${activeView === item.id ? ' active' : ''}`}
          title={item.label}
          onClick={() => onViewChange(item.id)}
        >
          <Icon name={item.icon} size={18} />
        </button>
      ))}
      <div className="act-spacer" />
      {bottomItems.map(item => (
        <button
          key={item.id}
          className={`act-btn${activeView === item.id ? ' active' : ''}`}
          title={item.label}
          onClick={() => onViewChange(item.id)}
        >
          <Icon name={item.icon} size={18} />
        </button>
      ))}
    </nav>
  );
}

Object.assign(window, { Sidebar, ActivityBar, CONNECTIONS });
