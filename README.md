# HomeScout — Alaska Home Decor Buyer Finder

HomeScout discovers potential retail buyers with Foursquare Places, searches business contacts and emails with Snov.io, and opens reviewed email drafts in Gmail for you to send.

## Run locally

1. Install Node.js 18 or later.
2. Copy `.env.example` to `.env` and add API credentials. Keep `.env` private.
3. Run `npm start` and open `http://localhost:3000`.

## Render setup

Set these server-side variables in the Render service:

- `FOURSQUARE_API_KEY` — Foursquare Places buyer discovery.
- `SNOV_API_USER_ID` and `SNOV_API_SECRET` — Snov.io prospect search and Email Finder.

Searches use Foursquare only. Snov.io checks eligible Foursquare results with a supported primary business domain; hosted-site domains may not be searchable. The app does not impose a fixed count of companies, prospects, or emails. Snov.io prospect results are paginated and Email Finder requests are chunked to the provider-supported batch size. Snov.io account access, provider rate limits, plan restrictions, and credits still apply. Foursquare controls its own result cap and plan availability. Check provider dashboards for current limits and billing. Keep credentials in Render Environment or a private local `.env`; never expose them in browser code or commit them to GitHub.

## Emails and outreach

Foursquare may include an email published on a place listing. Snov.io can search for contact people and business emails based on eligible business domains. Returned email verification status comes from Snov.io; confirm details before outreach. **Open draft in Gmail** opens Gmail compose with the recipient, subject, and message filled in. Review the message and send it yourself. No SMTP credentials are stored or required.

## Google Sheets

To log sent emails, complete the one-time Apps Script setup described in `public/sheet-sync.html`. Logging requires Google account authorization.

## API endpoints

- `GET /api/config` — reports Foursquare and Snov.io readiness.
- `POST /api/search` — searches Foursquare buyer listings for an Alaska city.
- `POST /api/snov-email` — looks up available prospect pages and finds emails through Snov.io, subject to provider limits and account access.
