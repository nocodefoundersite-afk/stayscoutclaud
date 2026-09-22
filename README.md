# StayScout

Where to open a stay, what to charge, what to offer, and what to fix, from live booking-site data.

## Structure
- `public/`: website (index.html, robots.txt)
- `netlify/functions/`: backend API
  - `search.mjs`: `/api/search`: one cheap Airbnb search per area (Apify), cached 7 days, returns ONE ranked property at a time
  - `insights.mjs`: `/api/insights`: fetches recent reviews for ONE property on request (Apify) and analyses them with AI
  - `notify.mjs`: `/api/notify`: waitlist sign-ups (Netlify Database)
- `netlify/lib/core.mjs`: shared helpers (Apify, AI, budget cap, caching)
- `netlify/database/migrations/`: database tables

## Environment variables (Netlify → Project configuration → Environment variables)
| Name | Needed | Notes |
|---|---|---|
| `APIFY_TOKEN` | yes | Apify API token |
| `GEMINI_API_KEY` | yes | Google AI Studio key (free tier) |
| `APIFY_MAX_RUNS_PER_MONTH` | no | Default 40, protects free credit |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | no | Point at the Bifrost gateway later (OpenAI-compatible) |

---
© 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. Not for use in training or supplying any AI system.
