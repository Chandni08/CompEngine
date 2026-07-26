import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");

test("journal sources render in a two-row horizontal slider", () => {
  assert.match(app, /journal-source-slider-viewport/);
  assert.match(app, /data-journal-slide="previous"/);
  assert.match(app, /data-journal-slide="next"/);
  assert.match(app, /ResizeObserver\(updateJournalSourceSlider\)/);
  assert.match(styles, /grid-template-rows:\s*repeat\(2, auto\)/);
  assert.match(styles, /grid-auto-flow:\s*column/);
  assert.match(styles, /overflow-x:\s*auto/);
});

test("journal source slider advances by the visible group", () => {
  assert.match(app, /metrics\.currentColumn \+ direction \* metrics\.visibleColumns/);
  assert.match(app, /Showing \$\{startSource\}–\$\{endSource\} of \$\{cards\.length\}/);
  assert.match(app, /scrollTo\(\{ left: targetColumn \* metrics\.columnWidth, behavior: "smooth" \}\)/);
});
