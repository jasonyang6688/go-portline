const { useState, useRef, useEffect } = React;

const TERMINAL_DATA = {
  c1: {
    host: 'prod-01', user: 'root', path: '/var/www',
    lines: [
      { t: 'info', v: 'Connecting to root@prod-01 (10.0.1.100:22)…' },
      { t: 'success', v: '✓  Connected  ·  Ubuntu 22.04 LTS  ·  SSH-2.0-OpenSSH_8.9' },
      { t: 'blank' },
      { t: 'text', v: 'Welcome to Ubuntu 22.04.5 LTS (GNU/Linux 5.15.0-113-generic x86_64)' },
      { t: 'text', v: '' },
      { t: 'text', v: '  * Documentation:  https://help.ubuntu.com' },
      { t: 'text', v: '  * Support:        https://ubuntu.com/pro' },
      { t: 'blank' },
      { t: 'cmd',  user:'root', host:'prod-01', path:'/var/www', v:'ls -la' },
      { t: 'ls', entries:[
        { p:'total 28', n:'', special:true },
        { p:'drwxr-xr-x', l:5,  u:'www-data', g:'www-data', s:'4096', d:'May 25 09:43', n:'.', isDir:true },
        { p:'drwxr-xr-x', l:13, u:'root',     g:'root',     s:'4096', d:'May 12 08:31', n:'..', isDir:true },
        { p:'drwxr-xr-x', l:8,  u:'www-data', g:'www-data', s:'4096', d:'May 28 08:15', n:'app', isDir:true },
        { p:'drwxr-xr-x', l:2,  u:'www-data', g:'www-data', s:'4096', d:'Apr 15 14:22', n:'html', isDir:true },
        { p:'drwxr-xr-x', l:6,  u:'www-data', g:'www-data', s:'4096', d:'May 27 23:00', n:'static', isDir:true },
        { p:'-rw-r--r--', l:1,  u:'root',     g:'root',     s:' 847', d:'May 20 11:15', n:'nginx.conf' },
      ]},
      { t: 'cmd',  user:'root', host:'prod-01', path:'/var/www', v:'systemctl status nginx' },
      { t: 'svc', name:'nginx', desc:'A high performance web server', status:'active', pid:1235, uptime:'2h 14min', memory:'5.8M', cpu:'35ms' },
      { t: 'blank' },
      { t: 'cmd',  user:'root', host:'prod-01', path:'/var/www', v:'df -h /' },
      { t: 'df', header:['Filesystem','Size','Used','Avail','Use%','Mounted'],
                  row: ['/dev/sda1','100G','45G','55G','45%','/'] },
    ]
  },
  c5: {
    host: 'Ubuntu', user: 'jason', path: '~',
    lines: [
      { t: 'info', v: 'Starting WSL: Ubuntu 22.04…' },
      { t: 'success', v: '✓  WSL session ready' },
      { t: 'blank' },
      { t: 'cmd', user:'jason', host:'Ubuntu', path:'~', v:'uname -a' },
      { t: 'text', v: 'Linux Ubuntu 5.15.167.4-microsoft-standard-WSL2 #1 SMP Tue Nov 5 00:21:55 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux' },
      { t: 'cmd', user:'jason', host:'Ubuntu', path:'~', v:'ls ~/projects/' },
      { t: 'text', v: '' },
      { t: 'files', items:['go-termflow/', 'web-app/', 'scripts/', 'notes.md', '.env'] },
      { t: 'cmd', user:'jason', host:'Ubuntu', path:'~/projects/go-termflow', v:'git log --oneline -5' },
      { t: 'gitlog', entries:[
        { hash:'3f4a1d2', msg:'feat: improve SSH reconnect logic', date:'2 hours ago' },
        { hash:'c8e52b1', msg:'fix: WSL session cleanup on close', date:'5 hours ago' },
        { hash:'a1209fd', msg:'style: update sidebar layout', date:'Yesterday' },
        { hash:'8bc3d70', msg:'feat: add file manager breadcrumb', date:'2 days ago' },
        { hash:'72e1a9c', msg:'refactor: extract terminal component', date:'3 days ago' },
      ]},
    ]
  }
};

