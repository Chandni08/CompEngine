# Competitive Intelligence Engine Architecture

This prototype is a static, browser-based Product Manager dashboard backed by JSON data files and one public-data collection script.

## System Overview

```mermaid
flowchart TB
  PM["Product Manager"] --> Browser["Browser / Local Preview<br/>http://127.0.0.1:8765"]

  Browser --> HTML["index.html<br/>Dashboard structure"]
  Browser --> CSS["styles.css<br/>Visual system and layouts"]
  Browser --> JS["app.js<br/>Filtering, rendering, source-health views"]

  JS --> Intelligence["data/intelligence.json<br/>Publication trends, SEC-derived signals,<br/>recommendations, source-health snapshot"]
  JS --> Launches["data/product_launches.json<br/>5-year competitor launch timeline"]
  JS --> Sources["data/source_catalog.json<br/>Step 0 source inventory and link health"]

  Collector["scripts/collect_real_data.py<br/>Public data refresh"] --> Intelligence

  PubMed["PubMed E-utilities"] --> Collector
  SEC["SEC submissions API"] --> Collector
  OfficialPages["Official competitor pages<br/>availability checks"] --> Collector

  ManualCuration["Manual PM/source curation"] --> Launches
  ManualCuration --> Sources
```

## Data Flow

```mermaid
flowchart LR
  subgraph ExternalSources["External Sources"]
    PubMed["PubMed"]
    SEC["SEC EDGAR submissions"]
    CompanyPages["Competitor product/news pages"]
    ManualSources["Conference, trade, customer voice<br/>source candidates"]
  end

  subgraph DataLayer["Local Data Layer"]
    Intelligence["intelligence.json"]
    ProductLaunches["product_launches.json"]
    SourceCatalog["source_catalog.json"]
  end

  PubMed --> Collector["collect_real_data.py"]
  SEC --> Collector
  CompanyPages --> Collector
  Collector --> Intelligence

  CompanyPages --> ProductLaunches
  ManualSources --> SourceCatalog
  CompanyPages --> SourceCatalog

  DataLayer --> App["app.js"]
  App --> Views["Rendered PM dashboard<br/>Step 0 source inventory<br/>5-year launch timeline<br/>roadmap questions<br/>evidence feed"]
```

## Frontend Render Flow

```mermaid
flowchart TD
  Load["loadData()"] --> FetchAll["Fetch three JSON files"]
  FetchAll --> State["Store in state:<br/>data, productData, sourceCatalog"]
  State --> Competitors["populateCompetitors()"]
  State --> Render["render()"]

  Render --> CurrentSignals["currentSignals()<br/>filter intelligence signals"]
  Render --> CurrentLaunches["currentLaunches()<br/>filter launch timeline"]
  Render --> SourceInventory["renderSourceInventory()<br/>Step 0 source map"]
  Render --> Metrics["renderMetrics()<br/>launch-driven KPI cards"]
  Render --> Timeline["renderLaunchTimeline()<br/>5-year product intelligence"]
  Render --> Recommendations["renderRecommendations()<br/>roadmap guidance"]
  Render --> Trends["renderTrends()<br/>scientific/application context"]
  Render --> CompetitorActivity["renderCompetitors()<br/>launch counts by competitor"]
  Render --> Whitespace["renderRoadmapSignals()<br/>PM questions"]
  Render --> Evidence["renderSignals()<br/>traceable evidence feed"]

  Filters["Geography, segment, technology,<br/>competitor, horizon filters"] --> Render
  Reset["Reset button"] --> Render
```

## File Responsibilities

```mermaid
flowchart TB
  subgraph UI["Static UI"]
    Index["index.html<br/>Page structure and dashboard panels"]
    Styles["styles.css<br/>Reference-inspired dashboard styling"]
    App["app.js<br/>State, filters, data joins, DOM rendering"]
  end

  subgraph Data["Data Files"]
    SourceCatalog["source_catalog.json<br/>Source inventory, health status,<br/>bad/blocked links, next actions"]
    ProductLaunches["product_launches.json<br/>Competitor product launch timeline<br/>and PM implications"]
    Intelligence["intelligence.json<br/>Signals, publication trends,<br/>recommendations, source checks"]
  end

  subgraph Scripts["Scripts"]
    Collector["collect_real_data.py<br/>Refreshes public PubMed/SEC/source-health data"]
  end

  subgraph QA["Project Notes"]
    DesignQA["design-qa.md<br/>Visual QA and known follow-ups"]
  end

  Index --> App
  Index --> Styles
  App --> SourceCatalog
  App --> ProductLaunches
  App --> Intelligence
  Collector --> Intelligence
```

## Current Source Health Model

```mermaid
flowchart LR
  Source["Source catalog entry"] --> Health{"health"}
  Health -->|"good"| Ready["Ready source<br/>can be ingested/displayed"]
  Health -->|"blocked"| Blocked["Blocked source<br/>403/access denied/rate threshold"]
  Health -->|"bad"| Broken["Broken source<br/>404 or invalid link"]
  Health -->|"manual"| Manual["Manual source<br/>needs source map or policy review"]

  Ready --> Matrix["Green cell in source-health matrix"]
  Blocked --> MatrixYellow["Yellow cell + Source Alert"]
  Broken --> MatrixRed["Red cell + Source Alert"]
  Manual --> MatrixOrange["Orange cell"]
```

## Current Runtime

The app is served locally with:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Current local URL:

```text
http://127.0.0.1:8765
```

## Architectural Notes

- This is currently a frontend-only prototype: no database, no backend API, no authentication layer.
- `app.js` does the runtime joins between source inventory, product launches, and intelligence signals.
- `product_launches.json` and `source_catalog.json` are curated inputs today.
- `collect_real_data.py` is the only automated collection path today and currently refreshes `intelligence.json`.
- The next architecture step should split ingestion into source-specific connectors and store normalized signals in a database or search index.
