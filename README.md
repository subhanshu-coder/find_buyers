# HomeScout — Alaska Home Decor Buyer Finder

HomeScout helps home decor sellers discover potential retailers, view business websites and phones, look up verified work emails through Prospeo, and prepare individual Gmail drafts.

## Run locally

1. Install Node.js 18 or later.
2. Copy `.env.example` to `.env` and add API keys. Keep `.env` private.
3. Run `npm start` and open `http://localhost:3000`.

## Render setup

Configure these server-side environment variables in the Render service:

- `FOURSQUARE_API_KEY` — optional business discovery source.
- `GOOGLE_PLACES_API_KEY` — optional Google Places Text Search source. If both search keys are configured, HomeScout merges and deduplicates both sources. Google Places usage is billed according to the requested fields and your Google Cloud project.
- `PROSPEO_API_KEY` — buyer work-email lookup.

Save the variables and redeploy. Never put provider keys in browser code or commit them to GitHub. Google Places returns business details such as the listing name, address, website, and phone when available; Prospeo is used for email enrichment.

## Emails and outreach

After searching, click **Find email** on a business to ask Prospeo for a verified buyer email. Prospeo plan limits and credits apply. Email drafts open in Gmail for review; HomeScout does not send emails automatically. Attach the catalogue manually and contact only recipients who agreed to hear from you.

## Google Sheets

To log sent emails, complete the one-time Apps Script setup described in `public/sheet-sync.html`. Logging requires Google account authorization.

## API endpoints

- `GET /api/config` — reports whether search and email providers are configured.
- `POST /api/search` — searches configured Foursquare and/or Google Places sources.
- `POST /api/contacts` — searches Prospeo for verified work email using the business domain.
- `POST /api/send` — direct sending is disabled; use the reviewed Gmail draft.
