# HomeScout — Alaska Home Decor Buyer Finder

HomeScout helps home decor sellers discover potential retail buyers in Alaska, look up publicly available business email addresses, review websites, and draft individual or selected-recipient outreach.

## Run locally

1. Install Node.js 18 or later.
2. Copy `.env.example` to `.env` and add API credentials. Keep `.env` private.
3. Run `node server.js` and open `http://localhost:3000`.

The website is in `public/`; the Vercel API function is in `api/`. No npm packages are required.

## Search options

Product categories: Singing bowls; Candle holders; Crystal candle holders; Decorative glassware and home decor; Votive candle holders.

Buyer keywords: votive candle holders; votive holder; votive candle holder; glass votive holders; metal votive holders; decorative votive holders; tealight holders; tea light holders; candle cups; candle lanterns; home decor store; gift shop; gift store; candle shop; home accessories store; interior decor store; boutique; event decor supplier; wedding decor supplier; hospitality supplier; restaurant decor; hotel decor supplier; wholesale candle holders; home decor wholesaler; giftware wholesaler.

Cities include Anchorage, Wasilla, Palmer, Kenai, Soldotna, Homer, Juneau, Sitka, Ketchikan, Skagway, Wrangell, Fairbanks, North Pole, Delta Junction, Nenana, Nome, Bethel, Dillingham, Unalaska, and Utqiagvik.

## Vercel deployment

Import the repository root into Vercel. The included `vercel.json` uses the **Other** framework, serves `public/` as static assets, and deploys `/api` as a serverless function. Add `FOURSQUARE_API_KEY`, `SNOV_API_USER_ID`, and `SNOV_API_SECRET` in the Vercel project's Environment Variables, then redeploy. Add `RESEND_API_KEY` and `SENDER_EMAIL` if you want the API to send email directly. Never commit `.env` or put API secrets in browser code.

GitHub Pages serves only static files and cannot run the API. Deploy the backend separately and set the page's `?api=https://YOUR-API-HOST` parameter if using Pages.

## Buyer emails and outreach

Foursquare Places searches for potential retailers. Snov.io looks up public business emails by website domain; lookups may use account credits. Review the results, including website and email, before outreach. Buyers can be filtered by email availability and selected. Selected emails are sent using private BCC so recipients do not see one another. Without Resend, HomeScout opens a prefilled email draft in the user's email application. The app never reports an email as sent unless Resend confirms it.

Add a verified sender in Resend before direct sending. Use truthful sender details, include a valid postal address and opt-out instructions in commercial messages, and honor opt-outs.

## API endpoints

- `GET /api/config` — reports whether provider integrations are configured.
- `POST /api/search` — searches Foursquare for a city, product category, and buyer keyword.
- `POST /api/contacts` — searches Snov.io for domain email results.
- `POST /api/send` — sends one reviewed email or one message to up to 50 selected recipients using private BCC.

