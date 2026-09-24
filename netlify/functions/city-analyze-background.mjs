/*
 * Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. Not for use in training or supplying any AI system.
 *
 * Background job: turns collected stays into areas, scores them, adds airports/stations/hospitals/colleges
 * (OpenStreetMap), and asks the AI for best areas, pricing by location and a verdict.
 */
import { store, apifyItems, aiJSON, km, priceToINR, median, slug, usdToInr } from "../lib/core.mjs";

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/** Google Maps searches also return non-stays (a zoo, a travel agent). Only real places to stay count. */
const STAY_CAT = /hotel|hostel|motel|inn\b|lodge|lodging|resort|guest ?house|home ?stay|bed ?(&|and) ?breakfast|b&b|villa|cottage|apartment|serviced|farm ?stay|holiday|vacation rental|camp|haveli|dharamshala|dormitory|house/i;
const NOT_STAY = /zoo|travel agency|tour operator|real estate|restaurant|cafe|coffee|bar\b|museum|temple|hospital|school|college|university|shop|store|wedding|banquet|event|corporate office|construction|builder|association|apartment (building|complex)|condominium|residential|housing|gym|fitness|spa\b|salon|parking|atm\b|bank\b|clinic|pharmacy|market|mall|cinema|theatre|theater|club\b|hall\b|agency|consultant|contractor|furniture|interior/i;
export const isStay = (cat) => !!cat && STAY_CAT.test(cat) && !NOT_STAY.test(cat);

const SYSTEM = `You are a hospitality location strategist for India.
You get a city's stays grouped into areas with counted numbers, plus nearby airports, railway stations, hospitals and colleges.
Use ONLY the numbers given. Never invent numbers, prices, places or facts.
When an area has median_price_inr, quote a range around it; only say "not enough price data" when median_price_inr is null.
When km_to_airport, km_to_railway, km_to_hospital and km_to_college are all null, landmarks were unavailable: skip pricing_by_location rows that depend on them instead of guessing.
For demand_drivers, use what the numbers show (review volume, which areas draw the most reviews per stay, the mix of stay types); write "not enough data" only if there is truly nothing.
facilities_pct is the share of stays offering each facility. A facility under 40% is a gap a new property can win on; a facility over 80% is table stakes it must match. Name the actual facilities.
unhappy_pct is the counted share of 1 and 2 star reviews. Use it for pain, and quote it.
Where booking_site_median_inr and airbnb_median_inr are both present, say which channel prices higher and what that means for the owner.
Write simple English, short sentences. Return JSON exactly:
{
 "headline": "one sentence: the best place to open in this city and why",
 "best_areas": [{"area":"", "why":"2 short lines using the numbers", "price_range_inr":"e.g. 2,500-3,500 or not enough price data", "good_for":"which property type fits"}],
 "avoid_areas": [{"area":"", "why":""}],
 "pricing_by_location": [{"location":"Near airport|Near railway station|Near hospital|Near college|City centre / tourist area", "areas":["..."], "price_range_inr":"", "who_stays":"", "advice":"one line"}],
 "demand_drivers": ["what brings guests to this city, from the data"],
 "opportunities": ["gaps a new property can win: name the facility and its percentage, e.g. 'only 22% offer airport pickup'"],
 "must_match": ["facilities over 80% of stays already offer, which a new property has to have"],
 "channel_advice": "one or two lines on booking-site vs Airbnb pricing in this city, or \\"not enough data\\"",
 "verdict": "2-3 sentences: open here, open with care there, avoid there"
}
Give 3 best_areas at most, 3 avoid_areas at most, up to 5 opportunities, up to 5 must_match, and only pricing_by_location rows that the data supports.`;

async function overpass(query) {
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "StayScout/1.0 (stayscoutclaud.netlify.app)" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(40000),
      });
      if (!r.ok) { console.error(`[pois] ${url} -> ${r.status}`); continue; }
      const j = await r.json();
      if (Array.isArray(j.elements)) return j.elements;
    } catch (e) {
      console.error(`[pois] ${url} failed: ${String(e.message).slice(0, 120)}`);
    }
  }
  return null; // every mirror failed: the caller says so instead of showing "none nearby"
}

