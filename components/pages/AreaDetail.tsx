/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bookmark, BookmarkCheck, MapPin, Star, Home, ExternalLink, SearchX } from "lucide-react";
import { PROPERTY_TYPES, inr, areaStats, placesIn, priceOf, rankScore, nearLine, tierLabel, type CityResult, type LiveArea, type PropertyType, type AreaResult } from "@/lib/data";
import { KEYS, useLocal, EMPTY_SELECTION, savedId, type Selection, type SavedArea } from "@/lib/storage";
import { useAreaReview } from "@/lib/live";
import { useAuth } from "@/lib/auth";
import { Live, ScoreBadge } from "@/lib/ui";
import CityGate from "@/components/CityGate";
import { ReviewPanel } from "@/components/Plan";

export default function AreaDetail() {
  const [q, setQ] = useState<{ state: string; city: string; id: string } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ({ state: p.get("state") || "", city: p.get("city") || "", id: p.get("id") || "" });
  }, []);
  if (!q) return null;
  return (
    <div className="stack" style={{ gap: 24 }}>
      <Link href="/areas" className="btn btn-ghost" style={{ alignSelf: "flex-start", paddingLeft: 8 }}><ArrowLeft aria-hidden="true" />All areas</Link>
      <CityGate state={q.state} city={q.city} what="this area">
        {(r, key) => {
          const a = r.areas.find((x) => x.id === q.id);
          if (!a) return (
            <div className="card empty"><SearchX aria-hidden="true" /><h1 style={{ fontSize: 22 }}>Locality not found</h1><p className="muted">It isn’t in the latest analysis of {q.city}. Localities can change when a city is re-analysed.</p><Link href="/areas" className="btn btn-primary">See all localities</Link></div>
          );
          return <Detail r={r} a={a} cityKey={key} state={q.state} city={q.city} />;
        }}
      </CityGate>
    </div>
  );
}

