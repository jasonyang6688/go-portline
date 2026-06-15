const { useState, useEffect, useRef } = React;

const CPU_HISTORY = [18,22,35,28,45,52,38,41,29,33,47,55,62,48,40,36,44,51,43,38,42,58,65,48,41,39,44,50,46,23];
const NET_HISTORY = [12,15,8,22,18,35,28,42,19,25,31,44,38,27,20,15,24,32,28,19,23,41,36,25,18,22,29,35,31,14];

const PROCESSES = [
  { name:'nginx',        pid:1235, cpu:'2.1%', mem:'5.8M',  user:'www-data' },
  { name:'python3',      pid:2841, cpu:'1.8%', mem:'42.3M', user:'root'     },
  { name:'mysql',        pid:981,  cpu:'0.9%', mem:'184M',  user:'mysql'    },
  { name:'node',         pid:3204, cpu:'0.7%', mem:'98.2M', user:'www-data' },
  { name:'redis-server', pid:1102, cpu:'0.4%', mem:'12.1M', user:'redis'    },
  { name:'sshd',         pid:892,  cpu:'0.1%', mem:'3.4M',  user:'root'     },
  { name:'crond',        pid:1044, cpu:'0.0%', mem:'1.2M',  user:'root'     },
];

function MiniChart({ data, color, height = 60 }) {
  const max = Math.max(...data);
  return (
    <div className="mini-chart" style={{ height }}>
      {data.map((v, i) => (
        <div
          key={i}
          className="chart-bar"
          style={{
            height: `${Math.max(4, (v / max) * height)}px`,
            background: color,
            opacity: i === data.length - 1 ? 1 : 0.35 + (i / data.length) * 0.35,
            transition: `height ${300 + i * 10}ms ease`,
          }}
        />
      ))}
    </div>
  );
}

function Gauge({ value, color, label, sublabel }) {
  const r = 36;
  const circ = Math.PI * r; // half circle
  const dash = (value / 100) * circ;
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
      <svg width="90" height="52" viewBox="0 0 90 52">
        <path
          d={`M 9 46 A ${r} ${r} 0 0 1 81 46`}
          fill="none" stroke="var(--surface0)" strokeWidth="7" strokeLinecap="round"
        />
        <path
          d={`M 9 46 A ${r} ${r} 0 0 1 81 46`}
          fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <text x="45" y="44" textAnchor="middle" fontSize="15" fill="#cad3f5"
          fontFamily="'JetBrains Mono',monospace" fontWeight="700">{value}%</text>
      </svg>
      <div style={{ fontSize:'11px', fontWeight:700, color:'var(--overlay1)', textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</div>
      {sublabel && <div style={{ fontSize:'10.5px', color:'var(--overlay0)' }}>{sublabel}</div>}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, progress }) {
  return (
    <div className="monitor-card">
      <div className="mc-label">
        <Icon name={icon} size={13} style={{ color }} />
        {label}
      </div>
      <div className="mc-value" style={{ color }}>{value}</div>
      <div className="mc-sub">{sub}</div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width:`${progress}%`, background:color }} />
      </div>
      <div style={{ fontSize:'11px', color:'var(--overlay0)', textAlign:'right' }}>{progress}%</div>
    </div>
  );
}

