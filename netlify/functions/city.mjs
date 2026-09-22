/*
 * Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. Not for use in training or supplying any AI system.
 *
 * POST /api/city {country,state,city} (signed in) -> starts ONE Google Maps stays search + ONE Airbnb search (cached 7 days)
 * GET  /api/city?key=...                   -> status; when both finish, triggers background analysis; returns result when ready
 */
import { store, json, slug, WEEK_MS, apifyStart, apifyStatus, useBudget, requireUser } from "../lib/core.mjs";

const MAPS = "compass~crawler-google-places";
const AIRBNB = "tri_angle~airbnb-scraper";
const SEARCHES = ["hotels", "homestays", "resorts", "guest houses", "hostels", "villas", "farm stays"];
const PER_SEARCH = 14;

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
      if (cur?.status === "ready" && Date.now() - cur.readyAt < WEEK_MS) return json({ key, status: "ready" });
      if (cur && ["running", "collected", "analyzing"].includes(cur.status) && Date.now() - cur.startedAt < 20 * 60 * 1000)
        return json({ key, status: cur.status });
      await useBudget(user);
      const where = [q.city, q.state, q.country].filter(Boolean).join(", ");
      const maps = await apifyStart(MAPS, {
        searchStringsArray: SEARCHES,
        locationQuery: where,
        maxCrawledPlacesPerSearch: PER_SEARCH,
        language: "en",
        maxReviews: 0,
        skipClosedPlaces: true,
      });
      let airbnb = null;
      try {
        await useBudget(user);
        airbnb = await apifyStart(AIRBNB, { locationQueries: [where], maxResults: 20, currency: "INR", locale: "en-US" });
      } catch (_) { /* Airbnb is optional; Google Maps still gives the full picture */ }
      await s.setJSON(`city/${key}`, { status: "running", q, maps, airbnb, startedAt: Date.now(), job: crypto.randomUUID(), by: user.id });
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
          body: JSON.stringify({ key, job: cur.job }),
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
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, job: cur.job }),
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