function Detail({ r, a, cityKey, state, city }: { r: CityResult; a: LiveArea; cityKey: string; state: string; city: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [saved, setSaved] = useLocal<SavedArea[]>(KEYS.saved, []);
  const [sel, setSel] = useLocal<Selection>(KEYS.selection, EMPTY_SELECTION);
  const [, setProperty] = useLocal<Record<string, unknown>>(KEYS.property, {});
  const [msg, setMsg] = useState("");
  const review = useAreaReview(cityKey, a.id);
  const rv = review.job.status === "ready" ? (review.job.result as AreaResult) : null;
  const on = saved.some((x) => savedId(x) === `${cityKey}/${a.id}`);
  const types = PROPERTY_TYPES.filter((t) => placesIn(r, a, t).length > 0);
  const [type, setType] = useState<PropertyType>(types.includes(sel.type as PropertyType) ? (sel.type as PropertyType) : types[0] || "Homestay");
  const hot = useMemo(() => placesIn(r, a, "All").sort((x, y) => rankScore(y) - rankScore(x)).slice(0, 8), [r, a]);
  const all = areaStats(r, a, "All");
  const tStats = areaStats(r, a, type);

  const toggle = () => {
    setSaved((p) => (on ? p.filter((x) => savedId(x) !== `${cityKey}/${a.id}`) : [...p, { key: cityKey, id: a.id, name: a.name, city, state, score: a.score }]));
    setMsg(on ? "Removed from saved areas." : "Saved to your areas.");
  };
  const openInFinder = () => { setSel({ ...EMPTY_SELECTION, state, city, locality: a.id, type: sel.type || "All" }); router.push("/"); };
  const plan = () => { setProperty((p) => ({ ...p, key: cityKey, state, city, areaId: a.id, type, price: tStats.price ?? "" })); router.push("/property"); };

  return (
    <>
      <Live message={msg} />
      <header className="page-h" style={{ marginBottom: 0 }}>
        <div>
          <p className="muted"><MapPin size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> India › {state} › {city}</p>
          <h1 style={{ marginTop: 6 }}>{a.name}</h1>
          <p>{tierLabel(a.tier)} locality · {a.confidence} confidence{rv?.ai?.verdict ? ` · Review verdict: ${rv.ai.verdict}` : ""}</p>
        </div>
        <div className="row">
          <button type="button" className="btn btn-secondary" aria-pressed={on} onClick={toggle}>{on ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}{on ? "Saved" : "Save area"}</button>
          <button type="button" className="btn btn-primary" onClick={openInFinder}>Open in finder</button>
        </div>
      </header>

      <section className="grid-4" aria-label="Key figures">
        <div className="stat"><b><ScoreBadge score={a.score} /></b><span>Score out of 100 within {city}</span></div>
        <div className="stat"><b className="num">{all.price ? inr(all.price) : "—"}</b><span>Typical nightly price ({all.priceSamples} prices)</span></div>
        <div className="stat"><b className="num">{a.avgRating ? a.avgRating.toFixed(1) : "—"}</b><span>Average rating, out of five</span></div>
        <div className="stat"><b className="num">{a.reviews.toLocaleString("en-IN")}</b><span>Reviews across {a.stays} stays</span></div>
      </section>
      {nearLine(a) && <p className="muted">Nearest: {nearLine(a)} (straight-line distance from the locality centre)</p>}

      <ReviewPanel review={review} areaName={a.name} signedIn={!!user} />

      {!!rv?.ai?.problems?.length && (
        <section className="card" aria-labelledby="fix-h">
          <div className="card-h"><h2 id="fix-h">Frequent problems and how to fix them</h2><span className="muted">Themes, never quotes</span></div>
          <div className="tbl-wrap">
            <table className="tbl rtbl">
              <thead><tr><th scope="col">Problem</th><th scope="col">Mentions</th><th scope="col">Recommended fix</th><th scope="col">Rough cost</th><th scope="col">Priority</th></tr></thead>
              <tbody>
                {rv.ai.problems.map((c) => (
                  <tr key={c.problem}>
                    <td className="rt-full"><b>{c.problem}</b></td>
                    <td data-label="Mentions">{c.mentions}</td>
                    <td className="rt-full" data-label="Recommended fix">{c.fix}</td>
                    <td data-label="Rough cost">{c.cost_inr}</td>
                    <td data-label="Priority"><span className={`pill ${c.priority === "Must fix" ? "bad" : c.priority === "Should fix" ? "warn" : "neutral"}`}>{c.priority}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="card" aria-labelledby="price-h">
          <div className="card-h"><h2 id="price-h">Typical nightly price by type</h2></div>
          <div className="tbl-wrap">
            <table className="tbl" style={{ minWidth: 0 }}>
              <thead><tr><th scope="col">Type</th><th scope="col" className="num">Found</th><th scope="col" className="num">Typical price</th></tr></thead>
              <tbody>
                {PROPERTY_TYPES.map((t) => {
                  const s = areaStats(r, a, t);
                  return <tr key={t}><th scope="row">{t}</th><td className="num">{s.count}</td><td className="num">{s.price ? inr(s.price) : <span className="muted">{s.count ? "No price data" : "None found"}</span>}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>Types come from Google Maps categories, which owners set themselves.</p>
        </section>
        <section className="card stack" aria-labelledby="plan-h">
          <h2 id="plan-h" style={{ fontSize: 20 }}>Plan a property here</h2>
          {types.length ? (
            <div className="field">
              <label htmlFor="ad-type">Property type</label>
              <select id="ad-type" className="select" value={type} onChange={(e) => setType(e.target.value as PropertyType)}>
                {types.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          ) : <p className="muted">Google Maps didn’t categorise the stays here clearly, so we’ll plan a homestay.</p>}
          <p style={{ color: "var(--ink-2)" }}>Comparable {type.toLowerCase()}s here charge <b>{tStats.price ? inr(tStats.price) : "an unknown amount"}</b> a night on average.</p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={plan}><Home aria-hidden="true" />Plan my property</button>
            <Link className="btn btn-secondary" href={tStats.price ? `/calculator/?price=${tStats.price}` : "/calculator/"}>Rent vs buy</Link>
          </div>
        </section>
      </div>

      <section className="card" aria-labelledby="hot-h">
        <div className="card-h"><h2 id="hot-h">Hot properties in {a.name}</h2><span className="muted">From Google Maps</span></div>
        <div className="tbl-wrap">
          <table className="tbl rtbl">
            <thead><tr><th scope="col">Property</th><th scope="col" className="num">Price per night</th><th scope="col" className="num">Rating</th><th scope="col" className="num">Reviews</th><th scope="col"><span className="sr">Link</span></th></tr></thead>
            <tbody>
              {hot.map((p) => {
                const pr = priceOf(p);
                return (
                  <tr key={p.id}>
                    <td className="rt-full"><b>{p.name}</b><div className="muted">{p.cat || "Stay"}</div></td>
                    <td className="num" data-label="Price per night">{pr ? inr(pr) : <span className="muted">Not listed</span>}</td>
                    <td className="num" data-label="Rating">{p.rating ? <><Star size={13} aria-hidden="true" style={{ verticalAlign: -1 }} /> {p.rating.toFixed(1)}</> : "—"}</td>
                    <td className="num" data-label="Reviews">{p.reviews.toLocaleString("en-IN")}</td>
                    <td style={{ textAlign: "right" }}>{p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" aria-label={`Open ${p.name} on Google Maps`}><ExternalLink aria-hidden="true" /></a>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
