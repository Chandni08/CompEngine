import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("SEC filing insights use a company master-detail navigator", async () => {
  const app = await read("../app.js");

  assert.match(app, /activeFilingCompetitor:\s*""/);
  assert.match(app, /function setupFilingInsightNavigation\(\)/);
  assert.match(app, /data-filing-select=/);
  assert.match(app, /role="tablist" aria-label="Companies with earnings and filing evidence"/);
  assert.match(app, /id="filing-selected-detail"[\s\S]*role="tabpanel"/);
  assert.match(app, /const activeGroup = sortedGroups\.find/);
});

test("filing company navigator retains the responsive competitor rail layout", async () => {
  const styles = await read("../product-ui.css");

  assert.match(styles, /\.intent-master-detail\s*\{[^}]*grid-template-columns:\s*minmax\(220px, 260px\) minmax\(0, 1fr\)/s);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.intent-master-detail\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(styles, /\.filing-selected-detail\s*\{[^}]*min-width:\s*0/s);
});

test("filing navigation ships identically in deployment assets", async () => {
  const [app, deployApp, styles, deployStyles] = await Promise.all([
    read("../app.js"),
    read("../deploy-site/app.js"),
    read("../product-ui.css"),
    read("../deploy-site/product-ui.css"),
  ]);

  assert.equal(deployApp, app);
  assert.equal(deployStyles, styles);
});