function TermLine({ line }) {
  if (line.t === 'blank') return <div className="term-line"> </div>;
  if (line.t === 'info')    return <div className="term-line"><span className="t-info">{line.v}</span></div>;
  if (line.t === 'success') return <div className="term-line"><span className="t-success t-bold">{line.v}</span></div>;
  if (line.t === 'text')    return <div className="term-line"><span className="t-output">{line.v}</span></div>;
  if (line.t === 'warn')    return <div className="term-line"><span className="t-warn">{line.v}</span></div>;
  if (line.t === 'dim')     return <div className="term-line"><span className="t-muted">{line.v}</span></div>;
  if (line.t === 'err')     return <div className="term-line"><span className="t-err">{line.v}</span></div>;

  if (line.t === 'cmd') return (
    <div className="term-line" style={{marginTop:'6px'}}>
      <span className="t-user t-bold">{line.user}</span>
      <span className="t-muted">@</span>
      <span className="t-host t-bold">{line.host}</span>
      <span className="t-muted">:</span>
      <span className="t-path">{line.path}</span>
      <span className="t-prompt"> # </span>
      <span className="t-cmd">{line.v}</span>
    </div>
  );

  if (line.t === 'ls') return (
    <div>
      {line.entries.map((e, i) =>
        e.special
          ? <div key={i} className="term-line"><span className="t-muted">{e.p}</span></div>
          : (
            <div key={i} className="term-line">
              <span className="t-muted">{e.p} </span>
              <span className="t-dim">{String(e.l).padStart(2)} </span>
              <span className="t-output">{(e.u+' '+e.g).padEnd(18)} </span>
              <span className="t-purple">{String(e.s).padStart(5)} </span>
              <span className="t-yellow">{e.d} </span>
              {e.isDir
                ? <span className="t-dir t-bold">{e.n}</span>
                : <span className="t-file">{e.n}</span>
              }
            </div>
          )
      )}
    </div>
  );

  if (line.t === 'svc') return (
    <div style={{marginTop:'2px'}}>
      <div className="term-line">
        <span className="t-green t-bold">● </span>
        <span className="t-bold t-output">{line.name}.service</span>
        <span className="t-dim"> - {line.desc}</span>
      </div>
      <div className="term-line"><span className="t-dim">     Loaded: </span><span className="t-output">loaded (/lib/systemd/system/{line.name}.service; enabled)</span></div>
      <div className="term-line">
        <span className="t-dim">     Active: </span>
        <span className="t-green t-bold">active (running)</span>
        <span className="t-output"> since Wed 2026-05-28 08:15:33 UTC; </span>
        <span className="t-cyan">{line.uptime}</span>
        <span className="t-output"> ago</span>
      </div>
      <div className="term-line"><span className="t-dim">    Main PID: </span><span className="t-yellow">{line.pid}</span><span className="t-output"> ({line.name})</span></div>
      <div className="term-line"><span className="t-dim">     Memory: </span><span className="t-output">{line.memory}</span></div>
      <div className="term-line"><span className="t-dim">        CPU: </span><span className="t-output">{line.cpu}</span></div>
    </div>
  );

  if (line.t === 'df') return (
    <div>
      <div className="term-line">
        {line.header.map((h,i) => <span key={i} className="t-cyan t-bold" style={{marginRight:i<2?'8px':'16px'}}>{h}</span>)}
      </div>
      <div className="term-line">
        {line.row.map((v,i) => <span key={i} className={i===4?'t-yellow':'t-output'} style={{marginRight:i<2?'8px':'16px'}}>{v}</span>)}
      </div>
    </div>
  );

  if (line.t === 'table') return (
    <div>
      {line.head && (
        <div className="term-line">
          {line.head.map((h,i) => <span key={i} className="t-cyan t-bold" style={{display:'inline-block', width:line.w[i]}}>{h}</span>)}
        </div>
      )}
      {line.rows.map((r,j) => (
        <div key={j} className="term-line">
          {r.map((c,i) => <span key={i} className={(line.cls && line.cls[i]) || 't-output'} style={{display:'inline-block', width:line.w[i]}}>{c}</span>)}
        </div>
      ))}
    </div>
  );

  if (line.t === 'files') return (
    <div className="term-line" style={{display:'flex',gap:'16px',flexWrap:'wrap'}}>
      {line.items.map((f,i) =>
        f.endsWith('/') ? <span key={i} className="t-dir t-bold">{f}</span>
                        : f.startsWith('.') ? <span key={i} className="t-dim">{f}</span>
                        : <span key={i} className="t-file">{f}</span>
      )}
    </div>
  );

  if (line.t === 'gitlog') return (
    <div>
      {line.entries.map((e,i) => (
        <div key={i} className="term-line">
          <span className="t-yellow">{e.hash}</span>
          <span className="t-output"> {e.msg}</span>
          <span className="t-dim" style={{marginLeft:'8px'}}>({e.date})</span>
        </div>
      ))}
    </div>
  );

  return null;
}

/* Blocks + cwd survive tab switches and receive broadcast pushes */
const SESSION_BLOCKS = {};
const SESSION_CWD = {};

function QuickBar({ commands, onRun, onManage }) {
  return (
    <div className="term-quickbar">
      <span className="tq-label"><Icon name="zap" size={11} />Quick</span>
      {(!commands || commands.length === 0) && (
        <button className="tq-chip" onClick={onManage} style={{ borderStyle: 'dashed', color: 'var(--overlay1)' }}>
          Pin commands in the Library →
        </button>
      )}
      {(commands || []).map((c) => {
        const danger = c.tags && c.tags.includes('danger');
        const params = /\{\{\w+\}\}/.test(c.cmd);
        return (
          <button
            key={c.id}
            className={`tq-chip${danger ? ' danger' : ''}`}
            onClick={() => onRun(c.cmd, c.name)}
            title={c.cmd}
          >
            <Icon name="play" size={9} />
            {c.name}
            {params && <span className="tq-param" title="Asks for input">⌁</span>}
          </button>
        );
      })}
      <button className="tq-manage" title="Manage Quick bar in the Command Library" onClick={onManage}>
        <Icon name="pin" size={12} />
      </button>
    </div>
  );
}

/* ── Virtual filesystem for the in-terminal Files panel ── */
const SSH_FS = {
  '/':                    ['var/', 'etc/', 'home/', 'opt/', 'root/', 'tmp/', 'usr/'],
  '/var':                 ['www/', 'log/', 'lib/', 'cache/', 'backups/'],
  '/var/www':             ['app/', 'html/', 'static/', 'nginx.conf'],
  '/var/www/app':         ['dist/', 'src/', 'node_modules/', 'package.json', 'vite.config.ts', '.env'],
  '/var/www/app/src':     ['components/', 'pages/', 'main.tsx', 'App.tsx'],
  '/var/log':             ['nginx/', 'syslog', 'auth.log', 'kern.log'],
  '/var/log/nginx':       ['access.log', 'error.log'],
  '/etc':                 ['nginx/', 'ssh/', 'hosts', 'fstab', 'crontab'],
  '/etc/nginx':           ['sites-available/', 'sites-enabled/', 'nginx.conf', 'mime.types'],
  '/root':                ['.ssh/', '.bashrc', '.profile', 'deploy.sh', 'backup.sh'],
  '/home':                ['deploy/', 'ubuntu/'],
  '/opt':                 ['termflow/'],
  '/tmp':                 [],
  '/usr':                 ['bin/', 'lib/', 'local/'],
};
const WSL_FS = {
  '/home/jason':                          ['projects/', '.bashrc', '.profile', 'notes.md'],
  '/home/jason/projects':                 ['go-termflow/', 'web-app/', 'scripts/'],
  '/home/jason/projects/go-termflow':     ['frontend/', 'internal/', 'main.go', 'app.go', 'go.mod', 'README.md'],
  '/home/jason/projects/web-app':         ['src/', 'public/', 'package.json'],
};
const FS_META = {
  'nginx.conf':'847 B', 'package.json':'1.3 KB', 'vite.config.ts':'0.8 KB', '.env':'312 B',
  'main.tsx':'1.1 KB', 'App.tsx':'4.2 KB', 'syslog':'14.2 MB', 'auth.log':'2.1 MB',
  'kern.log':'5.7 MB', 'access.log':'8.4 MB', 'error.log':'1.2 MB', 'hosts':'221 B',
  'fstab':'468 B', 'crontab':'1.1 KB', 'mime.types':'5.3 KB', '.bashrc':'3.7 KB',
  '.profile':'807 B', 'deploy.sh':'2.4 KB', 'backup.sh':'1.8 KB', 'notes.md':'3.2 KB',
  'main.go':'1.2 KB', 'app.go':'8.4 KB', 'go.mod':'612 B', 'README.md':'3.2 KB',
};
function fsFor(data) { return data.host === 'Ubuntu' ? WSL_FS : SSH_FS; }
function homeOf(data) { return data.user === 'root' ? '/root' : '/home/' + data.user; }
function absCwd(cwd, data) { return (!cwd || cwd === '~') ? homeOf(data) : cwd; }
function dispCwd(abs, data) { return abs === homeOf(data) ? '~' : abs; }
function joinAbs(base, seg) {
  if (seg.startsWith('/')) return seg;
  const parts = base.split('/').filter(Boolean);
  for (const piece of seg.split('/')) {
    if (piece === '' || piece === '.') continue;
    if (piece === '..') parts.pop();
    else parts.push(piece);
  }
  return '/' + parts.join('/');
}
function parentAbs(abs) {
  if (abs === '/' ) return '/';
  const parts = abs.split('/').filter(Boolean);
  parts.pop();
  return '/' + parts.join('/');
}
function fileEmoji(name) {
  if (name.endsWith('/')) return '📁';
  if (name.endsWith('.go')) return '🔷';
  if (name.endsWith('.md')) return '📝';
  if (name.endsWith('.json') || name.endsWith('.mod')) return '📋';
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return '🔵';
  if (name.endsWith('.conf') || name.endsWith('.types') || name.endsWith('.sh')) return '⚙️';
  if (name.endsWith('.log') || name === 'syslog') return '📜';
  if (name.endsWith('.env')) return '🔑';
  if (name.startsWith('.')) return '🔒';
  return '📄';
}

