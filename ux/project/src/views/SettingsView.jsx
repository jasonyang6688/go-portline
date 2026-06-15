const { useState } = React;

const ACCENT_COLORS = [
  { name:'Blue',    val:'#8aadf4' },
  { name:'Mauve',   val:'#c6a0f6' },
  { name:'Teal',    val:'#8bd5ca' },
  { name:'Green',   val:'#a6da95' },
  { name:'Peach',   val:'#f5a97f' },
  { name:'Red',     val:'#ed8796' },
];

const THEMES = [
  { name:'Catppuccin Macchiato', dark:true  },
  { name:'Tokyo Night',          dark:true  },
  { name:'Dracula',              dark:true  },
  { name:'Nord',                 dark:true  },
  { name:'One Dark Pro',         dark:true  },
  { name:'Gruvbox Dark',         dark:true  },
  { name:'Solarized Light',      dark:false },
];

const FONTS = [
  'JetBrains Mono', 'Cascadia Code', 'Fira Code',
  'Hack', 'Source Code Pro', 'Inconsolata', 'Courier New',
];

function Toggle({ checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="toggle-track" />
      <div className="toggle-thumb" />
    </label>
  );
}

function SettingsRow({ label, hint, children }) {
  return (
    <div className="ss-row">
      <div className="ss-label">
        <div className="ss-label-name">{label}</div>
        {hint && <div className="ss-label-hint">{hint}</div>}
      </div>
      <div className="ss-control">{children}</div>
    </div>
  );
}

const SECTIONS = [
  { id:'appearance', label:'Appearance',  icon:'palette'   },
  { id:'terminal',   label:'Terminal',    icon:'terminal'  },
  { id:'ssh',        label:'SSH / Keys',  icon:'key'       },
  { id:'transfer',   label:'File Transfer', icon:'download' },
  { id:'security',   label:'Security',    icon:'shield'    },
];