function MonitorView({ activeSession }) {
  const [tick, setTick] = useState(0);
  const [cpuNow, setCpuNow] = useState(23);
  const [cpuHistory, setCpuHistory] = useState(CPU_HISTORY);
  const [netHistory, setNetHistory] = useState(NET_HISTORY);
  const [memUsed, setMemUsed] = useState(3.2);

  useEffect(() => {
    const id = setInterval(() => {
      const newCpu = Math.max(5, Math.min(90, cpuNow + (Math.random() - 0.45) * 12));
      setCpuNow(Math.round(newCpu));
      setCpuHistory(h => [...h.slice(1), Math.round(newCpu)]);
      setNetHistory(h => [...h.slice(1), Math.round(Math.random() * 40 + 8)]);
      setMemUsed(m => Math.max(1.5, Math.min(7.5, m + (Math.random() - 0.5) * 0.2)));
    }, 2000);
    return () => clearInterval(id);
  }, [cpuNow]);

  const memPct = Math.round((memUsed / 8) * 100);
  const disk = 45;
  const connected = activeSession != null;

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div className="view-header">
        <Icon name="monitor" size={16} style={{ color:'var(--accent)' }} />
        <span className="view-header-title">
          Observability
          {connected && <span style={{ fontSize:'11px', color:'var(--green)', marginLeft:'10px', fontWeight:500 }}>● prod-01</span>}
        </span>
        <span style={{ fontSize:'11px', color:'var(--overlay0)' }}>Auto-refresh: 2s</span>
        <button className="view-btn"><Icon name="refresh" size={13}/>Refresh</button>
        <button className="view-btn primary"><Icon name="chart" size={13}/>Export</button>
      </div>

      <div className="monitor-wrap">
        {/* Gauges row */}
        <div style={{ display:'flex', gap:'16px', justifyContent:'center', padding:'8px 0 4px', background:'var(--mantle)', borderRadius:'var(--r-lg)', border:'1px solid var(--surface0)' }}>
          <Gauge value={cpuNow}  color="var(--blue)"   label="CPU"  sublabel="4 Cores" />
          <div style={{ width:'1px', background:'var(--surface0)', margin:'8px 0' }} />
          <Gauge value={memPct}  color="var(--mauve)"  label="MEM"  sublabel={`${memUsed.toFixed(1)}G / 8G`} />
          <div style={{ width:'1px', background:'var(--surface0)', margin:'8px 0' }} />
          <Gauge value={disk}    color="var(--peach)"  label="DISK" sublabel="45G / 100G" />
          <div style={{ width:'1px', background:'var(--surface0)', margin:'8px 0' }} />
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', padding:'0 20px' }}>
            {[
              { l:'Load Avg', v:'0.52, 0.41, 0.38' },
              { l:'Uptime',   v:'20d 2h 14m' },
              { l:'Sessions', v:'1 active' },
            ].map(s => (
              <div key={s.l} style={{ textAlign:'center' }}>
                <div style={{ fontSize:'10px', color:'var(--overlay0)', textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:700 }}>{s.l}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--subtext1)', fontWeight:600 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          <div className="monitor-section">
            <div className="ms-header"><Icon name="cpu" size={12} style={{ color:'var(--blue)' }}/>CPU History</div>
            <div className="chart-area">
              <MiniChart data={cpuHistory} color="var(--blue)" height={72} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:'6px', fontSize:'10.5px', color:'var(--overlay0)' }}>
                <span>30s ago</span><span>Now: <strong style={{ color:'var(--blue)', fontFamily:'var(--font-mono)' }}>{cpuNow}%</strong></span>
              </div>
            </div>
          </div>
          <div className="monitor-section">
            <div className="ms-header"><Icon name="network" size={12} style={{ color:'var(--teal)' }}/>Network I/O</div>
            <div className="chart-area">
              <MiniChart data={netHistory} color="var(--teal)" height={72} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:'6px', fontSize:'10.5px', color:'var(--overlay0)' }}>
                <span>30s ago</span><span>Now: <strong style={{ color:'var(--teal)', fontFamily:'var(--font-mono)' }}>{netHistory[netHistory.length-1]} MB/s</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Processes */}
        <div className="monitor-section">
          <div className="ms-header"><Icon name="list" size={12} style={{ color:'var(--mauve)' }}/>Top Processes</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto auto', gap:'8px', padding:'6px 16px', fontSize:'10.5px', color:'var(--overlay0)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid var(--surface0)' }}>
            <span>Name</span><span>PID</span><span>User</span><span style={{ textAlign:'right' }}>CPU</span><span style={{ textAlign:'right' }}>MEM</span>
          </div>
          {PROCESSES.map((p, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto auto', gap:'8px', padding:'7px 16px', fontSize:'12px', borderBottom: i < PROCESSES.length-1 ? '1px solid var(--surface0)' : 'none', alignItems:'center', transition:'background 140ms', cursor:'default' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--base)'}
              onMouseLeave={e => e.currentTarget.style.background=''}
            >
              <span style={{ fontFamily:'var(--font-mono)', color:'var(--text)' }}>{p.name}</span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'11px', color:'var(--overlay1)' }}>{p.pid}</span>
              <span style={{ fontSize:'11px', color:'var(--overlay1)' }}>{p.user}</span>
              <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:'var(--yellow)', textAlign:'right' }}>{p.cpu}</span>
              <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:'var(--blue)', textAlign:'right' }}>{p.mem}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MonitorView });
