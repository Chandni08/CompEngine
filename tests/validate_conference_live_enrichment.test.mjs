import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [handler, deployedHandler, catalogHandler, deployedCatalogHandler, page, deployedPage, data, deployedData] = await Promise.all([
  readFile(new URL("api/scrape-conference.js", root), "utf8"),
  readFile(new URL("deploy-site/api/scrape-conference.js", root), "utf8"),
  readFile(new URL("api/conferences.js", root), "utf8"),
  readFile(new URL("deploy-site/api/conferences.js", root), "utf8"),
  readFile(new URL("conference-page.js", root), "utf8"),
  readFile(new URL("deploy-site/conference-page.js", root), "utf8"),
  readFile(new URL("data/conference_preparation.json", root), "utf8").then(JSON.parse),
  readFile(new URL("deploy-site/data/conference_preparation.json", root), "utf8").then(JSON.parse),
]);

test("official event URLs are scraped server-side with public-host and response-size guards", () => {
  assert.match(handler, /async function validatedUrl\(value\)/);
  assert.match(handler, /isPrivateAddress/);
  assert.match(handler, /MAX_RESPONSE_BYTES/);
  assert.match(handler, /eventJsonLd/);
  assert.match(handler, /likelyDatePages/);
  assert.match(handler, /startDate/);
  assert.match(handler, /endDate/);
  assert.equal(deployedHandler, handler);
});

test("admin-added future events merge into Upcoming Conferences without duplicating published events", () => {
  assert.match(page, /readConferenceCatalog/);
  assert.match(page, /conferenceEventFromCatalog/);
  assert.match(page, /mergeConferenceEvents/);
  assert.match(page, /conferenceDatePolicy\.isCurrentOrUpcoming/);
  assert.equal(deployedPage, page);
});

test("conference catalog is stored in an atomic server JSON file and served without caching", () => {
  assert.match(catalogHandler, /require\("node:fs\/promises"\)/);
  assert.match(catalogHandler, /CONFERENCE_CATALOG_PATH/);
  assert.match(catalogHandler, /async function writePersistedCatalog\(records\)/);
  assert.match(catalogHandler, /await rename\(temporary, target\)/);
  assert.match(catalogHandler, /Cache-Control", "no-store/);
  assert.match(catalogHandler, /if \(!authenticated\(request\)\)/);
  assert.doesNotMatch(catalogHandler, /@vercel\/blob/);
  assert.equal(deployedCatalogHandler, catalogHandler);
});

test("EP3M Summit is present with dates verified from its official 2026 program", () => {
  const event = data.events.find((item) => item.id === "ep3m-summit-2026-prep");
  assert.ok(event);
  assert.equal(event.startDate, "2026-09-29");
  assert.equal(event.endDate, "2026-09-30");
  assert.equal(event.website, "https://www.ep3msummit.com/");
  assert.ok(event.monitoringLinks.some((item) => item.url.includes("executiveprojectprogramportfoliomanagement")));
  assert.deepEqual(deployedData, data);
});
