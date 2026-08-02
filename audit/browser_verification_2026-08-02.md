# Browser Verification — 2026-08-02

**Result: 20 of 20 canonical checks passed.** The checks ran in the Codex in-app browser against the local deployment at `http://127.0.0.1:8765/`.

The dashboard loaded 25 visible panels with 278 public records, 30 exact customer-source links, seven upcoming conferences, and no data-load error. Role switching, all global and time-horizon filters, customer tabs, PMM targeting controls, collapsible panels, evidence dialogs, and pagination behaved correctly. The conference and publication pages loaded, filtered, paginated, and participated correctly in browser back/forward history.

Responsive checks found no horizontal overflow on the dashboard at 390, 768, 1024, or 1440 pixels, or on the conference and publication pages at 390, 768, or 1440 pixels. The loaded dashboard contained 282 syntactically valid external evidence links spanning official product, publication, conference, and customer-source types. The browser console reported no warnings or errors.

Browser QA found and verified fixes for a Marketing-role visibility defect: the role switch hid the customer-positioning workspace, and the Marketing render path did not recalculate the Marketing-only Positioning tab. The app script cache key was advanced to ensure clients load the corrected code.

This is a functional UI verdict, not a global currency claim. The displayed truth state still reports **61 required sources needing attention**, so the engine is not globally current.

Machine-readable details: `audit/browser_verification_2026-08-02.json`.
