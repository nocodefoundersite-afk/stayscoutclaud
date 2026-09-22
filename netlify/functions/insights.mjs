/*
 * Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. Not for use in training or supplying any AI system.
 *
 * POST /api/insights {location, i}  -> fetch recent reviews for ONE property (only when asked)
 * GET  /api/insights?location=&i=   -> status; when ready returns AI analysis (cached, never paid twice)
 */
import { store, json, slug, apifyStart, apifyStatus, apifyItems, useBudget, aiJSON } from "../lib/core.mjs";

const ACTOR = "tri_angle~airbnb-reviews-scraper";
const MAX_REVIEWS = 30;

const SYSTEM = `You are a hospitality market analyst for stays in India.
You receive ONE property's public listing data and its recent guest reviews.
Use only the data given. Never invent numbers, facts, prices or quotes.
Write in simple English, short sentences.
Return JSON exactly in this shape:
{
 "summary": "one sentence on why this property performs well",
 "why_doing_well": ["3-5 concrete reasons from amenities, rating, reviews"],
 "guests_love": ["2-4 things guests praise, from the reviews"],
 "complaints": [{"theme":"short name","detail":"one line","quote":"max 15 words copied from a review, no names"}],
 "fixes_for_you": [{"problem":"...","fix":"simple steps a competing host can take","priority":"Must fix|Should fix|Nice to have"}],
 "listing_lines": ["3-5 lines a competing host could write in their own listing, only promises they can keep"]
}
If there are few or no reviews, say so in "summary" and keep lists short.`;

async function findStay(s, location, i) {
  const cur = await s.get(`search/${slug(location)}`, { type: "json" });
  if (!cur || cur.status !== "ready") return null;
  return cur.stays[i] || null;
}

export default async (req) => {
  try {
    const s = store();
    let location, i;
    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      location = String(b.location || "");
      i = Math.max(0, parseInt(b.i, 10) || 0);
    } else {
      const u = new URL(req.url);
      location = String(u.searchParams.get("location") || "");
      i = Math.max(0, parseInt(u.searchParams.get("i") || "0", 10) || 0);
    }
    const stay = await findStay(s, location, i);
    if (!stay) return json({ error: "Load the property first." }, 404);
    const key = `insight/${slug(stay.id)}`;
    let cur = await s.get(key, { type: "json" });

    if (req.method === "POST") {
      if (cur?.status === "ready") return json({ status: "ready" });
      if (cur?.status === "running" && Date.now() - cur.startedAt < 15 * 60 * 1000) return json({ status: "running" });
      if (!stay.url) return json({ error: "This listing has no link to fetch reviews from." }, 400);
      await useBudget();
      const { runId, datasetId } = await apifyStart(ACTOR, {
        startUrls: [{ url: stay.url }],
        maxReviewsPerListing: MAX_REVIEWS,
        locale: "en-US",
      });
      await s.setJSON(key, { status: "running", runId, datasetId, startedAt: Date.now() });
      return json({ status: "running" });
    }

    if (!cur) return json({ status: "none" });
    if (cur.status === "running") {
      const st = await apifyStatus(cur.runId);
      if (["FAILED", "ABORTED", "TIMED-OUT"].includes(st)) {
        await s.delete(key);
        return json({ status: "failed", error: `Review fetch ${st.toLowerCase()}. Please try again.` });
      }
      if (st !== "SUCCEEDED") return json({ status: "running" });
      const raw = await apifyItems(cur.datasetId, MAX_REVIEWS);
      const reviews = raw
        .map((r) => ({ text: String(r.text || r.comments || "").slice(0, 600), rating: r.rating ?? null, date: r.createdAt || r.date || "" }))
        .filter((r) => r.text);
      const payload = {
        listing: {
          title: stay.title, roomType: stay.roomType, rating: stay.rating, reviewsCount: stay.reviews,
          price: stay.priceLabel, superhost: stay.superhost, details: stay.details,
          amenities: stay.amenities, description: stay.description,
        },
        reviews_analysed: reviews.length,
        reviews,
      };
      const ai = await aiJSON(SYSTEM, JSON.stringify(payload));
      cur = { status: "ready", reviewsAnalysed: reviews.length, insight: ai, createdAt: Date.now() };
      await s.setJSON(key, cur);
    }
    return json({ status: "ready", reviewsAnalysed: cur.reviewsAnalysed, insight: cur.insight, createdAt: cur.createdAt });
  } catch (e) {
    return json({ error: e.message }, e.status || 500);
  }
};

export const config = { path: "/api/insights" };
