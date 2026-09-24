/*
 * Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. Unauthorised copying, modification, distribution,
 * public display, or use of this file, in whole or in part, via any medium, is
 * strictly prohibited without prior written permission. This code, its logic,
 * data and outputs may not be used to train, fine-tune, or supply content to any
 * artificial intelligence or machine learning model or service.
 */
import { getStore } from "@netlify/blobs";

export const store = () => getStore({ name: "stayscout", consistency: "strong" });

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const readVar = (n) => String(Netlify.env.get(n) ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
/** Reads the first set variable, ignoring stray spaces, line breaks or quotes pasted with the value. */
export const env = (...names) => {
  for (const n of names) {
    const v = readVar(n);
    if (v) return v;
  }
  return "";
};
/** Every distinct value found under these names, so an old key left behind doesn't block a new one. */
export const envAll = (...names) => [...new Set(names.map(readVar).filter(Boolean))];

export const slug = (s) =>
  String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);

export const WEEK_MS = 7 * 24 * 3600 * 1000;

/* ---------- Apify (async runs, polled) ---------- */
const APIFY = "https://api.apify.com/v2";
const apifyToken = () => env("APIFY_TOKEN", "APIFY_API_TOKEN", "ApifyToken", "Apify", "APIFY");

export async function apifyStart(actor, input) {
  const token = apifyToken();
  if (!token) throw new Error("Apify key missing. Add APIFY_TOKEN in Netlify → Environment variables.");
  const r = await fetch(`${APIFY}/acts/${actor}/runs`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Apify start failed (${r.status}): ${body?.error?.message || "unknown error"}`);
  return { runId: body.data.id, datasetId: body.data.defaultDatasetId };
}

export async function apifyStatus(runId) {
  const r = await fetch(`${APIFY}/actor-runs/${runId}`, { headers: { authorization: `Bearer ${apifyToken()}` } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Apify status failed (${r.status})`);
  return body.data.status; // READY, RUNNING, SUCCEEDED, FAILED, ABORTED, TIMED-OUT
}

export async function apifyItems(datasetId, limit = 100) {
  const r = await fetch(`${APIFY}/datasets/${datasetId}/items?clean=true&format=json&limit=${limit}`, {
    headers: { authorization: `Bearer ${apifyToken()}` },
  });
  if (!r.ok) throw new Error(`Apify dataset read failed (${r.status})`);
  return r.json();
}

/* ---------- Sign-in check (Netlify Identity) ---------- */
export async function requireUser(req) {
  const h = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/.test(h)) {
    const e = new Error("Sign in to run a new analysis.");
    e.status = 401;
    throw e;
  }
  const r = await fetch(`${new URL(req.url).origin}/.netlify/identity/user`, { headers: { authorization: h } });
  if (!r.ok) {
    const e = new Error("Your session has expired. Sign in again.");
    e.status = 401;
    throw e;
  }
  const u = await r.json();
  return { id: u.id, email: u.email };
}

/* ---------- Monthly budget guards (protect free credit): whole site + each account ---------- */
export async function useBudget(user) {
  const cap = Number(env("APIFY_MAX_RUNS_PER_MONTH") || 40);
  const userCap = Number(env("USER_MAX_RUNS_PER_MONTH") || 10);
  const month = new Date().toISOString().slice(0, 7);
  const s = store();
  const u = (await s.get("usage/apify", { type: "json" })) || {};
  const runs = u.month === month ? u.runs || 0 : 0;
  if (runs >= cap) {
    const e = new Error(`StayScout has used this month's data budget (${cap} fetches). It resets on the 1st.`);
    e.status = 429;
    throw e;
  }
  let mine = 0;
  const ukey = user ? `usage/users/${slug(user.id)}` : null;
  if (ukey) {
    const m = (await s.get(ukey, { type: "json" })) || {};
    mine = m.month === month ? m.runs || 0 : 0;
    if (mine >= userCap) {
      const e = new Error(`You've used your ${userCap} data fetches for this month. They reset on the 1st.`);
      e.status = 429;
      throw e;
    }
    await s.setJSON(ukey, { month, runs: mine + 1 });
  }
  await s.setJSON("usage/apify", { month, runs: runs + 1 });
  return { month, runs: runs + 1, cap, mine: mine + 1, userCap };
}

