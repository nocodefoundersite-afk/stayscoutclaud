/*
 * Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. Not for use in training or supplying any AI system.
 *
 * Live data model. Shapes match what the Netlify Functions return (/api/city, /api/area).
 * Tokens for Apify and the AI gateway live only on the server.
 */

export type PropertyType = "Homestay" | "Hotel" | "Villa" | "Apartment" | "Hostel" | "Resort";
export const PROPERTY_TYPES: PropertyType[] = ["Homestay", "Hotel", "Villa", "Apartment", "Hostel", "Resort"];
export type TypeFilter = PropertyType | "All";

/* ---------------- India states & cities (location step) ---------------- */
export const COUNTRY = "India";
export const STATES: Record<string, string[]> = {
  "Andaman & Nicobar Islands": ["Port Blair", "Havelock Island"],
  "Andhra Pradesh": ["Visakhapatnam", "Tirupati", "Vijayawada", "Araku Valley"],
  "Arunachal Pradesh": ["Tawang", "Ziro", "Itanagar"],
  Assam: ["Guwahati", "Kaziranga", "Jorhat"],
  Bihar: ["Patna", "Bodh Gaya", "Rajgir"],
  Chandigarh: ["Chandigarh"],
  Chhattisgarh: ["Raipur", "Bastar"],
  "Dadra & Nagar Haveli and Daman & Diu": ["Daman", "Diu", "Silvassa"],
  Delhi: ["New Delhi", "South Delhi", "Aerocity"],
  Goa: ["Mapusa", "Panaji"],
  Gujarat: ["Ahmedabad", "Kutch", "Dwarka", "Somnath", "Vadodara"],
  Haryana: ["Gurugram", "Faridabad", "Panchkula"],
  "Himachal Pradesh": ["Manali", "Shimla", "Dharamshala", "Kasol"],
  "Jammu & Kashmir": ["Srinagar", "Gulmarg", "Pahalgam", "Katra"],
  Jharkhand: ["Ranchi", "Deoghar"],
  Karnataka: ["Bengaluru", "Coorg", "Mysuru", "Hampi", "Gokarna"],
  Kerala: ["Kochi", "Munnar", "Alleppey", "Varkala", "Wayanad"],
  Ladakh: ["Leh", "Nubra Valley"],
  Lakshadweep: ["Agatti"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Ujjain", "Khajuraho"],
  Maharashtra: ["Mumbai", "Pune", "Lonavala", "Mahabaleshwar", "Alibaug"],
  Manipur: ["Imphal"],
  Meghalaya: ["Shillong", "Cherrapunji"],
  Mizoram: ["Aizawl"],
  Nagaland: ["Kohima"],
  Odisha: ["Puri", "Bhubaneswar", "Konark"],
  Puducherry: ["Puducherry"],
  Punjab: ["Amritsar", "Ludhiana"],
  Rajasthan: ["Udaipur", "Jaipur", "Jaisalmer", "Jodhpur", "Pushkar"],
  Sikkim: ["Gangtok", "Pelling"],
  "Tamil Nadu": ["Chennai", "Ooty", "Kodaikanal", "Madurai"],
  Telangana: ["Hyderabad", "Warangal"],
  Tripura: ["Agartala"],
  "Uttar Pradesh": ["Varanasi", "Agra", "Lucknow", "Ayodhya"],
  Uttarakhand: ["Rishikesh", "Mussoorie", "Nainital", "Haridwar"],
  "West Bengal": ["Kolkata", "Darjeeling", "Kalimpong"],
};


/* ---------------- live result shapes ---------------- */
export type Near = { name: string; km: number | null } | null;

export type Facility = { name: string; n: number; pct: number };

export type LiveArea = {
  id: string; name: string; lat: number; lng: number; radiusKm: number;
  stays: number; reviews: number; reviewsPerStay: number; avgRating: number | null; lowRatedPct: number;
  medianPriceINR: number | null; priceSamples: number; airbnbNearby: number; types: string[];
  airport: Near; railway: Near; hospital: Near; college: Near; bus: Near;
  score: number; confidence: "High" | "Medium" | "Low"; tier: "best" | "medium" | "worst"; rank?: number; of?: number;
  /** Counted from the 1-5 star breakdown rather than estimated from the average. */
  unhappyPct?: number | null; reviewsSeen?: number;
  airbnbMedianINR?: number | null; otaMedianINR?: number | null; otaSamples?: number;
  avgStars?: number | null; open24?: number;
  facilitiesOf?: number; facilities?: Facility[];
  themes?: { title: string; n: number }[];
};

export type OtaPrice = { site: string; price: number; official?: boolean; url?: string };
export type Rival = { name: string; rating: number | null; reviews: number; price: number | null; note: string };

export type Place = {
  id: string; name: string; cat: string; cats?: string[]; rating: number | null; reviews: number;
  price?: number | null; priceLabel: string; priceFrom?: "google" | "ota" | null;
  lat: number; lng: number; url: string; area: string;
  amenities?: string[];
  /** Facilities Google explicitly says the place does NOT have. */
  missing?: string[];
  amenityGroups?: Record<string, string[]>;
  stars?: number | null; desc?: string;
  ota?: OtaPrice[]; otaPrice?: number | null; rivals?: Rival[];
  spread?: { one: number; two: number; three: number; four: number; five: number; total: number; unhappyPct: number } | null;
  unhappyPct?: number | null; themes?: string[];
  questions?: number; images?: number; open24?: boolean; phone?: string; website?: string;
};

export type AirbnbListing = {
  name: string; lat: number; lng: number; price: number | null; rating: number | null; reviews: number;
  url: string; roomType?: string; source?: string;
  sub?: { cleanliness: number | null; location: number | null; value: number | null; accuracy: number | null; checkin: number | null; communication: number | null };
  amenities?: string[]; capacity?: number | null; bedrooms?: number | null; beds?: number | null; baths?: number | null;
  superhost?: boolean; host?: string;
};

export type CityAI = {
  headline?: string;
  best_areas?: { area: string; why: string; price_range_inr: string; good_for: string }[];
  avoid_areas?: { area: string; why: string }[];
  pricing_by_location?: { location: string; areas: string[]; price_range_inr: string; who_stays: string; advice: string }[];
  demand_drivers?: string[];
  opportunities?: string[];
  must_match?: string[];
  channel_advice?: string;
  verdict?: string;
  error?: string;
};

export type CityResult = {
  summary: {
    city: string; state: string; stays: number; airbnbListings: number; avgRating: number | null; medianPriceINR: number | null;
    priceSamples: number; types: [string, number][];
    skippedNonStays?: number; landmarksAvailable?: boolean; convertedPrices?: number; usdRate?: number;
    /** How much of the picture each source filled in, so a thin city reads as thin rather than empty. */
    facilitiesFrom?: number; otaFrom?: number; reviewsSeen?: number; reviewsSampled?: number;
    airbnbWithAmenities?: number; starsFrom?: number;
    cityFacilities?: Facility[]; cityFacilitiesOf?: number;
  };
  areas: LiveArea[];
  ai: CityAI | null;
  places: Place[];
  airbnb: AirbnbListing[];
  pois: { type: string; name: string; lat: number; lng: number }[];
  poisAvailable?: boolean;
  center: { lat: number; lng: number };
};

export type AreaAI = {
  summary?: string;
  guests_love?: string[];
  problems?: { problem: string; mentions: string; fix: string; cost_inr: string; priority: "Must fix" | "Should fix" | "Nice to have" | string }[];
  website_lines?: string[];
  must_have_amenities?: string[];
  verdict?: "Open here" | "Open with care" | "Avoid" | string;
  verdict_reason?: string;
};
export type AreaResult = { area: string; reviewsAnalysed: number; places: number; ai: AreaAI };

/* ---------------- helpers ---------------- */
export const inr = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : (n < 0 ? "−₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN"));

