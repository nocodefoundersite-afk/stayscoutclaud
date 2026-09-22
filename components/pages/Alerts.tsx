/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import { useState } from "react";
import { BellPlus, Bell, Trash2, Pause, Play, BellRing } from "lucide-react";
import { inr, areaStats, type CityResult } from "@/lib/data";
import { KEYS, useLocal, EMPTY_SELECTION, type Selection } from "@/lib/storage";
import CityGate from "@/components/CityGate";
import { useCity } from "@/lib/live";
import { Live, PageHeader } from "@/lib/ui";

type Kind = "price_below" | "price_above" | "rating_below" | "score_above";
export type Alert = { id: string; key: string; city: string; state: string; areaId: string; areaName: string; kind: Kind; value: number; paused: boolean; created: string };
const KINDS: { v: Kind; l: string; unit: "price" | "rating" | "score" }[] = [
  { v: "price_below", l: "Typical price drops below", unit: "price" },
  { v: "price_above", l: "Typical price rises above", unit: "price" },
  { v: "rating_below", l: "Average rating falls below", unit: "rating" },
  { v: "score_above", l: "Opportunity score rises above", unit: "score" },
];
const kindOf = (k: Kind) => KINDS.find((x) => x.v === k)!;
const describe = (a: Alert) => {
  const k = kindOf(a.kind);
  return `${k.l} ${k.unit === "price" ? inr(a.value) : k.unit === "rating" ? `${a.value.toFixed(1)} out of five` : `${a.value} out of 100`}`;
};

/** Checks an alert against the latest live analysis of its city. */
function check(a: Alert, r: CityResult | null, key: string | null) {
  if (!r || key !== a.key) return null;
  const area = r.areas.find((x) => x.id === a.areaId);
  if (!area) return { met: false, now: "Locality not in the latest analysis" };
  const st = areaStats(r, area, "All");
  if (a.kind === "price_below" || a.kind === "price_above") {
    if (!st.price) return { met: false, now: "No price data yet" };
    return { met: a.kind === "price_below" ? st.price < a.value : st.price > a.value, now: `Now ${inr(st.price)}` };
  }
  if (a.kind === "rating_below") {
    if (st.rating == null) return { met: false, now: "No rating data yet" };
    return { met: st.rating < a.value, now: `Now ${st.rating.toFixed(2)}` };
  }
  return { met: area.score > a.value, now: `Now ${area.score}` };
}

export default function Alerts() {
  const [sel, , ready] = useLocal<Selection>(KEYS.selection, EMPTY_SELECTION);
  const [alerts, setAlerts] = useLocal<Alert[]>(KEYS.alerts, []);
  const [msg, setMsg] = useState("");

  const remove = (id: string) => { setAlerts((p) => p.filter((a) => a.id !== id)); setMsg("Alert deleted."); };
  const togglePause = (id: string) => {
    const was = alerts.find((a) => a.id === id)?.paused;
    setAlerts((p) => p.map((a) => (a.id === id ? { ...a, paused: !a.paused } : a)));
    setMsg(was ? "Alert resumed." : "Alert paused.");
  };

  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader title="Alerts" lead="Watch a locality’s price, rating or score. Alerts are saved on this device and checked against the latest analysis whenever you open this page." />
      <p className="status info" role="note"><Bell size={16} aria-hidden="true" style={{ verticalAlign: -3 }} /> Email notifications aren’t switched on yet, so check back here. Analyses refresh when a city is re-run after 7 days.</p>
      <Live message={msg} />
      {ready && (
        <CityGate state={sel.state} city={sel.city} what="alerts">
          {(r, key) => <AlertForm result={r} cityKey={key} sel={sel} alerts={alerts} add={(a) => { setAlerts((p) => [a, ...p]); setMsg(`Alert added for ${a.areaName}.`); }} />}
        </CityGate>
      )}
      <AlertList alerts={alerts} sel={sel} remove={remove} togglePause={togglePause} />
    </div>
  );
}