function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
function genContent(name) {
  if (name === 'nginx.conf') return 'user www-data;\nworker_processes auto;\n\nevents {\n    worker_connections 1024;\n}\n\nhttp {\n    include       /etc/nginx/mime.types;\n    sendfile      on;\n    keepalive_timeout  65;\n\n    server {\n        listen 80;\n        server_name _;\n        root /var/www/html;\n    }\n}\n';
  if (name.endsWith('.env')) return 'NODE_ENV=production\nPORT=3000\nDATABASE_URL=postgres://app:secret@localhost:5432/app\nREDIS_URL=redis://localhost:6379\nLOG_LEVEL=info\n';
  if (name.endsWith('.json') || name.endsWith('.mod')) return '{\n  "name": "termflow",\n  "version": "0.1.4",\n  "private": true,\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build"\n  }\n}\n';
  if (name.endsWith('.md')) return '# ' + name.replace(/\.md$/, '') + '\n\nNotes and documentation go here.\n\n- item one\n- item two\n';
  if (name.endsWith('.sh')) return '#!/usr/bin/env bash\nset -euo pipefail\n\necho "Running ' + name + '…"\n';
  if (name.endsWith('.go')) return 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hello from ' + name + '")\n}\n';
  return '# ' + name + '\n\n(file contents)\n';
}

/* ── Drag-and-drop helpers: walk dropped files AND folders ── */
function walkEntry(entry, prefix = '') {
  return new Promise((resolve) => {
    if (!entry) return resolve([]);
    if (entry.isFile) {
      entry.file(
        f => resolve([{ rel: prefix + entry.name, isDir: false, size: f.size }]),
        () => resolve([{ rel: prefix + entry.name, isDir: false, size: 0 }])
      );
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const collected = [];
      const readBatch = () => reader.readEntries(async (ents) => {
        if (!ents.length) {
          const nested = await Promise.all(collected.map(e => walkEntry(e, prefix + entry.name + '/')));
          resolve([{ rel: prefix + entry.name + '/', isDir: true }, ...nested.flat()]);
        } else {
          collected.push(...ents);
          readBatch();
        }
      }, () => resolve([{ rel: prefix + entry.name + '/', isDir: true }]));
      readBatch();
    } else resolve([]);
  });
}
function registerInto(tree, targetAbs, items) {
  const next = { ...tree };
  items.forEach(it => {
    const segs = it.rel.split('/').filter(Boolean);
    const base = it.isDir ? segs[segs.length - 1] + '/' : segs[segs.length - 1];
    const parentAbs = joinAbs(targetAbs, segs.slice(0, -1).join('/'));
    next[parentAbs] = [...new Set([...(next[parentAbs] || []), base])];
    if (it.isDir) {
      const dirAbs = joinAbs(targetAbs, segs.join('/'));
      if (!next[dirAbs]) next[dirAbs] = [];
    }
  });
  return next;
}

