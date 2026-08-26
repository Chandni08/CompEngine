# Website Evaluation Plan

This plan evaluates the Waters Next Gen Competitive Intelligence Engine as a decision-support product, not only as a collection of pages. The executable checks live in `tests/website_evals.test.mjs` and run with the repository's existing Node test command.

## Release threshold

- Required score: **85/100** or higher.
- Every critical gate must pass, regardless of total score.
- A regression that exposes Product Marketing-only content to another role, removes evidence provenance, breaks a primary route, or makes a primary workflow keyboard-inaccessible is a release blocker.

## Scorecard

| Area | Weight | Evaluation | Critical gate |
| --- | ---: | --- | :---: |
| Entry points and navigation | 15 | Dashboard, Conference Intelligence, Publication Intelligence, and Conference Admin load; local links and hash destinations resolve; every primary workspace is reachable. | Yes |
| Decision workflows | 20 | Each role reaches the intended decision surfaces; filters change the visible evidence; global search finds and opens an exact result; empty states explain how to recover. | Yes |
| Evidence trust | 20 | Runtime datasets parse, expose freshness metadata, retain safe source URLs, and show provenance and governance state for field-usable claims. | Yes |
| Accessibility | 15 | Landmarks, headings, control names, dialog names, focus behavior, keyboard search, and keyboard activation remain usable without a mouse. | Yes |
| Resilience | 10 | Missing data, failed API calls, zero results, clipboard failures, and save/delete failures produce clear, non-destructive feedback. | No |
| Responsive usability | 10 | At 390 px, 768 px, and 1440 px widths, navigation, filters, tables, cards, dialogs, and action rows remain readable and operable without page-level horizontal overflow. | No |
| Deployment integrity | 10 | Source and deployment mirrors match, all runtime assets ship, JSON dependencies are present, and the production build completes. | Yes |

## Automated evaluation

Run:

```bash
node --test tests/website_evals.test.mjs
node scripts/build_sites_static.mjs
```

The executable suite checks document structure, accessible control names, unique IDs, local route and asset reachability, hash destinations, runtime JSON contracts, freshness metadata, evidence URL safety, role/search coverage, recovery states, and source-to-deployment parity.

## Scenario evaluations

Use a fresh browser profile and the published test dataset for each scenario. Record the build identifier, role, filters, viewport, observed result, expected result, and any console or network error.

### 1. Product manager finds a roadmap decision

1. Open the dashboard in Product Management view.
2. Set Market to Biopharma and Technology to LC-MS.
3. Open Decisions Needed, then open one evidence drill-down.
4. Confirm the decision, owner, decision gate, tradeoff, and direct evidence links remain consistent with the active filters.

Pass when the decision is actionable, every quantitative or competitive assertion has traceable evidence, and changing either filter changes or explicitly preserves the result for a stated reason.

### 2. Leadership gets a concise market brief

1. Switch to Leadership view.
2. Confirm the first viewport communicates what changed, why it matters, and which decision is needed.
3. Copy the brief and open one supporting source.

Pass when the summary can be understood without opening lower panels, the copied brief matches the visible content, and the supporting source resolves to the claimed evidence.

### 3. Product Marketing content stays governed

1. Switch to Product Marketing.
2. Choose a Waters product, market, application, buying situation, buyer role, and competitor.
3. Inspect Product Battlecards, Claim Control, Proof Priorities, Seller Assets, and the Evidence Appendix.
4. Attempt to export an asset containing an unapproved or non-field-citable claim.

Pass when targeting flows consistently through every surface, unsupported claims are visibly blocked, internal notes do not appear in field assets, and export remains unavailable until all included claims are approved and field-citable.

### 4. Global search respects scope and keyboard use

1. Press Cmd+K or Ctrl+K, type a known competitor or workflow, and move through results with Arrow keys.
2. Press Enter and confirm exact arrival and visible highlighting.
3. Repeat after changing role and filters, then use Search everywhere.
4. Press Escape.

Pass when results are grouped and relevant, role-restricted content never leaks, the scope line matches the active filters, Search everywhere ignores only non-role filters, exact arrival works, and focus returns to the invoking control on dismissal.

### 5. Conference preparation supports a go/no-go choice

1. Open Conference Intelligence and filter by market, technology, and competitor.
2. Select events from both the timeline and event rail.
3. Copy the selected brief and open an official source.
4. Apply a filter combination with no results, then reset it.

Pass when both selectors stay synchronized, the brief matches the selected event, the official source is traceable, the no-results state explains recovery, and reset restores events.

### 6. Publication intelligence preserves exact records

1. Open Publication Intelligence and filter by source class, market, technical topic, and comparison period.
2. Select a source and open a topic's dated evidence.
3. Compare the latest period with the prior period.

Pass when counts reconcile with the displayed records, period labels are unambiguous, DOI/source links open the exact cited record, and sparse or zero-result states do not imply unsupported trend direction.

### 7. Conference Admin fails safely

Run this scenario only against a disposable catalog.

1. Verify invalid credentials do not unlock the workspace.
2. Add, edit, search, filter, export, and delete a test conference.
3. Simulate a failed save and failed delete.
4. Sign out and reload.

Pass when unauthorized content remains hidden, valid changes persist after reload, destructive actions are explicit, failures retain the previous catalog, secrets are not stored beyond the intended session, and sign-out restores the locked state.

### 8. Responsive and assistive-technology sweep

Repeat the dashboard, conference, publication, and admin happy paths at 390 px, 768 px, and 1440 px. At 200% zoom, use only Tab, Shift+Tab, Arrow keys, Enter, Space, and Escape; also check a screen-reader landmark and control-name summary.

Pass when focus is always visible, focus order follows reading order, dialogs trap and restore focus, controls retain accessible names, wide regions scroll within their containers, and no primary action or evidence link is clipped.

## Reporting

For each failure, include severity, route, role, active filters, viewport, exact reproduction steps, expected behavior, observed behavior, and a screenshot or console/network excerpt when relevant. Re-run the automated suite and the affected scenario after remediation.
