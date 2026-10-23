# HomeScout — Alaska Home Decor Buyer Finder

HomeScout helps home decor sellers find potential retail buyers in Alaska, view business websites and phone numbers, look up verified work emails through Prospeo, and prepare individual Gmail drafts.

## Run locally

1. Install Node.js 18 or later.
2. Copy `.env.example` to `.env` and add your API keys. Keep `.env` private.
3. Run `npm start` and open `http://localhost:3000`.

## Render deployment

The Render web service runs `node server.js` from the repository root. Configure these server-side variables in the Render service Environment settings:

- `FOURSQUARE_API_KEY` — business/place search.
- `PROSPEO_API_KEY` — verified buyer email lookup.

Save the variables and redeploy the service. Keep both keys out of browser code and GitHub. Render service: [find-buyers.onrender.com](https://find-buyers.onrender.com).

## Search coverage

The app searches the Alaska city list in the form and filters retailers by the chosen product category and buyer keyword. Results depend on Foursquare listings and may include businesses without websites. Prospeo lookup is started only when the user clicks “Find email”; it searches the business website domain and buyer job titles. Provider plan limits and credits apply.

## Email drafts and logging

Email drafts open in Gmail for review; HomeScout does not send messages automatically. Attach the product catalogue manually. Contact only recipients who agreed to hear from you, include your business postal address, and honor opt-outs.

To log sent emails in the linked Google Sheet, complete the one-time Apps Script setup in `public/sheet-sync.html`. Logging requires Google account authorization and checks Gmail periodically.

## API endpoints

- `GET /api/config` — reports whether Foursquare and Prospeo are configured.
- `POST /api/search` — searches Foursquare for a city, product category, and buyer keyword.
- `POST /api/contacts` — searches Prospeo for a verified business email using a company domain.
- `POST /api/send` — direct sending is disabled; use the reviewed Gmail draft.