function TermFilesPanel({ data, cwd, onCd, onPickFile, onClose, onEditFile, onUploadEcho }) {
  const [panelPath, setPanelPath] = useState(cwd);
  const [tree, setTree] = useState(() => JSON.parse(JSON.stringify(fsFor(data))));
  const [meta, setMeta] = useState(() => ({ ...FS_META }));
  const [transfers, setTransfers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [width, setWidth] = useState(() => +(localStorage.getItem('tf-files-w') || 280));
  const [dragOver, setDragOver] = useState(false);
  const [dropRow, setDropRow] = useState(null);   // folder name we're hovering during a drag
  const dragDepth = useRef(0);
  const fileInputRef = useRef(null);

  // follow the terminal whenever it moves while we're already synced
  const prevCwd = useRef(cwd);
  useEffect(() => {
    if (panelPath === prevCwd.current) setPanelPath(cwd);
    prevCwd.current = cwd;
  }, [cwd]); // eslint-disable-line
  useEffect(() => { localStorage.setItem('tf-files-w', width); }, [width]);

  const entries = tree[panelPath];
  const diverged = panelPath !== cwd;
  const segs = panelPath === '/' ? [] : panelPath.split('/').filter(Boolean);

  // ── drag-to-resize (panel sits on the right; drag left edge) ──
  const startDrag = (e) => {
    e.preventDefault();
    const startX = e.clientX, startW = width;
    const move = (ev) => setWidth(Math.max(230, Math.min(580, startW - (ev.clientX - startX))));
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); document.body.style.cursor = ''; };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    document.body.style.cursor = 'col-resize';
  };

  // ── transfer simulation with progress ──
  const startTransfer = (name, dir, onDone) => {
    const id = 't' + Date.now() + Math.round(Math.random() * 1000);
    setTransfers(ts => [...ts, { id, name, dir, pct: 0, done: false }]);
    let pct = 0;
    const iv = setInterval(() => {
      pct = Math.min(100, pct + (7 + Math.random() * 15));
      setTransfers(ts => ts.map(t => t.id === id ? { ...t, pct: Math.round(pct) } : t));
      if (pct >= 100) {
        clearInterval(iv);
        setTransfers(ts => ts.map(t => t.id === id ? { ...t, pct: 100, done: true } : t));
        onDone && onDone();
        setTimeout(() => setTransfers(ts => ts.filter(t => t.id !== id)), 2600);
      }
    }, 170);
  };

  const onFilesPicked = (e) => {
    const picked = [...e.target.files];
    picked.forEach(f => {
      const size = humanSize(f.size || Math.round(Math.random() * 400000));
      startTransfer(f.name, 'up', () => {
        setTree(t => ({ ...t, [panelPath]: [...new Set([...(t[panelPath] || []), f.name])] }));
        setMeta(m => ({ ...m, [f.name]: size }));
      });
    });
    e.target.value = '';
  };

  // ── Drag-and-drop upload (files + whole folders, into current dir or a hovered subfolder) ──
  const ingest = (flat, dest, topName) => {
    const fileCount = flat.filter(f => !f.isDir).length || 1;
    onUploadEcho && onUploadEcho(topName, dest);
    startTransfer(topName, 'up', () => {
      setTree(t => registerInto(t, dest, flat));
      setMeta(m => {
        const nm = { ...m };
        flat.filter(f => !f.isDir).forEach(f => { nm[f.rel.split('/').pop()] = humanSize(f.size || 0); });
        return nm;
      });
    });
    return fileCount;
  };
  const handleDrop = async (e, targetDir) => {
    e.preventDefault(); e.stopPropagation();
    setDragOver(false); setDropRow(null); dragDepth.current = 0;
    const dest = targetDir || panelPath;
    const dt = e.dataTransfer;
    // grab directory entries SYNCHRONOUSLY (the item list dies after the handler yields)
    const entries = dt.items ? [...dt.items].map(it => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean) : [];
    if (entries.length) {
      for (const entry of entries) {
        const flat = await walkEntry(entry);
        ingest(flat, dest, entry.name + (entry.isDirectory ? '/' : ''));
      }
    } else {
      [...(dt.files || [])].forEach(f => ingest([{ rel: f.name, isDir: false, size: f.size }], dest, f.name));
    }
  };
  const onDragEnter = (e) => { e.preventDefault(); dragDepth.current++; setDragOver(true); };
  const onDragLeave = (e) => { e.preventDefault(); dragDepth.current--; if (dragDepth.current <= 0) { setDragOver(false); setDropRow(null); } };

  const removeEntry = (name) => setTree(t => ({ ...t, [panelPath]: (t[panelPath] || []).filter(n => n !== name) }));

  const startRename = (name) => { setEditing(name); setEditVal(name.replace(/\/$/, '')); };
  const commitRename = () => {
    const old = editing;
    if (!old) return;
    const isDir = old.endsWith('/');
    const next = editVal.trim();
    if (next && next !== old.replace(/\/$/, '')) {
      const newName = isDir ? next + '/' : next;
      setTree(t => ({ ...t, [panelPath]: (t[panelPath] || []).map(n => n === old ? newName : n) }));
      setMeta(m => { const nm = { ...m }; if (nm[old]) { nm[newName] = nm[old]; delete nm[old]; } return nm; });
    }
    setEditing(null);
  };

  return (
    <div
      className={`term-files${dragOver ? ' drag-over' : ''}`}
      style={{ width }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDragLeave={onDragLeave}
      onDrop={(e) => handleDrop(e, null)}
    >
      <div className="tf-resize" onMouseDown={startDrag} title="Drag to resize" />
      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={onFilesPicked} />

      {dragOver && (
        <div className="tf-drop">
          <div className="tf-drop-card">
            <Icon name="upload" size={26} />
            <div className="tf-drop-title">Drop to upload</div>
            <div className="tf-drop-dest">→ {dropRow ? joinAbs(panelPath, dropRow.replace(/\/$/, '')) : panelPath}</div>
            <div className="tf-drop-hint">files & folders · hover a folder to drop inside it</div>
          </div>
        </div>
      )}

      <div className="tf-head">
        <span className="tf-head-title"><Icon name="files" size={13} />Files</span>
        <div className="tf-head-spacer" />
        <button
          className={`tf-sync${diverged ? ' diverged' : ''}`}
          title="Jump to the terminal's current directory"
          onClick={() => setPanelPath(cwd)}
        >
          <Icon name="link" size={11} />{diverged ? 'Sync' : 'Synced'}
        </button>
        <button className="tf-icon-btn" title="Upload here" onClick={() => fileInputRef.current && fileInputRef.current.click()}><Icon name="upload" size={13} /></button>
        <button className="tf-icon-btn" title="Close panel" onClick={onClose}><Icon name="close" size={13} /></button>
      </div>

      <div className="tf-path">
        <span className="tf-path-seg" onClick={() => setPanelPath('/')}>/</span>
        {segs.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="tt-slash">/</span>}
            <span className="tf-path-seg" onClick={() => setPanelPath('/' + segs.slice(0, i + 1).join('/'))}>{s}</span>
          </React.Fragment>
        ))}
      </div>

      <div className="tf-list">
        {panelPath !== '/' && (
          <div className="tf-row dir" onClick={() => setPanelPath(parentAbs(panelPath))}>
            <span className="tf-row-icon">📂</span>
            <span className="tf-row-name" style={{ color: 'var(--overlay1)' }}>..</span>
          </div>
        )}
        {!entries && (
          <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--overlay0)', fontSize: '11px' }}>Directory not indexed</div>
        )}
        {entries && entries.length === 0 && (
          <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--overlay0)', fontSize: '11px' }}>Empty — drop files via Upload ↑</div>
        )}
        {entries && entries.map((name, i) => {
          const isDir = name.endsWith('/');
          const bare = name.replace(/\/$/, '');
          const childAbs = joinAbs(panelPath, bare);
          if (editing === name) {
            return (
              <div key={i} className={`tf-row${isDir ? ' dir' : ''}`}>
                <span className="tf-row-icon">{fileEmoji(name)}</span>
                <input
                  className="tf-rename-input" autoFocus value={editVal} spellCheck={false}
                  onChange={e => setEditVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(null); }}
                  onBlur={commitRename}
                />
              </div>
            );
          }
          return (
            <div
              key={i}
              className={`tf-row${isDir ? ' dir' : ''}${dropRow === name ? ' drop-target' : ''}`}
              onClick={() => isDir ? setPanelPath(childAbs) : onPickFile(childAbs)}
              onDoubleClick={() => !isDir && onEditFile({ name: bare, path: childAbs, content: genContent(bare) })}
              onDragOver={isDir ? (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; setDropRow(name); } : undefined}
              onDragLeave={isDir ? (e) => { e.stopPropagation(); setDropRow(r => r === name ? null : r); } : undefined}
              onDrop={isDir ? (e) => handleDrop(e, childAbs) : undefined}
              title={childAbs}
            >
              <span className="tf-row-icon">{fileEmoji(name)}</span>
              <span className="tf-row-name">{name}</span>
              <span className="tf-row-size">{isDir ? '' : (meta[bare] || '')}</span>
              <span className="tf-actions" onClick={e => e.stopPropagation()}>
                {isDir
                  ? <button className="tf-act" title="cd here in terminal" onClick={() => { onCd(childAbs); setPanelPath(childAbs); }}><Icon name="terminal" size={11} /></button>
                  : <button className="tf-act" title="Edit contents" onClick={() => onEditFile({ name: bare, path: childAbs, content: genContent(bare) })}><Icon name="edit" size={11} /></button>}
                <button className="tf-act" title={isDir ? 'Download as archive' : 'Download'} onClick={() => startTransfer(name, 'down')}><Icon name="download" size={11} /></button>
                <button className="tf-act" title="Rename" onClick={() => startRename(name)}><Icon name="pin" size={11} style={{ display: 'none' }} /><span style={{ fontSize: '11px', fontWeight: 700 }}>R</span></button>
                <button className="tf-act danger" title="Delete" onClick={() => removeEntry(name)}><Icon name="trash" size={11} /></button>
              </span>
            </div>
          );
        })}
      </div>

      {transfers.length > 0 && (
        <div className="tf-transfers">
          {transfers.map(t => (
            <div key={t.id} className="tf-xfer">
              <Icon name={t.dir === 'up' ? 'upload' : 'download'} size={11} />
              <span className="tf-xfer-name">{t.name}</span>
              <span className={`tf-xfer-pct${t.done ? ' done' : ''}`}>{t.done ? '✓ done' : t.pct + '%'}</span>
              <div className="tf-xfer-track"><div className="tf-xfer-fill" style={{ width: t.pct + '%' }} /></div>
            </div>
          ))}
        </div>
      )}

      <div className="tf-foot">
        <span>{entries ? entries.length : 0} items</span>
        <button className="tf-foot-up" onClick={() => fileInputRef.current && fileInputRef.current.click()}><Icon name="upload" size={10} />Upload</button>
        {diverged && <span style={{ color: 'var(--yellow)' }}>● not following</span>}
      </div>
    </div>
  );
}

