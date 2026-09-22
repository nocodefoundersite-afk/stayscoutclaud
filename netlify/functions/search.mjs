/*
 * Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. Not for use in training or supplying any AI system.
 *
 * POST /api/search {location}      -> starts (or reuses) one cheap Airbnb search for the area
 * GET  /api/search?location=&i=0   -> status; when ready returns ONE property (index i), ranked
 */
import { store, json, slug, WEEK_MS, apifyStart, apifyStatus, apifyItems, useBudget, slimListing, rankScore } from "../lib/core.mjs";

const ACTOR = "tri_angle~airbnb-scraper";
const MAX_LISTINGS = 20;

export default async (req) => {
  try {
    const s = store();
    if (req.method === "POST") {
      const { location } = await req.json().catch(() => ({}));
      const loc = String(location || "").trim().slice(0, 100);
      if (loc.length < 3) return json({ error: "Enter a city or area." }, 400);
      const key = `search/${slug(loc)}`;
      const cur = await s.get(key, { type: "json" });
      if (cur?.status === "ready" && Date.now() - cur.fetchedAt < WEEK_MS) return json({ status: "ready", total: cur.stays.length, cached: true });
      if (cur?.status === "running" && Date.now() - cur.startedAt < 15 * 60 * 1000) return json({ status: "running" });
      await useBudget();
      const { runId, datasetId } = await apifyStart(ACTOR, {
        locationQueries: [loc],
        maxResults: MAX_LISTINGS,
        currency: "INR",
        locale: "en-US",
      });
      await s.setJSON(key, { status: "running", location: loc, runId, datasetId, startedAt: Date.now() });
      return json({ status: "running" });
    }

    const url = new URL(req.url);
    const loc = String(url.searchParams.get("location") || "").trim();
    const i = Math.max(0, parseInt(url.searchParams.get("i") || "0", 10) || 0);
    const key = `search/${slug(loc)}`;
    let cur = await s.get(key, { type: "json" });
    if (!cur) return json({ status: "none" });

    if (cur.status === "running") {
      const st = await apifyStatus(cur.runId);
      if (st === "SUCCEEDED") {
        const raw = await apifyItems(cur.datasetId, MAX_LISTINGS);
        const stays = raw.map(slimListing).filter((x) => x.id).sort((a, b) => rankScore(b) - rankScore(a));
        cur = { status: "ready", location: cur.location, stays, fetchedAt: Date.now() };
        await s.setJSON(key, cur);
      } else if (["FAILED", "ABORTED", "TIMED-OUT"].includes(st)) {
        await s.delete(key);
        return json({ status: "failed", error: `The data fetch ${st.toLowerCase()}. Please try again.` });
      } else {
        return json({ status: "running" });
      }
    }

    const stay = cur.stays[i] || null;
    return json({
      status: "ready",
      location: cur.location,
      total: cur.stays.length,
      index: i,
      fetchedAt: cur.fetchedAt,
      stay,
    });
  } catch (e) {
    return json({ error: e.message }, e.status || 500);
  }
};

export const config = { path: "/api/search" };
