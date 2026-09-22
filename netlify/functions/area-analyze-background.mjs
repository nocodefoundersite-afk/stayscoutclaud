/*
 * Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. Not for use in training or supplying any AI system.
 *
 * Background job: AI analysis of recent guest reviews for one area -> problems, fixes, website lines, verdict.
 */
import { store, apifyItems, aiJSON } from "../lib/core.mjs";

const SYSTEM = `You are a guest-experience consultant for hotels, homestays and rentals in India.
You get recent public guest reviews of the top stays in ONE area, plus counted area numbers.
Use ONLY what is in the reviews and numbers. Never invent facts or numbers. Never quote or name individual guests; describe themes in your own words.
Count mentions yourself from the reviews given and report them as "X of N reviews".
Simple English, short sentences. Return JSON exactly:
{
 "summary": "one sentence on what guests in this area experience",
 "guests_love": ["2-4 things guests praise"],
 "problems": [{"problem":"short name e.g. Power cuts","mentions":"X of N reviews","fix":"what a new property should do","cost_inr":"rough range or 'low'","priority":"Must fix|Should fix|Nice to have"}],
 "website_lines": ["lines to put on the property's website/listing that answer these problems, e.g. 'Power cuts are common here, so we run a full backup generator.' Only promises a host can keep."],
 "must_have_amenities": ["from the reviews"],
 "verdict": "Open here | Open with care | Avoid",
 "verdict_reason": "2 short sentences"
}
List up to 6 problems, most mentioned first.`;

export default async (req) => {
  const s = store();
  let key, area;
  try {
    const body = await req.json();
    ({ key, area } = body);
    const k = `area/${key}/${area}`;
    const cur = await s.get(k, { type: "json" });
    if (!cur || cur.status === "ready") return;
    if (cur.job && body.job !== cur.job) { key = area = undefined; return; } // only the app's own poller may start this job
    const city = await s.get(`city/${key}`, { type: "json" });
    const a = city?.result?.areas?.find((x) => x.id === area) || {};
    const raw = await apifyItems(cur.run.datasetId, 200);
    const reviews = raw
      .map((r) => ({ place: r.title || r.placeName || "", stars: r.stars ?? r.rating ?? null, date: (r.publishedAtDate || "").slice(0, 10), text: String(r.text || r.textTranslated || "").slice(0, 500) }))
      .filter((r) => r.text);
    const input = {
      area: a.name, city: city?.q?.city,
      numbers: { stays: a.stays, avg_rating: a.avgRating, low_rated_pct: a.lowRatedPct, median_price_inr: a.medianPriceINR, km_to_airport: a.airport?.km, km_to_railway: a.railway?.km, km_to_hospital: a.hospital?.km },
      reviews_count: reviews.length,
      reviews,
    };
    const ai = reviews.length
      ? await aiJSON(SYSTEM, JSON.stringify(input))
      : { summary: "No recent written reviews were found for the top stays in this area.", problems: [], website_lines: [], verdict: "Open with care", verdict_reason: "Not enough review data to judge." };
    await s.setJSON(k, { ...cur, status: "ready", readyAt: Date.now(), result: { area: a.name, reviewsAnalysed: reviews.length, places: [...new Set(reviews.map((r) => r.place))].length, ai } });
  } catch (e) {
    if (key && area) {
      const k = `area/${key}/${area}`;
      const cur = (await s.get(k, { type: "json" })) || {};
      await s.setJSON(k, { ...cur, status: "failed", error: e.message });
    }
  }
};
