import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const app = await readFile(new URL("app.js", root), "utf8");
const html = await readFile(new URL("index.html", root), "utf8");
const styles = await readFile(new URL("styles.css", root), "utf8");

test("competitive timeline puts the launch count beside the horizon", () => {
  assert.match(html, /id="timelineHorizonLabel"[\s\S]*id="timelineLaunchCount"/);
  assert.match(app, /byId\("timelineLaunchCount"\)\.textContent/);
});

test("competitive timeline omits the launch summary strip", () => {
  assert.doesNotMatch(app, /class="launch-board-summary"/);
  assert.doesNotMatch(app, />Compare latest<\/button>/);
  assert.doesNotMatch(styles, /\.launch-board-summary/);
});
