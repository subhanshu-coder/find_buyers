# HomeScout — Alaska Home Decor Buyer Finder

HomeScout helps home decor sellers discover potential retailers using Foursquare Places and OpenStreetMap. It checks public business websites for published email addresses, finds eligible verified work emails with Snov.io, and opens reviewed email drafts in Gmail for you to send.

## Run locally

1. Install Node.js 18 or later.
2. Copy `.env.example` to `.env` and add API keys. Keep `.env` private.
3. Run `npm start` and open `http://localhost:3000`.

## Render setup

Configure these server-side environment variables in the Render service:

- `FOURSQUARE_API_KEY` — Foursquare Places discovery. OpenStreetMap is queried as a second business-listing source.
- `SNOV_API_USER_ID` and `SNOV_API_SECRET` — Snov.io prospect search and Email Finder APIs. After public website lookup, the app checks up to 10 eligible buyer companies per search; additional buyers can be checked with their **Find with Snov.io** buttons.

Set secrets only in Render Environment (or your local `.env`), then redeploy. Never put provider credentials in browser code or commit them to GitHub. Website email lookup reads a business’s public HTTPS website and up to two same-site contact/about pages. It checks at most 50 sites per search, four at a time, and caches results for six hours. Only visible, publicly published addresses can be found; many businesses publish none, and results are not verified. Snov.io’s docs state domain prospect profile search costs 1 credit per unique request; the name-and-domain Email Finder costs 1 credit for each valid or unknown email it returns. Plan access and balance apply. HomeScout checks up to 10 eligible businesses automatically and caches results. Automatic checks stop on provider errors. OpenStreetMap lookups use Nominatim and the shared Overpass API; public servers can be busy.

## Emails and outreach

After searching, review any public email shown on a buyer card, or enter a recipient address you have verified. The **Open draft in Gmail** button opens Gmail compose with the recipient, subject, and message filled in. Review the message and send it yourself in Gmail. No SMTP credentials are stored or required. Keep the suggested subject format so the optional sent-mail sheet logger can identify the product and company.

## Google Sheets

To log sent emails, complete the one-time Apps Script setup described in `public/sheet-sync.html`. Logging requires Google account authorization.

## API endpoints

- `GET /api/config` — reports Foursquare, OpenStreetMap, and Snov.io readiness.
- `POST /api/search` — searches Foursquare (when configured) and OpenStreetMap business listings in the selected Alaska city.
- `POST /api/email-lookup` — checks up to 50 supplied business websites for public email addresses using bounded HTTPS requests.
- `POST /api/snov-email` — finds relevant buyer contacts and business emails through Snov.io; the app checks up to 10 eligible businesses per search.
