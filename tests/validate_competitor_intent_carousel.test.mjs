import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("competitor activity uses one responsive carousel implementation", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("product-ui.css", root), "utf8"),
  ]);

  assert.match(app, /function intentActivityCardsPerView\(width, total\)/);
  assert.match(app, /width >= 1080 \? 4 : width >= 760 \? 3 : width >= 500 \? 2 : 1/);
  assert.match(app, /data-intent-activity-carousel/);
  assert.match(app, /data-intent-carousel-action="previous"/);
  assert.match(app, /data-intent-carousel-action="next"/);
  assert.match(app, /requestAnimationFrame\(initializeIntentActivityCarousel\)/);
  assert.match(styles, /\.intent-activity-viewport\s*{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.intent-activity-theme-grid\s*{[^}]*grid-auto-flow:\s*column/s);
  assert.match(styles, /grid-auto-columns:\s*var\(--intent-card-width, 100%\)/);
});

test("deploy mirror includes the same responsive carousel assets", async () => {
  const [app, mirrorApp, styles, mirrorStyles] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("deploy-site/app.js", root), "utf8"),
    readFile(new URL("product-ui.css", root), "utf8"),
    readFile(new URL("deploy-site/product-ui.css", root), "utf8"),
  ]);

  assert.equal(mirrorApp, app);
  assert.equal(mirrorStyles, styles);
});
