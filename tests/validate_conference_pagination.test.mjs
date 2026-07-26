import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../conference-page.js", import.meta.url), "utf8");
const html = await readFile(new URL("../conference.html", import.meta.url), "utf8");

test("conference preparation paginates four cards at a time", () => {
  assert.match(app, /eventPageSize:\s*4/);
  assert.match(app, /visibleEvents = events\.slice\(pageStart, pageStart \+ conferenceState\.eventPageSize\)/);
  assert.match(app, /data-conference-page/);
  assert.match(html, /id="conferenceEventPagination"/);
});

test("conference pagination resets when filters reset", () => {
  assert.match(app, /conferenceState\.eventPage = 1/);
});
