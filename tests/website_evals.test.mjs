import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entryPages = ["index.html", "conference.html", "publications.html", "conference-admin.html"];
const runtimeScripts = ["app.js", "conference-page.js", "publication-page.js", "conference-admin.js"];

const read = (relativePath, root = projectRoot) => readFile(path.join(root, relativePath), "utf8");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function exists(relativePath, root = projectRoot) {
  try {
    await stat(path.join(root, relativePath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function attribute(markup, name) {
  return markup.match(new RegExp(`\\b${escapeRegExp(name)}=["']([^"']*)["']`, "i"))?.[1] || "";
}

function idsIn(document) {
  return [...document.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
}

function localReferences(document) {
  return [...document.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)].map((match) => match[1]);
}

function isRemoteReference(reference) {
  return /^(?:https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(reference);
}

function pathPart(reference) {
  return decodeURIComponent(reference.split("#", 1)[0].split("?", 1)[0]);
}

function fragmentPart(reference) {
  const index = reference.indexOf("#");
  return index === -1 ? "" : decodeURIComponent(reference.slice(index + 1));
}

function controlHasAccessibleName(document, markup, offset) {
  if (/\baria-label(?:ledby)?=["'][^"']+["']/i.test(markup)) return true;
  const id = attribute(markup, "id");
  if (id && new RegExp(`<label\\b[^>]*\\bfor=["']${escapeRegExp(id)}["']`, "i").test(document)) return true;

  const before = document.slice(0, offset).toLowerCase();
  const openLabel = before.lastIndexOf("<label");
  const closedLabel = before.lastIndexOf("</label>");
  return openLabel > closedLabel && document.toLowerCase().indexOf("</label>", offset) !== -1;
}

function collectUrlFields(value, location = "$") {
  const urlField = /^(?:url|sourceUrl|pressReleaseUrl|productUrl|resultsUrl|apiUrl|sourceApiUrl|finalUrl|canonicalUrl|sourcePageUrl|libraryUrl|newestUrl|sourceAnchorUrl|competitorSourceUrl|watersSourceUrl)$/i;
  const results = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => results.push(...collectUrlFields(item, `${location}[${index}]`)));
    return results;
  }
  if (!value || typeof value !== "object") return results;

  for (const [key, child] of Object.entries(value)) {
    if (urlField.test(key) && typeof child === "string") results.push({ location: `${location}.${key}`, value: child });
    results.push(...collectUrlFields(child, `${location}.${key}`));
  }
  return results;
}

test("eval: every website entry point has a valid, accessible document shell", async () => {
  for (const page of entryPages) {
    const document = await read(page);
    assert.match(document, /^<!doctype html>/i, `${page} must declare HTML5`);
    assert.match(document, /<html\b[^>]*\blang=["']en["']/i, `${page} must declare its language`);
    assert.match(document, /<meta\b[^>]*\bcharset=["']UTF-8["']/i, `${page} must declare UTF-8`);
    assert.match(document, /<meta\b[^>]*\bname=["']viewport["'][^>]*\bcontent=["']width=device-width, initial-scale=1\.0["']/i, `${page} must support mobile layout`);
    assert.match(document, /<title>[^<]+<\/title>/i, `${page} must have a non-empty title`);
    assert.match(document, /<main\b/i, `${page} must expose a main landmark`);
    assert.match(document, /<h1\b[^>]*>[^<]*(?:<[^>]+>[^<]*)*<\/h1>/i, `${page} must have an H1`);
    assert.match(document, /<nav\b[^>]*\baria-label=["'][^"']+["']/i, `${page} navigation must be named`);

    const ids = idsIn(document);
    assert.equal(new Set(ids).size, ids.length, `${page} contains duplicate element IDs`);

    for (const match of document.matchAll(/<(?:input|select|textarea)\b[^>]*>/gi)) {
      if (/\btype=["']hidden["']/i.test(match[0])) continue;
      assert.ok(
        controlHasAccessibleName(document, match[0], match.index),
        `${page} contains an unnamed control: ${match[0]}`,
      );
    }

    for (const match of document.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
      const visibleText = match[2].replace(/<[^>]+>/g, "").replace(/&[a-z0-9#]+;/gi, " ").trim();
      const namedByAttribute = /\baria-label(?:ledby)?=["'][^"']+["']/i.test(match[1]);
      assert.ok(visibleText || namedByAttribute, `${page} contains an unnamed button`);
    }

    for (const match of document.matchAll(/<(?:dialog\b[^>]*|[^>]+\brole=["']dialog["'][^>]*)>/gi)) {
      const directName = attribute(match[0], "aria-label");
      const labelledBy = attribute(match[0], "aria-labelledby");
      assert.ok(directName || labelledBy, `${page} contains an unnamed dialog`);
      if (labelledBy) assert.ok(ids.includes(labelledBy), `${page} dialog references a missing label: ${labelledBy}`);
    }
  }
});

test("eval: all local links, scripts, styles, downloads, and hash destinations resolve", async () => {
  for (const page of entryPages) {
    const document = await read(page);
    const pageDirectory = path.dirname(page);

    for (const reference of localReferences(document)) {
      if (isRemoteReference(reference)) continue;
      const relativeTarget = path.normalize(path.join(pageDirectory, pathPart(reference) || page));
      assert.ok(!relativeTarget.startsWith(".."), `${page} reference escapes the project: ${reference}`);
      assert.ok(await exists(relativeTarget), `${page} references a missing local asset: ${reference}`);

      const fragment = fragmentPart(reference);
      if (!fragment) continue;
      const targetDocument = relativeTarget === page ? document : await read(relativeTarget);
      assert.ok(idsIn(targetDocument).includes(fragment), `${page} references a missing hash target: ${reference}`);
    }
  }
});

test("eval: every runtime JSON dependency is present, parseable, fresh-dated, and deployable", async () => {
  const fetchedJson = new Set();
  for (const script of runtimeScripts) {
    const source = await read(script);
    for (const match of source.matchAll(/fetch\(["'](data\/[^"']+\.json)["']/g)) fetchedJson.add(match[1]);
  }

  assert.ok(fetchedJson.size >= 20, `expected the dashboard data contract, found only ${fetchedJson.size} JSON dependencies`);

  for (const dataPath of [...fetchedJson].sort()) {
    assert.ok(await exists(dataPath), `runtime JSON is missing: ${dataPath}`);
    assert.ok(await exists(dataPath, path.join(projectRoot, "deploy-site")), `deployed runtime JSON is missing: ${dataPath}`);

    const [sourceText, deployText] = await Promise.all([
      read(dataPath),
      read(dataPath, path.join(projectRoot, "deploy-site")),
    ]);
    assert.ok(deployText === sourceText, `${dataPath} differs from the deployed copy`);

    const payload = JSON.parse(sourceText);
    if (dataPath.endsWith("link_health.json")) {
      assert.ok(Array.isArray(payload) && payload.length > 0, "link health must contain checked sources");
      payload.forEach((record, index) => {
        assert.match(record.url || "", /^https?:\/\//, `link health record ${index} needs a URL`);
        assert.ok(Number.isFinite(Date.parse(record.checkedAt)), `link health record ${index} needs a valid checkedAt`);
        assert.ok(record.status, `link health record ${index} needs a status`);
      });
      continue;
    }

    assert.ok(payload && typeof payload === "object" && !Array.isArray(payload), `${dataPath} must contain an object`);
    const freshness = payload.generatedAt || payload.asOfDate || payload.lastSuccessfulRefreshAt || payload.sourcesVerifiedAt;
    assert.ok(freshness, `${dataPath} must expose freshness metadata`);
    assert.ok(Number.isFinite(Date.parse(freshness)), `${dataPath} freshness metadata is not a valid date: ${freshness}`);
  }
});

test("eval: source evidence URLs use safe web schemes or intentional local data links", async () => {
  const app = await read("app.js");
  const dataPaths = [...new Set([...app.matchAll(/fetch\(["'](data\/[^"']+\.json)["']/g)].map((match) => match[1]))];
  let evaluatedUrls = 0;

  for (const dataPath of dataPaths) {
    const payload = JSON.parse(await read(dataPath));
    for (const field of collectUrlFields(payload)) {
      evaluatedUrls += 1;
      assert.ok(field.value.trim(), `${dataPath} has an empty evidence URL at ${field.location}`);
      if (/^data\/[^?#]+\.json(?:[?#].*)?$/.test(field.value)) {
        assert.ok(await exists(field.value.split(/[?#]/, 1)[0]), `${dataPath} points to missing local evidence at ${field.location}`);
        continue;
      }
      assert.match(field.value, /^https?:\/\//i, `${dataPath} has an unsafe or malformed evidence URL at ${field.location}`);
    }
  }

  assert.ok(evaluatedUrls >= 1000, `evidence URL coverage unexpectedly low: ${evaluatedUrls}`);
});

test("eval: the dashboard exposes its core decision workflows and role boundaries", async () => {
  const [document, app] = await Promise.all([read("index.html"), read("app.js")]);

  for (const role of ["Leadership", "Product", "Engineering", "Marketing"]) {
    assert.match(document, new RegExp(`<option\\b[^>]*value=["']${role}["']`), `role selector is missing ${role}`);
    assert.match(app, new RegExp(`\\b${role}:\\s*\\{`), `view behavior is missing ${role}`);
  }

  const navigationTargets = [...document.matchAll(/data-section-nav=["']([^"']+)["']/g)].map((match) => match[1]);
  assert.ok(navigationTargets.length >= 20, "dashboard navigation no longer covers the decision workspaces");
  for (const target of new Set(navigationTargets)) {
    assert.ok(idsIn(document).includes(target), `navigation target is not rendered: ${target}`);
  }

  assert.match(app, /initializeRoleView\(\);\s*initializeHeadToHeadSelection\(\);/);
});

test("eval: load failures and empty results have user-visible recovery states", async () => {
  const [app, conferences, publications, admin] = await Promise.all(
    runtimeScripts.map((name) => read(name)),
  );

  assert.match(app, /loadData\(\)\.catch\(\(error\) =>/);
  assert.match(app, /Data File Not Loaded/);
  assert.match(app, /error\.message/);

  assert.match(conferences, /initConferencePage\(\)\.catch\(\(error\) =>/);
  assert.match(conferences, /No conferences match these filters/);
  assert.match(conferences, /Conference preparation could not be loaded/);

  assert.match(publications, /init\(\)\.catch\(\(error\) =>/);
  assert.match(publications, /No classified publication topics match these filters/);
  assert.match(publications, /Publication intelligence could not load/);

  assert.match(admin, /startConferenceAdmin\(\)\.catch\(\(error\) =>/);
  assert.match(admin, /The conference could not be permanently saved/);
  assert.match(admin, /Conference was not removed/);
});

test("eval: every user-facing runtime asset matches the deployment mirror", async () => {
  const deployRoot = path.join(projectRoot, "deploy-site");
  const runtimeAssets = new Set([...entryPages, ...runtimeScripts, "styles.css", "product-ui.css", "conference-page.css", "conference-admin.css", "publication-page.css"]);

  for (const page of entryPages) {
    const document = await read(page);
    for (const reference of localReferences(document)) {
      if (isRemoteReference(reference) || reference.startsWith("#")) continue;
      const target = path.normalize(path.join(path.dirname(page), pathPart(reference)));
      if (target) runtimeAssets.add(target);
    }
  }

  for (const api of ["api/conferences.js", "api/scrape-conference.js"]) runtimeAssets.add(api);

  for (const asset of [...runtimeAssets].sort()) {
    assert.ok(await exists(asset), `source runtime asset is missing: ${asset}`);
    assert.ok(await exists(asset, deployRoot), `deployment runtime asset is missing: ${asset}`);
    const [source, deployed] = await Promise.all([
      readFile(path.join(projectRoot, asset)),
      readFile(path.join(deployRoot, asset)),
    ]);
    assert.ok(deployed.equals(source), `${asset} differs from the deployment mirror`);
  }
});
