/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Save, Wand2, Copy, Download, RotateCcw, CheckCircle2, MessageSquareText, Loader2 } from "lucide-react";
import {
  AMENITY_CATALOG, PROPERTY_TYPES, inr, listingLineFor, areaStats, placesIn, amenityCoverage,
  type PropertyType, type CityResult, type LiveArea,
} from "@/lib/data";
import { KEYS, useLocal, EMPTY_SELECTION, type Selection } from "@/lib/storage";
import { useAreaReview } from "@/lib/live";
import CityGate from "@/components/CityGate";
import { Live, PageHeader } from "@/lib/ui";

type Stored = {
  key?: string; state?: string; city?: string; areaId?: string; type?: string; name?: string; bedrooms?: number | string;
  price?: number | string; amenities?: string[]; fixed?: string[]; lines?: string[]; notes?: string;
};
type Form = { name: string; areaId: string; type: PropertyType; bedrooms: string; price: string; amenities: string[]; fixed: string[]; lines: string[]; notes: string };

const MATCH: Record<string, RegExp> = {
  "Wi-Fi": /wi-?fi|internet/i, "Air conditioning": /air.?condition|\bac\b/i, "Power backup": /power|generator|backup/i, "Hot water": /hot water|geyser/i,
  Kitchen: /kitchen/i, Parking: /parking/i, Breakfast: /breakfast/i, "Work desk": /desk|workspace/i, "24/7 check-in": /24|front desk|reception/i,
  "Private pool": /private pool/i, "Swimming pool": /pool/i, Lift: /lift|elevator/i, "Washing machine": /laundry|washing/i, "Window mesh": /mesh|mosquito/i,
  "Sea view": /sea view|ocean|beach/i, "Pet friendly": /pet/i, "Airport transfer": /airport|shuttle/i, "CCTV at entrance": /cctv|security/i,
};

const toForm = (s: Stored, fallbackArea: string): Form => ({
  name: s.name ?? "",
  areaId: s.areaId || fallbackArea,
  type: (PROPERTY_TYPES as string[]).includes(s.type ?? "") ? (s.type as PropertyType) : "Homestay",
  bedrooms: s.bedrooms != null && s.bedrooms !== "" ? String(s.bedrooms) : "2",
  price: s.price != null && s.price !== "" ? String(s.price) : "",
  amenities: Array.isArray(s.amenities) ? s.amenities : ["Wi-Fi", "Air conditioning"],
  fixed: Array.isArray(s.fixed) ? s.fixed : [],
  lines: Array.isArray(s.lines) ? s.lines : [],
  notes: s.notes ?? "",
});

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!f.name.trim()) e.name = "Give your property a name.";
  else if (f.name.trim().length > 60) e.name = "Keep the name under 60 characters.";
  if (!f.areaId) e.areaId = "Choose the locality.";
  const b = Number(f.bedrooms);
  if (!/^\d+$/.test(f.bedrooms.trim()) || b < 1 || b > 50) e.bedrooms = "Enter a whole number from 1 to 50.";
  const p = Number(f.price.replace(/,/g, ""));
  if (f.price.trim() === "") e.price = "Enter your nightly price.";
  else if (!isFinite(p)) e.price = "Enter a number, e.g. 4500.";
  else if (p <= 0) e.price = "Price must be more than zero.";
  else if (p > 500000) e.price = "That looks too high for one night. Check the number.";
  if (f.notes.length > 600) e.notes = "Keep notes under 600 characters.";
  return e;
}

export default function PropertyPage() {
  const [stored, setStored, ready] = useLocal<Stored>(KEYS.property, {});
  const [sel, , selReady] = useLocal<Selection>(KEYS.selection, EMPTY_SELECTION);
  const state = stored.state || sel.state;
  const city = stored.city || sel.city;
  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader
        title="My property"
        lead="Describe your place, tick the local problems you’ve fixed, and get a listing draft that says so. Saved on this device."
      />
      {!ready || !selReady ? (
        <div className="card empty" aria-busy="true"><Loader2 className="spin" aria-hidden="true" /><p className="muted">Loading…</p></div>
      ) : (
        <CityGate state={state} city={city} what="your property plan">
          {(r, key) => <PropertyForm result={r} cityKey={key} state={state} city={city} stored={stored} setStored={setStored} />}
        </CityGate>
      )}
    </div>
  );
}

