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
  assert.match(app, /localStorage\.setItem\(CONFERENCE_ADMIN_STORAGE_KEY/);
  assert.match(app, /data-admin-edit/);
  assert.match(app, /data-admin-delete/);
  assert.match(app, /exportConferenceCatalog/);
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
  assert.match(app, /crypto\.subtle\.digest\("SHA-256"/);
});

test("conference intelligence reads and live-refreshes the admin catalog", async () => {
  const [html, app] = await Promise.all([
    read("../conference.html"),
    read("../conference-page.js"),
  ]);

  assert.match(html, /id="conferenceSourceCatalog"/);
  assert.match(html, /Admin entries appear here immediately/);
  assert.match(app, /CONFERENCE_ADMIN_STORAGE_KEY = "waters-conference-admin-catalog-v1"/);
  assert.match(app, /readConferenceAdminCatalog/);
  assert.match(app, /window\.addEventListener\("storage"/);
  assert.match(app, /window\.addEventListener\("pageshow"/);
  assert.match(app, /Awaiting dates and intelligence enrichment/);
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

test("conference admin source and deployment assets stay synchronized", async () => {
  const names = ["conference-admin.html", "conference-admin.css", "conference-admin.js"];
  for (const name of names) {
    const [source, deployed] = await Promise.all([read(`../${name}`), read(`../deploy-site/${name}`)]);
    assert.equal(deployed, source, `${name} differs in deploy-site`);
  }
});
