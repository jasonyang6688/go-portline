import { Icon } from "./Icon";

type ActivityItem = {
  id: string;
  label: string;
  icon: string;
};

type ActivityBarProps<TView extends string> = {
  activeView: TView;
  items: readonly ActivityItem[];
  settingsView: TView;
  sidebarCollapsed: boolean;
  onSetView: (view: TView) => void;
  onToggleSidebar: () => void;
};

export function ActivityBar<TView extends string>({
  activeView,
  items,
  settingsView,
  sidebarCollapsed,
  onSetView,
  onToggleSidebar,
}: ActivityBarProps<TView>) {
  return (
    <aside className="actbar" aria-label="Primary navigation">
      <button
        className={`act-btn${sidebarCollapsed ? "" : " active-secondary"}`}
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? "Show connections sidebar" : "Hide connections sidebar"}
        title={sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
      >
        <Icon name="sidebar" size={18} />
      </button>
      {items.filter((item) => item.id !== settingsView).map((item) => (
        <button
          key={item.id}
          className={`act-btn${activeView === item.id ? " active" : ""}`}
          type="button"
          onClick={() => onSetView(item.id as TView)}
          aria-label={item.label}
          title={item.label}
        >
          <Icon name={item.icon} size={18} />
        </button>
      ))}
      <div className="act-spacer" />
      <button
        className={`act-btn${activeView === settingsView ? " active" : ""}`}
        type="button"
        onClick={() => onSetView(settingsView)}
        aria-label="Settings"
        title="Settings"
      >
        <Icon name="settings" size={18} />
      </button>
      <button className="act-btn" type="button" aria-label="Account" title="Account">
        <Icon name="user" size={18} />
      </button>
    </aside>
  );
}
