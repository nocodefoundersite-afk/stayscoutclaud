/*
 * Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. Not for use in training or supplying any AI system.
 *
 * POST /api/notify {email, city}  -> saves a waitlist sign-up in Netlify Database
 */
import { getDatabase } from "@netlify/database";
import { json } from "../lib/core.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  try {
    const { email, city } = await req.json().catch(() => ({}));
    const e = String(email || "").trim().toLowerCase().slice(0, 200);
    const c = String(city || "").trim().slice(0, 100);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return json({ error: "Enter a valid email." }, 400);
    const db = getDatabase();
    await db.sql`INSERT INTO waitlist (email, city) VALUES (${e}, ${c}) ON CONFLICT (email, city) DO NOTHING`;
    return json({ ok: true });
  } catch (err) {
    return json({ error: "Could not save right now. Please try again." }, 500);
  }
};

export const config = { path: "/api/notify" };
