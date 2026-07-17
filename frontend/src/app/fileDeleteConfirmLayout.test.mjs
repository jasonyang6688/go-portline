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
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "m"));
  return match?.[1] ?? "";
}

test("file delete confirmation keeps long selections scrollable with visible actions", () => {
  const component = readAppFile("FileModals.tsx");
  const styles = readAppFile("styles.css");

  assert.match(component, /className="danger-body"/);
  assert.match(component, /className="file-delete-list"/);
  assert.match(component, /className="file-delete-item"/);

  const cardRule = cssRule(styles, ".danger-card");
  assert.match(cardRule, /max-height:\s*calc\(100vh - 48px\)/);

  const bodyRule = cssRule(styles, ".danger-body");
  assert.match(bodyRule, /overflow:\s*hidden/);

  const listRule = cssRule(styles, ".file-delete-list");
  assert.match(listRule, /overflow-y:\s*auto/);
  assert.match(listRule, /max-height:/);

  const actionsRule = cssRule(styles, ".danger-actions");
  assert.match(actionsRule, /flex-shrink:\s*0/);
});
