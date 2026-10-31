# HomeScout — Alaska Home Decor Buyer Finder

HomeScout helps home decor sellers discover potential retailers using Foursquare Places and OpenStreetMap, shows public contact details listed in OpenStreetMap, and sends individual messages through Gmail SMTP.

## Run locally

1. Install Node.js 18 or later.
2. Copy `.env.example` to `.env` and add API keys. Keep `.env` private.
3. Run `npm start` and open `http://localhost:3000`.

## Render setup

Configure these server-side environment variables in the Render service:

- `FOURSQUARE_API_KEY` — Foursquare Places discovery. OpenStreetMap is queried as a second business-listing source.
- `GMAIL_USER` — the Gmail mailbox used as the sender.
- `GMAIL_APP_PASSWORD` — a Google App Password for Nodemailer. Create one after enabling Google 2-Step Verification. Do not use your normal Gmail password.

Set secrets only in Render Environment (or your local `.env`), then redeploy. Never put provider credentials in browser code or commit them to GitHub. OpenStreetMap lookups use Nominatim and the shared Overpass API; public servers can be busy. Public emails appear only when a business listing includes them, so many shops will have no email listed.

## Emails and outreach

After searching, review any public email shown on a buyer card, or enter a recipient address you have verified. The **Send with Gmail SMTP** button sends one text-only message from `GMAIL_USER`; the API limits each client IP to five sends per hour. Review every recipient, include required sender details and an opt-out method in commercial messages, honor opt-outs, and include a link to your collection when useful. Google may block SMTP authentication or impose account sending limits. Nodemailer documents App Passwords for Gmail accounts with 2-Step Verification and recommends OAuth 2.0 for new production integrations.

## Google Sheets

To log sent emails, complete the one-time Apps Script setup described in `public/sheet-sync.html`. Logging requires Google account authorization.

## API endpoints

- `GET /api/config` — reports Foursquare, OpenStreetMap, and SMTP readiness.
- `POST /api/search` — searches Foursquare and OpenStreetMap business listings in the selected Alaska city.
- `POST /api/send` — sends a single plain-text email through the configured Gmail SMTP account.

