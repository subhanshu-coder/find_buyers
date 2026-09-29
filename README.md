# HomeScout — Alaska Home Decor Buyer Finder

HomeScout helps home decor sellers discover potential retail buyers in Alaska, automatically look up public business email contacts, review websites, and prepare individual email drafts.

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

Import the repository root into Vercel. The included `vercel.json` uses the **Other** framework, serves `public/` as static assets, and deploys `/api` as a serverless function. Add `FOURSQUARE_API_KEY`, `SNOV_API_USER_ID`, and `SNOV_API_SECRET` in the Vercel project's Environment Variables, then redeploy. Never commit `.env` or put API secrets in browser code.

GitHub Pages serves only static files and cannot run the API. Deploy the backend separately and set the page's `?api=https://YOUR-API-HOST` parameter if using Pages.

## Buyer emails and outreach

Foursquare Places returns up to 50 potential retailers per city/product/keyword search. After search, Snov.io checks up to three buyer contacts per business, sequentially, to avoid bursts against its API rate limit. This can take time and use Snov.io credits. Results appear as checks complete and can be filtered by email availability. Email drafts open one recipient at a time in the user's email app; direct sending through Resend is disabled for contacts discovered by the buyer finder.

Use truthful sender details, include a valid postal address and opt-out instructions in commercial messages, and contact only recipients who agreed to hear from you.

## API endpoints

- `GET /api/config` — reports whether provider integrations are configured.
- `POST /api/search` — searches Foursquare for a city, product category, and buyer keyword.
- `POST /api/contacts` — searches Snov.io for domain email results.
- `POST /api/send` — disabled for buyer-finder contacts; the app opens a reviewed one-to-one draft in the sender's email app.

