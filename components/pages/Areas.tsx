/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, Search, SearchX, Star, ArrowRight } from "lucide-react";
import { PROPERTY_TYPES, inr, areaStats, nearLine, tierLabel, type CityResult, type TypeFilter } from "@/lib/data";
import { KEYS, useLocal, EMPTY_SELECTION, savedId, type Selection, type SavedArea } from "@/lib/storage";
import { Live, PageHeader, ScoreBadge } from "@/lib/ui";
import AreaMap from "@/components/AreaMap";
import CityGate from "@/components/CityGate";

type Sort = "score" | "price" | "reviews" | "name";
export const areaHref = (state: string, city: string, id: string) => `/area/?state=${encodeURIComponent(state)}&city=${encodeURIComponent(city)}&id=${encodeURIComponent(id)}`;

export default function Areas() {
  const [sel, , ready] = useLocal<Selection>(KEYS.selection, EMPTY_SELECTION);
  if (!ready) return null;
  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader title={sel.city ? `Localities in ${sel.city}` : "Explore areas"} lead="Every locality found in the latest analysis. Save the ones you want to compare." />
      <CityGate state={sel.state} city={sel.city} what="this list">{(r, key) => <List r={r} cityKey={key} sel={sel} />}</CityGate>
    </div>
  );
}

function List({ r, cityKey, sel }: { r: CityResult; cityKey: string; sel: Selection }) {
  const [saved, setSaved] = useLocal<SavedArea[]>(KEYS.saved, []);
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>((sel.type as TypeFilter) || "All");
  const [sort, setSort] = useState<Sort>("score");
  const [onlySaved, setOnlySaved] = useState(false);
  const [msg, setMsg] = useState("");
  const isSaved = (id: string) => saved.some((x) => savedId(x) === `${cityKey}/${id}`);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return r.areas
      .map((a) => ({ a, st: areaStats(r, a, type) }))
      .filter(({ st }) => st.count > 0)
      .filter(({ a }) => !t || a.name.toLowerCase().includes(t))
      .filter(({ a }) => !onlySaved || isSaved(a.id))
      .sort((x, y) => sort === "score" ? y.a.score - x.a.score : sort === "reviews" ? y.st.reviews - x.st.reviews : sort === "name" ? x.a.name.localeCompare(y.a.name) : (x.st.price ?? Infinity) - (y.st.price ?? Infinity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r, q, type, sort, onlySaved, saved]);

  const toggle = (id: string, name: string, score: number) => {
    const was = isSaved(id);
    setSaved((p) => (was ? p.filter((x) => savedId(x) !== `${cityKey}/${id}`) : [...p, { key: cityKey, id, name, city: sel.city, state: sel.state, score }]));
    setMsg(was ? `${name} removed from saved areas.` : `${name} saved.`);
  };

  const hrefFor = useCallback((id: string) => areaHref(sel.state, sel.city, id), [sel.state, sel.city]);
  return (
    <>
      <section className="card" aria-labelledby="map-h">
        <div className="card-h"><h2 id="map-h">Where the stays are</h2><span className="muted">{r.areas.length} localities · {r.summary.stays} stays</span></div>
        <AreaMap result={r} hrefFor={hrefFor} />
      </section>
      <section className="card" aria-label="Filters">
        <div className="grid-3" style={{ alignItems: "end" }}>
          <div className="field">
            <label htmlFor="a-q">Search</label>
            <div style={{ position: "relative" }}>
              <Search size={18} aria-hidden="true" style={{ position: "absolute", left: 12, top: 13, color: "var(--ink-3)" }} />
              <input id="a-q" type="search" className="input" style={{ paddingLeft: 38 }} placeholder="Locality name" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="a-type">Property type</label>
            <select id="a-type" className="select" value={type} onChange={(e) => setType(e.target.value as TypeFilter)}>
              <option value="All">All stays</option>
              {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="a-sort">Sort by</label>
            <select id="a-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="score">Highest score</option><option value="price">Lowest price</option><option value="reviews">Most reviews</option><option value="name">Name (A–Z)</option>
            </select>
          </div>
        </div>
        <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={onlySaved} onChange={(e) => setOnlySaved(e.target.checked)} />Show saved areas only</label>
      </section>
      <p className="muted" aria-live="polite">{list.length} {list.length === 1 ? "locality" : "localities"} with {type === "All" ? "stays" : `${type.toLowerCase()}s`}.</p>
      <Live message={msg} />
      {list.length === 0 ? (
        <div className="card empty">
          <SearchX aria-hidden="true" />
          <h2 style={{ fontSize: 18 }}>No localities match</h2>
          <p className="muted">Try another search, property type, or turn off “saved only”.</p>
          <button type="button" className="btn btn-secondary" onClick={() => { setQ(""); setType("All"); setOnlySaved(false); }}>Clear filters</button>
        </div>
      ) : (
        <ul className="grid-3" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {list.map(({ a, st }) => {
            const on = isSaved(a.id);
            return (
              <li key={a.id} className="card stack" style={{ gap: 12, padding: 20 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "nowrap" }}>
                  <div style={{ minWidth: 0 }}><h2 style={{ fontSize: 19 }}>{a.name}</h2><p className="muted">{tierLabel(a.tier)} · {a.confidence} confidence</p></div>
                  <ScoreBadge score={a.score} />
                </div>
                {nearLine(a) && <p style={{ color: "var(--ink-2)", fontSize: 14 }}>{nearLine(a)}</p>}
                <dl className="row" style={{ margin: 0, gap: 16, fontSize: 14 }}>
                  <div><dt className="muted">Typical price</dt><dd style={{ margin: 0, fontWeight: 700 }} className="num">{st.price ? inr(st.price) : "No data"}</dd></div>
                  <div><dt className="muted">Rating</dt><dd style={{ margin: 0, fontWeight: 700 }} className="num">{st.rating ? <><Star size={14} aria-hidden="true" style={{ verticalAlign: -1 }} /> {st.rating.toFixed(1)}</> : "—"}</dd></div>
                  <div><dt className="muted">Stays</dt><dd style={{ margin: 0, fontWeight: 700 }} className="num">{st.count}</dd></div>
                </dl>
                <div className="row" style={{ marginTop: "auto" }}>
                  <Link href={areaHref(sel.state, sel.city, a.id)} className="btn btn-primary" style={{ flex: 1 }}>View area <ArrowRight aria-hidden="true" /></Link>
                  <button type="button" className="btn btn-secondary" aria-pressed={on} onClick={() => toggle(a.id, a.name, a.score)}>{on ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}{on ? "Saved" : "Save"}</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
