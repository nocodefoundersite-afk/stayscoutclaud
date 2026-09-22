/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import Link from "next/link";
import { ArrowRight, Bookmark, MapPin, Calculator, Home, ThumbsUp, Ban, TrendingUp, Lightbulb } from "lucide-react";
import { inr, nearLine, type CityResult } from "@/lib/data";
import { KEYS, useLocal, EMPTY_SELECTION, type Selection, type SavedArea } from "@/lib/storage";
import { PageHeader, ScoreBadge } from "@/lib/ui";
import CityGate from "@/components/CityGate";

const areaHref = (state: string, city: string, id: string) => `/area/?state=${encodeURIComponent(state)}&city=${encodeURIComponent(city)}&id=${encodeURIComponent(id)}`;

export default function Overview() {
  const [sel, , ready] = useLocal<Selection>(KEYS.selection, EMPTY_SELECTION);
  const [saved] = useLocal<SavedArea[]>(KEYS.saved, []);
  if (!ready) return null;
  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader title={sel.city ? `${sel.city} market overview` : "Market overview"} lead="Where guests stay, what they pay and which localities stand out, from live Google Maps, Airbnb and OpenStreetMap data." />
      <CityGate state={sel.state} city={sel.city} what="the overview">
        {(r, _key, readyAt) => <Body r={r} sel={sel} readyAt={readyAt} />}
      </CityGate>
      <section className="card" aria-labelledby="saved-h">
        <div className="card-h"><h2 id="saved-h">Your saved areas</h2><span className="muted">Saved on this device</span></div>
        {saved.length ? (
          <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 8 }}>
            {saved.map((a) => (
              <li key={a.key + a.id} className="row" style={{ justifyContent: "space-between" }}>
                <Link href={areaHref(a.state, a.city, a.id)}><b>{a.name}</b> <span className="muted">· {a.city}</span></Link>
                <ScoreBadge score={a.score} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty" style={{ padding: 16 }}>
            <Bookmark aria-hidden="true" />
            <p>No saved areas yet. Save a locality from the finder or the area list.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Body({ r, sel, readyAt }: { r: CityResult; sel: Selection; readyAt?: number }) {
  const sm = r.summary;
  const ai = r.ai && !r.ai.error ? r.ai : null;
  const top = [...r.areas].sort((a, b) => b.score - a.score).slice(0, 6);
  return (
    <>
      <section aria-label="Key figures" className="grid-4">
        <div className="stat"><b className="num">{sm.stays}</b><span>Stays found on Google Maps</span></div>
        <div className="stat"><b className="num">{inr(sm.medianPriceINR)}</b><span>Median nightly price ({sm.priceSamples} prices)</span></div>
        <div className="stat"><b className="num">{sm.avgRating ? sm.avgRating.toFixed(2) : "—"}</b><span>Average guest rating, out of five</span></div>
        <div className="stat"><b className="num">{r.areas.length}</b><span>Localities compared{sm.airbnbListings ? ` · ${sm.airbnbListings} Airbnb listings` : ""}</span></div>
      </section>
      {readyAt && <p className="muted" style={{ marginTop: -8 }}>Analysed {new Date(readyAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}. Refreshes after 7 days.</p>}
      {r.ai?.error && <p className="status info">The AI summary wasn’t available for this analysis. Everything below is counted directly from the data.</p>}

      {ai?.headline && (
        <section className="card stack" style={{ gap: 12, borderColor: "color-mix(in srgb, var(--brand) 45%, var(--line))" }} aria-labelledby="ai-h">
          <h2 id="ai-h" style={{ fontSize: 20 }}>{ai.headline}</h2>
          {ai.verdict && <p style={{ color: "var(--ink-2)" }}>{ai.verdict}</p>}
        </section>
      )}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="card" aria-labelledby="top-h">
          <div className="card-h"><h2 id="top-h">Top localities</h2><Link href="/areas" className="btn btn-ghost">All areas <ArrowRight aria-hidden="true" /></Link></div>
          <div className="tbl-wrap">
            <table className="tbl" style={{ minWidth: 0 }}>
              <thead><tr><th scope="col">Locality</th><th scope="col" className="num">Score</th><th scope="col" className="num">Typical price</th></tr></thead>
              <tbody>
                {top.map((a) => (
                  <tr key={a.id}>
                    <td><Link href={areaHref(sel.state, sel.city, a.id)}><b>{a.name}</b></Link><div className="muted">{a.stays} stays{nearLine(a) ? ` · ${nearLine(a).split(" · ")[0]}` : ""}</div></td>
                    <td className="num"><ScoreBadge score={a.score} /></td>
                    <td className="num">{a.medianPriceINR ? inr(a.medianPriceINR) : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card stack" aria-labelledby="best-h">
          <h2 id="best-h" style={{ fontSize: 20 }}>Where to open, and where not to</h2>
          {ai?.best_areas?.length ? (
            <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12 }}>
              {ai.best_areas.map((b) => (
                <li key={b.area}><b><ThumbsUp size={15} aria-hidden="true" style={{ verticalAlign: -2, color: "var(--good)" }} /> {b.area}</b> <span className="muted">· {b.price_range_inr} · {b.good_for}</span><p style={{ color: "var(--ink-2)", fontSize: 15 }}>{b.why}</p></li>
              ))}
            </ul>
          ) : <p className="muted">No AI recommendation for this analysis. Use the scores on the left.</p>}
          {!!ai?.avoid_areas?.length && (
            <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              {ai.avoid_areas.map((b) => (
                <li key={b.area}><b><Ban size={15} aria-hidden="true" style={{ verticalAlign: -2, color: "var(--bad)" }} /> {b.area}</b><p style={{ color: "var(--ink-2)", fontSize: 15 }}>{b.why}</p></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid-3" style={{ alignItems: "start" }}>
        <section className="card" aria-labelledby="dd-h">
          <div className="card-h"><h2 id="dd-h" style={{ fontSize: 18 }}><TrendingUp size={18} aria-hidden="true" style={{ verticalAlign: -3 }} /> What brings guests</h2></div>
          {ai?.demand_drivers?.length ? <ul className="list">{ai.demand_drivers.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="muted">Not enough data.</p>}
        </section>
        <section className="card" aria-labelledby="op-h">
          <div className="card-h"><h2 id="op-h" style={{ fontSize: 18 }}><Lightbulb size={18} aria-hidden="true" style={{ verticalAlign: -3 }} /> Gaps you can win</h2></div>
          {ai?.opportunities?.length ? <ul className="list">{ai.opportunities.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="muted">Not enough data.</p>}
        </section>
        <section className="card" aria-labelledby="ty-h">
          <div className="card-h"><h2 id="ty-h" style={{ fontSize: 18 }}>Types of stay</h2></div>
          <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 10 }}>
            {sm.types.map(([t, n]) => (
              <li key={t}>
                <div className="row" style={{ justifyContent: "space-between" }}><span>{t || "Other"}</span><span className="num muted">{n}</span></div>
                <div className="bar" style={{ marginTop: 4 }}><i style={{ width: `${Math.round((n / Math.max(1, sm.stays)) * 100)}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card" aria-labelledby="next-h">
        <div className="card-h"><h2 id="next-h">Next steps</h2></div>
        <div className="grid-3">
          <Link href="/" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}><MapPin aria-hidden="true" />Compare localities</Link>
          <Link href="/property" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}><Home aria-hidden="true" />Plan your property</Link>
          <Link href="/calculator" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}><Calculator aria-hidden="true" />Rent vs buy</Link>
        </div>
      </section>
    </>
  );
}
