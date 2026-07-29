import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { headingConsistencyErrors, titleCaseErrors } from "../scripts/validate_heading_consistency.mjs";

const names = ["index.html", "app.js", "conference.html", "conference-page.js", "publications.html", "publication-page.js"];
const files = Object.fromEntries(
  await Promise.all(names.map(async (name) => [name, await readFile(new URL(`../${name}`, import.meta.url), "utf8")])),
);
const deployFiles = Object.fromEntries(
  await Promise.all(names.map(async (name) => [name, await readFile(new URL(`../deploy-site/${name}`, import.meta.url), "utf8")])),
);

test("dashboard, conference, and publication structural headings use consistent title case", () => {
  assert.deepEqual(headingConsistencyErrors(files), []);
});

test("deployment copies preserve the same heading capitalization", () => {
  assert.deepEqual(headingConsistencyErrors(deployFiles), []);
  for (const name of names) assert.equal(deployFiles[name], files[name], `${name} differs in deploy-site`);
});

test("a lowercase second word fails the deployment heading validation", () => {
  assert.match(titleCaseErrors("test heading", "Decisions needed").join("\n"), /needed.*capitalized/i);
});
