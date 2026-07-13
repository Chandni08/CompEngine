final result: passed

# Design QA

Reference target: Product Manager dashboard mock with top filters, large card panels, timeline/analysis visuals, and alert-style whitespace/source issues.

Implemented state:
- Product Manager title uses the requested roadmap and whitespace framing.
- Filters are grouped at the top of the workspace.
- Meaningful PM visuals were added above the detailed source inventory.
- Competitive timeline renders product-launch bars from the current launch dataset.
- Feature-gap heatmap now represents competitive capability hypotheses, not broken links.
- External signal bubbles render from PubMed trend counts.
- Decision metrics summarize launch confidence, gap count, and leading trend.
- Step 0 source inventory is kept as a plain inventory table below the analysis visuals.
- Agilent launch links were updated to https://www.agilent.com/about/newsroom.html.

Known P3 follow-ups:
- The feature-gap matrix is a PM hypothesis view and should be validated against product specs before being used for decisions.
- The app still keeps the dark source-summary band from the previous prototype; it is useful for status but can be slimmed down in the next visual pass.
