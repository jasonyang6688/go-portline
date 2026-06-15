/* ════════════════════════════════════════════════════════════
   Inline Monitor — live vitals shared by the toolbar pills and
   the dockable right-hand Monitor panel. One source of truth per
   session so prod-01 and the WSL box each report their own host.
   ════════════════════════════════════════════════════════════ */
const { useState, useEffect, useRef } = React;

function vHash(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function vClamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

/* Per-host process tables — each box runs a different workload */
const VITALS_PROCS = {
  default: [
    { name: 'nginx',        pid: 1235, base: 2.1, mem: '5.8M',  user: 'www-data' },
    { name: 'python3',      pid: 2841, base: 1.8, mem: '42.3M', user: 'root'     },
    { name: 'mysqld',       pid: 981,  base: 0.9, mem: '184M',  user: 'mysql'    },
    { name: 'node',         pid: 3204, base: 0.7, mem: '98.2M', user: 'www-data' },
    { name: 'redis-server', pid: 1102, base: 0.4, mem: '12.1M', user: 'redis'    },
    { name: 'sshd',         pid: 892,  base: 0.1, mem: '3.4M',  user: 'root'     },
  ],
  Ubuntu: [
    { name: 'go',           pid: 4471, base: 3.4, mem: '212M',  user: 'jason' },
    { name: 'node',         pid: 4012, base: 2.2, mem: '146M',  user: 'jason' },
    { name: 'vite',         pid: 4188, base: 1.6, mem: '88.4M', user: 'jason' },
    { name: 'gopls',        pid: 4503, base: 0.9, mem: '174M',  user: 'jason' },
    { name: 'bash',         pid: 3990, base: 0.1, mem: '4.2M',  user: 'jason' },
    { name: 'docker',       pid: 770,  base: 0.3, mem: '64.0M', user: 'root'  },
  ],
};

/* Live host vitals. Returns synchronized CPU/MEM/DISK/NET + history + procs. */
function useVitals(host) {
  const prof = useRef(null);
  if (!prof.current) {
    const seed = vHash(host || 'host');
    const busy = (seed % 100) / 100;            // 0..1 personality
    prof.current = {
      cpuBase: 14 + busy * 34,
      memBase: 28 + busy * 38,
      disk: host === 'Ubuntu' ? 38 : 45,
      cores: host === 'Ubuntu' ? 8 : 4,
      memTotal: host === 'Ubuntu' ? 16 : 8,
      procs: VITALS_PROCS[host] || VITALS_PROCS.default,
    };
  }
  const p = prof.current;
  const seed0 = useRef(vHash(host || 'h') % 17);
  const mk = (base, amp, n) => Array.from({ length: n }, (_, i) =>
    Math.round(vClamp(base + Math.sin((i + seed0.current) / 2.4) * amp + (Math.random() - 0.5) * amp * 0.6, 3, 99)));

  const [cpu, setCpu] = useState(() => Math.round(p.cpuBase));
  const [mem, setMem] = useState(() => Math.round(p.memBase));
  const [net, setNet] = useState(() => ({ down: 2.1, up: 0.6 }));
  const [cpuHist, setCpuHist] = useState(() => mk(p.cpuBase, 12, 28));
  const [netHist, setNetHist] = useState(() => mk(22, 16, 28));
  const [procTick, setProcTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCpu(c => {
        const next = Math.round(vClamp(c + (Math.random() - 0.46) * 14, 4, 99));
        setCpuHist(h => [...h.slice(1), next]);
        return next;
      });
      setMem(m => Math.round(vClamp(m + (Math.random() - 0.5) * 5, 12, 96)));
      setNet(() => ({ down: +(Math.random() * 6 + 0.4).toFixed(1), up: +(Math.random() * 2.4 + 0.1).toFixed(1) }));
      setNetHist(h => [...h.slice(1), Math.round(Math.random() * 40 + 6)]);
      setProcTick(t => t + 1);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // live-ish process cpu, sorted desc
  const procs = p.procs.map((pr, i) => {
    const jitter = (Math.sin(procTick / 3 + i) + 1) * pr.base * 0.5;
    return { ...pr, cpu: +(pr.base + jitter).toFixed(1) };
  }).sort((a, b) => b.cpu - a.cpu);

  return {
    cpu, mem, disk: p.disk, net, cpuHist, netHist,
    cores: p.cores, memTotal: p.memTotal,
    memUsed: +(mem / 100 * p.memTotal).toFixed(1),
    procs,
  };
}

/* level → palette key for threshold coloring */
function vLevel(v, warn = 70, crit = 88) {
  return v >= crit ? 'crit' : v >= warn ? 'warn' : 'ok';
}
const V_COLOR = { ok: 'var(--green)', warn: 'var(--yellow)', crit: 'var(--red)' };

/* Tiny inline bar sparkline */
function Spark({ data, color, w = 46, h = 15, bars = 14 }) {
  const slice = data.slice(-bars);
  const max = Math.max(...slice, 1);
  return (
    <span className="spark" style={{ width: w, height: h }}>
      {slice.map((v, i) => (
        <span key={i} className="spark-bar" style={{
          height: Math.max(2, (v / max) * h) + 'px',
          background: color,
          opacity: 0.4 + (i / slice.length) * 0.6,
        }} />
      ))}
    </span>
  );
}

/* ── Toolbar vitals pills — always visible, glanceable ── */
function TermVitalsPills({ vitals, onOpen, open }) {
  const cpuLv = vLevel(vitals.cpu);
  const memLv = vLevel(vitals.mem);
  const diskLv = vLevel(vitals.disk, 80, 92);
  return (
    <div className="tt-vitals" title="Open the Monitor panel">
      <button className={`tt-vital cpu ${cpuLv}`} onClick={onOpen}>
        <span className="tt-vital-k">CPU</span>
        <span className="tt-vital-v">{vitals.cpu}%</span>
        <Spark data={vitals.cpuHist} color={V_COLOR[cpuLv]} />
      </button>
      <button className={`tt-vital mem ${memLv}`} onClick={onOpen}>
        <span className="tt-vital-k">MEM</span>
        <span className="tt-vital-v">{vitals.mem}%</span>
      </button>
      <button className={`tt-vital disk ${diskLv}`} onClick={onOpen}>
        <span className="tt-vital-k">DISK</span>
        <span className="tt-vital-v">{vitals.disk}%</span>
      </button>
      <button className="tt-vital net" onClick={onOpen}>
        <span className="tt-vital-net">↓{vitals.net.down}</span>
        <span className="tt-vital-net up">↑{vitals.net.up}</span>
      </button>
    </div>
  );
}

/* Half-ring gauge for the panel */
function MiniGauge({ value, color, label, sub }) {
  const r = 30, circ = Math.PI * r, dash = (value / 100) * circ;
  return (
    <div className="mg">
      <svg width="78" height="46" viewBox="0 0 78 46">
        <path d="M 8 40 A 30 30 0 0 1 70 40" fill="none" stroke="var(--surface0)" strokeWidth="6" strokeLinecap="round" />
        <path d="M 8 40 A 30 30 0 0 1 70 40" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`} style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        <text x="39" y="38" textAnchor="middle" fontSize="14" fill="var(--text)" fontFamily="'JetBrains Mono',monospace" fontWeight="700">{value}%</text>
      </svg>
      <div className="mg-label">{label}</div>
      <div className="mg-sub">{sub}</div>
    </div>
  );
}

/* ── Dockable right-hand Monitor panel ── */
function TermMonitorPanel({ vitals, host, user, onClose, onInject, onOpenFull }) {
  const [width, setWidth] = useState(() => +(localStorage.getItem('tf-mon-w') || 300));
  useEffect(() => { localStorage.setItem('tf-mon-w', width); }, [width]);

  const startDrag = (e) => {
    e.preventDefault();
    const startX = e.clientX, startW = width;
    const move = (ev) => setWidth(Math.max(260, Math.min(560, startW - (ev.clientX - startX))));
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); document.body.style.cursor = ''; };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    document.body.style.cursor = 'col-resize';
  };

  const cpuLv = vLevel(vitals.cpu), memLv = vLevel(vitals.mem);

  return (
    <div className="term-monitor" style={{ width }}>
      <div className="tf-resize" onMouseDown={startDrag} title="Drag to resize" />

      <div className="tf-head">
        <span className="tf-head-title"><Icon name="monitor" size={13} />Monitor</span>
        <div className="tf-head-spacer" />
        <span className="tm-live"><span className="tm-live-dot" />live · 2s</span>
        <button className="tf-icon-btn" title="Open full Observability view" onClick={onOpenFull}><Icon name="chart" size={13} /></button>
        <button className="tf-icon-btn" title="Close panel" onClick={onClose}><Icon name="close" size={13} /></button>
      </div>

      <div className="tm-host">{user}@{host}</div>

      <div className="tm-scroll">
        <div className="tm-gauges">
          <MiniGauge value={vitals.cpu} color={V_COLOR[cpuLv]} label="CPU" sub={`${vitals.cores} cores`} />
          <MiniGauge value={vitals.mem} color={V_COLOR[memLv]} label="MEM" sub={`${vitals.memUsed}/${vitals.memTotal}G`} />
          <MiniGauge value={vitals.disk} color="var(--peach)" label="DISK" sub={`${vitals.disk}G/100G`} />
        </div>

        <div className="tm-charts">
          <div className="tm-chart">
            <div className="tm-chart-head"><Icon name="cpu" size={11} style={{ color: 'var(--blue)' }} />CPU<span className="tm-chart-now" style={{ color: 'var(--blue)' }}>{vitals.cpu}%</span></div>
            <Spark data={vitals.cpuHist} color="var(--blue)" w={'100%'} h={34} bars={28} />
          </div>
          <div className="tm-chart">
            <div className="tm-chart-head"><Icon name="network" size={11} style={{ color: 'var(--teal)' }} />Net<span className="tm-chart-now" style={{ color: 'var(--teal)' }}>↓{vitals.net.down} ↑{vitals.net.up} MB/s</span></div>
            <Spark data={vitals.netHist} color="var(--teal)" w={'100%'} h={34} bars={28} />
          </div>
        </div>

        <div className="tm-procs">
          <div className="tm-procs-head">
            <span>Top processes</span>
            <span className="tm-procs-hint">hover → act</span>
          </div>
          {vitals.procs.map((pr) => {
            const lv = vLevel(pr.cpu, 6, 18);
            return (
              <div key={pr.pid} className="tm-proc">
                <span className="tm-proc-name">{pr.name}</span>
                <span className="tm-proc-pid">{pr.pid}</span>
                <span className="tm-proc-mem">{pr.mem}</span>
                <span className="tm-proc-cpu" style={{ color: V_COLOR[lv] }}>{pr.cpu.toFixed(1)}%</span>
                <span className="tm-proc-acts" onClick={e => e.stopPropagation()}>
                  <button className="tm-act" title={`strace -p ${pr.pid}`} onClick={() => onInject(`strace -p ${pr.pid}`)}><Icon name="terminal" size={10} /></button>
                  <button className="tm-act danger" title={`kill ${pr.pid}`} onClick={() => onInject(`kill ${pr.pid}`)}>kill</button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tm-foot">
        <span style={{ color: V_COLOR[cpuLv] }}>● CPU {vitals.cpu}%</span>
        <span style={{ color: V_COLOR[memLv] }}>● MEM {vitals.mem}%</span>
        <button className="tf-foot-up" onClick={onOpenFull}><Icon name="chart" size={10} />Full view</button>
      </div>
    </div>
  );
}

Object.assign(window, { useVitals, vLevel, V_COLOR, Spark, TermVitalsPills, TermMonitorPanel });
