import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const productUi = await readFile(new URL("../product-ui.css", import.meta.url), "utf8");
const queueStart = app.indexOf("function renderDecisionQueue(signals)");
const queueEnd = app.indexOf("\nfunction ", queueStart + 1);
const decisionQueueRenderer = app.slice(queueStart, queueEnd);

test("follow-up decision cards omit owners and due dates", () => {
  assert.ok(queueStart >= 0 && queueEnd > queueStart);
  assert.doesNotMatch(decisionQueueRenderer, /<dt>Accountable owners<\/dt>/);
  assert.doesNotMatch(decisionQueueRenderer, /<dt>Decision due<\/dt>/);
  assert.match(decisionQueueRenderer, /<dt>Next PM Considerations<\/dt>/);
  assert.doesNotMatch(decisionQueueRenderer, /<dt>Required output<\/dt>/);
});

test("required output uses the complete action text", () => {
  const factsStart = app.indexOf("function leadershipDecisionFacts(");
  const factsEnd = app.indexOf("\nfunction ", factsStart + 1);
  const factsRenderer = app.slice(factsStart, factsEnd);

  assert.doesNotMatch(factsRenderer, /compactText\(recommendation\.action/);
  assert.match(factsRenderer, /recommendation\.decisionDeliverable \|\| recommendation\.action \|\| nextAction/);
});

test("Next PM Considerations uses a bold label and normal-weight text", () => {
  assert.match(productUi, /\.decision-card \.decision-queue-facts dt \{[\s\S]*?font-weight: 850;[\s\S]*?text-transform: none;/);
  assert.match(productUi, /\.decision-card \.decision-queue-facts dd \{[\s\S]*?font-weight: 400;/);
});

test("top three decisions share the Decisions needed card format", () => {
  assert.match(decisionQueueRenderer, /allDecisions\.slice\(0, 3\)/);
  assert.match(decisionQueueRenderer, /Decision \$\{index \+ 1\}/);
  assert.doesNotMatch(decisionQueueRenderer, /follow-up decisions/);
});

test("leadership brief keeps context but does not duplicate Decision 1", () => {
  const packetStart = app.indexOf("function renderDecisionPacket(signals)");
  const packetEnd = app.indexOf("\nfunction ", packetStart + 1);
  const packetRenderer = app.slice(packetStart, packetEnd);

  assert.match(packetRenderer, /leadershipHighlightsMarkup/);
  assert.doesNotMatch(packetRenderer, /leadershipDecisionCardMarkup/);
});
