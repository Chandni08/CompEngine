import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadPolicy(relativeUrl = "../conference-date-policy.js") {
  const source = await readFile(new URL(relativeUrl, import.meta.url), "utf8");
  const context = vm.createContext({ Date });
  vm.runInContext(source, context);
  return context.ConferenceDatePolicy;
}

test("stale refresh dates cannot keep ended conferences upcoming", async () => {
  const policy = await loadPolicy();
  const now = new Date(2026, 7, 16, 9, 30);
  const cutoffDate = policy.effectiveCurrentDate("2026-08-11", now);

  assert.equal(cutoffDate, "2026-08-16");
  assert.equal(policy.isCurrentOrUpcoming({ startDate: "2026-08-10", endDate: "2026-08-13" }, cutoffDate), false);
  assert.equal(policy.isCurrentOrUpcoming({ startDate: "2026-08-16", endDate: "2026-08-16" }, cutoffDate), true);
  assert.equal(policy.isCurrentOrUpcoming({ startDate: "2026-08-22", endDate: "2026-08-28" }, cutoffDate), true);
});

test("the policy respects a data snapshot later than the viewer date", async () => {
  const policy = await loadPolicy();
  const now = new Date(2026, 7, 16, 9, 30);

  assert.equal(policy.effectiveCurrentDate("2026-08-20", now), "2026-08-20");
  assert.equal(policy.isCurrentOrUpcoming({ startDate: "2026-08-19" }, "2026-08-20"), false);
  assert.equal(policy.isCurrentOrUpcoming({ startDate: "2026-08-20" }, "2026-08-20"), true);
});

test("dashboard and conference pages load and apply the shared date policy", async () => {
  const [index, conferenceHtml, app, conferencePage, deployedPolicy] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../conference.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../conference-page.js", import.meta.url), "utf8"),
    loadPolicy("../deploy-site/conference-date-policy.js"),
  ]);

  assert.ok(index.indexOf("conference-date-policy.js") < index.indexOf("app.js"));
  assert.ok(conferenceHtml.indexOf("conference-date-policy.js") < conferenceHtml.indexOf("conference-page.js"));
  assert.match(app, /conferenceDatePolicy\.effectiveCurrentDate\(asOfValue\)/);
  assert.match(app, /conferenceDatePolicy\.isCurrentOrUpcoming\(event, cutoffDate\)/);
  assert.match(conferencePage, /conferenceDatePolicy\.effectiveCurrentDate\(conferenceState\.data\?\.asOfDate\)/);
  assert.match(conferencePage, /conferenceDatePolicy\.isCurrentOrUpcoming\(event, cutoffDate\)/);
  assert.equal(deployedPolicy.effectiveCurrentDate("2026-08-11", new Date(2026, 7, 16)), "2026-08-16");
});