function TerminalSession({ session, allSessions, injectCmd, onInjected, pinnedCommands, onRequestRun, onManage, onDisconnect, onReconnect, onEditFile, onOpenMonitorView }) {
  const dataRef = useRef(null);
  if (!dataRef.current) {
    dataRef.current = TERMINAL_DATA[session.connId] || {
      host: session.host || session.name,
      user: session.user || (session.type === 'WSL' ? 'user' : 'root'),
      path: session.path || '~',
      lines: [
        { t: 'info', v: `Connecting to ${session.user || 'root'}@${session.host || session.name}…` },
        { t: 'success', v: '✓  Connected  ·  SSH-2.0-OpenSSH_8.9' },
        { t: 'blank' },
        { t: 'text', v: 'Type a command, or use the Quick bar / ⌘K to get started.' },
        { t: 'blank' },
      ],
    };
  }
  const data = dataRef.current;
  const outputRef = useRef(null);
  const inputRef = useRef(null);
  const [blocks, setBlocks] = useState(() => SESSION_BLOCKS[session.id] || linesToBlocks(data.lines, session.id));
  const [inputVal, setInputVal] = useState('');
  const [histIdx, setHistIdx] = useState(-1);
  const [cwd, setCwd] = useState(() => SESSION_CWD[session.id] || absCwd(data.path, data));
  const [dock, setDock] = useState(null);   // 'files' | 'monitor' | 'history' | null — one right-hand panel at a time
  const [smartOpen, setSmartOpen] = useState(false);
  const [broadcast, setBroadcast] = useState(false);
  const [dangerReq, setDangerReq] = useState(null);
  const cmdHistory = useRef([]);
  const vitals = useVitals(data.host);
  const alertRef = useRef({ cpu: false, mem: false, last: 0 });
  const env = session.env || (/prod/i.test(data.host) ? 'prod' : /staging/i.test(data.host) ? 'staging' : null);

  useEffect(() => { SESSION_BLOCKS[session.id] = blocks; }, [blocks, session.id]);
  useEffect(() => { SESSION_CWD[session.id] = cwd; }, [cwd, session.id]);

  // ⌘J toggles the smart suggestions popover
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) { e.preventDefault(); setSmartOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [blocks]);

  // Run a command injected from outside (Quick bar / ⌘K palette)
  useEffect(() => {
    if (injectCmd) {
      runCommand(injectCmd);
      onInjected && onInjected();
      if (inputRef.current) inputRef.current.focus();
    }
  }, [injectCmd]); // eslint-disable-line

  // Terminal self-alert: when this host crosses a threshold, drop an inline warning
  useEffect(() => {
    if (session.status === 'disconnected') return;
    const now = Date.now();
    const check = (key, val, label) => {
      const above = val >= 90;
      if (above && !alertRef.current[key] && now - alertRef.current.last > 7000) {
        const top = vitals.procs[0];
        setBlocks(b => [...b, { id: 'n' + Date.now(), kind: 'note', status: 'warn', lines: [{ t: 'warn', v: `⚠  ${label} ${val}% on ${data.host} — top: ${top.name} (pid ${top.pid}, ${top.cpu.toFixed(1)}%)  ·  open Monitor to act` }] }]);
        alertRef.current.last = now;
      }
      alertRef.current[key] = above;
    };
    check('cpu', vitals.cpu, 'CPU');
    check('mem', vitals.mem, 'MEM');
  }, [vitals.cpu, vitals.mem]); // eslint-disable-line

  const statusOf = (lines) =>
    lines.some(l => l.t === 'err' || (l.t === 'text' && /command not found/.test(l.v || ''))) ? 'err'
    : lines.some(l => l.t === 'warn') ? 'warn' : 'ok';

  const runCommand = (raw, opts = {}) => {
    const cmd = (raw || '').trim();
    if (!cmd) return;
    if (session.status === 'disconnected') {
      setBlocks(b => [...b, { id: 'n' + Date.now(), kind: 'note', status: 'err', lines: [{ t: 'err', v: 'Not connected — reconnect this session first.' }] }]);
      return;
    }
    // Danger guard — intercept destructive commands before they run
    if (!opts.force) {
      const rule = detectDanger(cmd, env);
      if (rule) { setDangerReq({ cmd, rule }); return; }
    }
    cmdHistory.current.unshift(cmd);
    setInputVal('');
    setHistIdx(-1);
    setSmartOpen(false);
    const bid = 'b' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const prompt = dispCwd(cwd, data);
    const ts = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (cmd.toLowerCase() === 'clear') { setBlocks([]); return; }

    // cd — moves the working directory; the prompt + Files panel follow
    if (cmd === 'cd' || cmd.startsWith('cd ')) {
      const arg = cmd.slice(2).trim();
      let target;
      if (!arg || arg === '~') target = homeOf(data);
      else if (arg === '/') target = '/';
      else target = joinAbs(cwd, arg);
      const fs = fsFor(data);
      const ok = target === '/' || fs[target] !== undefined;
      setBlocks(b => [...b, {
        id: bid, kind: 'cmd', cmd, user: data.user, host: data.host, path: prompt, ts,
        lines: ok ? [] : [{ t: 'err', v: `cd: ${arg}: No such file or directory` }],
        status: ok ? 'ok' : 'err',
      }]);
      auditLog({ ts: Date.now(), host: data.host, user: data.user, env, cwd: prompt, cmd, status: ok ? 'ok' : 'err' });
      if (ok) setCwd(target);
      return;
    }

    const lines = getResponse(cmd, data, cwd);
    const status = statusOf(lines);
    const block = { id: bid, kind: 'cmd', cmd, user: data.user, host: data.host, path: prompt, ts, lines, status };

    // ⇆ broadcast — mirror this command into every other connected session
    if (broadcast) {
      const others = (allSessions || []).filter(o => o.id !== session.id && o.status === 'connected');
      others.forEach(o => {
        const od = TERMINAL_DATA[o.connId] || { host: o.host || o.name, user: o.user || 'root', path: '~', lines: [] };
        const ocwd = SESSION_CWD[o.id] || absCwd(od.path, od);
        const olines = getResponse(cmd, od, ocwd);
        SESSION_BLOCKS[o.id] = [
          ...(SESSION_BLOCKS[o.id] || linesToBlocks(od.lines, o.id)),
          { id: bid + o.id, kind: 'cmd', cmd, user: od.user, host: od.host, path: dispCwd(ocwd, od), ts, lines: olines, status: statusOf(olines), viaBroadcast: true },
        ];
        auditLog({ ts: Date.now(), host: od.host, user: od.user, env: o.env, cwd: dispCwd(ocwd, od), cmd, status: statusOf(olines), broadcast: true });
      });
      if (others.length) block.sentTo = others.length;
    }

    setBlocks(b => [...b, block]);
    auditLog({ ts: Date.now(), host: data.host, user: data.user, env, cwd: prompt, cmd, status });
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && inputVal.trim()) {
      runCommand(inputVal);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, cmdHistory.current.length - 1);
      setHistIdx(idx);
      if (cmdHistory.current[idx]) setInputVal(cmdHistory.current[idx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInputVal(idx === -1 ? '' : cmdHistory.current[idx] || '');
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setBlocks([]);
    } else if (e.key === 'Escape') {
      setSmartOpen(false);
    }
  };

  const promptDisp = dispCwd(cwd, data);
  const crumbSegs = promptDisp.split('/').filter(Boolean);
  const disconnected = session.status === 'disconnected';

  const doDisconnect = () => {
    setBlocks(b => [...b, { id: 'n' + Date.now(), kind: 'note', status: 'err', lines: [{ t: 'err', v: `✗  Connection to ${data.user}@${data.host} closed.` }] }]);
    onDisconnect && onDisconnect(session.id);
  };
  const doReconnect = () => {
    setBlocks(b => [...b, { id: 'n' + Date.now(), kind: 'note', status: 'ok', lines: [
      { t: 'info', v: `Reconnecting to ${data.user}@${data.host}…` },
      { t: 'success', v: `✓  Reconnected · working directory restored to ${promptDisp}` },
    ] }]);
    onReconnect && onReconnect(session.id);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
  };

  return (
    <div className="term-stage">
      <div className="term-pane">
        <div className="term-toolbar">
          <span className="tt-host"><span className="dot" style={disconnected ? { background: 'var(--overlay0)', boxShadow: 'none' } : (env === 'prod' ? { background: 'var(--red)', boxShadow: '0 0 4px var(--red)' } : undefined)} /></span>
          {env && <EnvBadge env={env} />}
          <div className="tt-crumbs">
            {promptDisp === '~'
              ? <span className="tt-crumb">~</span>
              : <>
                  <span className="tt-slash">/</span>
                  {crumbSegs.map((s, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <span className="tt-slash">/</span>}
                      <span className="tt-crumb">{s}</span>
                    </React.Fragment>
                  ))}
                </>}
          </div>
          <div className="tt-spacer" />
          {!disconnected && !dock && (
            <TermVitalsPills vitals={vitals} open={dock === 'monitor'} onOpen={() => setDock('monitor')} />
          )}
          {disconnected
            ? <button className="tt-btn" style={{ borderColor: 'var(--green)', color: 'var(--green)' }} onClick={doReconnect} title="Reconnect, restoring this directory">
                <Icon name="refresh" size={12} />Reconnect
              </button>
            : <button className="tt-btn icon-only" onClick={doDisconnect} title="Disconnect this session">
                <Icon name="disconnect" size={12} />
              </button>}
          <button
            className={`tt-btn${dock === 'monitor' ? ' active' : ''}`}
            onClick={() => setDock(d => d === 'monitor' ? null : 'monitor')}
            title="Toggle the live Monitor panel for this session"
          >
            <Icon name="monitor" size={12} />Monitor
          </button>
          <button
            className={`tt-btn${dock === 'files' ? ' active' : ''}`}
            onClick={() => setDock(d => d === 'files' ? null : 'files')}
            title="Toggle the file browser for this session"
          >
            <Icon name="files" size={12} />Files
          </button>
          <button
            className={`tt-btn${dock === 'history' ? ' active' : ''}`}
            onClick={() => setDock(d => d === 'history' ? null : 'history')}
            title="Command history & audit for your machines"
          >
            <Icon name="list" size={12} />History
          </button>
        </div>

        <div className="term-output" ref={outputRef}>
          {blocks.map((b) => (
            <CommandBlock
              key={b.id}
              block={b}
              onToggle={() => setBlocks(bs => bs.map(x => x.id === b.id ? { ...x, collapsed: !x.collapsed } : x))}
              onRerun={(c) => runCommand(c)}
            />
          ))}
          <div style={{ height: '8px' }} />
        </div>

        {smartOpen && !disconnected && (
          <SmartBar
            entries={fsFor(data)[cwd] || []}
            cwdAbs={cwd}
            pinned={pinnedCommands}
            recent={cmdHistory.current.slice(0, 4)}
            onPick={(c, name) => { setSmartOpen(false); onRequestRun(c, name); }}
            onClose={() => setSmartOpen(false)}
          />
        )}

        {broadcast && !disconnected && (
          <div className="bcast-banner">
            <Icon name="network" size={11} />
            Broadcasting — Enter sends this command to {(allSessions || []).filter(o => o.status === 'connected').length} connected sessions
            <button onClick={() => setBroadcast(false)}>turn off</button>
          </div>
        )}

        <div className="term-input-row" style={disconnected ? { opacity: 0.45 } : undefined}>
          <span className="term-prompt-label">
            <span className="t-user t-bold">{data.user}</span>
            <span className="t-muted">@</span>
            <span className="t-host t-bold">{data.host}</span>
            <span className="t-muted">:</span>
            <span className="t-path">{promptDisp}</span>
            <span className="t-prompt"> # </span>
          </span>
          <input
            ref={inputRef}
            className="term-input"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKey}
            disabled={disconnected}
            autoFocus
            spellCheck={false}
            placeholder={disconnected ? 'Disconnected' : ''}
          />
          <button className={`tir-btn${smartOpen ? ' active' : ''}`} title="Smart suggestions (⌘J)" onClick={() => setSmartOpen(o => !o)}>
            <Icon name="zap" size={13} />
          </button>
          <button className={`tir-btn${broadcast ? ' active bcast' : ''}`} title="Broadcast input to all connected sessions" onClick={() => setBroadcast(b => !b)}>
            <Icon name="network" size={13} />
            {broadcast && <span className="tir-lab">ALL</span>}
          </button>
        </div>

        {disconnected && (
          <div className="term-disconnected">
            <Icon name="disconnect" size={28} style={{ color: 'var(--overlay1)' }} />
            <div className="td-title">Connection closed</div>
            <div className="td-sub">{data.user}@{data.host} · working directory <code>{promptDisp}</code> will be restored</div>
            <button className="td-btn" onClick={doReconnect}><Icon name="refresh" size={13} />Reconnect</button>
          </div>
        )}
      </div>

      {dock === 'files' && (
        <TermFilesPanel
          data={data}
          cwd={cwd}
          onCd={(abs) => {
            setHistory(h => [...h, { t: 'cmd', user: data.user, host: data.host, path: dispCwd(cwd, data), v: 'cd ' + dispCwd(abs, data) }]);
            setCwd(abs);
            if (inputRef.current) inputRef.current.focus();
          }}
          onPickFile={(abs) => {
            setInputVal(v => v ? v + ' ' + abs : abs);
            if (inputRef.current) inputRef.current.focus();
          }}
          onUploadEcho={(name, dest) => {
            setHistory(h => [...h, { t: 'cmd', user: 'local', host: 'me', path: '~', v: `scp -r ${name} ${data.user}@${data.host}:${dest}/` }, { t: 'success', v: `✓  queued upload → ${dest}/${name}` }]);
          }}
          onClose={() => setDock(null)}
          onEditFile={onEditFile}
        />
      )}

      {dock === 'monitor' && (
        <TermMonitorPanel
          vitals={vitals}
          host={data.host}
          user={data.user}
          onClose={() => setDock(null)}
          onOpenFull={() => onOpenMonitorView && onOpenMonitorView()}
          onInject={(cmd) => {
            setInputVal(cmd);
            if (inputRef.current) inputRef.current.focus();
          }}
        />
      )}
      {dock === 'history' && (
        <HistoryPanel
          host={data.host}
          onClose={() => setDock(null)}
          onRun={(c) => runCommand(c)}
          onInject={(c) => { setInputVal(c); if (inputRef.current) inputRef.current.focus(); }}
        />
      )}

      <DangerModal
        req={dangerReq}
        host={data.host}
        env={env}
        onCancel={() => setDangerReq(null)}
        onConfirm={() => { const c = dangerReq.cmd; setDangerReq(null); runCommand(c, { force: true }); }}
      />
    </div>
  );
}

