import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
const deployment = await readFile(new URL("../deploy-site/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const deploymentApp = await readFile(new URL("../deploy-site/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const deploymentStyles = await readFile(new URL("../deploy-site/styles.css", import.meta.url), "utf8");
const matchModel = await readFile(new URL("../product-match-model.js", import.meta.url), "utf8");
const deploymentMatchModel = await readFile(new URL("../deploy-site/product-match-model.js", import.meta.url), "utf8");
const productComparisons = JSON.parse(await readFile(new URL("../data/product_comparisons.json", import.meta.url), "utf8"));
const historicalProducts = JSON.parse(await readFile(new URL("../data/historical_product_catalog.json", import.meta.url), "utf8"));

test("the consolidated capability section remains available but hidden", () => {
  for (const markup of [source, deployment]) {
    assert.doesNotMatch(markup, /id="roadmapImpactMap"/);
    assert.match(markup, /Product-scoped directional gap map with authority-tagged public evidence/);
    assert.equal((markup.match(/id="competitive-capability-evidence"/g) || []).length, 1);
    assert.match(markup, /id="competitive-capability-evidence"[^>]*\shidden(?:\s|>)/);
  }
});

test("the gap map is product-scoped through the shared closest-product model", () => {
  for (const implementation of [app, deploymentApp]) {
    assert.match(implementation, /data-gap-scope-control="mode"/);
    assert.match(implementation, /data-gap-scope-control="waters"/);
    assert.match(implementation, /data-gap-scope-control="competitor-product"/);
    assert.match(implementation, /data-gap-competitor=/);
    assert.match(implementation, /all competitors' closest matched products/);
    assert.match(implementation, /model\.columns\.map/);
    assert.match(implementation, /--gap-columns:\$\{model\.columns\.length\}/);
    assert.match(implementation, /const gapMapCompetitorOrder = \["Agilent", "Thermo Fisher", "Shimadzu", "SCIEX", "PerkinElmer"\]/);
    assert.match(implementation, /headToHeadProductMatchModel\.candidates/);
    assert.match(implementation, /headToHeadProductMatchModel\.portfolioPairs/);
    assert.match(implementation, /Worst-case exposure:/);
    assert.match(implementation, /Aggregation — never a single-product comparison/);
  }
  for (const implementation of [matchModel, deploymentMatchModel]) {
    assert.match(implementation, /function closest\(model, watersProductId, competitor\)/);
    assert.match(implementation, /function portfolioPairs\(model, competitor\)/);
  }
});

test("capabilities come from the canonical inventory and carry comparison scope", () => {
  for (const implementation of [app, deploymentApp]) {
    assert.match(implementation, /const watersCapabilityDefinitions = \[/);
    for (const capability of ["Method transfer", "LC-MS sensitivity", "Informatics / software", "Automation ecosystem", "Regulatory / compliance ecosystem", "Service network / serviceability"])
      assert.match(implementation, new RegExp(`label: "${capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    assert.match(implementation, /scope: "instrument"/);
    assert.match(implementation, /scope: "platform"/);
    assert.match(implementation, /Instrument-level/);
    assert.match(implementation, /Platform\/company-level/);
    assert.match(implementation, /hiddenCapabilities/);
  }
});

test("source authority, direction, and confidence are separate", () => {
  for (const implementation of [app, deploymentApp]) {
    assert.match(implementation, /const gapMapAuthorityWeights = \{ INDEPENDENT: 3, USER_GENERATED: 2, VENDOR_PUBLISHED: 1 \}/);
    assert.match(implementation, /sourceAuthorityTier/);
    assert.match(implementation, /sourceType/);
    assert.match(implementation, /record\.sourceAuthorityTier === "VENDOR_PUBLISHED" && record\.comparisonKind !== "SPEC_TO_SPEC"/);
    assert.match(implementation, /const independentSourceCount = new Set\(independentRecords\.map\(gapMapIndependentKey\)\)\.size/);
    assert.match(implementation, /const tier = independentSourceCount >= 2 \? "Proven" : sourceCount \? "Directional" : "Insufficient"/);
    assert.match(implementation, /Vendor-stated · unverified/);
    assert.match(implementation, /I = independent-source count/);
    assert.match(implementation, /zero dated sources always becomes No evidence/);
    assert.match(implementation, /can never make Waters Behind/);
  }
  for (const stylesheet of [styles, deploymentStyles]) {
    assert.match(stylesheet, /\.gap-map-ahead\s*\{[^}]*background:\s*#d7efdc/s);
    assert.match(stylesheet, /\.gap-map-parity\s*\{[^}]*background:\s*#e6ebee/s);
    assert.match(stylesheet, /\.gap-map-behind\s*\{[^}]*background:\s*#f5d7d5/s);
    assert.match(stylesheet, /\.gap-map-no-evidence\s*\{[^}]*repeating-linear-gradient/s);
    assert.match(stylesheet, /\.gap-authority-independent/);
  }
});

test("product artifacts are first-class but claims do not fabricate direction", () => {
  for (const implementation of [app, deploymentApp]) {
    for (const sourceType of ["SPEC_SHEET", "RELEASE_NOTES", "PRESS_RELEASE", "APPLICATION_NOTE", "PEER_REVIEWED_PAPER", "REGULATORY_DOCUMENT", "PRODUCT_REVIEW", "REDDIT_DISCUSSION"])
      assert.match(implementation, new RegExp(sourceType));
    assert.match(implementation, /comparisonKind: "SPEC_TO_SPEC"/);
    assert.match(implementation, /Vendor-stated specs/);
    assert.match(implementation, /positioningSignal: true/);
    assert.match(implementation, /This is a positioning pressure signal only; it cannot score Waters Behind without corroboration/);
    assert.match(implementation, /gapMapIndependentEvidence/);
    assert.match(implementation, /gapMapCustomerEvidence/);
    assert.match(implementation, /product\.artifacts/);
    assert.match(implementation, /function gapMapArtifactBadgeMarkup/);
    assert.match(implementation, /\$\{escapeHtml\(artifact\.type\)\} not linked/);
  }
  const acquity = productComparisons.watersSystems.find((product) => product.id === "acquity-premier-system");
  const alliance = productComparisons.watersSystems.find((product) => product.id === "alliance-is-hplc");
  const agilent1290 = historicalProducts.products.find((product) => product.id === "agilent-1290-infinity-iii-2024");
  assert.ok(acquity.artifacts.some((artifact) => artifact.sourceType === "SPEC_SHEET"));
  assert.ok(alliance.artifacts.some((artifact) => artifact.sourceType === "RELEASE_NOTES"));
  assert.deepEqual(new Set(agilent1290.artifacts.map((artifact) => artifact.sourceType)), new Set(["SPEC_SHEET", "RELEASE_NOTES", "PRESS_RELEASE"]));
});

test("every rendered cell opens dated authority-tagged evidence", () => {
  for (const implementation of [app, deploymentApp]) {
    assert.match(implementation, /data-gap-evidence-key="\$\{escapeHtml\(cell\.key\)\}"/);
    assert.match(implementation, /state\.capabilityGapEvidence\.find/);
    assert.match(implementation, /record\.sourceAuthorityTier/);
    assert.match(implementation, /record\.sourceType/);
    assert.match(implementation, /Open dated primary source/);
    assert.match(implementation, /No direction is inferred/);
  }
});

test("the reading guide, legend, and worst-case rule are explicit", () => {
  for (const implementation of [app, deploymentApp]) {
    assert.match(implementation, /Red = Waters is behind this competitor here/);
    assert.match(implementation, /Ahead<\/b> Waters stronger/);
    assert.match(implementation, /Parity<\/b> no clear difference/);
    assert.match(implementation, /Behind<\/b> competitor stronger/);
    assert.match(implementation, /No evidence<\/b> insufficient to judge/);
    assert.match(implementation, /Evidence authority and direction scoring rule/);
    assert.match(implementation, /never an average/);
  }
});

test("gap-map static assets ship consistently", () => {
  assert.equal(deployment, source);
  assert.equal(deploymentApp, app);
  assert.equal(deploymentStyles, styles);
  assert.equal(deploymentMatchModel, matchModel);
});