function PropertyForm({ result, cityKey, state, city, stored, setStored }: {
  result: CityResult; cityKey: string; state: string; city: string; stored: Stored; setStored: (s: Stored) => void;
}) {
  const areas = useMemo(() => [...result.areas].sort((a, b) => b.score - a.score), [result]);
  const sameCity = !stored.key || stored.key === cityKey;
  const [f, setF] = useState<Form>(() => toForm(sameCity ? stored : { ...stored, areaId: "" }, ""));
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [out, setOut] = useState("");

  const area: LiveArea | undefined = areas.find((a) => a.id === f.areaId);
  const review = useAreaReview(cityKey, area ? area.id : null);
  const rv = review.job.status === "ready" ? review.job.result : undefined;
  const problems = rv?.ai?.problems ?? [];
  const aiLines = rv?.ai?.website_lines ?? [];

  // Drop ticks that no longer apply when the locality changes.
  useEffect(() => {
    if (review.job.status !== "ready") return;
    setF((p) => ({
      ...p,
      fixed: p.fixed.filter((x) => problems.some((q) => q.problem === x)),
      lines: p.lines.filter((x) => aiLines.includes(x)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review.job.status, f.areaId]);

  const errors = validate(f);
  const valid = Object.keys(errors).length === 0;
  const show = (k: keyof Form) => (touched ? errors[k] : undefined);
  const stats = area ? areaStats(result, area, f.type) : null;
  const typical = stats?.price ?? null;
  const price = Number(f.price.replace(/,/g, ""));

  const coverage = useMemo(() => {
    if (!area) return null;
    const list = placesIn(result, area, f.type);
    const cov = amenityCoverage(list.length >= 3 ? list : placesIn(result, area, "All"));
    return cov.total >= 3 ? cov : null;
  }, [result, area, f.type]);
  const shareOf = (name: string) => {
    if (!coverage) return undefined;
    const re = MATCH[name];
    const hits = coverage.items.filter((x) => (re ? re.test(x.name) : x.name.toLowerCase() === name.toLowerCase()));
    return hits.length ? Math.max(...hits.map((h) => h.pct)) : 0;
  };

  const priceNote = useMemo(() => {
    if (!area) return null;
    const word = f.type.toLowerCase();
    if (!typical) return { tone: "info" as const, text: `Not enough price data for ${word}s in ${area.name} to compare. Check a few live listings before you set your rate.` };
    if (!isFinite(price) || price <= 0) return { tone: "info" as const, text: `Typical ${word} price in ${area.name}: ${inr(typical)} a night (from ${stats?.priceSamples} live prices).` };
    const d = Math.round(((price - typical) / typical) * 100);
    if (d < -15) return { tone: "warn" as const, text: `${Math.abs(d)}% below the typical ${inr(typical)} for ${word}s here. You may be leaving money on the table.` };
    if (d > 15) return { tone: "warn" as const, text: `${d}% above the typical ${inr(typical)} for ${word}s here. Make sure your amenities and fixes justify it.` };
    return { tone: "good" as const, text: `In line with the typical ${inr(typical)} for ${word}s in ${area.name}.` };
  }, [area, typical, price, f.type, stats?.priceSamples]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((p) => ({ ...p, [k]: v })); setStatus(null); };
  const toggleIn = (k: "amenities" | "fixed" | "lines", v: string) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);
  const persist = () => setStored({ ...f, key: cityKey, state, city, bedrooms: Number(f.bedrooms), price: Number(f.price.replace(/,/g, "")) });

  function draft() {
    if (!area) return "";
    const beds = Number(f.bedrooms);
    const gaps = f.amenities.filter((x) => { const s = shareOf(x); return s !== undefined && s < 45; }).slice(0, 2);
    const title = `${f.name.trim()} · ${beds}-bedroom ${f.type.toLowerCase()} in ${area.name}, ${city}${gaps.length ? ` with ${gaps.join(" and ").toLowerCase()}` : ""}`;
    const near = [area.airport && area.airport.km != null && area.airport.km <= 30 ? `${area.airport.km} km from ${area.airport.name}` : "", area.railway && area.railway.km != null && area.railway.km <= 15 ? `${area.railway.km} km from ${area.railway.name}` : ""].filter(Boolean);
    const love = rv?.ai?.guests_love ?? [];
    const why = [
      ...f.lines,
      ...problems.filter((p) => f.fixed.includes(p.problem)).map((p) => listingLineFor(p.problem, p.fix)),
    ].filter((x, i, arr) => arr.indexOf(x) === i);
    return [
      title,
      "",
      `${f.name.trim()} is a ${beds}-bedroom ${f.type.toLowerCase()} in ${area.name}, ${city}.${near.length ? ` It’s ${near.join(" and ")}.` : ""}${love.length ? ` Guests who stay in ${area.name} enjoy ${love.slice(0, 2).join(" and ").toLowerCase()}.` : ""}`,
      "",
      ...(why.length ? ["Why guests choose us", ...why.map((x) => `• ${x}`), ""] : []),
      "Amenities",
      ...f.amenities.map((x) => `• ${x}`),
      ...(f.notes.trim() ? ["", "Good to know", f.notes.trim()] : []),
    ].join("\n");
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) { setStatus({ kind: "err", text: "Please fix the highlighted fields." }); return; }
    persist();
    setStatus({ kind: "ok", text: "Property saved on this device." });
  };
  const generate = () => {
    setTouched(true);
    if (!valid) { setStatus({ kind: "err", text: "Fill in the required fields before generating a draft." }); return; }
    persist();
    setOut(draft());
    setStatus({ kind: "ok", text: "Listing draft ready below. Edit it before you use it." });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(out); setStatus({ kind: "ok", text: "Draft copied to your clipboard." }); }
    catch { setStatus({ kind: "err", text: "Couldn’t copy automatically. Select the text and copy it manually." }); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([out], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "stayscout-listing-draft.txt";
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus({ kind: "ok", text: "Draft downloaded." });
  };
  const reset = () => {
    setF(toForm({}, "")); setTouched(false); setOut(""); setStored({});
    setStatus({ kind: "info", text: "Form cleared and saved property removed." });
  };

  return (
    <>
      <Live message={status?.text ?? ""} />
      <p className="muted">Planning in <b>{city}, {state}</b>. <Link href="/">Change city in the finder</Link>.</p>

      <form className="card stack" style={{ gap: 20 }} onSubmit={save} noValidate aria-labelledby="pf-h">
        <h2 id="pf-h" style={{ fontSize: 20 }}>Property details</h2>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="p-name">Property name</label>
            <input id="p-name" className="input" value={f.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!show("name")} aria-describedby={show("name") ? "p-name-e" : undefined} autoComplete="off" />
            {show("name") && <span id="p-name-e" className="error">{show("name")}</span>}
          </div>
          <div className="field">
            <label htmlFor="p-area">Locality</label>
            <select id="p-area" className="select" value={f.areaId} onChange={(e) => set("areaId", e.target.value)} aria-invalid={!!show("areaId")} aria-describedby={show("areaId") ? "p-area-e" : "p-area-h"}>
              <option value="">Choose a locality</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name} (score {a.score})</option>)}
            </select>
            {show("areaId") ? <span id="p-area-e" className="error">{show("areaId")}</span> : <span id="p-area-h" className="hint">Localities found in the live analysis of {city}.</span>}
          </div>
          <div className="field">
            <label htmlFor="p-type">Property type</label>
            <select id="p-type" className="select" value={f.type} onChange={(e) => set("type", e.target.value as PropertyType)}>
              {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label htmlFor="p-beds">Bedrooms</label>
              <input id="p-beds" className="input num" inputMode="numeric" value={f.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} aria-invalid={!!show("bedrooms")} aria-describedby={show("bedrooms") ? "p-beds-e" : undefined} />
              {show("bedrooms") && <span id="p-beds-e" className="error">{show("bedrooms")}</span>}
            </div>
            <div className="field">
              <label htmlFor="p-price">Nightly price (₹)</label>
              <input id="p-price" className="input num" inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value)} aria-invalid={!!show("price")} aria-describedby={show("price") ? "p-price-e" : undefined} />
              {show("price") && <span id="p-price-e" className="error">{show("price")}</span>}
            </div>
          </div>
        </div>
        {priceNote && <p className={`status ${priceNote.tone === "good" ? "ok" : priceNote.tone === "warn" ? "warn" : "info"}`}>{priceNote.text}</p>}

        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="lbl" style={{ fontWeight: 600, marginBottom: 4 }}>Amenities you offer</legend>
          <p className="muted" style={{ marginBottom: 8 }}>
            {coverage ? <>“Few offer this” means under 45% of the {coverage.total} stays in {area?.name} that list amenities have it.</> : area ? <>Not enough amenity data for {area.name} to compare.</> : <>Choose a locality to compare with competitors.</>}
          </p>
          <div className="grid-3" style={{ gap: 0 }}>
            {AMENITY_CATALOG.map((m) => {
              const share = shareOf(m);
              return (
                <label key={m} className="check">
                  <input type="checkbox" checked={f.amenities.includes(m)} onChange={() => toggleIn("amenities", m)} />
                  <span>{m}{share !== undefined && share < 45 && <span className="pill good" style={{ marginLeft: 6 }}>Few offer this</span>}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {area && (
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="lbl" style={{ fontWeight: 600, marginBottom: 4 }}>Guest problems in {area.name}: which have you fixed?</legend>
            {review.job.status === "ready" ? (
              problems.length ? (
                <>
                  <p className="muted" style={{ marginBottom: 8 }}>From {rv?.reviewsAnalysed} recent guest reviews. Ticked fixes become lines in your listing.</p>
                  {problems.map((c) => (
                    <label key={c.problem} className="check">
                      <input type="checkbox" checked={f.fixed.includes(c.problem)} onChange={() => toggleIn("fixed", c.problem)} />
                      <span><b>{c.problem}</b> <span className="muted">· {c.mentions} · fix: {c.fix}</span></span>
                    </label>
                  ))}
                </>
              ) : <p className="muted">No recurring problems were found in recent reviews for {area.name}.</p>
            ) : review.job.status === "checking" ? (
              <p className="muted"><Loader2 size={16} className="spin" aria-hidden="true" style={{ verticalAlign: -3 }} /> Checking for a review analysis…</p>
            ) : review.job.status === "running" || review.job.status === "analyzing" ? (
              <p className="muted"><Loader2 size={16} className="spin" aria-hidden="true" style={{ verticalAlign: -3 }} /> {review.job.step || "Reading guest reviews…"} Check back in a few minutes.</p>
            ) : (
              <p className="status info">
                <MessageSquareText size={16} aria-hidden="true" style={{ verticalAlign: -3 }} /> Guest reviews for {area.name} haven’t been analysed yet. Open the locality in the <Link href="/">finder</Link> and choose <b>Analyse guest reviews</b> to see its common problems here.
              </p>
            )}
          </fieldset>
        )}

        {aiLines.length > 0 && (
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="lbl" style={{ fontWeight: 600, marginBottom: 4 }}>Lines for your listing</legend>
            <p className="muted" style={{ marginBottom: 8 }}>Suggested from what guests in {area?.name} complain about. Tick only promises you can keep.</p>
            {aiLines.map((l) => (
              <label key={l} className="check">
                <input type="checkbox" checked={f.lines.includes(l)} onChange={() => toggleIn("lines", l)} />
                <span>{l}</span>
              </label>
            ))}
          </fieldset>
        )}

        <div className="field">
          <label htmlFor="p-notes">Anything else guests should know (optional)</label>
          <textarea id="p-notes" className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} aria-invalid={!!show("notes")} aria-describedby="p-notes-h" />
          <span id="p-notes-h" className={show("notes") ? "error" : "hint"}>{show("notes") ?? `${f.notes.length}/600 characters`}</span>
        </div>

        {status && <p className={`status ${status.kind}`}>{status.kind === "ok" && <CheckCircle2 size={16} aria-hidden="true" style={{ verticalAlign: -3 }} />} {status.text}</p>}

        <div className="row">
          <button type="submit" className="btn btn-primary"><Save aria-hidden="true" />Save property</button>
          <button type="button" className="btn btn-secondary" onClick={generate}><Wand2 aria-hidden="true" />Generate listing draft</button>
          <button type="button" className="btn btn-ghost" onClick={reset}><RotateCcw aria-hidden="true" />Clear</button>
        </div>
      </form>

      {out && (
        <section className="card stack" aria-labelledby="draft-h">
          <div className="card-h" style={{ marginBottom: 0 }}><h2 id="draft-h">Listing draft</h2></div>
          <label htmlFor="draft" className="sr">Listing draft text</label>
          <textarea id="draft" className="textarea" style={{ minHeight: 280 }} value={out} onChange={(e) => setOut(e.target.value)} />
          <p className="muted">Check every claim is true for your property before publishing it.</p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={copy}><Copy aria-hidden="true" />Copy</button>
            <button type="button" className="btn btn-secondary" onClick={download}><Download aria-hidden="true" />Download .txt</button>
          </div>
        </section>
      )}
    </>
  );
}
