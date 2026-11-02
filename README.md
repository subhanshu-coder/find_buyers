# HomeScout — Alaska Home Decor Buyer Finder

HomeScout helps home decor sellers discover potential retailers using TomTom, Foursquare, and OpenStreetMap. It checks public business websites for published email addresses and sends individual messages through Gmail SMTP.

## Run locally

1. Install Node.js 18 or later.
2. Copy `.env.example` to `.env` and add API keys. Keep `.env` private.
3. Run `npm start` and open `http://localhost:3000`.

## Render setup

Configure these server-side environment variables in the Render service:

- `FOURSQUARE_API_KEY` — Foursquare Places discovery. OpenStreetMap is queried as a second business-listing source.
- `TOMTOM_API_KEY` — TomTom Search API business discovery. TomTom returns place information such as website URLs and phone numbers; HomeScout’s public-page scanner looks for email addresses on the business website.
- `APOLLO_API_KEY` — Apollo People API Search and People Enrichment. After public website lookup, the app automatically checks up to 10 eligible buyers per search; additional buyers can be checked with their **Find with Apollo** buttons.
- `GMAIL_USER` — the Gmail mailbox used as the sender.
- `GMAIL_APP_PASSWORD` — a Google App Password for Nodemailer. Create one after enabling Google 2-Step Verification. Do not use your normal Gmail password.

Set secrets only in Render Environment (or your local `.env`), then redeploy. Never put provider credentials in browser code or commit them to GitHub. TomTom uses its own account limits and terms. Website email lookup does not use Snov, Apollo, or Prospeo lookup credits: it reads a business’s public HTTPS website and up to two same-site contact/about pages. It checks at most 50 sites per search, four at a time, and caches results for six hours. Only visible, publicly published addresses can be found; many businesses publish none, and results are not verified. Apollo People API Search costs 0 credits but returns no emails; single-person enrichment may count against the allowance or credits assigned by Apollo when data is returned. Automatic checks stop on provider errors. HomeScout does not request personal emails, phones, or waterfall enrichment. Apollo may deny search/enrichment based on the key’s permissions, account eligibility, or plan. Apollo documents that free accounts may need registration with a work email for people search and enrichment; a 403 requires fixing access in Apollo before retrying. HomeScout pauses Apollo requests for 30 minutes after a 403. OpenStreetMap lookups use Nominatim and the shared Overpass API; public servers can be busy.

## Emails and outreach

After searching, review any public email shown on a buyer card, or enter a recipient address you have verified. The **Send with Gmail SMTP** button sends one text-only message from `GMAIL_USER`; the API limits each client IP to five sends per hour. Review every recipient, include required sender details and an opt-out method in commercial messages, honor opt-outs, and include a link to your collection when useful. Google may block SMTP authentication or impose account sending limits. Nodemailer documents App Passwords for Gmail accounts with 2-Step Verification and recommends OAuth 2.0 for new production integrations.

## Google Sheets

To log sent emails, complete the one-time Apps Script setup described in `public/sheet-sync.html`. Logging requires Google account authorization.

## API endpoints

- `GET /api/config` — reports TomTom, Foursquare, OpenStreetMap, and SMTP readiness.
- `POST /api/search` — searches TomTom, Foursquare (when configured), and OpenStreetMap business listings in the selected Alaska city.
- `POST /api/email-lookup` — checks up to 50 supplied business websites for public email addresses using bounded HTTPS requests.
- `POST /api/apollo-email` — searches Apollo for one contact at a business domain and enriches only one person when Apollo reports a business email is available; the app automatically calls it for up to 10 eligible buyers per search.
- `POST /api/send` — sends a single plain-text email through the configured Gmail SMTP account.