function getResponse(cmd, data, cwd) {
  const c = cmd.trim().toLowerCase();
  if (c === 'clear') return [];
  if (c === 'pwd') return [{ t:'text', v: cwd ? dispCwd(cwd, data).replace('~', homeOf(data)) : (data.path === '~' ? homeOf(data) : data.path) }];
  if (c === 'whoami') return [{ t:'text', v: data.user }];
  if (c === 'hostname') return [{ t:'text', v: data.host }];
  if (c === 'uptime') return [{ t:'text', v:' 10:29:42 up 20 days,  2:14,  1 user,  load average: 0.52, 0.41, 0.38' }];
  if (c === 'date') return [{ t:'text', v: new Date().toString() }];
  if (c.startsWith('echo ')) return [{ t:'text', v: cmd.slice(5) }];
  if (c === 'ls' || c === 'ls -la' || c === 'ls -l') return TERMINAL_DATA[data.host === 'Ubuntu' ? 'c5' : 'c1']?.lines.find(l => l.t === 'ls') ? [TERMINAL_DATA[data.host === 'Ubuntu' ? 'c5' : 'c1'].lines.find(l => l.t === 'ls')] : [{ t:'text', v:'(empty)' }];
  if (c === 'df -h' || c === 'df -h /') return [{ t:'df', header:['Filesystem','Size','Used','Avail','Use%','Mounted'], row:['/dev/sda1','100G','45G','55G','45%','/'] }];
  if (c === 'free -h' || c === 'free -m' || c === 'free') return [{
    t:'table',
    w:['80px','80px','80px','80px','90px','110px','90px'],
    head:['', 'total','used','free','shared','buff/cache','available'],
    cls:['t-cyan','t-output','t-yellow','t-green','t-output','t-output','t-green'],
    rows:[
      ['Mem:','7.8Gi','2.9Gi','1.2Gi','156Mi','3.7Gi','4.6Gi'],
      ['Swap:','2.0Gi','0B','2.0Gi','','',''],
    ],
  }];
  if (c === 'systemctl status nginx') return [
    { t:'svc', name:'nginx', desc:'A high performance web server', status:'active', pid:1235, uptime:'2h 14min', memory:'5.8M', cpu:'35ms' },
  ];
  if (c === 'docker ps' || c.startsWith('docker ps')) return [{
    t:'table',
    w:['150px','170px','120px','220px'],
    head:['NAMES','IMAGE','STATUS','PORTS'],
    cls:['t-blue','t-output','t-green','t-purple'],
    rows:[
      ['termflow-api','node:20-alpine','Up 2 hours','0.0.0.0:3000->3000/tcp'],
      ['postgres','postgres:16','Up 5 days','5432/tcp'],
      ['redis','redis:7-alpine','Up 5 days','6379/tcp'],
      ['nginx-proxy','nginx:1.25','Up 2 hours','0.0.0.0:80->80/tcp'],
    ],
  }];
  if (c === 'ss -tlnp' || c === 'ss -tln') return [{
    t:'table',
    w:['90px','90px','190px','170px'],
    head:['State','Recv-Q','Local Address:Port','Process'],
    cls:['t-green','t-output','t-purple','t-blue'],
    rows:[
      ['LISTEN','0','0.0.0.0:22','sshd'],
      ['LISTEN','0','0.0.0.0:80','nginx'],
      ['LISTEN','0','0.0.0.0:443','nginx'],
      ['LISTEN','0','127.0.0.1:5432','postgres'],
    ],
  }];
  if (c === 'htop' || c === 'top') return [{ t:'warn', v:'htop is interactive — open the Monitor view for live process stats.' }];
  if (c.startsWith('systemctl restart')) {
    const svc = cmd.trim().split(/\s+/)[2] || 'service';
    return [{ t:'success', v:`✓  ${svc}.service restarted` }, { t:'text', v:`   Active: active (running) since ${new Date().toUTCString()}` }];
  }
  if (c.startsWith('systemctl start'))   return [{ t:'success', v:`✓  ${cmd.trim().split(/\s+/)[2] || 'service'}.service started` }];
  if (c.startsWith('systemctl stop'))    return [{ t:'warn',    v:`○  ${cmd.trim().split(/\s+/)[2] || 'service'}.service stopped` }];
  if (c.startsWith('tail ')) {
    const file = cmd.trim().split(/\s+/).pop();
    return [
      { t:'dim',  v:`==> ${file} <==` },
      { t:'text', v:'2026-06-04 10:31:02 [info] 10.0.1.4 "GET /api/health" 200 2ms' },
      { t:'text', v:'2026-06-04 10:31:05 [info] 10.0.1.9 "POST /api/deploy" 202 41ms' },
      { t:'warn', v:'2026-06-04 10:31:09 [warn] upstream response slow (1.2s)' },
      { t:'text', v:'2026-06-04 10:31:12 [info] 10.0.1.4 "GET /api/health" 200 2ms' },
    ];
  }
  if (c.startsWith('ufw allow') || c.startsWith('ufw deny')) return [{ t:'success', v:'Rule added' }, { t:'success', v:'Rule added (v6)' }];
  if (c === 'exit') return [{ t:'warn', v:'Use the × tab button to close this session.' }];
  if (c === 'help') return [
    { t:'text', v:'Available demo commands:' },
    { t:'text', v:'  ls, pwd, whoami, hostname, uptime, date, df -h, free -h, clear, echo <text>' },
    { t:'text', v:'  systemctl status nginx, docker ps, ss -tlnp   (or tap the Quick bar below)' },
  ];
  return [{ t:'text', v: `bash: ${cmd}: command not found` }];
}

