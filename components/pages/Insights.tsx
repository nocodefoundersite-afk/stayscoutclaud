/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import { useMemo, useState } from "react";
import { Plane, TrainFront, Hospital, GraduationCap, MapPin } from "lucide-react";
import {
  PROPERTY_TYPES, inr, areaStats, amenityCoverage, typeOf, median,
  type CityResult, type TypeFilter,
} from "@/lib/data";
import { KEYS, useLocal, EMPTY_SELECTION, type Selection } from "@/lib/storage";
import CityGate from "@/components/CityGate";
import { PageHeader } from "@/lib/ui";

const typeWord = (t: TypeFilter, plural = false) => (t === "All" ? (plural ? "stays" : "stay") : `${t.toLowerCase()}${plural ? "s" : ""}`);

export default function Insights() {
  const [sel, , ready] = useLocal<Selection>(KEYS.selection, EMPTY_SELECTION);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader
        title="Price & amenities"
        lead={sel.city ? `What stays in ${sel.city} charge, what they offer and how location changes the price.` : "What stays charge, what they offer and how location changes the price."}
      />
      {ready && (
        <CityGate state={sel.state} city={sel.city} what="this page">
          {(r) => <Body result={r} />}
        </CityGate>
      )}
    </div>
  );
}

function Body({ result }: { result: CityResult }) {
  const [type, setType] = useState<TypeFilter>("All");
  const rows = useMemo(
    () => result.areas.map((a) => ({ a, st: areaStats(result, a, type) })).filter((x) => x.st.count > 0),
    [result, type],
  );
  const priced = rows.filter((x) => x.st.price).sort((x, y) => (y.st.price as number) - (x.st.price as number));
  const unpriced = rows.length - priced.length;
  const max = Math.max(1, ...priced.map((x) => x.st.price as number));
  const typed = type === "All" ? result.places : result.places.filter((p) => typeOf(p.cat) === type);
  const cov = amenityCoverage(typed);
  const ai = result.ai || {};
  const airbnbPrices = result.airbnb.map((x) => x.price);
  const airbnbMedian = median(airbnbPrices);
  const mix = result.summary.types || [];
  const mixTotal = mix.reduce((t, [, n]) => t + n, 0) || 1;

  return (
    <>
      <section className="card" aria-label="Filter">
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="i-type">Property type</label>
          <select id="i-type" className="select" value={type} onChange={(e) => setType(e.target.value as TypeFilter)}>
            <option value="All">All stay types</option>
            {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <span className="hint">Prices and amenities compare only {typeWord(type, true)}.</span>
        </div>
      </section>

      <section className="card" aria-labelledby="pr-h">
        <div className="card-h"><h2 id="pr-h">Typical nightly price by locality</h2><span className="muted">Median of live prices</span></div>
        {priced.length === 0 ? (
          <p className="status info">Not enough price data for {typeWord(type, true)} in {result.summary.city}. Many Google Maps listings don’t show a price; try “All stay types”.</p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12 }}>
            {priced.map(({ a, st }) => (
              <li key={a.id} className="pricebar">
                <span>{a.name}</span>
                <div className="bar" style={{ height: 12 }} role="img" aria-label={`${a.name}: ${inr(st.price)} per night from ${st.priceSamples} prices`}><i style={{ width: `${((st.price as number) / max) * 100}%` }} /></div>
                <span className="num"><b>{inr(st.price)}</b> <span className="muted">({st.priceSamples})</span></span>
              </li>
            ))}
          </ul>
        )}
        {unpriced > 0 && priced.length > 0 && <p className="muted" style={{ marginTop: 12 }}>{unpriced} {unpriced === 1 ? "locality has" : "localities have"} no price data and {unpriced === 1 ? "isn’t" : "aren’t"} shown. The number in brackets is how many prices each median uses.</p>}
        {airbnbMedian && (
          <p className="muted" style={{ marginTop: 8 }}>Airbnb listings in {result.summary.city}: median {inr(airbnbMedian)} a night across {airbnbPrices.filter(Boolean).length} listings.</p>
        )}
      </section>

      <section className="card" aria-labelledby="loc-h">
        <div className="card-h"><h2 id="loc-h">Pricing by what you’re near</h2><span className="muted">AI summary of the live numbers</span></div>
        {ai.pricing_by_location?.length ? (
          <div className="tbl-wrap">
            <table className="tbl rtbl">
              <thead><tr><th scope="col">Location</th><th scope="col">Localities</th><th scope="col">Price range</th><th scope="col">Who stays</th><th scope="col">Advice</th></tr></thead>
              <tbody>
                {ai.pricing_by_location.map((p) => (
                  <tr key={p.location}>
                    <td className="rt-full"><b>{p.location}</b></td>
                    <td data-label="Localities">{(p.areas || []).join(", ") || "—"}</td>
                    <td data-label="Price range" className="num">{p.price_range_inr ? (/\d/.test(p.price_range_inr) ? `₹${p.price_range_inr.replace(/^₹/, "")}` : p.price_range_inr) : "—"}</td>
                    <td data-label="Who stays">{p.who_stays}</td>
                    <td className="rt-full" data-label="Advice">{p.advice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="status info">The AI summary for {result.summary.city} didn’t include pricing by location. The distances below still help you position your price.</p>}

        <h3 style={{ fontSize: 16, margin: "24px 0 12px" }}>Distance from each locality</h3>
        <div className="tbl-wrap">
          <table className="tbl rtbl wide">
            <thead>
              <tr>
                <th scope="col">Locality</th>
                <th scope="col"><Plane size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> Airport</th>
                <th scope="col"><TrainFront size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> Station</th>
                <th scope="col"><Hospital size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> Hospital</th>
                <th scope="col"><GraduationCap size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> College</th>
              </tr>
            </thead>
            <tbody>
              {result.areas.map((a) => (
                <tr key={a.id}>
                  <td className="rt-full"><b><MapPin size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> {a.name}</b></td>
                  {([["Airport", a.airport], ["Station", a.railway], ["Hospital", a.hospital], ["College", a.college]] as const).map(([label, n]) => (
                    <td key={label} data-label={label}>{n && n.km != null ? <><b className="num">{n.km} km</b><div className="muted clamp2">{n.name}</div></> : <span className="muted">None nearby</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="card" aria-labelledby="am-h">
          <div className="card-h"><h2 id="am-h">What competitors offer</h2><span className="muted">{cov.total} {typeWord(type, true)} list amenities</span></div>
          {cov.total < 3 ? (
            <p className="status info">Too few {typeWord(type, true)} list their amenities on Google Maps to compare. Guest review analysis (in the finder) shows which amenities guests ask for.</p>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: 12 }}><span className="pill good">Under 45%</span> is a gap: offering it helps you stand out.</p>
              <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12 }}>
                {cov.items.slice(0, 14).map((m) => (
                  <li key={m.name}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span>{m.name} {m.pct < 45 && <span className="pill good">Gap</span>}</span><span className="num muted">{m.pct}%</span>
                    </div>
                    <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${m.pct}%` }} /></div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card" aria-labelledby="mix-h">
          <div className="card-h"><h2 id="mix-h">What’s already there</h2><span className="muted">{result.summary.stays} stays on Google Maps</span></div>
          {mix.length ? (
            <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12 }}>
              {mix.map(([name, n]) => (
                <li key={name}>
                  <div className="row" style={{ justifyContent: "space-between" }}><span>{name || "Other"}</span><span className="num muted">{n}</span></div>
                  <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${Math.round((n / mixTotal) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No category data.</p>}
          {!!ai.opportunities?.length && (
            <>
              <h3 style={{ fontSize: 16, margin: "20px 0 10px" }}>Gaps a new property can win</h3>
              <ul className="list">{ai.opportunities.map((o) => <li key={o}>{o}</li>)}</ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}
