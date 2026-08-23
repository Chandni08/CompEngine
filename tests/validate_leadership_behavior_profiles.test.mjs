import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const app = readFileSync(new URL("app.js", root), "utf8");
const css = readFileSync(new URL("product-ui.css", root), "utf8");
const dataset = JSON.parse(readFileSync(new URL("data/leadership_profiles.json", root), "utf8"));
const peopleDataset = JSON.parse(readFileSync(new URL("data/leadership_people.json", root), "utf8"));

test("Engineering exposes evidence-based competitor leadership profiles", () => {
  assert.match(html, /id="leadership-behavior-profiles"/);
  assert.match(html, /Competitor Leadership Behavior Profiles/);
  assert.match(html, /id="leadershipBehaviorNav"/);
  assert.doesNotMatch(html, /not a personality or psychology assessment/i);
  assert.match(html, /Engineering · LC-MS portfolio intelligence/);
  assert.match(app, /function renderLeadershipBehaviorProfiles\(\)/);
  assert.match(app, /function firstLeadershipSentence\(value\)/);
  assert.match(app, /const leadershipPersonPriority =/);
  assert.match(app, /const conciseCareerArc =/);
  assert.match(app, /\.slice\(0, 1\)/);
  assert.match(app, /profile\.watchItems\.slice\(0, 2\)/);
  assert.match(app, /function moveLeadershipPersonSlider\(competitor, direction\)/);
  assert.match(app, /data-leadership-person-action="previous"/);
  assert.match(app, /data-leadership-person-select/);
  assert.ok(
    app.indexOf('<div class="leadership-person-dots"') < app.indexOf('<header class="leadership-person-slider-header"'),
    "leader selector should render above the relevant-leaders profile header",
  );
  assert.match(app, /const engineeringEvidenceVisible = state\.view === "Engineering"/);
  assert.match(css, /\.leadership-selected-detail/);
  assert.match(css, /\.leadership-person-slider/);
  assert.doesNotMatch(app, /leadership-evidence-boundary/);
  assert.doesNotMatch(css, /leadership-evidence-boundary/);
});

test("all five competitor profiles map current executive and LC-MS portfolio ownership", () => {
  assert.deepEqual(
    new Set(dataset.profiles.map((profile) => profile.competitor)),
    new Set(["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX", "PerkinElmer"]),
  );
  dataset.profiles.forEach((profile) => {
    assert.ok(profile.leaders.length >= 2);
    assert.ok(profile.leaders.some((leader) => /Chief executive|Parent chief executive/.test(leader.roleLabel)));
    assert.ok(profile.leaders.some((leader) => /LC-MS/.test(leader.roleLabel)));
    assert.ok(profile.observableSignals.length >= 2);
    assert.equal(profile.identityConfidence, "High");
    assert.equal(profile.behaviorReadConfidence, "Directional");
    assert.equal(profile.fieldCitable, false);
    assert.match(profile.evidenceBoundary, /not|do not|does not/i);
    profile.observableSignals.forEach((signal) => {
      assert.match(signal.sourceUrl, /^https:\/\//);
      assert.match(signal.sourceDate, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(signal.observedAction.length > 70);
      assert.ok(signal.planningImplication.length > 70);
    });
  });
});

test("each named leader has a source-bounded person profile for the slider", () => {
  const nonPersonLabels = new Set(["Open role", "Status unverified"]);
  const namedLeaders = dataset.profiles.flatMap((profile) => profile.leaders.filter((leader) => !nonPersonLabels.has(leader.name)));
  assert.equal(namedLeaders.length, peopleDataset.people.length);
  namedLeaders.forEach((leader) => {
    const person = peopleDataset.people.find((item) => item.name === leader.name);
    assert.ok(person, `missing profile for ${leader.name}`);
    assert.equal(person.careerArc.length, 3);
    assert.ok(person.operatingPattern.summary.length > 60);
    assert.ok(person.companyChanges.length >= 1);
    assert.match(person.likelyFocus.confidence, /Directional/);
    assert.ok(/not|inference|derived|public|does not/i.test(person.likelyFocus.basis));
    person.companyChanges.forEach((change) => {
      assert.match(change.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(change.sourceUrl, /^https:\/\//);
      assert.ok(change.attribution.length > 20);
    });
  });
});

test("direct LC-MS and technology owners are included and prioritized", () => {
  const addedLeaders = ["Iris Mangelschots", "August Specht", "Dieter Hofmann", "Hiroto Itoi", "Chris Lock"];
  addedLeaders.forEach((name) => {
    assert.ok(peopleDataset.people.some((person) => person.name === name), `missing relevant leader ${name}`);
    assert.match(app, new RegExp(name));
  });
  assert.equal(peopleDataset.asOfDate, "2026-08-22");
});

test("SCIEX parent oversight and the changed PerkinElmer portfolio-role status are explicit", () => {
  const sciex = dataset.profiles.find((profile) => profile.competitor === "SCIEX");
  const perkinElmer = dataset.profiles.find((profile) => profile.competitor === "PerkinElmer");
  assert.ok(sciex.leaders.some((leader) => leader.name === "Rainer M. Blair"));
  assert.ok(sciex.leaders.some((leader) => leader.name === "Chris Hagen"));
  assert.ok(perkinElmer.leaders.some((leader) => leader.status === "No longer listed"));
  assert.match(perkinElmer.observableSignals.map((signal) => signal.observedAction).join(" "), /now returns 404.*absent from.*current.*Woodbridge index/i);
});

test("deployment mirror contains matching leadership code, UI, and data", () => {
  const deployedHtml = readFileSync(new URL("deploy-site/index.html", root), "utf8");
  const deployedApp = readFileSync(new URL("deploy-site/app.js", root), "utf8");
  const deployedCss = readFileSync(new URL("deploy-site/product-ui.css", root), "utf8");
  const deployedData = JSON.parse(readFileSync(new URL("deploy-site/data/leadership_profiles.json", root), "utf8"));
  const deployedPeople = JSON.parse(readFileSync(new URL("deploy-site/data/leadership_people.json", root), "utf8"));
  assert.equal(deployedHtml, html);
  assert.equal(deployedApp, app);
  assert.equal(deployedCss, css);
  assert.deepEqual(deployedData, dataset);
  assert.deepEqual(deployedPeople, peopleDataset);
});
