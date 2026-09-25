# HomeScout — US Home Decor Buyer Finder

A lightweight API-powered prospecting website for sellers of home decor products. Search independent furniture, home decor, gift, and interior design retailers in a US city; enrich prospects with publicly sourced business email addresses; review and send a personalized email.

## Run locally

1. Install Node.js 18 or later.
2. Copy `.env.example` to `.env` and add API credentials (details below).
3. Run `node server.js` from this folder and open http://localhost:3000.

No npm packages are required.

### Using VS Code Live Server

Live Server serves static files; it does not run the API backend. Start `node server.js` in the `outputs/homescout` folder and leave that terminal running. The page can then be opened with Live Server (usually port 5500) and will connect to the backend on `http://localhost:3000`. If the backend is running on another port, use `?backend=PORT` in the page URL, for example `http://127.0.0.1:5500/?backend=3177`.

## API setup

- **Foursquare Places:** Set `FOURSQUARE_API_KEY` in `.env`. HomeScout uses Places Search to find home decor, furniture, interior design, and gift retailers near the US city entered. The key stays on the server. Search uses Foursquare Places Service Key authentication.
- **Snov.io:** Set `SNOV_API_USER_ID` and `SNOV_API_SECRET` in `.env` from Snov.io account settings → API. HomeScout requests a temporary OAuth access token and searches domain email results. Snov.io API searches may consume credits and require API access on your account.
- **Resend:** Set `RESEND_API_KEY` and `SENDER_EMAIL`. Verify the sender domain in Resend before sending. Set the sender to a verified address, for example `HomeScout <hello@yourdomain.com>`.

With Foursquare configured, buyer search is live. Snov.io handles email lookup; Resend is optional for sending. Never put API secrets in browser code or commit `.env`.

## Workflow

Search a US city and buyer type. Open a prospect to look for public domain email addresses with Snov.io. If Snov.io is unavailable or returns no email, enter a public business email from the retailer's website manually. Personalize the draft and send one reviewed email at a time; without Resend, HomeScout opens the draft in your default email app. The app does not bulk-send or guess email addresses. Use truthful sender details, comply with CAN-SPAM and applicable law, include a valid postal address and opt-out instructions in commercial messages, and honor opt-outs.

## API endpoints

- `GET /api/config` — reports which integrations are configured.
- `POST /api/search` — Foursquare Places Search for retailer prospects.
- `POST /api/contacts` — Snov.io domain email search.
- `POST /api/send` — sends a single reviewed email through Resend.