/* ---------- AI (OpenAI-compatible) ----------
 * Order: AI_BASE_URL gateway (e.g. Bifrost) if set, otherwise Google Gemini; then Groq as a backup.
 * Keys never leave the server. Detailed provider errors go to the function log; people see a plain sentence.
 */
const errText = (body) => {
  const b = Array.isArray(body) ? body[0] : body;
  return String(b?.error?.message || b?.message || b?.error || JSON.stringify(body || {}).slice(0, 200));
};

async function chat(p, key, model, system, user, jsonMode) {
  const r = await fetch(`${p.base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(errText(body));
    e.status = r.status;
    throw e;
  }
  return String(body?.choices?.[0]?.message?.content || "");
}

function parseJSON(text) {
  const t = text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "").trim();
  try { return JSON.parse(t); } catch { /* try the outermost object */ }
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  const e = new Error("unreadable answer");
  e.status = 422;
  throw e;
}

const keyProblem = (e) => e.status === 401 || e.status === 403 || /api key|api_key|unauthori[sz]ed|invalid.*key|permission denied/i.test(e.message || "");

export async function aiJSON(system, user) {
  const providers = [];
  const geminiKeys = envAll("AI_API_KEY", "GEMINI_API_KEY", "Gemini", "GEMINI", "gemini", "GeminiAPIKey", "GemAPIKey", "GEMAPIKEY", "GEMINI_KEY");
  const gateway = env("AI_BASE_URL");
  if (gateway) providers.push({ name: "AI gateway", base: gateway, keys: geminiKeys, models: [env("AI_MODEL") || "gemini-2.5-flash"] });
  else if (geminiKeys.length) providers.push({ name: "Gemini", base: "https://generativelanguage.googleapis.com/v1beta/openai", keys: geminiKeys, models: [env("AI_MODEL") || "gemini-2.5-flash"] });
  const groqKeys = envAll("GROQ_API_KEY", "gROQcLOUD", "GROQCLOUD", "GroqCloud", "groqcloud", "GROQ");
  if (groqKeys.length) providers.push({ name: "Groq", base: "https://api.groq.com/openai/v1", keys: groqKeys, models: [env("GROQ_MODEL") || "openai/gpt-oss-120b", "llama-3.3-70b-versatile"] });
  if (!providers.length) {
    console.error("[ai] no AI key configured");
    throw new Error("AI analysis isn’t set up yet: no AI key is configured for StayScout.");
  }

  const problems = [];
  for (const p of providers) {
    // Several keys can be saved for the same provider (an old one left behind, a new one added): try each.
    for (let i = 0; i < p.keys.length; i++) {
      const key = p.keys[i];
      let badKey = false;
      for (const model of p.models) {
        try {
          let text;
          try { text = await chat(p, key, model, system, user, true); }
          catch (e) {
            if (e.status === 400 && /response_format|json_object|json mode/i.test(e.message)) text = await chat(p, key, model, system, user, false);
            else throw e;
          }
          return parseJSON(text);
        } catch (e) {
          console.error(`[ai] ${p.name} key ${i + 1}/${p.keys.length} ${model} failed (${e.status || "network"}): ${String(e.message).slice(0, 300)}`);
          problems.push({ name: p.name, e });
          if (keyProblem(e)) { badKey = true; break; } // this key fails for every model; try the next key
        }
      }
      if (!badKey) break; // the key worked but the models didn't: another key won't help
    }
  }
  const keyFail = problems.filter((x) => keyProblem(x.e)).map((x) => x.name);
  const allKeysBad = providers.every((p) => keyFail.filter((n) => n === p.name).length >= p.keys.length);
  const busy = problems.some((x) => x.e.status === 429);
  const err = new Error(
    keyFail.length && allKeysBad
      ? `AI analysis is unavailable: the AI provider rejected StayScout’s key (${[...new Set(keyFail)].join(" and ")}).`
      : busy
        ? "AI analysis is busy right now (rate limit). Try again in a minute."
        : "AI analysis didn’t work this time. Try again in a minute.",
  );
  err.status = 502;
  err.aiFailure = true;
  throw err;
}

/* ---------- Listing normalisation ---------- */
const num = (v) => (typeof v === "number" && isFinite(v) ? v : Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0);

export function slimListing(it) {
  const rating = it?.rating || {};
  const score = num(rating.guestSatisfaction ?? rating.value ?? it.stars ?? it.rating);
  const reviews = num(rating.reviewsCount ?? it.reviewsCount ?? it.numberOfReviews);
  const amen = [];
  const walk = (x) => {
    if (!x) return;
    if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x === "object") {
      if (x.title && x.available !== false && !x.values) amen.push(String(x.title));
      if (x.values) walk(x.values);
    }
  };
  walk(it.amenities);
  const price = it.price || {};
  return {
    id: String(it.id ?? it.roomId ?? it.url ?? ""),
    url: it.url || "",
    title: it.title || it.name || "Untitled listing",
    roomType: it.roomType || it.propertyType || "",
    rating: score ? Math.round(score * 100) / 100 : null,
    reviews,
    priceLabel: price.label || price.amount || (typeof price === "string" ? price : ""),
    superhost: !!it?.host?.isSuperHost,
    details: Array.isArray(it.subDescription?.items) ? it.subDescription.items.join(" · ") : (it.subDescription?.title || ""),
    amenities: [...new Set(amen)].slice(0, 30),
    description: String(it.description || "").slice(0, 700),
  };
}

export const rankScore = (s) => (s.rating || 0) * Math.log10((s.reviews || 0) + 1);

/* ---------- Geo + price helpers ---------- */
export function km(a, b) {
  if (!a || !b) return null;
  const R = 6371, t = (d) => (d * Math.PI) / 180;
  const dLat = t(b.lat - a.lat), dLng = t(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}
/* ---------- Prices ----------
 * Google Maps shows Indian stays in US dollars for many searches ("$135"), so a price is only
 * meaningful together with its currency. Everything is converted to rupees before it is compared.
 */
const RATES = { $: 88, USD: 88, "£": 112, GBP: 112, "€": 95, EUR: 95, "₹": 1, INR: 1, Rs: 1 };
export const usdToInr = () => Number(env("USD_INR")) || RATES.$;

/** Reads "$135", "₹8,500", "1,500–2,000", "$1.2K" -> rupees per night, or null when there's no number. */
export function priceToINR(v) {
  if (v == null) return null;
  const raw = String(typeof v === "object" ? (v.label ?? v.amount ?? "") : v).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "");
  const nums = [...cleaned.matchAll(/(\d+(?:\.\d+)?)\s*([kK])?/g)].map((m) => parseFloat(m[1]) * (m[2] ? 1000 : 1));
  if (!nums.length) return null;
  // A range ("1,500-2,000") is represented by its midpoint.
  const n = nums.length > 1 && /[-–—]/.test(cleaned) ? (nums[0] + nums[1]) / 2 : nums[0];
  let rate = 1;
  if (/\$|usd/i.test(cleaned)) rate = usdToInr();
  else if (/£|gbp/i.test(cleaned)) rate = RATES["£"];
  else if (/€|eur/i.test(cleaned)) rate = RATES["€"];
  const inr = Math.round(n * rate);
  return inr >= 150 && inr < 2000000 ? inr : null; // below ₹150 a night isn't a real stay price
}
/** Kept for older callers: same rules, rupee input. */
export const parseINR = (v) => priceToINR(v);

export const median = (arr) => {
  const a = arr.filter((x) => typeof x === "number" && isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
};
