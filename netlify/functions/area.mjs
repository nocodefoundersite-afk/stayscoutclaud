/*
 * Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. Not for use in training or supplying any AI system.
 *
 * POST /api/area {key, area} (signed in) -> fetch recent Google reviews for the top stays in ONE area (only when asked)
 * GET  /api/area?key=&area=   -> status; when reviews arrive, AI analysis runs in the background; returns result
 */
import { store, json, slug, WEEK_MS, apifyStart, apifyStatus, useBudget, requireUser } from "../lib/core.mjs";

const REVIEWS = "compass~google-maps-reviews-scraper";

export default async (req) => {
  try {
    const user = await requireUser(req);
    const s = store();
    let key, area;
    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      key = slug(b.key); area = slug(b.area);
    } else {
      const u = new URL(req.url);
      key = slug(u.searchParams.get("key")); area = slug(u.searchParams.get("area"));
    }
    const city = await s.get(`city/${key}`, { type: "json" });
    const a = city?.result?.areas?.find((x) => x.id === area);
    if (!a) return json({ error: "Analyse the city first." }, 404);
    const k = `area/${key}/${area}`;
    const cur = await s.get(k, { type: "json" });
    const origin = new URL(req.url).origin;
    const kick = (job) => fetch(`${origin}/.netlify/functions/area-analyze-background`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, area, job }),
    }).catch(() => {});

    if (req.method === "POST") {
      if (cur?.status === "ready" && Date.now() - cur.readyAt < WEEK_MS) return json({ status: "ready" });
      // Reviews already collected but the AI step failed: run only the AI step again. No data fetch is used.
      if (cur?.status === "failed" && cur.run?.datasetId) {
        const job = crypto.randomUUID();
        await s.setJSON(k, { ...cur, status: "analyzing", error: null, analyzeAt: Date.now(), startedAt: Date.now(), job });
        await kick(job);
        return json({ status: "analyzing", free: true });
      }
      if (cur && ["running", "analyzing"].includes(cur.status) && Date.now() - cur.startedAt < 20 * 60 * 1000) return json({ status: cur.status });
      if (!a.topPlaceIds?.length) return json({ error: "No reviewable places in this area." }, 400);
      await useBudget(user);
      const run = await apifyStart(REVIEWS, {
        placeIds: a.topPlaceIds,
        maxReviews: 15,
        reviewsSort: "newest",
        language: "en",
        personalData: false,
      });
      await s.setJSON(k, { status: "running", run, startedAt: Date.now(), job: crypto.randomUUID(), by: user.id });
      return json({ status: "running" });
    }

    if (!cur) return json({ status: "none" });
    if (cur.status === "running") {
      const st = await apifyStatus(cur.run.runId);
      if (["FAILED", "ABORTED", "TIMED-OUT"].includes(st)) {
        await s.delete(k);
        return json({ status: "failed", error: "Fetching reviews failed. Please try again." });
      }
      if (st !== "SUCCEEDED") return json({ status: "running", step: "Reading the latest guest reviews…" });
      await s.setJSON(k, { ...cur, status: "analyzing", analyzeAt: Date.now() });
      await kick(cur.job);
      return json({ status: "analyzing", step: "AI is finding guest problems and fixes…" });
    }
    if (cur.status === "analyzing") {
      if (Date.now() - (cur.analyzeAt || 0) > 5 * 60 * 1000) { await s.setJSON(k, { ...cur, analyzeAt: Date.now() }); await kick(cur.job); }
      return json({ status: "analyzing", step: "AI is finding guest problems and fixes…" });
    }
    if (cur.status === "failed") return json({ status: "failed", error: cur.error || "Analysis failed.", retryFree: !!cur.run?.datasetId });
    return json({ status: "ready", result: cur.result });
  } catch (e) {
    return json({ error: e.message }, e.status || 500);
  }
};

export const config = { path: "/api/area" };
