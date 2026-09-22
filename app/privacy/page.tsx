/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/lib/ui";

export const metadata: Metadata = { title: "Privacy" };

export default function Page() {
  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader title="Privacy" lead="Last updated September 2026." />
      <article className="card prose">
        <h2>Your account</h2>
        <p>When you register we store your name, email address and a securely hashed password with our sign-in provider (Netlify Identity). We use your email to confirm your account, reset your password and, if you ask, tell you when a paid plan opens.</p>
        <h2>What you research</h2>
        <p>City and locality analyses are stored on our server so anyone researching the same place gets them without paying for the data again. We record how many data fetches each account uses so we can apply monthly limits. We don’t sell your data or show you ads.</p>
        <h2>What stays on your device</h2>
        <p>Your finder selection, saved areas, property details, alerts, theme and sign-in session are kept in your browser’s local storage. You can download or delete them in <Link href="/profile">Settings</Link>.</p>
        <h2>Public data we collect</h2>
        <p>We collect public listing information (names, categories, ratings, review counts, prices and locations) from Google Maps and Airbnb, and places from OpenStreetMap. Recent public review text is read by AI to find common problems; we show themes and counts, never guests’ names or quotes.</p>
        <h2>Service providers</h2>
        <p>Netlify hosts the site, sign-in and storage. Apify collects the public listing data. Google Gemini produces the AI summaries.</p>
        <h2>Contact and deletion</h2>
        <p>To delete your account, <Link href="/contact">contact us</Link> from the email address you registered with.</p>
      </article>
    </div>
  );
}
