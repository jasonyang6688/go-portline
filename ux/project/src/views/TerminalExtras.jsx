// TerminalExtras — command blocks, danger guard, smart suggestions, audit history
const { useState, useEffect, useRef } = React;

/* ── Environment badges ─────────────────────────── */
function EnvBadge({ env, size }) {
  if (!env) return null;
  const label = env === 'prod' ? 'PROD' : env === 'staging' ? 'STAGING' : 'DEV';
  return <span className={`env-badge ${env}${size === 'sm' ? ' sm' : ''}`}>{label}</span>;
}

/* ── Danger detection ───────────────────────────── */
const DANGER_RULES = [
  { re: /\brm\s+(-[a-zA-Z]*[rf][a-zA-Z]*\s+)+/, label: 'Recursive / forced delete' },
  { re: /\b(drop|truncate)\s+(table|database|schema)\b/i, label: 'Destructive SQL statement' },
  { re: /\b(mkfs(\.\w+)?|dd\s+if=)/, label: 'Disk-destructive operation' },
  { re: /\b(shutdown|reboot|halt|poweroff)\b/, label: 'Host power action' },
  { re: /\bchmod\s+(-R\s+)?777\b/, label: 'World-writable permissions' },
  { re: /\bgit\s+push\b.*(--force|-f)\b/, label: 'Force push' },
  { re: /\bsystemctl\s+(stop|restart)\b/, label: 'Service interruption', prodOnly: true },
  { re: /\bdocker\s+(rm|rmi|system\s+prune)\b/, label: 'Container / image removal', prodOnly: true },
];
function detectDanger(cmd, env) {
  return DANGER_RULES.find(r => r.re.test(cmd) && (!r.prodOnly || env === 'prod')) || null;
}

/* ── Danger confirm modal ───────────────────────── */
function DangerModal({ req, host, env, onCancel, onConfirm }) {
  const [typed, setTyped] = useState('');
  useEffect(() => { setTyped(''); }, [req]);
  if (!req) return null;
  const needType = env === 'prod';
  const ok = !needType || typed === host;
  return (
    <div className="dgr-overlay" onClick={onCancel}>
      <div className="dgr-card" onClick={e => e.stopPropagation()}>
        <div className="dgr-head">
          <span className="dgr-icon"><Icon name="shield" size={16} /></span>
          <span className="dgr-title">{req.rule.label}</span>
          <EnvBadge env={env} />
        </div>
        <div className="dgr-cmd">{req.cmd}</div>
        <div className="dgr-sub">
          This will run on <b>{host}</b>{env === 'prod' ? ' — a production server.' : '.'}
        </div>
        {needType && (
          <input
            className="dgr-input"
            autoFocus
            placeholder={`Type "${host}" to confirm`}
            value={typed}
            spellCheck={false}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && ok) onConfirm(); if (e.key === 'Escape') onCancel(); }}
          />
        )}
        <div className="dgr-actions">
          <button className="dgr-btn" onClick={onCancel}>Cancel</button>
          <button className="dgr-btn danger" disabled={!ok} onClick={onConfirm}>Run anyway</button>
        </div>
      </div>
    </div>
  );
}

