const { useState, useRef } = React;

const LOCAL_TREE = {
  '/': ['Documents/', 'Downloads/', 'Projects/', 'Desktop/', '.ssh/', '.bashrc', '.profile'],
  '/Documents': ['report.pdf', 'notes.md', 'contracts/'],
  '/Downloads': ['TermFlow-v0.1.4.zip', 'ubuntu-22.04.iso', 'screenshot.png'],
  '/Projects': ['go-termflow/', 'web-app/', 'scripts/'],
  '/Projects/go-termflow': ['frontend/', 'internal/', 'main.go', 'app.go', 'go.mod', 'README.md'],
};

const REMOTE_TREE = {
  '/': ['var/', 'etc/', 'home/', 'opt/', 'tmp/'],
  '/var': ['www/', 'log/', 'lib/', 'cache/'],
  '/var/www': ['app/', 'html/', 'static/', 'nginx.conf'],
  '/var/www/app': ['dist/', 'src/', 'node_modules/', 'package.json', 'vite.config.ts', '.env'],
  '/var/log': ['nginx/', 'syslog', 'auth.log', 'kern.log'],
  '/etc': ['nginx/', 'ssh/', 'hosts', 'fstab', 'crontab'],
};

const FILE_META = {
  'app/':          { size:'—',       date:'May 28 08:15', type:'dir'  },
  'html/':         { size:'—',       date:'Apr 15 14:22', type:'dir'  },
  'static/':       { size:'—',       date:'May 27 23:00', type:'dir'  },
  'nginx.conf':    { size:'2.1 KB',  date:'May 20 11:15', type:'conf' },
  'package.json':  { size:'1.3 KB',  date:'May 26 09:44', type:'json' },
  'vite.config.ts':{ size:'0.8 KB',  date:'May 24 16:02', type:'ts'   },
  '.env':          { size:'0.3 KB',  date:'May 15 10:00', type:'env'  },
  'dist/':         { size:'—',       date:'May 28 08:00', type:'dir'  },
  'src/':          { size:'—',       date:'May 27 22:30', type:'dir'  },
  'node_modules/': { size:'—',       date:'May 26 09:45', type:'dir'  },
  'main.go':       { size:'1.2 KB',  date:'May 28 07:50', type:'go'   },
  'app.go':        { size:'8.4 KB',  date:'May 28 07:55', type:'go'   },
  'go.mod':        { size:'0.6 KB',  date:'May 20 10:00', type:'mod'  },
  'README.md':     { size:'3.2 KB',  date:'May 27 18:00', type:'md'   },
  'go-termflow/':  { size:'—',       date:'May 28 07:55', type:'dir'  },
  'web-app/':      { size:'—',       date:'May 27 12:00', type:'dir'  },
  'scripts/':      { size:'—',       date:'May 24 09:00', type:'dir'  },
  'syslog':        { size:'14.2 MB', date:'May 28 10:24', type:'log'  },
  'auth.log':      { size:'2.1 MB',  date:'May 28 09:45', type:'log'  },
  'kern.log':      { size:'5.7 MB',  date:'May 28 08:30', type:'log'  },
};

function getIcon(name) {
  if (name.endsWith('/')) return '📁';
  if (name.endsWith('.go'))   return '🔷';
  if (name.endsWith('.md'))   return '📝';
  if (name.endsWith('.json')) return '📋';
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return '🔵';
  if (name.endsWith('.vue'))  return '💚';
  if (name.endsWith('.conf') || name.endsWith('.yaml') || name.endsWith('.yml')) return '⚙️';
  if (name.endsWith('.log'))  return '📜';
  if (name.endsWith('.env'))  return '🔑';
  if (name.endsWith('.zip') || name.endsWith('.iso')) return '📦';
  if (name.endsWith('.pdf'))  return '📄';
  if (name.endsWith('.png') || name.endsWith('.jpg')) return '🖼️';
  if (name.startsWith('.'))   return '🔒';
  return '📄';
}

const isDirEntry = (e) => e.endsWith('/');
const childPath = (path, entry) => {
  const folder = isDirEntry(entry) ? entry.slice(0, -1) : entry;
  return path === '/' ? '/' + folder : path + '/' + folder;
};
const joinPath = (path, name) => (path === '/' ? '/' + name : path + '/' + name);
const displayPath = (path, type) => (type === 'remote' && path === '/' ? '/' : path);

