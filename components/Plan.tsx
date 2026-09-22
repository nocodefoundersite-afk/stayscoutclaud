/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft, Home, Calculator, Download, Bookmark, BookmarkCheck, Sparkles, AlertTriangle, Wrench, Ban, MapPin,
  Loader2, MessageSquareText, LogIn, Quote, Heart, Tags, RefreshCw,
} from "lucide-react";
import { inr, areaStats, placesIn, amenityCoverage, nearLine, type CityResult, type LiveArea, type TypeFilter, type AreaResult } from "@/lib/data";
import { useAreaReview } from "@/lib/live";
import { Live } from "@/lib/ui";
import s from "./finder.module.css";

const typeWord = (t: TypeFilter) => (t === "All" ? "stay" : t.toLowerCase());
const verdictTone = (v?: string) => (v === "Open here" ? "good" : v === "Avoid" ? "bad" : "warn");
const prioTone = (p: string) => (p === "Must fix" ? "bad" : p === "Should fix" ? "warn" : "neutral");

export function planData(result: CityResult, area: LiveArea, type: TypeFilter, review: AreaResult | null) {
  const places = placesIn(result, area, type === "All" ? "All" : type);
  const cov = amenityCoverage(places.length >= 3 ? places : placesIn(result, area, "All"));
  const must = cov.total >= 3 ? cov.items.filter((x) => x.pct >= 70).slice(0, 6) : [];
  const gaps = cov.total >= 3 ? cov.items.filter((x) => x.pct < 45 && x.count >= 1).slice(0, 6) : [];
  const ai = result.ai || {};
  const lower = area.name.toLowerCase();
  const pricing = (ai.pricing_by_location || []).filter((p) => (p.areas || []).some((x) => x.toLowerCase().includes(lower) || lower.includes(x.toLowerCase())));
  const avoidHere = (ai.avoid_areas || []).find((x) => x.area.toLowerCase().includes(lower) || lower.includes(x.area.toLowerCase()));
  const bestHere = (ai.best_areas || []).find((x) => x.area.toLowerCase().includes(lower) || lower.includes(x.area.toLowerCase()));
  const avoid: string[] = [];
  if (avoidHere) avoid.push(`${area.name} itself: ${avoidHere.why}`);
  if (area.lowRatedPct >= 30) avoid.push(`${area.lowRatedPct}% of rated stays here score under 4.0, so guests are quick to complain. Don’t open with basic standards.`);
  if (review?.ai?.verdict === "Avoid" && review.ai.verdict_reason) avoid.push(review.ai.verdict_reason);
  for (const x of ai.avoid_areas || []) if (x !== avoidHere) avoid.push(`${x.area}: ${x.why}`);
  return { cov, must, gaps, pricing, avoid, bestHere, avoidHere, st: areaStats(result, area, type) };
}

