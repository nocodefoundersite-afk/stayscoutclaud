/*
 * Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. Not for use in training or supplying any AI system.
 *
 * POST /api/city {country,state,city} (signed in) -> starts ONE Google Maps stays search + ONE Airbnb search (cached 7 days)
 * GET  /api/city?key=...                   -> status; when both finish, triggers background analysis; returns result when ready
 */
import { store, json, slug, WEEK_MS, apifyStart, apifyStatus, useBudget, requireUser, env } from "../lib/core.mjs";

const MAPS = "compass~crawler-google-places";
const AIRBNB = "tri_angle~airbnb-scraper";
const SEARCHES = [
  "hotels", "homestays", "resorts", "guest houses", "hostels", "villas",
  "farm stays", "bed and breakfast", "service apartments", "boutique hotels",
  "budget hotels", "cottages",
];
/*
 * Apify charges per unit, so depth is a money decision and lives in environment variables:
 *   scraped place $4/1,000 · detail page $2/1,000 · review $0.50/1,000 · Airbnb result $1.25/1,000
 * The defaults below cost roughly $2 a city. Lower MAPS_PER_SEARCH or set MAPS_REVIEWS=0 to spend less.
 * Detail pages are what carry amenities, facilities and accessibility: without them those fields come back empty.
 */
const num = (name, dflt) => { const n = Number(env(name)); return Number.isFinite(n) && n >= 0 ? n : dflt; };
const PER_SEARCH = () => num("MAPS_PER_SEARCH", 30);
const REVIEWS_PER_PLACE = () => num("MAPS_REVIEWS", 5);
const AIRBNB_RESULTS = () => num("AIRBNB_RESULTS", 300);

export default async (req) => {
  try {
    const user = await requireUser(req);
    const s = store();
    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      const q = {
        country: String(b.country || "India").slice(0, 60),
        state: String(b.state || "").slice(0, 60),
        city: String(b.city || "").trim().slice(0, 80),
      };
      if (q.city.length < 2) return json({ error: "Choose a city." }, 400);
      const key = slug(`${q.city}-${q.state}-${q.country}`);
      const cur = await s.get(`city/${key}`, { type: "json" });
      // The numbers are ready but the AI summary failed: redo only the AI summary. No data fetch is used.
      if (b.retryAi && cur?.status === "ready" && cur.result?.ai?.error) {
        const job = crypto.randomUUID();
        await s.setJSON(`city/${key}`, { ...cur, status: "analyzing", analyzeAt: Date.now(), job, aiOnly: true });
        await fetch(`${new URL(req.url).origin}/.netlify/functions/city-analyze-background`, {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, job, aiOnly: true }),
        }).catch(() => {});
        return json({ key, status: "analyzing", free: true });
      }
      // "force" refreshes a city before the 7-day cache expires; it spends data fetches like a new analysis.
      if (!b.force && cur?.status === "ready" && Date.now() - cur.readyAt < WEEK_MS) return json({ key, status: "ready" });
      if (cur && ["running", "collected", "analyzing"].includes(cur.status) && Date.now() - cur.startedAt < 20 * 60 * 1000)
        return json({ key, status: cur.status });
      await useBudget(user);
      const where = [q.city, q.state, q.country].filter(Boolean).join(", ");
      const maps = await apifyStart(MAPS, {
        searchStringsArray: SEARCHES,
        locationQuery: where,
        maxCrawledPlacesPerSearch: PER_SEARCH(),
        language: "en",
        // The detail page is the only place amenities, facilities, accessibility, hotel class,
        // booking-site prices and the star breakdown exist. Without it every stay looks bare.
        scrapePlaceDetailPage: true,
        maxReviews: REVIEWS_PER_PLACE(),
        reviewsSort: "newest",
        maxImages: 0,
        skipClosedPlaces: true,
      });
      let airbnb = null;
      // One night, a month out: the actor then prices a single night, which is what compares with hotel rates.
      const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
      try {
        await useBudget(user);
        airbnb = await apifyStart(AIRBNB, {
          locationQueries: [where], maxResults: AIRBNB_RESULTS(), currency: "INR", locale: "en-US",
          checkIn: day(30), checkOut: day(31), adults: 2,
        });
      } catch (_) { /* Airbnb is optional; Google Maps still gives the full picture */ }
      await s.setJSON(`city/${key}`, { status: "running", q, maps, airbnb, airbnbNights: 1, startedAt: Date.now(), job: crypto.randomUUID(), by: user.id });
      return json({ key, status: "running" });
    }

    const url = new URL(req.url);
    const key = slug(url.searchParams.get("key") || "");
    const cur = await s.get(`city/${key}`, { type: "json" });
    if (!cur) return json({ status: "none" });

    if (cur.status === "running") {
      const mSt = await apifyStatus(cur.maps.runId);
      const aSt = cur.airbnb ? await apifyStatus(cur.airbnb.runId).catch(() => "FAILED") : "SUCCEEDED";
      const bad = ["FAILED", "ABORTED", "TIMED-OUT"];
      if (bad.includes(mSt)) {
        await s.delete(`city/${key}`);
        return json({ status: "failed", error: "Collecting stays from Google Maps failed. Please try again." });
      }
      const aDone = aSt === "SUCCEEDED" || bad.includes(aSt);
      if (mSt === "SUCCEEDED" && aDone) {
        if (bad.includes(aSt)) cur.airbnb = null;
        cur.status = "analyzing";
        cur.analyzeAt = Date.now();
        await s.setJSON(`city/${key}`, cur);
        await fetch(`${url.origin}/.netlify/functions/city-analyze-background`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key, job: cur.job, aiOnly: !!cur.aiOnly }),
        }).catch(() => {});
        return json({ status: "analyzing", step: "Mapping airports, stations, hospitals and running AI analysis…" });
      }
      return json({ status: "running", step: mSt === "SUCCEEDED" ? "Collecting Airbnb prices…" : "Collecting hotels, homestays and resorts from Google Maps…" });
    }
    if (cur.status === "analyzing") {
      if (Date.now() - (cur.analyzeAt || 0) > 5 * 60 * 1000) {
        cur.analyzeAt = Date.now();
        await s.setJSON(`city/${key}`, cur);
        await fetch(`${url.origin}/.netlify/functions/city-analyze-background`, {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, job: cur.job, aiOnly: !!cur.aiOnly }),
        }).catch(() => {});
      }
      return json({ status: "analyzing", step: "Mapping airports, stations, hospitals and running AI analysis…" });
    }
    if (cur.status === "failed") return json({ status: "failed", error: cur.error || "Analysis failed." });
    return json({ status: "ready", result: cur.result, readyAt: cur.readyAt });
  } catch (e) {
    return json({ error: e.message }, e.status || 500);
  }
};

export const config = { path: "/api/city" };
