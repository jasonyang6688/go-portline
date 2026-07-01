import { Icon } from "./Icon";
import {
  getFilteredCommandPaletteItems,
  type CommandPaletteItem,
} from "./commandPaletteItems";

type CommandPaletteProps = {
  items: CommandPaletteItem[];
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
};

export function CommandPalette({
  items,
  query,
  onQueryChange,
  onClose,
}: CommandPaletteProps) {
  const filteredItems = getFilteredCommandPaletteItems(items, query);

  function runItem(item: CommandPaletteItem) {
    onClose();
    item.action();
  }

  return (
    <div className="tf-overlay" role="presentation" onMouseDown={onClose}>
      <div className="palette-card" onMouseDown={(event) => event.stopPropagation()}>
        <div className="pal-search">
          <Icon name="search" size={17} />
          <input
            className="pal-input"
            name="command-palette-search"
            autoFocus
            value={query}
            placeholder="Search connections, commands, views..."
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onClose();
                return;
              }
              if (event.key === "Enter" && filteredItems[0]) {
                runItem(filteredItems[0]);
              }
            }}
          />
          <span className="pal-kbd">ESC</span>
        </div>
        <div className="pal-list">
          <div className="pal-section">Actions</div>
          {filteredItems.map((item) => (
            <button
              className="pal-item"
              type="button"
              key={`${item.label}-${item.sub}`}
              onClick={() => runItem(item)}
            >
              <span className="pal-item-icon"><Icon name="terminal" size={14} /></span>
              <span className="pal-item-main">
                <span className="pal-item-title">{item.label}</span>
                <span className="pal-item-sub">{item.sub}</span>
              </span>
              <span className="pal-enter">enter</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
