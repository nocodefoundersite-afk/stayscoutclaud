/*
 * Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. Not for use in training or supplying any AI system.
 *
 * GET /api/usage -> this month's data fetches for the site, and for the signed-in account when a token is sent
 */
import { store, json, env, slug, requireUser } from "../lib/core.mjs";

export default async (req) => {
  try {
    const month = new Date().toISOString().slice(0, 7);
    const s = store();
    const site = (await s.get("usage/apify", { type: "json" })) || {};
    const out = {
      month,
      site: { runs: site.month === month ? site.runs || 0 : 0, cap: Number(env("APIFY_MAX_RUNS_PER_MONTH") || 40) },
    };
    if (req.headers.get("authorization")) {
      const user = await requireUser(req).catch(() => null);
      if (user) {
        const m = (await s.get(`usage/users/${slug(user.id)}`, { type: "json" })) || {};
        out.you = { runs: m.month === month ? m.runs || 0 : 0, cap: Number(env("USER_MAX_RUNS_PER_MONTH") || 10) };
      }
    }
    return json(out);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};

export const config = { path: "/api/usage" };