/** Airports, stations, hospitals and colleges around the city, from OpenStreetMap. */
async function pois(center) {
  const { lat, lng } = center;
  const q = `[out:json][timeout:60];(
    nwr["aeroway"="aerodrome"]["name"](around:70000,${lat},${lng});
    nwr["railway"="station"]["name"](around:25000,${lat},${lng});
    nwr["public_transport"="station"]["train"="yes"]["name"](around:25000,${lat},${lng});
    nwr["amenity"="hospital"]["name"](around:20000,${lat},${lng});
    nwr["amenity"~"^(college|university)$"]["name"](around:20000,${lat},${lng});
    nwr["amenity"="bus_station"]["name"](around:20000,${lat},${lng});
  );out center 400;`;
  const elements = await overpass(q);
  if (elements === null) return null;
  return elements
    .map((e) => {
      const t = e.tags || {};
      const type = t.aeroway ? "airport"
        : t.railway === "station" || t.train === "yes" ? "railway"
        : t.amenity === "hospital" ? "hospital"
        : t.amenity === "bus_station" ? "bus"
        : "college";
      return { type, name: t["name:en"] || t.name || type, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon };
    })
    .filter((p) => p.lat && p.lng && p.name);
}

/* Google puts a hotel's facilities in additionalInfo, split into sections that vary by property
   ("Amenities", "Hotel highlights", "Wellness", "Internet", "Accessibility", "Policies"...).
   Guessing the section names loses most of them, so every section is read. A false value is
   useful too: Google is stating the place does NOT have that, which is exactly a gap to fill. */
const SKIP_SECTION = /^(payments?|from the business|crowd|atmosphere|popular for|dining options|offerings)$/i;
export function facilitiesOf(p) {
  const has = [], lacks = [], groups = {};
  for (const [section, items] of Object.entries(p.additionalInfo || {})) {
    if (!Array.isArray(items) || SKIP_SECTION.test(section.trim())) continue;
    for (const it of items) {
      for (const [k, v] of Object.entries(it || {})) {
        const name = String(k).trim();
        if (!name || name.length > 48) continue;
        if (v === true) { has.push(name); (groups[section] ||= []).push(name); }
        else if (v === false) lacks.push(name);
      }
    }
  }
  return { has: [...new Set(has)].slice(0, 60), lacks: [...new Set(lacks)].slice(0, 30), groups };
}

/** "4-star hotel" -> 4 */
export const starsOf = (v) => { const m = /(\d(?:\.\d)?)\s*-?\s*star/i.exec(String(v || "")); return m ? Number(m[1]) : null; };

/** Prices Google shows from Booking.com, Agoda, Expedia and the hotel's own site. */
export function otaOf(p) {
  const out = [];
  for (const ad of p.hotelAds || []) {
    const inr = priceToINR(ad.price);
    if (!inr) continue;
    out.push({ site: String(ad.title || (ad.isOfficialSite ? "Official site" : "Booking site")).slice(0, 40), price: inr, official: !!ad.isOfficialSite, url: ad.url || ad.googleUrl || "" });
  }
  return out.slice(0, 8);
}

/** Google's own "similar hotels nearby" list: a ready-made competitor set with price gaps. */
export function rivalsOf(p) {
  return (p.similarHotelsNearby || [])
    .map((h) => ({ name: String(h.name || "").slice(0, 60), rating: h.rating ?? null, reviews: h.reviews ?? 0, price: priceToINR(h.price), note: String(h.description || "").slice(0, 60) }))
    .filter((h) => h.name)
    .slice(0, 6);
}

/** The real 1-5 star split, instead of guessing unhappy guests from the average. */
export function spreadOf(p) {
  const d = p.reviewsDistribution;
  if (!d) return null;
  const n = ["oneStar", "twoStar", "threeStar", "fourStar", "fiveStar"].map((k) => Number(d[k]) || 0);
  const total = n.reduce((a, b) => a + b, 0);
  if (!total) return null;
  return { one: n[0], two: n[1], three: n[2], four: n[3], five: n[4], total, unhappyPct: Math.round(((n[0] + n[1]) / total) * 100) };
}

const tagsOf = (p) => (p.reviewsTags || []).map((t) => (typeof t === "string" ? { title: t, count: 0 } : { title: String(t.title || "").slice(0, 40), count: Number(t.count) || 0 })).filter((t) => t.title).slice(0, 12);

