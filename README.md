# Waters Next Gen Competitive Intelligence Engine

A static competitive-intelligence dashboard for Waters Next Gen LC product strategy. The application reads its current evidence and analysis from the JSON files in `data/` and provides Leadership, Product Management, and Engineering views.

## Run locally

### Prerequisites

- Python 3
- A modern web browser

Node.js 20 or newer is optional and is only required to run the automated checks or build the Sites deployment bundle.

### Start the dashboard

From the repository root, start a local web server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

Stop the server with `Ctrl+C`.

Do not open `index.html` directly with a `file://` URL. The dashboard loads JSON with browser `fetch` requests, which require an HTTP server.

If port 8000 is already in use, choose another port, for example:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080/`.

## Validate the code

With Node.js and Python installed, run the JavaScript and Python checks from the repository root:

```bash
node --check app.js
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

Build the static Sites deployment bundle with:

```bash
node scripts/build_sites_static.mjs
```

The generated bundle is written to `dist/`.

## Conference catalog persistence

Conference Admin reads and writes its shared catalog through `/api/conferences`. On a Waters-hosted Node server, set `CONFERENCE_CATALOG_PATH` to a writable, backed-up location outside the application release directory:

```bash
CONFERENCE_CATALOG_PATH=/var/lib/waters-competition-engine/conferences.json
CONFERENCE_ADMIN_USER_ID=your-admin-id
CONFERENCE_ADMIN_PASSWORD_HASH=sha256-hex-of-the-admin-password
CONFERENCE_ADMIN_SESSION_SECRET=a-long-random-session-signing-secret
```

If the variable is omitted, the API uses `data/conference_catalog.runtime.json`. The service account running the application must have permission to create and replace the configured file. This JSON storage mode is intended for one application-server instance; use shared database storage if the application is later scaled to multiple instances.

The three admin authentication variables are required for sign-in and catalog writes. There are no built-in production credentials. Generate the password hash with a local SHA-256 utility and store both the hash and an independent random session secret in the hosting provider's encrypted environment settings.

## Global search

The persistent search beside **Dashboard sections** uses a lightweight client-side index built only after the dashboard's complete JSON data set has loaded; it does not depend on which cards happen to be visible or expanded. Results are role-gated, grouped by owning section, and constrained by the active Geography, Market, Technology, Competitor, and Horizon filters. The scope line above the results shows those constraints, and **Search everywhere** temporarily ignores the non-role filters without exposing content from another role. Product Marketing sections are searchable only while the Product Marketing role is selected.

Use `Cmd+K` on macOS or `Ctrl+K` on Windows/Linux to open search. Arrow keys move through results, `Enter` opens the selected result, and `Escape` closes search and restores focus.

## Main project files

- `index.html` — dashboard entry point
- `app.js` — application state, filtering, and rendering
- `styles.css` and `product-ui.css` — dashboard styling
- `data/` — evidence and intelligence records consumed by the dashboard
- `tests/` — JavaScript and Python regression checks
- `deploy-site/` — mirrored files used by the deployment build
