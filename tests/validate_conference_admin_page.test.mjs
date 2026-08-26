import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("conference admin provides the requested source fields and catalog actions", async () => {
  const [html, app] = await Promise.all([
    read("../conference-admin.html"),
    read("../conference-admin.js"),
  ]);

  assert.match(html, /<h1>Conference Admin<\/h1>/);
  assert.match(html, /id="conferenceTitle"[^>]*required/);
  assert.match(html, /id="conferenceLink"[^>]*type="url"[^>]*required/);
  assert.match(html, /id="conferenceTier"[^>]*required/);
  assert.match(html, /Tier 1 · Highest priority/);
  assert.match(html, /Tier 2 · Targeted monitoring/);
  assert.match(html, /Tier 3 · Watch list/);
  assert.match(app, /async function saveCatalog\(records\)/);
  assert.match(app, /fetch\("api\/conferences"/);
  assert.match(app, /method: "PUT"/);
  assert.match(app, /Authorization: `Bearer \$\{token\}`/);
  assert.match(app, /data-admin-edit/);
  assert.match(app, /data-admin-delete/);
  assert.match(app, /exportConferenceCatalog/);
  assert.match(app, /async function scrapeConferenceDetails\(link\)/);
  assert.match(app, /fetch\("api\/scrape-conference"/);
  assert.match(app, /only current or future events can enter Upcoming Conferences/);
  assert.match(app, /Checking official page…/);
  assert.match(html, /class="conference-sidebar admin-sidebar"/);
  assert.match(html, /class="admin-catalog-grid" role="list"/);
  assert.doesNotMatch(html, /class="admin-conference-table"/);
  assert.match(app, /class="admin-conference-card/);
  assert.match(html, /id="adminAuthForm"/);
  assert.match(html, /id="adminUserId"/);
  assert.match(html, /id="adminPassword"[^>]*type="password"/);
  assert.match(html, /id="adminSignOut"/);
  assert.match(app, /CONFERENCE_ADMIN_SESSION_KEY/);
  assert.match(app, /sessionStorage\.setItem\(CONFERENCE_ADMIN_SESSION_KEY/);
  assert.match(app, /authenticateConferenceAdmin/);
  assert.match(html, /Permanent server catalog/);
});

test("conference intelligence omits the monitored source catalog section", async () => {
  const [html, app] = await Promise.all([
    read("../conference.html"),
    read("../conference-page.js"),
  ]);

  assert.doesNotMatch(html, /conferenceSourceCatalog|Monitored Conference Sources|Live Admin Catalog/);
  assert.doesNotMatch(app, /renderConferenceSourceCatalog|readConferenceAdminCatalog|sourceCatalogExpanded/);
  assert.match(app, /fetch\("data\/conference_preparation\.json"/);
  assert.match(app, /async function loadLiveConferenceCatalog\(\)/);
  assert.match(app, /fetch\("api\/conferences", \{ cache: "no-store" \}\)/);
  assert.match(app, /conferenceState\.data\.events = mergeConferenceEvents/);
});

test("conference admin is reachable from conference intelligence surfaces", async () => {
  const [dashboard, conference, publications] = await Promise.all([
    read("../index.html"),
    read("../conference.html"),
    read("../publications.html"),
  ]);

  for (const source of [dashboard, conference, publications]) {
    assert.match(source, /href="conference-admin\.html"/);
  }
});

test("conference source and deployment assets stay synchronized", async () => {
  const names = ["conference-admin.html", "conference-admin.css", "conference-admin.js", "conference.html", "conference-page.css", "conference-page.js", "api/conferences.js"];
  for (const name of names) {
    const [source, deployed] = await Promise.all([read(`../${name}`), read(`../deploy-site/${name}`)]);
    assert.equal(deployed, source, `${name} differs in deploy-site`);
  }
});