// Sample contents shown in the editor for an edited file.
function sampleContent(name) {
  if (name === 'package.json') return '{\n  "name": "app",\n  "version": "0.1.4",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build"\n  }\n}\n';
  if (name === '.env') return 'NODE_ENV=production\nPORT=8080\nDATABASE_URL=postgres://localhost/app\n';
  if (name === 'nginx.conf') return 'server {\n  listen 80;\n  root /var/www/app/dist;\n  location / {\n    try_files $uri /index.html;\n  }\n}\n';
  if (name.endsWith('.md')) return '# ' + name.replace(/\.md$/, '') + '\n\nProject documentation goes here.\n';
  if (name.endsWith('.go')) return 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("TermFlow")\n}\n';
  return '// ' + name + '\n';
}

let XID = 0;

function FilePane({
  type, label, tree, setTree, path, setPath,
  selected, setSelected, counterpartPath, sessionName,
  onTransfer, onEdit,
}) {
  const [renaming, setRenaming] = useState(null);  // entry being renamed
  const [renameVal, setRenameVal] = useState('');
  const [creating, setCreating] = useState(false);
  const [newVal, setNewVal] = useState('');
  const busy = useRef({});

  const entries = tree[path] || [];
  const parts = path === '/' ? [] : path.split('/').filter(Boolean);
  const transferVerb = type === 'local' ? 'Upload' : 'Download';
  const counterLabel = type === 'local' ? 'REMOTE' : 'LOCAL';

  const navigate = (entry) => {
    if (!isDirEntry(entry)) return;
    const np = childPath(path, entry);
    setTree((t) => (t[np] ? t : { ...t, [np]: [] }));   // unknown dirs open empty
    setPath(np);
  };

  const goUp = () => {
    if (path === '/') return;
    const p = path.split('/'); p.pop();
    setPath(p.join('/') || '/');
  };

  // ── Mutations ──────────────────────────────
  const deleteEntry = (entry) => {
    setTree((t) => {
      const next = { ...t };
      next[path] = (next[path] || []).filter((e) => e !== entry);
      if (isDirEntry(entry)) {
        const cp = childPath(path, entry);
        Object.keys(next).forEach((k) => { if (k === cp || k.startsWith(cp + '/')) delete next[k]; });
      }
      return next;
    });
    if (selected === entry) setSelected(null);
  };

  const commitRename = () => {
    const old = renaming;
    let nn = renameVal.trim();
    setRenaming(null);
    if (!nn || nn === old) return;
    const dir = isDirEntry(old);
    nn = dir ? nn.replace(/\/+$/, '') + '/' : nn.replace(/\/+$/, '');
    setTree((t) => {
      const next = { ...t };
      next[path] = (next[path] || []).map((e) => (e === old ? nn : e));
      if (dir) {
        const oldCp = childPath(path, old);
        const newCp = childPath(path, nn);
        Object.keys(next).forEach((k) => {
          if (k === oldCp || k.startsWith(oldCp + '/')) {
            next[newCp + k.slice(oldCp.length)] = next[k];
            if (k !== oldCp || newCp !== oldCp) delete next[k];
          }
        });
      }
      return next;
    });
    if (selected === old) setSelected(nn);
  };

  const commitCreate = () => {
    let nn = newVal.trim();
    setCreating(false); setNewVal('');
    if (!nn) return;
    if (!isDirEntry(nn)) nn += '/';
    setTree((t) => {
      const next = { ...t };
      const list = next[path] ? [...next[path]] : [];
      if (!list.includes(nn)) list.unshift(nn);
      next[path] = list;
      const cp = childPath(path, nn);
      if (!next[cp]) next[cp] = [];
      return next;
    });
  };

  const startRename = (entry) => { setRenaming(entry); setRenameVal(entry.replace(/\/$/, '')); };

  const fireTransfer = (entry) => {
    if (busy.current[entry]) return;
    busy.current[entry] = true;
    onTransfer(type, entry, path, () => { delete busy.current[entry]; });
  };

  return (
    <div className="files-pane">
      <div className="files-pane-header">
        <span className={`fp-badge ${type}`}>{label}</span>
        {type === 'remote' && sessionName && (
          <span style={{fontSize:'11px',color:'var(--overlay0)',fontFamily:'var(--font-mono)'}}>{sessionName}</span>
        )}
        <span className="fp-path">{displayPath(path, type)}</span>
        <div className="fp-actions">
          <button className="fp-btn" title="Go up" onClick={goUp}><Icon name="upArrow" size={12}/></button>
          <button className="fp-btn" title="New folder" onClick={() => { setCreating(true); setNewVal(''); }}><Icon name="plus" size={13}/></button>
          <button className="fp-btn" title="Refresh"><Icon name="refresh" size={12}/></button>
          <button
            className="fp-btn"
            title={selected ? `${transferVerb} “${selected}” → ${counterLabel} ${counterpartPath}` : `${transferVerb} selected`}
            onClick={() => selected && fireTransfer(selected)}
            style={{opacity: selected ? 1 : 0.4}}
          >
            <Icon name={type === 'remote' ? 'download' : 'upload'} size={12}/>
          </button>
        </div>
      </div>

      <div className="files-toolbar">
        <span style={{fontSize:'11px',color:'var(--overlay0)'}}>Path:</span>
        <span
          style={{fontSize:'11.5px',color:'var(--subtext0)',cursor:'pointer',padding:'0 3px',borderRadius:'3px'}}
          onClick={() => setPath('/')}
        >/</span>
        {parts.map((seg, i) => (
          <React.Fragment key={i}>
            <span style={{fontSize:'11px',color:'var(--overlay0)'}}>›</span>
            <span
              style={{fontSize:'11.5px',color:'var(--subtext0)',cursor:'pointer',padding:'0 3px',borderRadius:'3px',transition:'color 140ms'}}
              onMouseEnter={(e) => e.target.style.color='var(--text)'}
              onMouseLeave={(e) => e.target.style.color='var(--subtext0)'}
              onClick={() => setPath('/' + parts.slice(0, i + 1).join('/'))}
            >{seg}</span>
          </React.Fragment>
        ))}
      </div>

      <div className="files-list">
        {creating && (
          <div className="f-item" style={{background:'var(--base)'}}>
            <span className="f-item-icon">📁</span>
            <input
              className="f-rename-input" autoFocus value={newVal}
              placeholder="new-folder"
              onChange={(e) => setNewVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitCreate(); if (e.key === 'Escape') { setCreating(false); setNewVal(''); } }}
              onBlur={commitCreate}
            />
          </div>
        )}
        {path !== '/' && (
          <div className="f-item" onClick={goUp}>
            <span className="f-item-icon">📂</span>
            <span className="f-item-name" style={{color:'var(--overlay0)'}}>.. (parent)</span>
          </div>
        )}
        {entries.map((entry, i) => {
          const meta = FILE_META[entry] || { size: isDirEntry(entry) ? '—' : '0 B', date: '—', type: isDirEntry(entry) ? 'dir' : 'file' };
          const dir = isDirEntry(entry);
          if (renaming === entry) {
            return (
              <div key={i} className="f-item selected">
                <span className="f-item-icon">{getIcon(entry)}</span>
                <input
                  className="f-rename-input" autoFocus value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
                  onBlur={commitRename}
                />
              </div>
            );
          }
          const xferingBusy = busy.current[entry];
          return (
            <div
              key={i}
              className={`f-item${selected === entry ? ' selected' : ''}${xferingBusy ? ' xfer-busy' : ''}`}
              onClick={() => setSelected(entry)}
              onDoubleClick={() => navigate(entry)}
            >
              <span className="f-item-icon">{getIcon(entry)}</span>
              <span className="f-item-name">{entry}</span>

              <span className="f-item-meta">
                <span className="f-item-size">{meta.size}</span>
                <span className="f-item-date">{meta.date}</span>
              </span>

              <div className="f-row-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="f-act go"
                  title={`${transferVerb} → ${counterLabel} ${counterpartPath}`}
                  onClick={() => fireTransfer(entry)}
                >
                  <Icon name={type === 'remote' ? 'download' : 'upload'} size={13}/>
                </button>
                {!dir && (
                  <button className="f-act" title="Edit" onClick={() => onEdit(entry, path, type)}>
                    <Icon name="edit" size={13}/>
                  </button>
                )}
                <button className="f-act" title="Rename" onClick={() => startRename(entry)}>
                  <Icon name="file" size={13}/>
                </button>
                <button className="f-act danger" title="Delete" onClick={() => deleteEntry(entry)}>
                  <Icon name="trash" size={13}/>
                </button>
              </div>
            </div>
          );
        })}
        {entries.length === 0 && !creating && (
          <div style={{padding:'24px 12px',textAlign:'center',color:'var(--overlay0)',fontSize:'12px'}}>Empty directory</div>
        )}
      </div>

      <div className="files-status">
        <span>{entries.length} items</span>
        {selected && <span>Selected: <strong style={{color:'var(--subtext1)'}}>{selected}</strong></span>}
        <span className="fs-spacer"></span>
        <span className={`fs-dest ${counterLabel.toLowerCase()}`}>
          <Icon name={type === 'remote' ? 'download' : 'upload'} size={11}/>
          {transferVerb} → <b>{counterLabel} {counterpartPath}</b>
        </span>
      </div>
    </div>
  );
}

