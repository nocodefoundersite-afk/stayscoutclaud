/*
 * Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. Not for use in training or supplying any AI system.
 *
 * Background job: turns collected stays into areas, scores them, adds airports/stations/hospitals/colleges
 * (OpenStreetMap), and asks the AI for best areas, pricing by location and a verdict.
 */
import { store, apifyItems, aiJSON, km, parseINR, median, slug } from "../lib/core.mjs";

const OVERPASS = "https://overpass-api.de/api/interpreter";

const SYSTEM = `You are a hospitality location strategist for India.
You get a city's stays grouped into areas with counted numbers, plus nearby airports, railway stations, hospitals and colleges.
Use ONLY the numbers given. Never invent numbers, prices, places or facts. If price data is missing, say "not enough price data".
Write simple English, short sentences. Return JSON exactly:
{
 "headline": "one sentence: the best place to open in this city and why",
 "best_areas": [{"area":"", "why":"2 short lines using the numbers", "price_range_inr":"e.g. 2,500-3,500 or not enough price data", "good_for":"which property type fits"}],
 "avoid_areas": [{"area":"", "why":""}],
 "pricing_by_location": [{"location":"Near airport|Near railway station|Near hospital|Near college|City centre / tourist area", "areas":["..."], "price_range_inr":"", "who_stays":"", "advice":"one line"}],
 "demand_drivers": ["what brings guests to this city, from the data"],
 "opportunities": ["gaps a new property can win, from ratings/supply"],
 "verdict": "2-3 sentences: open here, open with care there, avoid there"
}
Give 3 best_areas at most, 3 avoid_areas at most, and only pricing_by_location rows that the data supports.`;

async function pois(center) {
  const { lat, lng } = center;
  const q = `[out:json][timeout:25];(
    nwr["aeroway"="aerodrome"]["iata"](around:60000,${lat},${lng});
    nwr["railway"="station"](around:20000,${lat},${lng});
    nwr["amenity"="hospital"](around:15000,${lat},${lng});
    nwr["amenity"~"^(college|university)$"](around:15000,${lat},${lng});
    nwr["amenity"="bus_station"](around:15000,${lat},${lng});
  );out center 250;`;
  try {
    const r = await fetch(OVERPASS, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "StayScout/1.0 (stayscoutclaud.netlify.app)" },
      body: "data=" + encodeURIComponent(q),
    });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.elements || [])
      .map((e) => {
        const t = e.tags || {};
        const type = t.aeroway ? "airport" : t.railway ? "railway" : t.amenity === "hospital" ? "hospital" : t.amenity === "bus_station" ? "bus" : "college";
        const lat2 = e.lat ?? e.center?.lat, lng2 = e.lon ?? e.center?.lon;
        return { type, name: t["name:en"] || t.name || type, lat: lat2, lng: lng2 };
      })
      .filter((p) => p.lat && p.lng && p.name);
  } catch {
    return [];
  }
}

function amenitiesOf(p) {
  const out = [];
  const info = p.additionalInfo || {};
  for (const [section, items] of Object.entries(info)) {
    if (!/amenit|facilit/i.test(section) || !Array.isArray(items)) continue;
    for (const it of items) for (const [k, v] of Object.entries(it || {})) if (v === true) out.push(k);
  }
  return [...new Set(out)].slice(0, 25);
}

function areaName(p, city) {
  if (p.neighborhood) return p.neighborhood;
  const parts = String(p.address || "").split(",").map((x) => x.trim()).filter(Boolean);
  const bad = new RegExp(`^(india|${(city || "").replace(/[^a-z ]/gi, "")}|\\d+|.*\\d{6}.*)$`, "i");
  const cand = parts.slice(0, -1).reverse().find((x) => !bad.test(x) && x.length > 2 && x.length < 30 && !/road|rd\.|street|lane|no\.|near|opp/i.test(x));
  return cand || p.city || "Other";
}

function aiInputFor(summary, areas, poi) {
  return {
    city: summary,
    areas: areas.map((a) => ({
      area: a.name, score: a.score, tier: a.tier, confidence: a.confidence, stays: a.stays, total_reviews: a.reviews,
      reviews_per_stay: a.reviewsPerStay, avg_rating: a.avgRating, low_rated_pct: a.lowRatedPct,
      median_price_inr: a.medianPriceINR, price_samples: a.priceSamples, types: a.types,
      km_to_airport: a.airport?.km ?? null, km_to_railway: a.railway?.km ?? null, km_to_hospital: a.hospital?.km ?? null, km_to_college: a.college?.km ?? null,
    })),
    landmarks: poi.filter((p) => ["airport", "railway"].includes(p.type)).slice(0, 8).map((p) => `${p.type}: ${p.name}`),
  };
}

