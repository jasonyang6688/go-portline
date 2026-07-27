import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readAppFile(filename) {
  return readFileSync(join(__dirname, filename), "utf8");
}

function cssRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`^\\s*${escapedSelector}\\s*\\{([^}]*)\\}`, "m"));
  return match?.[1] ?? "";
}

test("minimized file dock reserves space for terminal footer controls", () => {
  const app = readAppFile("App.tsx");
  const styles = readAppFile("styles.css");

  assert.match(app, /data-active-view=\{activeView\}/);
  assert.match(app, /data-terminal-fullscreen=\{activeTerminalFullscreen\}/);
  assert.match(app, /data-terminal-broadcast=\{terminalBroadcast\}/);
  assert.match(app, /data-terminal-smart=\{terminalSmartOpen\}/);
  assert.match(app, /data-terminal-dock=\{terminalDock \?\? "none"\}/);

  const rootRule = cssRule(styles, ":root");
  assert.match(rootRule, /--terminal-input-h:\s*40px/);
  assert.match(rootRule, /--terminal-broadcast-h:\s*32px/);
  assert.match(rootRule, /--terminal-dock-w:\s*clamp\(440px, 28vw, 580px\)/);

  const appRule = cssRule(styles, ".app");
  assert.match(appRule, /--file-editor-dock-bottom:\s*calc\(var\(--statusbar-h\) \+ 10px\)/);
  assert.match(appRule, /--file-editor-dock-right:\s*14px/);

  const terminalRule = cssRule(
    styles,
    '.app[data-active-view="terminal"][data-terminal-fullscreen="false"]',
  );
  assert.match(
    terminalRule,
    /--file-editor-dock-bottom:\s*calc\(var\(--statusbar-h\) \+ var\(--terminal-input-h\) \+ 10px\)/,
  );

  const broadcastRule = cssRule(
    styles,
    '.app[data-active-view="terminal"][data-terminal-fullscreen="false"][data-terminal-broadcast="true"]',
  );
  assert.match(
    broadcastRule,
    /--file-editor-dock-bottom:\s*calc\(\s*var\(--statusbar-h\) \+ var\(--terminal-input-h\) \+ var\(--terminal-broadcast-h\) \+ 10px\s*\)/,
  );

  const terminalDockRule = cssRule(
    styles,
    '.app[data-active-view="terminal"][data-terminal-dock]:not([data-terminal-dock="none"])',
  );
  assert.match(
    terminalDockRule,
    /--file-editor-dock-right:\s*calc\(var\(--terminal-dock-w\) \+ 14px\)/,
  );

  const terminalPanelRule = cssRule(styles, ".term-files");
  assert.match(terminalPanelRule, /width:\s*var\(--terminal-dock-w\)/);

  const smartBarRule = cssRule(
    styles,
    '.app[data-active-view="terminal"][data-terminal-fullscreen="false"][data-terminal-smart="true"] .file-editor-dock',
  );
  assert.match(smartBarRule, /visibility:\s*hidden/);
  assert.match(smartBarRule, /pointer-events:\s*none/);
  assert.match(smartBarRule, /opacity:\s*0/);

  const dockRule = cssRule(styles, ".file-editor-dock");
  assert.match(dockRule, /bottom:\s*var\(--file-editor-dock-bottom\)/);
  assert.match(dockRule, /right:\s*var\(--file-editor-dock-right\)/);
  assert.match(
    dockRule,
    /max-width:\s*calc\(100vw - var\(--file-editor-dock-right\) - 14px\)/,
  );

  assert.match(
    styles,
    /@media \(max-width: 1100px\) \{[\s\S]*?\.app\[data-active-view="terminal"\]\[data-terminal-dock\]:not\(\[data-terminal-dock="none"\]\) \{\s*--file-editor-dock-right:\s*14px;/,
  );
});
