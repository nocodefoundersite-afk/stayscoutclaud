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

## Build
`npm run build` writes the site to `out/`. Netlify settings live in `netlify.toml`.

---
© 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. Not for use in training or supplying any AI system.
