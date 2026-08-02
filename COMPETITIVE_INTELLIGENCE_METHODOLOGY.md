# Competitive-intelligence methodology

## Claim structure

Competitor-intent profiles separate four elements:

1. **Observed facts** — dated actions directly supported by a primary URL.
2. **Inference** — the most plausible strategic interpretation of those actions.
3. **Alternative explanation** — a credible, less-strategic interpretation.
4. **Falsifier** — the evidence that would disprove or materially weaken the inference.

An inference is never presented as a fact. Unsupported adjacent claims, including SCIEX HRMS depth, remain explicitly unverified.

## Source-family independence

Confidence depends on independent source families, not record count.

- Multiple press releases or product pages from one issuer count as one issuer-controlled family.
- Multiple extracted insights from the same SEC filing count as one filing family.
- An issuer's press releases and its own filing are grouped as issuer-controlled evidence and do not provide independent corroboration of each other.
- Syndicated copies, duplicate URLs, and partner restatements of the same announcement are deduplicated.
- A source is treated as independent only when it is externally controlled and does not restate the same announcement.

## Inference-confidence rubric

- **High** — at least two genuinely independent source families, including a dated primary source and an externally controlled corroborating family, with no material contradiction.
- **Medium** — multiple useful families, but external independence, primary evidence, or contradiction resolution is incomplete.
- **Directional** — the evidence supports a hypothesis but lacks sufficient independent corroboration.
- **Low** — sparse, indirect, stale, or materially conflicting evidence.

The UI shows the exact evidence limitation and the source-family grouping used to make the assessment.

## Entity rules

- Agilent Technologies, Agilent Technologies Inc., and Agilent Technologies, Inc. are one issuer.
- Revvity and the current PerkinElmer entity are distinct companies. Revvity-era records are not attributed to PerkinElmer.
- SCIEX nominal-mass and software evidence is not generalized into an HRMS-platform claim without a separate dated primary source.

## Business magnitude

Public evidence may establish relevance, but it does not establish Waters revenue, share, installed-base, or engineering exposure. Every material implication therefore shows either a supported estimate with:

- affected segment;
- geography;
- installed-base or replacement cohort;
- revenue/share-at-risk band;
- time horizon;
- basis;
- magnitude confidence;
- validation owner; and
- next validation step;

or the exact status **UNQUANTIFIED — validation required**.

## Evidence priority

Evidence priority is shown as High, Medium, or Low. A precise 0–100 score is not exposed when material inputs such as business magnitude, customer value, or engineering effort are missing. Internal ranking may still be used only to order records; it is not represented as a quantified business case.

## Source-quality score

Source quality uses a four-dimension, 10-point rubric. It does not award points merely for adding URLs.

- **Authority (0–3):** primary, regulatory, government, or peer-reviewed sources receive the strongest rating; analyst and trade sources receive less; aggregators and community sources receive the least.
- **Directness (0–3):** sources are rated by whether they directly substantiate the decision claim, provide supporting context, or are merely adjacent.
- **Independent corroboration (0–2):** one source family earns no corroboration point; two independent families earn one; the second point requires an externally controlled source rather than only issuer-authored claims.
- **Evidence status (0–2):** fully verified claim mappings earn two points; a set containing only verified or partial mappings earns one; unsupported, contradicted, unreachable, or unclassified evidence earns none.

Duplicate URLs are removed before scoring. Multiple pages controlled by the same issuer share one independence group, so repetition cannot inflate the score. Recency remains a separate evidence-priority input and is not counted again as source quality.

## Snapshot consistency

The live Leadership Brief, PowerPoint export, and Customer Voice export carry the same `snapshotId` and as-of timestamp from `data/intelligence.json`. Shared synthesis text is generated once and reused by the live panel and the PowerPoint export.
