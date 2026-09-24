# StayScout

Where to open a stay, what to charge, what to offer and what to fix, from live Google Maps, Airbnb and OpenStreetMap data.

## Structure
- `app/`, `components/`, `lib/`: the website (Next.js, exported as static files to `out/`)
  - Sign in, registration, email confirmation and password reset use Netlify Identity (`lib/auth.ts`)
  - Every app page needs a signed-in account; Help, Plans, Contact, Privacy and Terms are public
- `netlify/functions/`: backend API (every data endpoint checks the Netlify Identity token)
  - `city.mjs`: `/api/city`: starts ONE Google Maps stays search + ONE Airbnb search for a city (Apify), cached 7 days
  - `city-analyze-background.mjs`: groups stays into localities, scores them, adds airports/stations/hospitals/colleges (OpenStreetMap) and an AI summary
  - `area.mjs` + `area-analyze-background.mjs`: `/api/area`: reads recent Google reviews for one locality and lists problems, fixes and listing lines with AI
  - `usage.mjs`: `/api/usage`: data fetches used this month, for the site and the signed-in account
  - `notify.mjs`: `/api/notify`: paid-plan waitlist (Netlify Database)
  - `contact.mjs`: `/api/contact`: support messages (Netlify Database)
- `netlify/lib/core.mjs`: shared helpers (Apify, AI, sign-in check, monthly limits, caching)
- `netlify/database/migrations/`: database tables

## Environment variables (Netlify → Project configuration → Environment variables)
| Name | Needed | Notes |
|---|---|---|
| `APIFY_TOKEN` (or `Apify`) | yes | Apify API token |
| `GEMINI_API_KEY` (or `GemAPIKey`) | yes | Google AI Studio key |
| `APIFY_MAX_RUNS_PER_MONTH` | no | Whole-site monthly limit, default 40 |
| `USER_MAX_RUNS_PER_MONTH` | no | Per-account monthly limit, default 10 |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | no | Point at the Bifrost gateway (OpenAI-compatible) once it's hosted |
| `MAPS_PER_SEARCH` | no | Stays fetched per search term, default 30 (12 terms) |
| `MAPS_REVIEWS` | no | Reviews read per stay, default 5; set 0 to skip reviews |
| `AIRBNB_RESULTS` | no | Airbnb listings per city, default 300 |
| `USD_INR` | no | Rate used to convert foreign prices, default 88 |

## What a city costs

Apify charges per unit, so the three variables above set the bill:

| Unit | Price | Default per city |
|---|---|---|
| Scraped place | $4.00 / 1,000 | 12 terms × 30 ≈ 360 before de-duplication |
| Place detail page | $2.00 / 1,000 | same count — this is what carries facilities |
| Review | $0.50 / 1,000 | 5 per stay |
| Airbnb listing | $1.25 / 1,000 | 300 |

That is roughly **$2 a city**. `scrapePlaceDetailPage` is the setting that matters: without it Google
returns no facilities, no booking-site prices, no star class and no rating breakdown, and the pages
have almost nothing to show. Lower `MAPS_PER_SEARCH` or set `MAPS_REVIEWS=0` to spend less.

## Build
`npm run build` writes the site to `out/`. Netlify settings live in `netlify.toml`.

---
© 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. Not for use in training or supplying any AI system.