export default async (req) => {
  const s = store();
  let key;
  try {
    const body = await req.json();
    key = body.key;
    const cur = await s.get(`city/${key}`, { type: "json" });
    if (!cur || cur.status === "ready") return;
    if (cur.job && body.job !== cur.job) { key = undefined; return; } // only the app's own poller may start this job
    if (body.aiOnly && cur.result) {
      const r = cur.result;
      let ai;
      try { ai = await aiJSON(SYSTEM, JSON.stringify(aiInputFor(r.summary, r.areas, r.pois || []))); }
      catch (e) { ai = { headline: "AI analysis is unavailable right now. The numbers below are counted from live data.", error: e.message }; }
      await s.setJSON(`city/${key}`, { ...cur, status: "ready", aiOnly: false, result: { ...r, ai }, readyAt: cur.readyAt || Date.now() });
      return;
    }
    const city = cur.q.city;

    const raw = await apifyItems(cur.maps.datasetId, 500);
    const seen = new Set();
    const places = [];
    for (const p of raw) {
      const id = p.placeId || p.url || p.title;
      if (!id || seen.has(id) || !p.location?.lat) continue;
      seen.add(id);
      places.push({
        id, name: p.title, cat: p.categoryName || "", rating: p.totalScore || null, reviews: p.reviewsCount || 0,
        price: parseINR(p.price), priceLabel: p.price || "", lat: p.location.lat, lng: p.location.lng,
        url: p.url || "", area: areaName(p, city), placeId: p.placeId || "", amenities: amenitiesOf(p),
      });
    }
    if (!places.length) throw new Error("No stays found for this city on Google Maps.");

    let airbnb = [];
    if (cur.airbnb) {
      try {
        const a = await apifyItems(cur.airbnb.datasetId, 50);
        airbnb = a.map((x) => ({
          name: x.title, lat: x.coordinates?.latitude, lng: x.coordinates?.longitude,
          price: parseINR(x.price?.amount ?? x.price?.label), rating: x.rating?.guestSatisfaction || null,
          reviews: x.rating?.reviewsCount || 0, url: x.url,
        })).filter((x) => x.lat && x.lng);
      } catch {}
    }

    const center = { lat: places.reduce((t, p) => t + p.lat, 0) / places.length, lng: places.reduce((t, p) => t + p.lng, 0) / places.length };
    const poi = await pois(center);

    // group into areas; fold tiny groups into the nearest bigger one
    const groups = {};
    for (const p of places) (groups[p.area] ||= []).push(p);
    const centerOf = (arr) => ({ lat: arr.reduce((t, p) => t + p.lat, 0) / arr.length, lng: arr.reduce((t, p) => t + p.lng, 0) / arr.length });
    let names = Object.keys(groups);
    const big = names.filter((n) => groups[n].length >= 3);
    if (big.length >= 2) {
      for (const n of names) {
        if (groups[n].length >= 3) continue;
        for (const p of groups[n]) {
          let best = big[0], bd = Infinity;
          for (const b of big) { const d = km(p, centerOf(groups[b])); if (d < bd) { bd = d; best = b; } }
          if (bd <= 6) { p.area = best; groups[best].push(p); } else { (groups["Outskirts"] ||= []).push(p); p.area = "Outskirts"; }
        }
        delete groups[n];
      }
    }
    names = Object.keys(groups);

    const nearest = (c, type) => {
      let best = null;
      for (const q of poi.filter((x) => x.type === type)) { const d = km(c, q); if (best === null || d < best.km) best = { name: q.name, km: d }; }
      return best;
    };
    let areas = names.map((n) => {
      const arr = groups[n], c = centerOf(arr);
      const rated = arr.filter((p) => p.rating);
      const avgRating = rated.length ? Math.round((rated.reduce((t, p) => t + p.rating, 0) / rated.length) * 100) / 100 : null;
      const reviews = arr.reduce((t, p) => t + (p.reviews || 0), 0);
      const low = rated.length ? Math.round((rated.filter((p) => p.rating < 4).length / rated.length) * 100) : 0;
      const nearAir = airbnb.filter((x) => km(c, x) <= 3);
      const prices = [...arr.map((p) => p.price), ...nearAir.map((x) => x.price)].filter(Boolean);
      const maxD = Math.max(...arr.map((p) => km(c, p) || 0), 0.6);
      return {
        id: slug(n), name: n, lat: c.lat, lng: c.lng, radiusKm: Math.min(maxD, 4),
        stays: arr.length, reviews, reviewsPerStay: Math.round(reviews / arr.length), avgRating, lowRatedPct: low,
        medianPriceINR: median(prices), priceSamples: prices.length, airbnbNearby: nearAir.length,
        types: [...new Set(arr.map((p) => p.cat).filter(Boolean))].slice(0, 5),
        airport: nearest(c, "airport"), railway: nearest(c, "railway"), hospital: nearest(c, "hospital"),
        college: nearest(c, "college"), bus: nearest(c, "bus"),
        topPlaceIds: arr.filter((p) => p.placeId).sort((a, b) => b.reviews - a.reviews).slice(0, 6).map((p) => p.placeId),
      };
    });

    // score 0-100 within the city
    const norm = (vals, v) => { const mx = Math.max(...vals), mn = Math.min(...vals); return mx === mn ? 0.5 : (v - mn) / (mx - mn); };
    const rps = areas.map((a) => a.reviewsPerStay), tot = areas.map((a) => a.reviews), sup = areas.map((a) => a.stays);
    areas = areas.map((a) => {
      const demand = 0.6 * norm(rps, a.reviewsPerStay) + 0.4 * norm(tot, a.reviews);
      const gap = 1 - norm(sup, a.stays);
      const pain = a.avgRating ? Math.min(1, Math.max(0, (4.6 - a.avgRating) / 1.0)) * 0.6 + (a.lowRatedPct / 100) * 0.4 : 0.3;
      const access = [a.airport && a.airport.km <= 15, a.railway && a.railway.km <= 5, a.hospital && a.hospital.km <= 3, a.college && a.college.km <= 3].filter(Boolean).length / 4;
      const score = Math.round((0.35 * demand + 0.2 * gap + 0.25 * pain + 0.2 * access) * 100);
      const conf = a.stays >= 8 && a.reviews >= 300 ? "High" : a.stays >= 4 ? "Medium" : "Low";
      const tier = score >= 60 && conf !== "Low" ? "best" : score >= 40 ? "medium" : "worst";
      return { ...a, score, confidence: conf, tier };
    }).sort((x, y) => y.score - x.score).slice(0, 14);

    const allPrices = [...places.map((p) => p.price), ...airbnb.map((x) => x.price)].filter(Boolean);
    const summary = {
      city, state: cur.q.state, stays: places.length, airbnbListings: airbnb.length,
      avgRating: Math.round((places.filter((p) => p.rating).reduce((t, p) => t + p.rating, 0) / Math.max(1, places.filter((p) => p.rating).length)) * 100) / 100,
      medianPriceINR: median(allPrices), priceSamples: allPrices.length,
      types: Object.entries(places.reduce((m, p) => ((m[p.cat] = (m[p.cat] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 6),
    };

    const aiInput = aiInputFor(summary, areas, poi);
    let ai = null;
    try { ai = await aiJSON(SYSTEM, JSON.stringify(aiInput)); } catch (e) { ai = { headline: "AI analysis is unavailable right now. The numbers below are counted from live data.", error: e.message }; }

    const result = {
      summary, areas, ai,
      places: places.map(({ id, name, cat, rating, reviews, price, priceLabel, lat, lng, url, area, amenities }) => ({ id, name, cat, rating, reviews, price, priceLabel, lat, lng, url, area, amenities })),
      airbnb: airbnb.slice(0, 30),
      pois: poi.filter((p) => p.type !== "bus").slice(0, 120),
      center,
    };
    await s.setJSON(`city/${key}`, { ...cur, status: "ready", result, readyAt: Date.now() });
  } catch (e) {
    if (key) {
      const cur = (await s.get(`city/${key}`, { type: "json" })) || {};
      await s.setJSON(`city/${key}`, { ...cur, status: "failed", error: e.message });
    }
  }
};