/** A few newest reviews per stay, so complaints show up city-wide instead of only where you drill in. */
const reviewsOf = (p) => (p.reviews || [])
  .map((r) => ({ stars: Number(r.stars) || null, text: String(r.text || r.textTranslated || "").replace(/\s+/g, " ").slice(0, 300), when: r.publishedAtDate || r.publishAt || "" }))
  .filter((r) => r.text)
  .slice(0, 6);

/** Reception desk open round the clock, from opening hours. */
const alwaysOpen = (p) => { const h = p.openingHours || []; return h.length >= 5 && h.every((d) => /24\s*hours|open 24/i.test(String(d.hours || ""))); };

const ROAD = /\b(road|rd\.?|marg|street|st\.?|lane|gali|highway|nh\d|bypass|circle|chauraha|crossing|near|opp\.?|behind|beside|plot|flat|floor|building|tower|no\.?)\b/i;

/** One short locality name per stay. Google's neighbourhood field often lists several, so the first is used. */
function areaName(p, city) {
  const clean = (x) => String(x || "").replace(/\s+/g, " ").trim().replace(/^[-,]+|[-,]+$/g, "");
  const cityRe = new RegExp(`^(india|${(city || "").replace(/[^a-z ]/gi, "")}|\\d+|.*\\d{6}.*)$`, "i");
  const ok = (x) => x && x.length > 2 && x.length < 28 && !cityRe.test(x) && !ROAD.test(x);
  if (p.neighborhood) {
    const first = clean(String(p.neighborhood).split(",")[0]);
    if (ok(first)) return first;
  }
  const parts = String(p.address || "").split(",").map(clean).filter(Boolean);
  const cand = parts.slice(0, -1).reverse().find(ok);
  return cand || clean(p.city) || "Other";
}

function aiInputFor(summary, areas, poi) {
  return {
    city: {
      ...summary,
      // Facilities across the whole city, as "how many of the stays that list facilities offer this".
      facilities_pct: (summary.cityFacilities || []).map((f) => `${f.name}: ${f.pct}%`),
    },
    areas: areas.map((a) => ({
      area: a.name, score: a.score, tier: a.tier, confidence: a.confidence, stays: a.stays, total_reviews: a.reviews,
      reviews_per_stay: a.reviewsPerStay, avg_rating: a.avgRating, low_rated_pct: a.lowRatedPct,
      unhappy_pct: a.unhappyPct, reviews_counted: a.reviewsSeen,
      median_price_inr: a.medianPriceINR, price_samples: a.priceSamples,
      booking_site_median_inr: a.otaMedianINR, airbnb_median_inr: a.airbnbMedianINR, airbnb_nearby: a.airbnbNearby,
      avg_hotel_stars: a.avgStars, stays_open_24h: a.open24, types: a.types,
      facilities_pct: (a.facilities || []).slice(0, 20).map((f) => `${f.name}: ${f.pct}%`),
      facilities_measured_on: a.facilitiesOf,
      guest_themes: (a.themes || []).map((t) => t.title),
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

    const raw = await apifyItems(cur.maps.datasetId, 1200);
    const seen = new Set();
    const places = [];
    let skipped = 0;
    for (const p of raw) {
      const id = p.placeId || p.url || p.title;
      if (!id || seen.has(id) || !p.location?.lat) continue;
      seen.add(id);
      // categoryName is one label; categories holds the rest, and a stay is often only tagged on the second.
      const cats = [...new Set([p.categoryName, ...(p.categories || [])].filter(Boolean).map(String))];
      const cat = cats.find(isStay) || p.categoryName || "";
      if (!cats.some(isStay)) { skipped++; continue; } // a zoo or a travel agent is not a place to stay
      const fac = facilitiesOf(p);
      const ota = otaOf(p);
      const spread = spreadOf(p);
      const gPrice = priceToINR(p.price);
      const otaMedian = median(ota.map((o) => o.price));
      places.push({
        id, name: p.title, cat, cats: cats.slice(0, 4), rating: p.totalScore || null, reviews: p.reviewsCount || 0,
        // Google's own price bracket is often missing; a booking-site price is a real nightly rate.
        price: gPrice ?? otaMedian, priceLabel: String(p.price ?? ""), priceFrom: gPrice ? "google" : otaMedian ? "ota" : null,
        lat: p.location.lat, lng: p.location.lng, url: p.url || "", area: areaName(p, city), placeId: p.placeId || "",
        amenities: fac.has, missing: fac.lacks, amenityGroups: fac.groups,
        stars: starsOf(p.hotelStars), desc: String(p.hotelDescription || "").replace(/\s+/g, " ").slice(0, 400),
        ota, otaPrice: otaMedian, rivals: rivalsOf(p), spread, unhappyPct: spread?.unhappyPct ?? null,
        tags: tagsOf(p), sample: reviewsOf(p), questions: (p.questionsAndAnswers || []).length,
        images: Number(p.imagesCount) || 0, open24: alwaysOpen(p),
        phone: p.phone || "", website: p.website || "",
      });
    }
    if (!places.length) throw new Error("No stays found for this city on Google Maps.");
    const withFacilities = places.filter((p) => p.amenities.length).length;
    const withOta = places.filter((p) => p.ota.length).length;
    console.log(`[city] ${city}: ${places.length} stays kept, ${skipped} non-stays skipped, ${withFacilities} with facilities, ${withOta} with booking-site prices`);
    if (!withFacilities) console.error(`[city] ${city}: no facilities on any stay — is scrapePlaceDetailPage on?`);

    let airbnb = [];
    if (cur.airbnb) {
      try {
        const a = await apifyItems(cur.airbnb.datasetId, 500);
        const nights = Number(cur.airbnbNights) || 1;
        airbnb = a.map((x) => {
          // price.amount covers the whole stay; the per-night rate is what compares with hotel prices.
          const perNight = priceToINR(x.price?.rate?.amount ?? x.price?.rate?.label);
          const total = priceToINR(x.price?.amount ?? x.price?.label ?? x.pricing?.rate?.amount);
          // Airbnb groups facilities by room ("Bathroom", "Kitchen", "Entertainment"); flatten to names.
          const am = [];
          for (const g of x.amenities || []) {
            if (typeof g === "string") { am.push(g); continue; }
            for (const v of g.values || g.items || []) am.push(String(v?.title ?? v?.name ?? v).slice(0, 48));
          }
          const r = x.rating || {};
          return {
            name: x.title, lat: x.coordinates?.latitude, lng: x.coordinates?.longitude,
            price: perNight ?? (total != null ? Math.round(total / nights) : null),
            rating: r.guestSatisfaction || null, reviews: r.reviewsCount || 0,
            // Sub-scores say WHY a listing wins, which a single star average hides.
            sub: { cleanliness: r.cleanliness ?? null, location: r.location ?? null, value: r.value ?? null, accuracy: r.accuracy ?? null, checkin: r.checkin ?? null, communication: r.communication ?? null },
            url: x.url, roomType: x.roomType || "", source: "Airbnb",
            amenities: [...new Set(am.filter(Boolean))].slice(0, 40),
            capacity: x.personCapacity ?? null, bedrooms: x.bedrooms ?? null, beds: x.beds ?? null, baths: x.baths ?? x.bathrooms ?? null,
            superhost: !!(x.host?.isSuperHost ?? x.isSuperhost), host: String(x.host?.name || "").slice(0, 40),
          };
        }).filter((x) => x.lat && x.lng);
      } catch {}
    }

    const center = { lat: places.reduce((t, p) => t + p.lat, 0) / places.length, lng: places.reduce((t, p) => t + p.lng, 0) / places.length };
    const poiRaw = await pois(center);
    const poiFailed = poiRaw === null;
    const poi = poiRaw || [];
    if (poiFailed) console.error("[city] OpenStreetMap landmarks unavailable for " + city);

    // group into areas; fold tiny groups into the nearest bigger one
    const groups = {};
    for (const p of places) (groups[p.area] ||= []).push(p);
    const centerOf = (arr) => ({ lat: arr.reduce((t, p) => t + p.lat, 0) / arr.length, lng: arr.reduce((t, p) => t + p.lng, 0) / arr.length });
    let names = Object.keys(groups);
    const MIN_STAYS = 2, MERGE_KM = 2.5;
    const big = names.filter((n) => groups[n].length >= MIN_STAYS);
    if (big.length >= 2) {
      for (const n of names) {
        if (groups[n].length >= MIN_STAYS) continue;
        for (const p of groups[n]) {
          let best = null, bd = Infinity;
          for (const b of big) { const d = km(p, centerOf(groups[b])); if (d !== null && d < bd) { bd = d; best = b; } }
          if (best && bd <= MERGE_KM) { p.area = best; groups[best].push(p); }
          else { (groups["Other parts of " + city] ||= []).push(p); p.area = "Other parts of " + city; }
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
    /** How many stays in a group offer each facility, as a share — that is the gap a new property fills. */
    const coverage = (arr) => {
      const withData = arr.filter((p) => p.amenities.length);
      if (!withData.length) return { of: 0, list: [] };
      const count = {};
      for (const p of withData) for (const a of new Set(p.amenities)) count[a] = (count[a] || 0) + 1;
      const list = Object.entries(count)
        .map(([name, n]) => ({ name, n, pct: Math.round((n / withData.length) * 100) }))
        .sort((a, b) => b.n - a.n).slice(0, 40);
      return { of: withData.length, list };
    };
    /** What guests keep mentioning, from Google's own review tags plus the sampled reviews. */
    const themes = (arr) => {
      const count = {};
      for (const p of arr) for (const t of p.tags) count[t.title.toLowerCase()] = (count[t.title.toLowerCase()] || 0) + (t.count || 1);
      return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([title, n]) => ({ title, n }));
    };
    let areas = names.map((n) => {
      const arr = groups[n], c = centerOf(arr);
      const rated = arr.filter((p) => p.rating);
      const avgRating = rated.length ? Math.round((rated.reduce((t, p) => t + p.rating, 0) / rated.length) * 100) / 100 : null;
      const reviews = arr.reduce((t, p) => t + (p.reviews || 0), 0);
      // Real 1-2 star share across every review in the locality, weighted by review count.
      const spreads = arr.map((p) => p.spread).filter(Boolean);
      const seen = spreads.reduce((t, s) => t + s.total, 0);
      const unhappy = seen ? Math.round((spreads.reduce((t, s) => t + s.one + s.two, 0) / seen) * 100) : null;
      const low = rated.length ? Math.round((rated.filter((p) => p.rating < 4).length / rated.length) * 100) : 0;
      const nearAir = airbnb.filter((x) => km(c, x) <= 3);
      const prices = [...arr.map((p) => p.price), ...nearAir.map((x) => x.price)].filter(Boolean);
      const otaPrices = arr.flatMap((p) => p.ota.map((o) => o.price)).filter(Boolean);
      const maxD = Math.max(...arr.map((p) => km(c, p) || 0), 0.6);
      const cov = coverage(arr);
      const starred = arr.map((p) => p.stars).filter(Boolean);
      return {
        id: slug(n), name: n, lat: c.lat, lng: c.lng, radiusKm: Math.min(maxD, 4),
        stays: arr.length, reviews, reviewsPerStay: Math.round(reviews / arr.length), avgRating, lowRatedPct: low,
        unhappyPct: unhappy, reviewsSeen: seen,
        medianPriceINR: median(prices), priceSamples: prices.length, airbnbNearby: nearAir.length,
        airbnbMedianINR: median(nearAir.map((x) => x.price)),
        otaMedianINR: median(otaPrices), otaSamples: otaPrices.length,
        avgStars: starred.length ? Math.round((starred.reduce((a, b) => a + b, 0) / starred.length) * 10) / 10 : null,
        facilitiesOf: cov.of, facilities: cov.list, themes: themes(arr),
        open24: arr.filter((p) => p.open24).length,
        types: [...new Set(arr.map((p) => p.cat).filter(Boolean))].slice(0, 5),
        airport: nearest(c, "airport"), railway: nearest(c, "railway"), hospital: nearest(c, "hospital"),
        college: nearest(c, "college"), bus: nearest(c, "bus"),
        topPlaceIds: arr.filter((p) => p.placeId).sort((a, b) => b.reviews - a.reviews).slice(0, 6).map((p) => p.placeId),
      };
    });

    /* Score 0-100 comparing localities inside this one city.
       Access only counts when OpenStreetMap answered; otherwise its weight is shared by the rest,
       so a missing landmark lookup can't quietly mark every locality down. */
    const norm = (vals, v) => { const mx = Math.max(...vals), mn = Math.min(...vals); return mx === mn ? 0.5 : (v - mn) / (mx - mn); };
    const rps = areas.map((a) => a.reviewsPerStay), tot = areas.map((a) => a.reviews), sup = areas.map((a) => a.stays);
    const W = poi.length ? { demand: 0.35, gap: 0.2, pain: 0.25, access: 0.2 } : { demand: 0.44, gap: 0.25, pain: 0.31, access: 0 };
    areas = areas.map((a) => {
      const demand = 0.6 * norm(rps, a.reviewsPerStay) + 0.4 * norm(tot, a.reviews);
      const gap = 1 - norm(sup, a.stays);
      // Prefer the counted 1-2 star share; fall back to the average only where no breakdown came back.
      const pain = a.unhappyPct != null
        ? Math.min(1, a.unhappyPct / 25) * 0.7 + (a.avgRating ? Math.min(1, Math.max(0, (4.6 - a.avgRating) / 1.0)) : 0.3) * 0.3
        : a.avgRating ? Math.min(1, Math.max(0, (4.6 - a.avgRating) / 1.0)) * 0.6 + (a.lowRatedPct / 100) * 0.4 : 0.3;
      const access = W.access
        ? [a.airport && a.airport.km <= 15, a.railway && a.railway.km <= 5, a.hospital && a.hospital.km <= 3, a.college && a.college.km <= 3].filter(Boolean).length / 4
        : 0;
      const score = Math.round((W.demand * demand + W.gap * gap + W.pain * pain + W.access * access) * 100);
      const conf = a.stays >= 8 && a.reviews >= 300 ? "High" : a.stays >= 4 ? "Medium" : "Low";
      return { ...a, score, confidence: conf };
    }).sort((x, y) => y.score - x.score).slice(0, 14);
    // Tiers rank localities against each other in this city: the best third is strong, the worst third weak.
    areas = areas.map((a, i) => ({
      ...a,
      rank: i + 1,
      of: areas.length,
      tier: areas.length < 3 ? "medium" : i < Math.ceil(areas.length / 3) ? "best" : i < Math.ceil((areas.length * 2) / 3) ? "medium" : "worst",
    }));

    const allPrices = [...places.map((p) => p.price), ...airbnb.map((x) => x.price)].filter(Boolean);
    const usdPrices = places.filter((p) => /\$/.test(p.priceLabel)).length;
    const reviewsSeen = places.reduce((t, p) => t + (p.spread?.total || 0), 0);
    const cityCoverage = coverage(places);
    const summary = {
      city, state: cur.q.state, stays: places.length, airbnbListings: airbnb.length, skippedNonStays: skipped,
      landmarksAvailable: !poiFailed, convertedPrices: usdPrices, usdRate: usdToInr(),
      avgRating: Math.round((places.filter((p) => p.rating).reduce((t, p) => t + p.rating, 0) / Math.max(1, places.filter((p) => p.rating).length)) * 100) / 100,
      medianPriceINR: median(allPrices), priceSamples: allPrices.length,
      types: Object.entries(places.reduce((m, p) => ((m[p.cat] = (m[p.cat] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 6),
      // Coverage counts: how much of the picture each source actually filled in, so gaps are visible
      // on the page instead of looking like "this city has nothing".
      facilitiesFrom: withFacilities, otaFrom: withOta, reviewsSeen,
      reviewsSampled: places.reduce((t, p) => t + p.sample.length, 0),
      airbnbWithAmenities: airbnb.filter((x) => x.amenities.length).length,
      starsFrom: places.filter((p) => p.stars).length,
      cityFacilities: cityCoverage.list.slice(0, 30), cityFacilitiesOf: cityCoverage.of,
    };

    const aiInput = aiInputFor(summary, areas, poi);
    let ai = null;
    try { ai = await aiJSON(SYSTEM, JSON.stringify(aiInput)); } catch (e) { ai = { headline: "AI analysis is unavailable right now. The numbers below are counted from live data.", error: e.message }; }

    const result = {
      summary, areas, ai,
      // Review text stays on the server: it feeds the analysis, it is not ours to republish.
      places: places.map(({ sample, tags, ...p }) => ({ ...p, themes: tags.map((t) => t.title).slice(0, 6) })),
      airbnb,
      pois: poi.filter((p) => p.type !== "bus").slice(0, 200),
      poisAvailable: !poiFailed,
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