function TerminalView({ sessions, activeId, onSwitch, onClose, onNew, injectCmd, onInjected, pinnedCommands, onRequestRun, onManage, onDisconnect, onReconnect, onEditFile, onOpenMonitorView }) {
  if (sessions.length === 0) {
    return (
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div className="term-empty">
          <Icon name="terminal" size={48} style={{color:'var(--overlay0)',marginBottom:'12px'}} />
          <div className="term-empty-title">No active sessions</div>
          <div className="term-empty-sub">Pick a saved connection in the sidebar, or add a new one</div>
          <button
            onClick={onNew}
            style={{marginTop:'12px',padding:'8px 16px',borderRadius:'var(--r-sm)',border:'1px solid var(--accent)',background:'var(--accent-glow)',color:'var(--accent)',fontFamily:'var(--font-ui)',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}
          >
            <Icon name="plus" size={13} />New Connection
          </button>
        </div>
      </div>
    );
  }
  const active = sessions.find(s => s.id === activeId);
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {active && (
        <TerminalSession
          key={active.id}
          session={active}
          allSessions={sessions}
          injectCmd={injectCmd}
          onInjected={onInjected}
          pinnedCommands={pinnedCommands}
          onRequestRun={onRequestRun}
          onManage={onManage}
          onDisconnect={onDisconnect}
          onReconnect={onReconnect}
          onEditFile={onEditFile}
          onOpenMonitorView={onOpenMonitorView}
        />
      )}
    </div>
  );
}

Object.assign(window, { TerminalView, TermLine });