/** Same slug rule as the server (netlify/lib/core.mjs). */
export const slug = (s: string) =>
  String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
export const cityKey = (city: string, state: string, country = COUNTRY) => slug(`${city}-${state}-${country}`);

export const median = (arr: (number | null | undefined)[]) => {
  const a = arr.filter((x): x is number => typeof x === "number" && isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
};

export const priceOf = (p: Place) => {
  if (typeof p.price === "number" && isFinite(p.price)) return p.price;
  const m = String(p.priceLabel || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([kK])?/);
  if (!m) return null;
  const n = parseFloat(m[1]) * (m[2] ? 1000 : 1);
  return n > 100 && n < 500000 ? Math.round(n) : null;
};

/** Map a Google Maps category to one of our property types. */
export function typeOf(cat: string): PropertyType | null {
  const c = (cat || "").toLowerCase();
  if (/hostel|dormitor/.test(c)) return "Hostel";
  if (/resort/.test(c)) return "Resort";
  if (/villa|cottage|farm ?stay|farmhouse|chalet|bungalow/.test(c)) return "Villa";
  if (/apartment|serviced|flat|condo/.test(c)) return "Apartment";
  if (/home ?stay|guest ?house|bed ?(&|and) ?breakfast|b&b|holiday home|lodging|vacation|rental/.test(c)) return "Homestay";
  if (/hotel|inn|motel|lodge|hotel/.test(c)) return "Hotel";
  return null;
}

export const placesIn = (r: CityResult, area: LiveArea, type: TypeFilter = "All") =>
  r.places.filter((p) => p.area === area.name && (type === "All" || typeOf(p.cat) === type));

/** Straight-line distance in km. */
export function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, t = (d: number) => (d * Math.PI) / 180;
  const dLat = t(b.lat - a.lat), dLng = t(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** Airbnb listings within 3 km of a locality: real per-night prices Google Maps often doesn't show. */
export const airbnbIn = (r: CityResult, area: LiveArea, withinKm = 3) =>
  (r.airbnb || []).filter((x) => isFinite(x.lat) && isFinite(x.lng) && kmBetween(area, x) <= withinKm);

/** Landmarks come from OpenStreetMap; when that lookup fails we say so instead of "none nearby". */
export const hasLandmarks = (r: CityResult) => r.poisAvailable !== false && (r.summary.landmarksAvailable ?? (r.pois?.length ?? 0) > 0);

export const rankScore = (p: Place) => (p.rating || 0) * Math.log10((p.reviews || 0) + 1);

/** Numbers for one area, counted only from properties of the chosen type. */
export function areaStats(r: CityResult, area: LiveArea, type: TypeFilter) {
  const list = placesIn(r, area, type);
  if (type === "All") {
    return { count: area.stays, price: area.medianPriceINR, priceSamples: area.priceSamples, rating: area.avgRating, reviews: area.reviews };
  }
  const rated = list.filter((p) => p.rating);
  const prices = list.map(priceOf);
  return {
    count: list.length,
    price: median(prices),
    priceSamples: prices.filter((x) => x != null).length,
    rating: rated.length ? Math.round((rated.reduce((t, p) => t + (p.rating || 0), 0) / rated.length) * 100) / 100 : null,
    reviews: list.reduce((t, p) => t + (p.reviews || 0), 0),
  };
}

/** Nightly price by booking channel, so an owner can see where the money actually is. */
export function priceChannels(r: CityResult, area?: LiveArea) {
  const list = area ? placesIn(r, area) : r.places;
  const near = area ? airbnbIn(r, area) : r.airbnb || [];
  const google = median(list.filter((p) => p.priceFrom !== "ota").map(priceOf));
  const ota = median(list.flatMap((p) => (p.ota || []).map((o) => o.price)));
  const air = median(near.map((x) => x.price));
  return {
    google, googleN: list.filter((p) => p.priceFrom !== "ota" && priceOf(p) != null).length,
    ota, otaN: list.reduce((t, p) => t + (p.ota?.length || 0), 0),
    airbnb: air, airbnbN: near.filter((x) => x.price != null).length,
  };
}

/** Facilities across a set of stays, counting Airbnb listings alongside Google's. */
export function facilityCoverage(places: Place[], airbnb: AirbnbListing[] = []) {
  const rows = [
    ...places.filter((p) => p.amenities?.length).map((p) => p.amenities as string[]),
    ...airbnb.filter((x) => x.amenities?.length).map((x) => x.amenities as string[]),
  ];
  const counts = new Map<string, number>();
  for (const list of rows) for (const a of new Set(list.map((x) => x.trim()).filter(Boolean))) counts.set(a, (counts.get(a) || 0) + 1);
  const items: Facility[] = [...counts.entries()]
    .map(([name, n]) => ({ name, n, pct: Math.round((n / Math.max(1, rows.length)) * 100) }))
    .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
  return {
    of: rows.length,
    items,
    /** Under 40%: few competitors offer it, so it is a way to stand out. */
    gaps: items.filter((f) => f.pct < 40 && f.n >= 2).slice(0, 12),
    /** Over 80%: guests expect it, so a new property has to match it. */
    stakes: items.filter((f) => f.pct >= 80).slice(0, 12),
  };
}

/** Competitors Google itself lists next to each stay, with how their price compares. */
export function rivalsIn(places: Place[]) {
  const seen = new Map<string, Rival>();
  for (const p of places) for (const r of p.rivals || []) if (r.name && !seen.has(r.name)) seen.set(r.name, r);
  return [...seen.values()].sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
}

export const tierLabel = (t: LiveArea["tier"]) => (t === "best" ? "Strong" : t === "medium" ? "Mixed" : "Weak");
export const nearLine = (a: LiveArea) =>
  [a.airport && `Airport ${a.airport.km} km`, a.railway && `Station ${a.railway.km} km`, a.hospital && `Hospital ${a.hospital.km} km`, a.college && `College ${a.college.km} km`]
    .filter(Boolean).join(" · ");

export const AMENITY_CATALOG = [
  "Wi-Fi", "Air conditioning", "Power backup", "Hot water", "Kitchen", "Parking", "Breakfast", "Work desk",
  "24/7 check-in", "Private pool", "Swimming pool", "Lift", "Washing machine", "Window mesh", "Sea view",
  "Pet friendly", "Airport transfer", "CCTV at entrance",
];

const LISTING_LINES: [RegExp, string][] = [
  [/power/i, "Power backup keeps the AC, fans and Wi-Fi running during outages."],
  [/noise|market|event/i, "Bedrooms are soundproofed and face away from the street for quiet nights."],
  [/highway/i, "Bedrooms face away from the road, with double-glazed windows."],
  [/clean/i, "Every stay is cleaned to a checklist, with photos taken before you arrive."],
  [/parking/i, "A parking spot is reserved for you, at no extra cost."],
  [/find|dark|lane/i, "We send an exact map pin and a short arrival video before check-in, and the path is lit at night."],
  [/mosquito/i, "Windows have mesh screens and every bed has a mosquito net."],
  [/water/i, "A pressure pump and backup tank give you steady water all day."],
  [/hidden|charge/i, "One all-inclusive price. No extra charges at check-in."],
  [/taxi/i, "We share a trusted driver's number and can arrange scooter rental."],
  [/stair/i, "We mention stairs clearly and help carry your luggage."],
  [/dated/i, "Bathrooms, lighting and linen were recently refreshed."],
  [/small room/i, "Room sizes are stated upfront, with space-saving furniture."],
  [/food/i, "Breakfast is served, and we share a list of places that deliver."],
  [/traffic|crowd/i, "We point you to quieter lanes, quieter beach times and pickup options."],
  [/far from beach/i, "Scooter rental can be arranged for easy beach trips."],
];
export const listingLineFor = (theme: string, fix?: string) =>
  LISTING_LINES.find(([re]) => re.test(theme))?.[1] ?? (fix ? `${theme}: ${fix.replace(/\.$/, "")}, so it won't affect your stay.` : `We've taken care of a common local issue: ${theme.toLowerCase()}.`);