function AppearanceSection({ settings, set }) {
  return (
    <>
      <div className="settings-section">
        <div className="ss-title">Theme & Colors</div>
        <div className="ss-desc">Choose the color scheme and accent for the entire app</div>
        <SettingsRow label="Color Theme">
          <select className="ss-select" value={settings.theme} onChange={e => set('theme', e.target.value)}>
            {THEMES.map(t => <option key={t.name}>{t.name}</option>)}
          </select>
        </SettingsRow>
        <SettingsRow label="Accent Color" hint="Used for active states and highlights">
          <div className="color-swatches">
            {ACCENT_COLORS.map(c => (
              <div
                key={c.name}
                className={`color-swatch${settings.accent === c.val ? ' active' : ''}`}
                style={{ background: c.val }}
                title={c.name}
                onClick={() => set('accent', c.val)}
              />
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Window Transparency" hint="Requires compositor support">
          <Toggle checked={settings.transparency} onChange={v => set('transparency', v)} />
        </SettingsRow>
        <SettingsRow label="Blur Background" hint="Frosted glass effect on sidebar">
          <Toggle checked={settings.blur} onChange={v => set('blur', v)} />
        </SettingsRow>
        <SettingsRow label="Animations" hint="Transitions and micro-interactions">
          <select className="ss-select" value={settings.animations} onChange={e => set('animations', e.target.value)}>
            <option>Full</option>
            <option>Reduced</option>
            <option>None</option>
          </select>
        </SettingsRow>
      </div>

      <div className="settings-section">
        <div className="ss-title">Layout</div>
        <div className="ss-desc">Customize the app layout and sidebar behavior</div>
        <SettingsRow label="Sidebar Width" hint="Default sidebar width in pixels">
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <input type="range" min="180" max="320" value={settings.sidebarW} onChange={e => set('sidebarW', +e.target.value)}
              style={{ accentColor:'var(--accent)', width:'100px' }} />
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--subtext1)', minWidth:'36px' }}>{settings.sidebarW}px</span>
          </div>
        </SettingsRow>
        <SettingsRow label="Status Bar" hint="Show status bar at the bottom">
          <Toggle checked={settings.statusbar} onChange={v => set('statusbar', v)} />
        </SettingsRow>
        <SettingsRow label="Tab Position">
          <select className="ss-select" value={settings.tabPos} onChange={e => set('tabPos', e.target.value)}>
            <option>Top</option>
            <option>Bottom</option>
          </select>
        </SettingsRow>
      </div>
    </>
  );
}

function TerminalSection({ settings, set }) {
  const sampleFontSize = settings.fontSize || 13;
  return (
    <>
      <div className="settings-section">
        <div className="ss-title">Font & Text</div>
        <div className="ss-desc">Configure terminal typeface and rendering</div>
        <SettingsRow label="Font Family">
          <select className="ss-select" value={settings.font} onChange={e => set('font', e.target.value)}>
            {FONTS.map(f => <option key={f}>{f}</option>)}
          </select>
        </SettingsRow>
        <SettingsRow label="Font Size" hint="Terminal text size in pixels">
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <input type="range" min="10" max="20" value={sampleFontSize} onChange={e => set('fontSize', +e.target.value)}
              style={{ accentColor:'var(--accent)', width:'100px' }} />
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--subtext1)', minWidth:'30px' }}>{sampleFontSize}px</span>
          </div>
        </SettingsRow>
        <SettingsRow label="Line Height" hint="Vertical spacing between lines">
          <select className="ss-select" value={settings.lineHeight} onChange={e => set('lineHeight', e.target.value)}>
            <option>1.2</option><option>1.4</option><option>1.5</option><option>1.6</option><option>1.8</option>
          </select>
        </SettingsRow>
        <SettingsRow label="Ligatures" hint="Enable font ligatures (e.g. → ≠ >=)">
          <Toggle checked={settings.ligatures} onChange={v => set('ligatures', v)} />
        </SettingsRow>

        {/* Terminal preview */}
        <div className="term-preview" style={{ fontFamily: settings.font || 'JetBrains Mono', fontSize: `${sampleFontSize}px` }}>
          <div><span style={{color:'#a6da95',fontWeight:600}}>jason@Ubuntu</span><span style={{color:'#8087a2'}}>:</span><span style={{color:'#c6a0f6'}}>~/projects</span><span style={{color:'#a6da95'}}> # </span><span style={{color:'#cad3f5'}}>ls -la</span></div>
          <div style={{color:'#a5adcb'}}>total 48</div>
          <div><span style={{color:'#a5adcb'}}>drwxr-xr-x  5 jason jason 4096 May 28 </span><span style={{color:'#8aadf4',fontWeight:600}}>go-termflow/</span></div>
          <div><span style={{color:'#a5adcb'}}>-rw-r--r--  1 jason jason 3412 May 27 </span><span style={{color:'#cad3f5'}}>README.md</span></div>
          <div style={{color:'#494d64', fontStyle:'italic'}}>← Preview updates as you change settings</div>
        </div>
      </div>

      <div className="settings-section">
        <div className="ss-title">Behavior</div>
        <div className="ss-desc">Terminal interaction settings</div>
        <SettingsRow label="Scrollback Lines" hint="Number of lines to keep in buffer">
          <select className="ss-select" value={settings.scrollback} onChange={e => set('scrollback', e.target.value)}>
            <option>1000</option><option>5000</option><option>10000</option><option>Unlimited</option>
          </select>
        </SettingsRow>
        <SettingsRow label="Bell" hint="Audible or visual bell on terminal bell">
          <select className="ss-select" value={settings.bell} onChange={e => set('bell', e.target.value)}>
            <option>Visual</option><option>Audible</option><option>None</option>
          </select>
        </SettingsRow>
        <SettingsRow label="Copy on Select" hint="Auto-copy selected text to clipboard">
          <Toggle checked={settings.copyOnSelect} onChange={v => set('copyOnSelect', v)} />
        </SettingsRow>
        <SettingsRow label="Ctrl+C Copies" hint="Use Ctrl+C for copy instead of SIGINT when text selected">
          <Toggle checked={settings.ctrlCCopy} onChange={v => set('ctrlCCopy', v)} />
        </SettingsRow>
      </div>
    </>
  );
}

function SSHSection({ settings, set }) {
  return (
    <div className="settings-section">
      <div className="ss-title">SSH Keys & Auth</div>
      <div className="ss-desc">Manage authentication and connection defaults</div>
      <SettingsRow label="Default Key Path" hint="Path to default SSH private key">
        <input
          style={{ background:'var(--surface0)', border:'1px solid var(--surface1)', borderRadius:'var(--r-sm)', padding:'5px 10px', fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--text)', outline:'none', width:'240px' }}
          defaultValue="~/.ssh/id_ed25519"
        />
      </SettingsRow>
      <SettingsRow label="SSH Agent Forwarding">
        <Toggle checked={settings.sshAgent} onChange={v => set('sshAgent', v)} />
      </SettingsRow>
      <SettingsRow label="Keep-alive Interval" hint="Send keep-alive packets every N seconds">
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <input type="number" defaultValue="60" min="0" max="300" style={{ width:'70px', background:'var(--surface0)', border:'1px solid var(--surface1)', borderRadius:'var(--r-sm)', padding:'4px 8px', fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--text)', outline:'none' }}/>
          <span style={{ fontSize:'12px', color:'var(--overlay0)' }}>seconds</span>
        </div>
      </SettingsRow>
      <SettingsRow label="Connection Timeout">
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <input type="number" defaultValue="30" min="5" max="120" style={{ width:'70px', background:'var(--surface0)', border:'1px solid var(--surface1)', borderRadius:'var(--r-sm)', padding:'4px 8px', fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--text)', outline:'none' }}/>
          <span style={{ fontSize:'12px', color:'var(--overlay0)' }}>seconds</span>
        </div>
      </SettingsRow>
      <SettingsRow label="Reconnect on Disconnect" hint="Automatically reconnect dropped sessions">
        <Toggle checked={settings.autoReconnect} onChange={v => set('autoReconnect', v)} />
      </SettingsRow>
    </div>
  );
}

function PlaceholderSection({ title }) {
  return (
    <div className="settings-section">
      <div className="ss-title">{title}</div>
      <div style={{ padding:'32px', textAlign:'center', color:'var(--overlay0)', fontSize:'13px' }}>
        Settings coming soon
      </div>
    </div>
  );
}

function SettingsView({ sidebarWidth, onSidebarWidthChange }) {
  const [activeSection, setActiveSection] = useState('appearance');
  const [settings, setSettings] = useState({
    theme:'Catppuccin Macchiato', accent:'#8aadf4', transparency:false,
    blur:false, animations:'Full', sidebarW: sidebarWidth || 224,
    statusbar:true, tabPos:'Top', font:'JetBrains Mono', fontSize:13,
    lineHeight:'1.65', ligatures:true, scrollback:'5000', bell:'Visual',
    copyOnSelect:true, ctrlCCopy:false, sshAgent:true, autoReconnect:true,
  });

  const set = (k, v) => {
    setSettings(s => ({ ...s, [k]: v }));
    if (k === 'sidebarW' && onSidebarWidthChange) onSidebarWidthChange(v);
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div className="view-header">
        <Icon name="settings" size={16} style={{ color:'var(--accent)' }} />
        <span className="view-header-title">Settings</span>
        <button className="view-btn primary">Save Changes</button>
      </div>
      <div className="settings-wrap">
        <nav className="settings-nav">
          {SECTIONS.map(s => (
            <div key={s.id} className={`sn-item${activeSection === s.id ? ' active' : ''}`} onClick={() => setActiveSection(s.id)}>
              <Icon name={s.icon} size={14} />
              {s.label}
            </div>
          ))}
        </nav>
        <div className="settings-content">
          {activeSection === 'appearance' && <AppearanceSection settings={settings} set={set} />}
          {activeSection === 'terminal'   && <TerminalSection   settings={settings} set={set} />}
          {activeSection === 'ssh'        && <SSHSection        settings={settings} set={set} />}
          {activeSection === 'transfer'   && <PlaceholderSection title="File Transfer" />}
          {activeSection === 'security'   && <PlaceholderSection title="Security" />}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsView });
