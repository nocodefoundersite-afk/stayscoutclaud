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

export const env = (...names) => {
  for (const n of names) {
    const v = Netlify.env.get(n);
    if (v) return v;
  }
  return "";
};

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

/* ---------- Monthly budget guard (protects free credit) ---------- */
export async function useBudget() {
  const cap = Number(env("APIFY_MAX_RUNS_PER_MONTH") || 40);
  const month = new Date().toISOString().slice(0, 7);
  const s = store();
  const u = (await s.get("usage/apify", { type: "json" })) || {};
  const runs = u.month === month ? u.runs || 0 : 0;
  if (runs >= cap) {
    const e = new Error(`Monthly data limit reached (${cap} fetches). It resets next month.`);
    e.status = 429;
    throw e;
  }
  await s.setJSON("usage/apify", { month, runs: runs + 1 });
  return { month, runs: runs + 1, cap };
}

/* ---------- AI (OpenAI-compatible; point AI_BASE_URL at Bifrost later) ---------- */
export async function aiJSON(system, user) {
  const base = env("AI_BASE_URL") || "https://generativelanguage.googleapis.com/v1beta/openai";
  const key = env("AI_API_KEY", "GEMINI_API_KEY", "GemAPIKey", "GEMAPIKEY");
  const model = env("AI_MODEL") || "gemini-2.5-flash";
  if (!key) throw new Error("AI key missing. Add GEMINI_API_KEY in Netlify → Environment variables.");
  const r = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`AI request failed (${r.status}): ${body?.error?.message || JSON.stringify(body).slice(0, 200)}`);
  const text = body?.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    throw new Error("AI returned an unreadable answer. Try again.");
  }
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
