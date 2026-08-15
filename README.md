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

## Main project files

- `index.html` — dashboard entry point
- `app.js` — application state, filtering, and rendering
- `styles.css` and `product-ui.css` — dashboard styling
- `data/` — evidence and intelligence records consumed by the dashboard
- `tests/` — JavaScript and Python regression checks
- `deploy-site/` — mirrored files used by the deployment build