function FilesView({ activeSession, onEditFile }) {
  const [localTree, setLocalTree] = useState(LOCAL_TREE);
  const [remoteTree, setRemoteTree] = useState(REMOTE_TREE);
  const [localPath, setLocalPath] = useState('/');
  const [remotePath, setRemotePath] = useState('/var/www');
  const [localSel, setLocalSel] = useState(null);
  const [remoteSel, setRemoteSel] = useState(null);
  const [transfers, setTransfers] = useState([]);

  // Refs so an in-flight transfer reads the *current* destination directory.
  const destRef = useRef({ localPath, remotePath });
  destRef.current = { localPath, remotePath };

  const copyEntryInto = (srcTree, dstTree, srcPath, dstPath, entry) => {
    const next = { ...dstTree };
    const list = next[dstPath] ? [...next[dstPath]] : [];
    if (!list.includes(entry)) list.unshift(entry);
    next[dstPath] = list;
    if (isDirEntry(entry)) {
      const srcCp = childPath(srcPath, entry);
      const dstCp = childPath(dstPath, entry);
      Object.keys(srcTree).forEach((k) => {
        if (k === srcCp || k.startsWith(srcCp + '/')) next[dstCp + k.slice(srcCp.length)] = [...srcTree[k]];
      });
      if (!next[dstCp]) next[dstCp] = [];
    }
    return next;
  };

  // kind: pane that initiated. local → upload to remote; remote → download to local.
  const runTransfer = (kind, entry, srcPath, done) => {
    const id = ++XID;
    const upload = kind === 'local';
    const destPath = upload ? destRef.current.remotePath : destRef.current.localPath;
    const destLabel = upload ? 'REMOTE' : 'LOCAL';
    setTransfers((t) => [...t, { id, name: entry, upload, destPath, destLabel, pct: 0 }]);

    let pct = 0;
    const tick = setInterval(() => {
      pct = Math.min(100, pct + (12 + Math.random() * 22));
      setTransfers((t) => t.map((x) => (x.id === id ? { ...x, pct: Math.round(pct) } : x)));
      if (pct >= 100) {
        clearInterval(tick);
        // Commit into the destination tree at the live counterpart directory.
        if (upload) setRemoteTree((rt) => copyEntryInto(localTree, rt, srcPath, destRef.current.remotePath, entry));
        else        setLocalTree((lt) => copyEntryInto(remoteTree, lt, srcPath, destRef.current.localPath, entry));
        done && done();
        setTimeout(() => setTransfers((t) => t.filter((x) => x.id !== id)), 1600);
      }
    }, 220);
  };

  const openEditor = (name, path, type) => {
    onEditFile && onEditFile({
      name,
      path: joinPath(displayPath(path, type), name),
      origin: type,
      content: sampleContent(name),
    });
  };

  // Mirror the two currently-open directories: copy whatever each side is
  // missing into the other, both ways.
  const doSync = () => {
    const le = localTree[localPath] || [];
    const re = remoteTree[remotePath] || [];
    const up = le.filter((e) => !re.includes(e));     // local-only → push to remote
    const down = re.filter((e) => !le.includes(e));   // remote-only → pull to local
    const total = up.length + down.length;
    const id = ++XID;

    if (total === 0) {
      setTransfers((t) => [...t, { id, info: true, name: 'Folders already in sync', pct: 100 }]);
      setTimeout(() => setTransfers((t) => t.filter((x) => x.id !== id)), 2200);
      return;
    }

    setTransfers((t) => [...t, {
      id, sync: true, pct: 0,
      name: `Syncing ${total} item${total > 1 ? 's' : ''}`,
      up: up.length, down: down.length,
      lp: displayPath(localPath, 'local'), rp: displayPath(remotePath, 'remote'),
    }]);

    let pct = 0;
    const tick = setInterval(() => {
      pct = Math.min(100, pct + (7 + Math.random() * 15));
      setTransfers((t) => t.map((x) => (x.id === id ? { ...x, pct: Math.round(pct) } : x)));
      if (pct >= 100) {
        clearInterval(tick);
        setRemoteTree((rt) => { let n = rt; up.forEach((e) => { n = copyEntryInto(localTree, n, localPath, remotePath, e); }); return n; });
        setLocalTree((lt) => { let n = lt; down.forEach((e) => { n = copyEntryInto(remoteTree, n, remotePath, localPath, e); }); return n; });
        setTimeout(() => setTransfers((t) => t.filter((x) => x.id !== id)), 1800);
      }
    }, 200);
  };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div className="view-header">
        <Icon name="files" size={16} style={{color:'var(--accent)'}}/>
        <span className="view-header-title">File Manager</span>
        <span style={{fontSize:'11px',color:'var(--overlay0)',fontFamily:'var(--font-mono)',marginLeft:'4px'}}>
          hover a file to transfer · rename · edit · delete
        </span>
      </div>

      <div className="files-split">
        <FilePane
          type="local" label="LOCAL"
          tree={localTree} setTree={setLocalTree}
          path={localPath} setPath={setLocalPath}
          selected={localSel} setSelected={setLocalSel}
          counterpartPath={remotePath}
          onTransfer={runTransfer} onEdit={openEditor}
        />
        <div className="pane-divider" />
        <FilePane
          type="remote" label="REMOTE"
          tree={remoteTree} setTree={setRemoteTree}
          path={remotePath} setPath={setRemotePath}
          selected={remoteSel} setSelected={setRemoteSel}
          counterpartPath={localPath}
          sessionName={activeSession ? activeSession.name : null}
          onTransfer={runTransfer} onEdit={openEditor}
        />

        {transfers.length > 0 && (
          <div className="xfer-stack">
            {transfers.map((x) => {
              const done = x.pct >= 100;
              if (x.info) {
                return (
                  <div key={x.id} className="xfer-card">
                    <div className="xfer-top">
                      <span className="xfer-dir" style={{background:'rgba(166,218,149,0.16)',color:'var(--green)'}}><Icon name="refresh" size={13}/></span>
                      <span className="xfer-name">{x.name}</span>
                      <span className="xfer-pct done">✓</span>
                    </div>
                  </div>
                );
              }
              if (x.sync) {
                return (
                  <div key={x.id} className="xfer-card">
                    <div className="xfer-top">
                      <span className="xfer-dir"><Icon name="refresh" size={13}/></span>
                      <span className="xfer-name">{x.name}</span>
                      <span className={`xfer-pct${done ? ' done' : ''}`}>{done ? '✓ Synced' : x.pct + '%'}</span>
                    </div>
                    <div className="xfer-dest">
                      <b style={{color:'var(--teal)'}}>↑ {x.up}</b> to REMOTE&nbsp;·&nbsp;<b style={{color:'var(--blue)'}}>↓ {x.down}</b> to LOCAL
                    </div>
                    <div className="xfer-bar"><div className={`xfer-bar-fill${done ? ' done' : ''}`} style={{width: x.pct + '%'}}></div></div>
                  </div>
                );
              }
              return (
                <div key={x.id} className="xfer-card">
                  <div className="xfer-top">
                    <span className="xfer-dir"><Icon name={x.upload ? 'upload' : 'download'} size={13}/></span>
                    <span className="xfer-name">{x.name}</span>
                    <span className={`xfer-pct${done ? ' done' : ''}`}>{done ? '✓ Done' : x.pct + '%'}</span>
                  </div>
                  <div className={`xfer-dest ${x.upload ? 'remote' : 'local'}`}>
                    to <b>{x.destLabel} {x.destPath}</b>
                  </div>
                  <div className="xfer-bar"><div className={`xfer-bar-fill${done ? ' done' : ''}`} style={{width: x.pct + '%'}}></div></div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { FilesView });
