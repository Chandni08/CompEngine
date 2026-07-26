import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateConferencePreparation } from "../scripts/validate_conference_preparation.mjs";

test("the shipped conference briefs separate confirmed content from expectations", async () => {
  const catalog = JSON.parse(await readFile(new URL("../data/conference_preparation.json", import.meta.url), "utf8"));
  assert.deepEqual(validateConferencePreparation(catalog), []);
});

test("confirmed competitor content cannot cite a portfolio page as event proof", () => {
  const catalog = {
    asOfDate: "2026-07-17",
    evidencePolicy: "Confirmed only from event programs.",
    events: [{
      id: "example",
      eventName: "Example",
      dateRange: "Aug 1-2, 2026",
      startDate: "2026-08-01",
      endDate: "2026-08-02",
      tier: "Tier 2",
      website: "https://www.acs.org/events/example",
      annualTheme: "Example",
      scientificFocus: ["One", "Two"],
      competitorContent: [{
        competitor: "Agilent",
        evidenceStatus: "Confirmed in 2026 program",
        content: "Example",
        evidenceBasis: "Example",
        sourceLabel: "Example",
        sourceUrl: "https://www.agilent.com/example",
      }],
      watersScientificContent: [
        { title: "One", deliverable: "One", proofNeeded: "One" },
        { title: "Two", deliverable: "Two", proofNeeded: "Two" },
      ],
      boothRecommendations: [
        { product: "One", role: "One", message: "One", productUrl: "https://www.waters.com/one" },
        { product: "Two", role: "Two", message: "Two", productUrl: "https://www.waters.com/two" },
      ],
      monitoringLinks: [{ label: "Event", url: "https://www.acs.org/events/example" }],
    }],
  };
  assert.match(validateConferencePreparation(catalog).join("\n"), /confirmed content must link to an official 2026 event source/);
});
