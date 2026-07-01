import { useEffect, useState } from "react";
import type { AppSettings } from "../features/connections/types";
import { Icon } from "./Icon";

export function SettingsView({
  appSettings,
  onSave,
}: {
  appSettings: AppSettings;
  onSave(settings: AppSettings): Promise<void> | void;
}) {
  const [activeSection, setActiveSection] = useState("appearance");
  const [settings, setSettings] = useState<AppSettings>(appSettings);
  useEffect(() => {
    setSettings(appSettings);
  }, [appSettings]);
  const setSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };
  const nav = [
    ["appearance", "Appearance", "palette"],
    ["terminal", "Terminal", "terminal"],
    ["ssh", "SSH / Keys", "key"],
    ["transfer", "File Transfer", "download"],
    ["security", "Security", "shield"],
  ] as const;

  return (
    <section className="view-stack">
      <div className="view-header">
        <Icon name="settings" size={16} />
        <span className="view-header-title">Settings</span>
        <button className="view-btn primary" type="button" onClick={() => void onSave(settings)}>Save Changes</button>
      </div>
      <div className="settings-wrap">
        <aside className="settings-nav">
          {nav.map(([id, label, icon]) => (
            <button className={`sn-item${activeSection === id ? " active" : ""}`} type="button" key={id} onClick={() => setActiveSection(id)}>
              <Icon name={icon} size={14} />
              {label}
            </button>
          ))}
        </aside>
        <div className="settings-content">
          {activeSection === "appearance" ? (
            <section className="settings-section">
              <div className="ss-title">Theme & Colors</div>
              <div className="ss-desc">Choose the color scheme and accent for the entire app.</div>
              <div className="ss-row">
                <div className="ss-label">
                  <div className="ss-label-name">Color Theme</div>
                  <div className="ss-label-hint">Catppuccin Macchiato / Latte parity</div>
                </div>
                <select className="ss-select" name="theme" value={settings.theme} onChange={(event) => setSetting("theme", event.target.value)}>
                  <option value="light">Catppuccin Latte</option>
                  <option value="dark">Catppuccin Macchiato</option>
                  <option value="tokyo-night">Tokyo Night</option>
                  <option value="nord">Nord</option>
                </select>
              </div>
              <div className="ss-row">
                <div className="ss-label">
                  <div className="ss-label-name">Accent Color</div>
                  <div className="ss-label-hint">Used for active states and highlights</div>
                </div>
                <div className="color-swatches">
                  {["#8aadf4", "#c6a0f6", "#8bd5ca", "#a6da95", "#f5a97f", "#ed8796"].map((color) => (
                    <button
                      className={`color-swatch${settings.accent === color ? " active" : ""}`}
                      key={color}
                      style={{ background: color }}
                      type="button"
                      onClick={() => setSetting("accent", color)}
                    />
                  ))}
                </div>
              </div>
              <SettingsToggle
                label="Window Transparency"
                name="window-transparency"
                hint="Requires compositor support"
                checked={settings.transparency}
                onChange={(value) => setSetting("transparency", value)}
              />
            </section>
          ) : null}
          {activeSection === "terminal" ? (
            <section className="settings-section">
              <div className="ss-title">Font & Text</div>
              <div className="ss-desc">Configure terminal typeface and rendering.</div>
              <div className="ss-row">
                <div className="ss-label">
                  <div className="ss-label-name">Font Size</div>
                  <div className="ss-label-hint">Terminal text size in pixels</div>
                </div>
                <div className="range-control">
                  <input name="terminal-font-size" type="range" min="10" max="20" value={settings.fontSize} onChange={(event) => setSetting("fontSize", Number(event.target.value))} />
                  <span>{settings.fontSize}px</span>
                </div>
              </div>
              <SettingsToggle
                label="Ligatures"
                name="terminal-ligatures"
                hint="Enable terminal programming ligatures"
                checked={settings.ligatures}
                onChange={(value) => setSetting("ligatures", value)}
              />
              <SettingsToggle
                label="Copy on Select"
                name="copy-on-select"
                hint="Auto-copy selected terminal text"
                checked={settings.copyOnSelect}
                onChange={(value) => setSetting("copyOnSelect", value)}
              />
              <div className="term-preview" style={{ fontSize: settings.fontSize }}>
                <span className="t-user">jason@Ubuntu</span><span className="t-sep">:</span><span className="t-path">~/projects</span><span className="t-prompt"> # </span><span className="t-cmd">ls -la</span>
                <br />
                <span className="t-muted">drwxr-xr-x 5 jason jason 4096 May 28 </span><span className="t-host">go-termflow/</span>
              </div>
            </section>
          ) : null}
          {activeSection === "ssh" ? (
            <section className="settings-section">
              <div className="ss-title">SSH Keys & Auth</div>
              <div className="ss-desc">Manage authentication and connection defaults.</div>
              <div className="ss-row">
                <div className="ss-label">
                  <div className="ss-label-name">Default Key Path</div>
                  <div className="ss-label-hint">Path to default SSH private key</div>
                </div>
                <input className="ss-input" name="default-key-path" value={settings.defaultKeyPath} onChange={(event) => setSetting("defaultKeyPath", event.target.value)} />
              </div>
              <SettingsToggle
                label="SSH Agent Forwarding"
                name="ssh-agent-forwarding"
                hint="Forward the local agent into remote sessions"
                checked={settings.sshAgent}
                onChange={(value) => setSetting("sshAgent", value)}
              />
            </section>
          ) : null}
          {activeSection === "transfer" || activeSection === "security" ? (
            <section className="settings-section">
              <div className="ss-title">{activeSection === "transfer" ? "File Transfer" : "Security"}</div>
              <div className="ss-desc">Reserved settings area from the UX prototype.</div>
              <div className="empty-state-inline">Settings coming soon</div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SettingsToggle({
  label,
  name,
  hint,
  checked,
  onChange,
}: {
  label: string;
  name: string;
  hint: string;
  checked: boolean;
  onChange(value: boolean): void;
}) {
  return (
    <div className="ss-row">
      <div className="ss-label">
        <div className="ss-label-name">{label}</div>
        <div className="ss-label-hint">{hint}</div>
      </div>
      <label className="toggle">
        <input name={name} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="toggle-track" />
        <span className="toggle-thumb" />
      </label>
    </div>
  );
}
