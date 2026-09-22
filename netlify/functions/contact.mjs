/*
 * Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. Not for use in training or supplying any AI system.
 *
 * POST /api/contact {name, email, topic, message} -> saves a support message in Netlify Database
 */
import { getDatabase } from "@netlify/database";
import { json } from "../lib/core.mjs";

const clean = (v, max) => String(v || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    if (b.website) return json({ ok: true }); // honeypot: bots fill hidden fields
    const name = clean(b.name, 120), email = clean(b.email, 200).toLowerCase(), topic = clean(b.topic, 80), message = clean(b.message, 2000);
    if (!name) return json({ error: "Enter your name." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
    if (message.length < 10) return json({ error: "Write at least 10 characters." }, 400);
    const db = getDatabase();
    await db.sql`INSERT INTO contact_messages (name, email, topic, message) VALUES (${name}, ${email}, ${topic}, ${message})`;
    return json({ ok: true });
  } catch {
    return json({ error: "Your message couldn’t be saved right now. Please try again in a few minutes." }, 500);
  }
};

export const config = { path: "/api/contact" };