/* ── Audit log (localStorage) ───────────────────── */
const TF_AUDIT_KEY = 'tf-audit';
function auditLog(entry) {
  try {
    const a = JSON.parse(localStorage.getItem(TF_AUDIT_KEY) || '[]');
    a.unshift(entry);
    localStorage.setItem(TF_AUDIT_KEY, JSON.stringify(a.slice(0, 400)));
  } catch (e) { /* ignore */ }
}
function readAudit() {
  try { return JSON.parse(localStorage.getItem(TF_AUDIT_KEY) || '[]'); } catch (e) { return []; }
}
function dayLabel(ts) {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── History / audit dock panel ─────────────────── */
function HistoryPanel({ host, onClose, onRun, onInject }) {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('host'); // 'host' | 'all'
  const all = readAudit();
  const items = all
    .filter(e => scope === 'all' || e.host === host)
    .filter(e => !q || (e.cmd + ' ' + e.host).toLowerCase().includes(q.toLowerCase()));

  let lastDay = null;
  return (
    <div className="term-files term-hist">
      <div className="tf-head">
        <span className="tf-head-title"><Icon name="list" size={13} />History</span>
        <div className="tf-head-spacer" />
        <button className="tf-icon-btn" title="Close panel" onClick={onClose}><Icon name="close" size={13} /></button>
      </div>
      <div className="hp-controls">
        <input className="hp-search" placeholder="Search commands…" value={q} onChange={e => setQ(e.target.value)} spellCheck={false} />
        <div className="hp-scope">
          <button className={scope === 'host' ? 'active' : ''} onClick={() => setScope('host')}>{host}</button>
          <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>All hosts</button>
        </div>
      </div>
      <div className="hp-list">
        {items.length === 0 && (
          <div className="hp-empty">No commands logged yet — everything you run is recorded here, searchable per host.</div>
        )}
        {items.map((e, i) => {
          const day = dayLabel(e.ts);
          const showDay = day !== lastDay; lastDay = day;
          return (
            <React.Fragment key={i}>
              {showDay && <div className="hp-day">{day}</div>}
              <div className="hp-row" title={`${e.user}@${e.host}:${e.cwd}`}>
                <span className={`hp-dot ${e.status || 'ok'}`} />
                <div className="hp-main">
                  <div className="hp-cmd">{e.cmd}</div>
                  <div className="hp-meta">
                    {new Date(e.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    <span className="hp-host">{e.host}</span>
                    {e.broadcast && <span className="hp-bcast">⇆ broadcast</span>}
                  </div>
                </div>
                <span className="hp-acts">
                  <button className="tf-act" title="Insert into prompt" onClick={() => onInject(e.cmd)}><Icon name="edit" size={11} /></button>
                  <button className="tf-act" title="Run again" onClick={() => onRun(e.cmd)}><Icon name="play" size={10} /></button>
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="tf-foot">
        <span>{items.length} of {all.length} entries</span>
        <button
          className="tf-foot-up"
          onClick={() => { localStorage.setItem(TF_AUDIT_KEY, '[]'); onInject(''); }}
          title="Clear the audit log"
        ><Icon name="trash" size={10} />Clear</button>
      </div>
    </div>
  );
}

/* ── Smart suggestions ──────────────────────────── */
function smartSuggestions(entries, cwdAbs) {
  const s = [];
  const has = (n) => entries.includes(n);
  if (has('nginx.conf') || cwdAbs.includes('nginx')) {
    s.push({ cmd: 'nginx -t', why: 'nginx.conf in this directory' });
    s.push({ cmd: 'systemctl reload nginx', why: 'apply config changes' });
    s.push({ cmd: 'tail -f /var/log/nginx/error.log', why: 'watch for errors' });
  }
  if (has('package.json')) {
    s.push({ cmd: 'npm run build', why: 'package.json found' });
    s.push({ cmd: 'npm ci', why: 'clean install' });
  }
  if (has('go.mod')) {
    s.push({ cmd: 'go build ./...', why: 'go.mod found' });
    s.push({ cmd: 'go test ./...', why: 'run tests' });
  }
  if (has('docker-compose.yml') || has('Dockerfile')) {
    s.push({ cmd: 'docker compose ps', why: 'compose project here' });
  }
  if (cwdAbs.includes('/log')) {
    s.push({ cmd: 'tail -f syslog', why: 'log directory' });
    s.push({ cmd: 'df -h', why: 'logs fill disks' });
  }
  if (has('.env')) {
    s.push({ cmd: 'docker ps', why: 'check app containers' });
  }
  return s.slice(0, 4);
}

function SmartBar({ entries, cwdAbs, pinned, recent, onPick, onClose }) {
  const ctx = smartSuggestions(entries, cwdAbs);
  return (
    <div className="term-smartbar">
      <div className="sm-head">
        <span className="sm-title"><Icon name="zap" size={11} />Suggestions</span>
        <span className="sm-kbd">⌘J</span>
        <button className="tf-icon-btn" onClick={onClose}><Icon name="close" size={11} /></button>
      </div>
      {ctx.length > 0 && (
        <div className="sm-row">
          <span className="sm-cat">Context</span>
          {ctx.map((c, i) => (
            <button key={i} className="tq-chip" title={c.why} onClick={() => onPick(c.cmd)}>
              <Icon name="play" size={9} />{c.cmd}
            </button>
          ))}
        </div>
      )}
      {(pinned || []).length > 0 && (
        <div className="sm-row">
          <span className="sm-cat">Pinned</span>
          {pinned.map((c) => (
            <button key={c.id} className={`tq-chip${c.tags && c.tags.includes('danger') ? ' danger' : ''}`} title={c.cmd} onClick={() => onPick(c.cmd, c.name)}>
              <Icon name="play" size={9} />{c.name}
            </button>
          ))}
        </div>
      )}
      {(recent || []).length > 0 && (
        <div className="sm-row">
          <span className="sm-cat">Recent</span>
          {recent.map((c, i) => (
            <button key={i} className="tq-chip" onClick={() => onPick(c)}>{c}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Command blocks ─────────────────────────────── */
function linesToBlocks(lines, prefix) {
  const blocks = [];
  let cur = { id: (prefix || 'b') + '-0', kind: 'banner', lines: [] };
  (lines || []).forEach((l) => {
    if (l.t === 'cmd') {
      blocks.push(cur);
      cur = { id: (prefix || 'b') + '-' + (blocks.length), kind: 'cmd', cmd: l.v, user: l.user, host: l.host, path: l.path, lines: [] };
    } else {
      cur.lines.push(l);
    }
  });
  blocks.push(cur);
  return blocks.filter(b => b.kind === 'cmd' || b.lines.length > 0).map(b => ({
    ...b,
    status: b.lines.some(l => l.t === 'err') ? 'err' : b.lines.some(l => l.t === 'warn') ? 'warn' : 'ok',
  }));
}

function lineText(l) {
  switch (l.t) {
    case 'text': case 'info': case 'success': case 'warn': case 'dim': case 'err': return l.v || '';
    case 'blank': return '';
    case 'ls': return l.entries.map(e => e.special ? e.p : [e.p, e.l, e.u, e.g, e.s, e.d, e.n].join('  ')).join('\n');
    case 'table': return [(l.head || []).join('  '), ...l.rows.map(r => r.join('  '))].filter(Boolean).join('\n');
    case 'df': return l.header.join('  ') + '\n' + l.row.join('  ');
    case 'files': return l.items.join('  ');
    case 'gitlog': return l.entries.map(e => `${e.hash} ${e.msg} (${e.date})`).join('\n');
    case 'svc': return `● ${l.name}.service — active (running), pid ${l.pid}, up ${l.uptime}`;
    default: return '';
  }
}
function blockOutputText(block) {
  return (block.lines || []).map(lineText).join('\n').trim();
}

function CommandBlock({ block, onToggle, onRerun }) {
  const [copied, setCopied] = useState(null);
  const copy = (what, text) => {
    if (navigator.clipboard && text) navigator.clipboard.writeText(text).catch(() => {});
    setCopied(what);
    setTimeout(() => setCopied(null), 1200);
  };
  if (block.kind !== 'cmd') {
    return (
      <div className={`cblock plain${block.kind === 'note' ? ' note' : ''}`}>
        {block.lines.map((line, i) => <TermLine key={i} line={line} />)}
      </div>
    );
  }
  const n = block.lines.length;
  return (
    <div className={`cblock st-${block.status}${block.collapsed ? ' collapsed' : ''}`}>
      <div className="cblock-hdr" onDoubleClick={onToggle}>
        <button className="cb-fold" title={block.collapsed ? 'Expand output' : 'Collapse output'} onClick={onToggle}>
          <Icon name="chevronDown" size={10} style={{ transform: block.collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 140ms ease' }} />
        </button>
        <span className={`cb-dot ${block.status}`} />
        <span className="cb-prompt">
          <span className="t-user t-bold">{block.user}</span>
          <span className="t-muted">@</span>
          <span className="t-host t-bold">{block.host}</span>
          <span className="t-muted">:</span>
          <span className="t-path">{block.path}</span>
          <span className="t-prompt"> # </span>
          <span className="t-cmd">{block.cmd}</span>
        </span>
        {block.sentTo && <span className="cb-bcast" title={`Also sent to ${block.sentTo} other session${block.sentTo > 1 ? 's' : ''}`}>⇆ {block.sentTo}</span>}
        {block.viaBroadcast && <span className="cb-bcast" title="Received via broadcast">⇆ broadcast</span>}
        <span className="cb-spacer" />
        {block.ts && <span className="cb-ts">{block.ts}</span>}
        <span className="cb-actions">
          <button className="cb-act" title="Copy command" onClick={() => copy('cmd', block.cmd)}>{copied === 'cmd' ? <span className="cb-ok">✓</span> : <Icon name="copy" size={11} />}</button>
          <button className="cb-act" title="Copy output" onClick={() => copy('out', blockOutputText(block))}>{copied === 'out' ? <span className="cb-ok">✓</span> : <Icon name="download" size={11} />}</button>
          <button className="cb-act" title="Run again" onClick={() => onRerun(block.cmd)}><Icon name="refresh" size={11} /></button>
        </span>
      </div>
      {block.collapsed
        ? (n > 0 && <div className="cb-folded" onClick={onToggle}>… {n} line{n > 1 ? 's' : ''} hidden</div>)
        : <div className="cb-out">{block.lines.map((line, i) => <TermLine key={i} line={line} />)}</div>}
    </div>
  );
}

Object.assign(window, {
  EnvBadge, detectDanger, DangerModal,
  auditLog, readAudit, HistoryPanel,
  SmartBar, smartSuggestions,
  linesToBlocks, CommandBlock, blockOutputText,
});
