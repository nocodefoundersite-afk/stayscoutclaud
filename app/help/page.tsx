/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/lib/ui";

export const metadata: Metadata = { title: "Help" };

const FAQ: [string, React.ReactNode][] = [
  ["Where does the data come from?", <>Stays, ratings and prices come from Google Maps and Airbnb, collected live through Apify. Airports, railway stations, hospitals and colleges come from OpenStreetMap. AI (Google Gemini) writes the summaries, problems and fixes, using only the numbers and reviews collected.</>],
  ["How do I find a location?", <>On <Link href="/">Find a location</Link>, pick a state and city and press <b>Choose a location</b>. If the city hasn’t been analysed in the last 7 days, a live analysis starts; it usually takes 3 to 6 minutes. You’ll then see localities ranked in a table. Filter by property type, price and rating, open a locality to see its top stays, then press <b>Choose this area</b> for a plan.</>],
  ["What is the score?", <>A number out of 100 comparing localities within the same city. It combines demand (reviews per stay), room for new supply, how unhappy guests are with existing stays (a gap you can fill) and access to airports, stations, hospitals and colleges. Confidence is lower when a locality has few stays.</>],
  ["Why is a price missing?", <>Many Google Maps listings don’t show a price. We only show a typical price when we have real prices to take a median from, and we say how many prices it uses.</>],
  ["What are data fetches?", <>Each new city analysis uses up to 2 fetches and each guest-review analysis uses 1. You get 10 a month on Starter. Anything analysed in the last 7 days opens again for free. See your usage in <Link href="/profile">Settings</Link>.</>],
  ["Do you show guest reviews?", <>We summarise review themes (for example “power cuts, 4 of 30 reviews”) and suggest fixes. We don’t quote or name individual guests.</>],
  ["I didn’t get the confirmation email", <>Check your spam folder. The link opens StayScout and signs you in. If it has expired, register again with the same email or <Link href="/forgot-password">reset your password</Link>.</>],
  ["Is this investment advice?", <>No. StayScout is a research tool. The <Link href="/calculator">rent vs buy calculator</Link> is a simple estimate. Speak to a qualified adviser before committing money.</>],
];

export default function Page() {
  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader title="Help" lead="How StayScout works and what the numbers mean." />
      <section className="card stack" aria-label="Frequently asked questions" style={{ gap: 0, padding: 8 }}>
        {FAQ.map(([q, a]) => (
          <details key={q} style={{ borderBottom: "1px solid var(--line)", padding: "4px 16px" }}>
            <summary style={{ minHeight: 44, display: "flex", alignItems: "center", fontWeight: 600, cursor: "pointer" }}>{q}</summary>
            <p style={{ color: "var(--ink-2)", paddingBottom: 16 }}>{a}</p>
          </details>
        ))}
      </section>
      <p className="muted">Still stuck? <Link href="/contact">Contact us</Link>.</p>
    </div>
  );
}
