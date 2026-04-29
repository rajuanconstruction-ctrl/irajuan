# BOQ Review Page (י.ה.ב רג'ואן)

Static website for contractors to price unmatched BOQ items.

## How it works

1. The n8n workflow `create_quta_offer` detects > 10 unmatched items
2. It generates a UUID token and stores the items in the `pending_reviews` Postgres table
3. Contractor receives a WhatsApp message with `https://USERNAME.github.io/REPO/?token=UUID`
4. This page reads the token from the URL, fetches the items via the n8n webhook API, and lets the contractor enter prices
5. On approval, the prices flow back through n8n into the project's item_map

## Stack

- Vanilla HTML + CSS + JS (no build step)
- Hosted on GitHub Pages
- Talks to n8n webhook endpoints

## Files

- `index.html` — the page
- `style.css` — RTL Hebrew styling
- `app.js` — token reading, API calls, UI logic

## Local development

Just open `index.html` in a browser. To test with a token:
`file:///path/to/index.html?token=test-uuid-here`

## API endpoints

- `GET  /api/review/:token` — fetch items
- `POST /api/review/:token/save` — autosave
- `POST /api/review/:token/approve` — final submit

Base URL configured in n8n env var `REVIEW_BASE_URL`.