function AlertForm({ result, cityKey, sel, alerts, add }: { result: CityResult; cityKey: string; sel: Selection; alerts: Alert[]; add: (a: Alert) => void }) {
  const [areaId, setAreaId] = useState("");
  const [kind, setKind] = useState<Kind>("price_below");
  const [value, setValue] = useState("");
  const [errors, setErrors] = useState<{ area?: string; value?: string }>({});
  const unit = kindOf(kind).unit;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: typeof errors = {};
    if (!areaId) er.area = "Choose a locality.";
    const n = Number(value.replace(/,/g, ""));
    if (value.trim() === "" || !isFinite(n)) er.value = unit === "price" ? "Enter a price, e.g. 3500." : unit === "rating" ? "Enter a rating, e.g. 4.3." : "Enter a score, e.g. 60.";
    else if (n < 0) er.value = "Can’t be negative.";
    else if (unit === "rating" && (n < 1 || n > 5)) er.value = "Ratings go from 1 to 5.";
    else if (unit === "score" && n > 100) er.value = "Scores go up to 100.";
    else if (unit === "price" && n === 0) er.value = "Price must be more than zero.";
    if (!er.area && !er.value && alerts.some((a) => a.key === cityKey && a.areaId === areaId && a.kind === kind && a.value === n)) er.value = "You already have this alert.";
    setErrors(er);
    if (Object.keys(er).length) return;
    const area = result.areas.find((a) => a.id === areaId)!;
    add({ id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, key: cityKey, city: sel.city, state: sel.state, areaId, areaName: area.name, kind, value: n, paused: false, created: new Date().toISOString() });
    setValue("");
  };

  return (
    <form className="card stack" onSubmit={submit} noValidate aria-labelledby="new-h">
      <h2 id="new-h" style={{ fontSize: 20 }}>New alert in {sel.city}</h2>
      <div className="grid-3" style={{ alignItems: "start" }}>
        <div className="field">
          <label htmlFor="al-area">Locality</label>
          <select id="al-area" className="select" value={areaId} onChange={(e) => setAreaId(e.target.value)} aria-invalid={!!errors.area} aria-describedby={errors.area ? "al-area-e" : undefined}>
            <option value="">Choose a locality</option>
            {result.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {errors.area && <span id="al-area-e" className="error">{errors.area}</span>}
        </div>
        <div className="field">
          <label htmlFor="al-kind">When</label>
          <select id="al-kind" className="select" value={kind} onChange={(e) => { setKind(e.target.value as Kind); setErrors({}); }}>
            {KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="al-val">{unit === "price" ? "Price (₹ per night)" : unit === "rating" ? "Rating (out of five)" : "Score (out of 100)"}</label>
          <input id="al-val" className="input num" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={!!errors.value} aria-describedby={errors.value ? "al-val-e" : undefined} />
          {errors.value && <span id="al-val-e" className="error">{errors.value}</span>}
        </div>
      </div>
      <div><button type="submit" className="btn btn-primary"><BellPlus aria-hidden="true" />Add alert</button></div>
    </form>
  );
}

function AlertList({ alerts, sel, remove, togglePause }: { alerts: Alert[]; sel: Selection; remove: (id: string) => void; togglePause: (id: string) => void }) {
  return (
    <section className="card" aria-labelledby="list-h">
      <div className="card-h"><h2 id="list-h">Your alerts</h2><span className="muted">{alerts.length} saved</span></div>
      {alerts.length === 0 ? (
        <div className="empty"><Bell aria-hidden="true" /><p>No alerts yet.</p></div>
      ) : (
        <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 0 }}>
          {alerts.map((a) => <AlertRow key={a.id} a={a} sel={sel} remove={remove} togglePause={togglePause} />)}
        </ul>
      )}
    </section>
  );
}

function AlertRow({ a, sel, remove, togglePause }: { a: Alert; sel: Selection; remove: (id: string) => void; togglePause: (id: string) => void }) {
  const inCity = a.city === sel.city && a.state === sel.state;
  return (
    <li className="row" style={{ justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
      <div style={{ minWidth: 0 }}>
        <b>{a.areaName}</b> <span className="muted">· {a.city}</span> {a.paused && <span className="pill neutral">Paused</span>}
        <p className="muted">{describe(a)}</p>
        {!a.paused && inCity && <AlertStatus a={a} />}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={() => togglePause(a.id)} aria-label={`${a.paused ? "Resume" : "Pause"} alert for ${a.areaName}`}>{a.paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}{a.paused ? "Resume" : "Pause"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => remove(a.id)} aria-label={`Delete alert for ${a.areaName}`}><Trash2 aria-hidden="true" />Delete</button>
      </div>
    </li>
  );
}

/** Reads the cached city analysis (no new data fetch) to show whether the alert's condition holds. */
function AlertStatus({ a }: { a: Alert }) {
  return (
    <CityGateQuiet state={a.state} city={a.city}>
      {(r, key) => {
        const c = check(a, r, key);
        if (!c) return null;
        return c.met
          ? <p className="pill bad" style={{ marginTop: 6 }}><BellRing size={13} aria-hidden="true" /> Triggered · {c.now}</p>
          : <p className="muted" style={{ marginTop: 4 }}>Not triggered · {c.now}</p>;
      }}
    </CityGateQuiet>
  );
}

function CityGateQuiet({ state, city, children }: { state: string; city: string; children: (r: CityResult, key: string) => React.ReactNode }) {
  const c = useCity(state, city);
  if (c.job.status !== "ready" || !c.job.result || !c.key) return null;
  return <>{children(c.job.result, c.key)}</>;
}
