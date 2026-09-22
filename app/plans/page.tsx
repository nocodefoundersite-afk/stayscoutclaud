/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { PageHeader } from "@/lib/ui";
import WaitlistButton from "@/components/WaitlistButton";

export const metadata: Metadata = { title: "Plans" };

const PLANS = [
  { name: "Starter", who: "Research your first location", price: "Free", status: "Available now" },
  { name: "Owner", who: "One property, more cities", price: "Price to be announced", status: "Coming soon" },
  { name: "Pro", who: "Investors and property managers", price: "Price to be announced", status: "Coming soon" },
];
const ROWS: [string, boolean, boolean, boolean][] = [
  ["Live city analysis from Google Maps and Airbnb", true, true, true],
  ["Localities ranked with prices, ratings and landmarks", true, true, true],
  ["Guest-review problems, fixes and listing lines", true, true, true],
  ["Rent vs buy calculator", true, true, true],
  ["10 data fetches a month", true, false, false],
  ["More data fetches each month", false, true, true],
  ["Email alerts", false, true, true],
  ["Multiple properties and exportable reports", false, false, true],
];

export default function Page() {
  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader title="Plans" lead="Starter is free while StayScout is in early access. Paid plans aren’t on sale yet, and nothing on this page takes a payment." />
      <ul className="grid-3" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {PLANS.map((p, i) => (
          <li key={p.name} className="card stack" style={{ gap: 12, borderColor: i === 1 ? "color-mix(in srgb, var(--brand) 45%, var(--line))" : undefined }}>
            <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ fontSize: 22 }}>{p.name}</h2><span className={`pill ${i === 0 ? "good" : "neutral"}`}>{p.status}</span></div>
            <p className="muted">{p.who}</p>
            <p style={{ fontSize: 22, fontWeight: 700 }}>{p.price}</p>
            <div style={{ marginTop: "auto" }}>
              {i === 0 ? <Link href="/" className="btn btn-primary">Start researching</Link> : <WaitlistButton plan={p.name} />}
            </div>
          </li>
        ))}
      </ul>
      <section className="card" aria-labelledby="cmp-h">
        <div className="card-h"><h2 id="cmp-h">Compare features</h2></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th scope="col">Feature</th>{PLANS.map((p) => <th key={p.name} scope="col" style={{ textAlign: "center" }}>{p.name}</th>)}</tr></thead>
            <tbody>
              {ROWS.map(([f, ...has]) => (
                <tr key={f}>
                  <th scope="row">{f}</th>
                  {has.map((h, i) => (
                    <td key={i} style={{ textAlign: "center" }}>
                      {h ? <Check size={18} aria-label="Included" style={{ color: "var(--good)" }} /> : <Minus size={18} aria-label="Not included" style={{ color: "var(--ink-3)" }} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