export default function Plan(props: {
  result: CityResult; area: LiveArea; type: TypeFilter; cityKey: string; cityName: string; signedIn: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>; back: () => void; onPlan: (price: number | null) => void; saved: boolean; onSave: () => void;
}) {
  const { result, area, type, cityName } = props;
  const review = useAreaReview(props.cityKey, area.id);
  const rv = review.job.status === "ready" ? (review.job.result as AreaResult) : null;
  const d = planData(result, area, type, rv);
  const [msg, setMsg] = useState("");
  const price = d.st.price;

  function downloadChecklist() {
    const lines = [
      `StayScout checklist: ${typeWord(type)} in ${area.name}, ${cityName}`,
      `Live data from Google Maps, Airbnb and OpenStreetMap. Research, not investment advice.`,
      ``,
      `Typical nightly price: ${price ? inr(price) : "not enough price data"}`,
      nearLine(area) ? `Nearest: ${nearLine(area)}` : "",
      ``,
      `Amenities to prioritise:`,
      ...d.must.map((x) => `[ ] ${x.name} (${x.pct}% of stays have it)`),
      ...d.gaps.map((x) => `[ ] ${x.name} (only ${x.pct}% offer it: a chance to stand out)`),
      ...(rv?.ai?.must_have_amenities || []).map((x) => `[ ] ${x} (guests ask for it in reviews)`),
      ``,
      `Fix these guest problems:`,
      ...(rv?.ai?.problems || []).map((p) => `[ ] ${p.problem} (${p.mentions}): ${p.fix} (${p.priority}; cost ${p.cost_inr})`),
      ...(rv ? [] : ["(Run the guest review analysis to fill this in.)"]),
      ``,
      `Lines for your listing:`,
      ...(rv?.ai?.website_lines || []).map((x) => `- ${x}`),
      ``,
      `Avoid:`,
      ...d.avoid.map((x) => `[ ] ${x}`),
    ].filter((x, i, a) => !(x === "" && a[i - 1] === ""));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `stayscout-checklist-${area.id}.txt`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg("Checklist downloaded.");
  }

  return (
    <div className="stack">
      <Live message={msg} />
      <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={props.back}><ArrowLeft aria-hidden="true" />Back to properties</button>
      <div className={`card ${s.planHead}`}>
        <p className="muted">Your plan · live data{rv?.ai?.verdict ? <> · <span className={`pill ${verdictTone(rv.ai.verdict)}`}>{rv.ai.verdict}</span></> : null}</p>
        <h2 id="results-h" ref={props.headingRef} tabIndex={-1} className={s.rh}>A {typeWord(type)} in {area.name}, {cityName}</h2>
        <p style={{ color: "var(--ink-2)" }}>
          Typical {typeWord(type)} price here: <b>{price ? `${inr(price)} a night` : "not enough price data yet"}</b>
          {d.st.rating ? <> · average rating <b>{d.st.rating.toFixed(1)}</b> out of five</> : null} · {d.st.count} comparable {d.st.count === 1 ? "stay" : "stays"}.
          {d.bestHere ? ` ${d.bestHere.why}` : ""}
        </p>
        {nearLine(area) && <p className="muted"><MapPin size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> Nearest: {nearLine(area)}</p>}
        <div className="row">
          <button className="btn btn-primary" onClick={() => props.onPlan(price)}><Home aria-hidden="true" />Plan my property</button>
          <Link className="btn btn-secondary" href={price ? `/calculator/?price=${price}` : "/calculator/"}><Calculator aria-hidden="true" />Rent vs buy calculator</Link>
          <button className="btn btn-secondary" onClick={downloadChecklist}><Download aria-hidden="true" />Download checklist</button>
          <button className="btn btn-ghost" onClick={props.onSave} aria-pressed={props.saved}>{props.saved ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}{props.saved ? "Saved" : "Save area"}</button>
        </div>
      </div>

      <ReviewPanel review={review} areaName={area.name} signedIn={props.signedIn} />

      <div className="grid-2">
        <div className="card">
          <div className="card-h"><h3><Sparkles size={18} aria-hidden="true" style={{ verticalAlign: -3, color: "var(--brand)" }} /> Amenities to prioritise</h3></div>
          {d.must.length || d.gaps.length || rv?.ai?.must_have_amenities?.length ? (
            <ul className="list">
              {d.must.map((x) => <li key={"m" + x.name}>{x.name} <span className="muted">({x.pct}% of stays have it; guests expect it)</span></li>)}
              {d.gaps.map((x) => <li key={"g" + x.name}>{x.name} <span className="muted">(only {x.pct}% offer it; a chance to stand out)</span></li>)}
              {(rv?.ai?.must_have_amenities || []).map((x) => <li key={"r" + x}>{x} <span className="muted">(asked for in reviews)</span></li>)}
            </ul>
          ) : (
            <p className="muted">Google Maps didn’t list enough amenities for stays here. Run the guest review analysis to see what guests ask for.</p>
          )}
        </div>
        <div className="card">
          <div className="card-h"><h3><Tags size={18} aria-hidden="true" style={{ verticalAlign: -3, color: "var(--brand)" }} /> Pricing by location</h3></div>
          {d.pricing.length ? (
            <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12 }}>
              {d.pricing.map((p) => (
                <li key={p.location}><b>{p.location}</b>: {p.price_range_inr} <span className="muted">· {p.who_stays}</span><p style={{ color: "var(--ink-2)", fontSize: 15 }}>{p.advice}</p></li>
              ))}
            </ul>
          ) : (
            <p className="muted">No location-based pricing pattern stood out for {area.name} in this analysis.</p>
          )}
        </div>
      </div>

      {rv?.ai?.problems && rv.ai.problems.length > 0 && (
        <>
          <div className="card">
            <div className="card-h"><h3><AlertTriangle size={18} aria-hidden="true" style={{ verticalAlign: -3, color: "var(--warn)" }} /> Frequent customer problems and fixes</h3><span className="muted">From {rv.reviewsAnalysed} recent reviews of {rv.places} stays</span></div>
            <div className="tbl-wrap">
              <table className="tbl rtbl">
                <thead><tr><th scope="col">Problem</th><th scope="col">Mentions</th><th scope="col">What to do</th><th scope="col">Rough cost</th><th scope="col">Priority</th></tr></thead>
                <tbody>{rv.ai.problems.map((c) => (
                  <tr key={c.problem}>
                    <td className="rt-full"><b>{c.problem}</b></td>
                    <td data-label="Mentions">{c.mentions}</td>
                    <td className="rt-full" data-label="What to do"><Wrench size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> {c.fix}</td>
                    <td data-label="Rough cost">{c.cost_inr}</td>
                    <td data-label="Priority"><span className={`pill ${prioTone(c.priority)}`}>{c.priority}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          {!!rv.ai.website_lines?.length && (
            <div className="card">
              <div className="card-h"><h3><Quote size={18} aria-hidden="true" style={{ verticalAlign: -3, color: "var(--brand)" }} /> Lines for your website or listing</h3></div>
              <ul className="list">{rv.ai.website_lines.map((x) => <li key={x}>{x}</li>)}</ul>
              <p className="muted" style={{ marginTop: 12 }}>Only use a line once the fix is actually in place.</p>
            </div>
          )}
        </>
      )}

      {d.avoid.length > 0 && (
        <div className="card">
          <div className="card-h"><h3><Ban size={18} aria-hidden="true" style={{ verticalAlign: -3, color: "var(--bad)" }} /> What to avoid</h3></div>
          <ul className="list">{d.avoid.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      <p className="muted">Built from live Google Maps, Airbnb and OpenStreetMap data, summarised by AI. It isn’t investment advice; visit the area and check local rules before committing money.</p>
    </div>
  );
}

/** Guest-review analysis: start it (signed in), show progress, then the summary and verdict. */
export function ReviewPanel({ review, areaName, signedIn }: { review: ReturnType<typeof useAreaReview>; areaName: string; signedIn: boolean }) {
  const st = review.job.status;
  if (st === "ready") {
    const rv = review.job.result as AreaResult;
    return (
      <div className="card stack" style={{ gap: 12 }}>
        <div className="card-h" style={{ marginBottom: 0 }}>
          <h3><MessageSquareText size={18} aria-hidden="true" style={{ verticalAlign: -3, color: "var(--brand)" }} /> What guests say in {areaName}</h3>
          {rv.ai?.verdict && <span className={`pill ${verdictTone(rv.ai.verdict)}`}>{rv.ai.verdict}</span>}
        </div>
        {rv.ai?.summary && <p>{rv.ai.summary}</p>}
        {rv.ai?.verdict_reason && <p style={{ color: "var(--ink-2)" }}>{rv.ai.verdict_reason}</p>}
        {!!rv.ai?.guests_love?.length && (
          <p style={{ color: "var(--ink-2)" }}><Heart size={14} aria-hidden="true" style={{ verticalAlign: -2, color: "var(--good)" }} /> Guests like: {rv.ai.guests_love.join(", ")}.</p>
        )}
        <p className="muted">Themes from {rv.reviewsAnalysed} recent Google reviews. We don’t quote or name individual guests.</p>
      </div>
    );
  }
  if (st === "running" || st === "analyzing") {
    return (
      <div className="card row" aria-busy="true" role="status">
        <Loader2 className="spin" aria-hidden="true" style={{ color: "var(--accent-text)" }} />
        <span><b>{review.job.step || "Reading the latest guest reviews…"}</b> <span className="muted">Usually 1 to 3 minutes.</span></span>
      </div>
    );
  }
  if (st === "checking" || st === "idle") {
    return <div className="card row muted" aria-busy="true"><Loader2 className="spin" aria-hidden="true" />Checking for a guest review analysis…</div>;
  }
  if (st === "error") {
    return (
      <div className="card row" style={{ justifyContent: "space-between" }}>
        <span className="muted">{review.job.error}</span>
        <button type="button" className="btn btn-secondary" onClick={review.retry}><RefreshCw aria-hidden="true" />Try again</button>
      </div>
    );
  }
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <h3><MessageSquareText size={18} aria-hidden="true" style={{ verticalAlign: -3, color: "var(--brand)" }} /> Find out what guests complain about in {areaName}</h3>
      {st === "failed" && <p className="status err">{review.job.error || "The last review analysis didn’t finish."}</p>}
      <p style={{ color: "var(--ink-2)" }}>We read the newest Google reviews of the top stays here, then list the problems, fixes, costs and lines for your listing. Uses 1 of your monthly data fetches.</p>
      {review.startError && <p className="status err" role="alert">{review.startError.message}</p>}
      <div className="row">
        {signedIn ? (
          <button type="button" className="btn btn-primary" onClick={review.start} disabled={review.starting}>
            {review.starting ? <Loader2 className="spin" aria-hidden="true" /> : <MessageSquareText aria-hidden="true" />}{review.starting ? "Starting…" : "Analyse guest reviews"}
          </button>
        ) : (
          <Link href="/login/?next=/" className="btn btn-primary"><LogIn aria-hidden="true" />Sign in to analyse reviews</Link>
        )}
      </div>
    </div>
  );
}
