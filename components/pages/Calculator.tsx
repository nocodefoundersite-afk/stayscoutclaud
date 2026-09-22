/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Info } from "lucide-react";
import { inr } from "@/lib/data";
import { compute, type CalcInput } from "@/lib/calc";
import { PageHeader } from "@/lib/ui";

type Key = keyof CalcInput;
type FieldDef = { k: Key; label: string; unit: "₹" | "%" | "months" | "years"; min: number; max: number; hint?: string; int?: boolean };

const DEFAULTS: Record<Key, string> = {
  price: "4000", occupancy: "55", commission: "15", opex: "25",
  rent: "45000", depositMonths: "3", setup: "400000",
  purchase: "8500000", downPct: "25", stampPct: "7", rate: "9", years: "20", maintenance: "60000", appreciation: "5",
  horizon: "5",
};

const COMMON: FieldDef[] = [
  { k: "price", label: "Nightly price", unit: "₹", min: 100, max: 500000 },
  { k: "occupancy", label: "Occupancy", unit: "%", min: 0, max: 100, hint: "Share of nights booked across the year" },
  { k: "commission", label: "Platform commission", unit: "%", min: 0, max: 50 },
  { k: "opex", label: "Running costs", unit: "%", min: 0, max: 90, hint: "Staff, cleaning, utilities, as a share of revenue" },
  { k: "setup", label: "Furnishing and setup", unit: "₹", min: 0, max: 100000000 },
  { k: "horizon", label: "Compare over", unit: "years", min: 1, max: 30, int: true },
];
const RENT: FieldDef[] = [
  { k: "rent", label: "Monthly rent", unit: "₹", min: 0, max: 10000000 },
  { k: "depositMonths", label: "Security deposit", unit: "months", min: 0, max: 24, int: true, hint: "Assumed returned at the end" },
];
const BUY: FieldDef[] = [
  { k: "purchase", label: "Purchase price", unit: "₹", min: 0, max: 5000000000 },
  { k: "downPct", label: "Down payment", unit: "%", min: 0, max: 100 },
  { k: "stampPct", label: "Stamp duty and registration", unit: "%", min: 0, max: 20 },
  { k: "rate", label: "Loan interest rate", unit: "%", min: 0, max: 30 },
  { k: "years", label: "Loan term", unit: "years", min: 1, max: 30, int: true },
  { k: "maintenance", label: "Yearly maintenance and tax", unit: "₹", min: 0, max: 100000000 },
  { k: "appreciation", label: "Yearly price growth", unit: "%", min: -20, max: 30, hint: "An assumption, not a forecast" },
];
const ALL = [...COMMON, ...RENT, ...BUY];

function check(d: FieldDef, raw: string) {
  const v = raw.trim().replace(/,/g, "");
  if (v === "") return "Required.";
  const n = Number(v);
  if (!isFinite(n)) return "Enter a number.";
  if (d.min >= 0 && n < 0) return "Can’t be negative.";
  if (n < d.min) return `Must be at least ${d.min}.`;
  if (n > d.max) return `Must be ${d.max.toLocaleString("en-IN")} or less.`;
  if (d.int && !Number.isInteger(n)) return "Use a whole number.";
  return "";
}

const months = (m: number | null) => (m === null ? "Never at these inputs" : m < 1 ? "Under a month" : m > 600 ? "More than 50 years" : `${Math.ceil(m)} months (${(m / 12).toFixed(1)} years)`);
const pct = (p: number | null) => (p === null ? "—" : p > 100 ? "Above 100% (not reachable)" : `${Math.ceil(p)}%`);

export default function Calculator() {
  const [v, setV] = useState<Record<Key, string>>(DEFAULTS);
  const [note, setNote] = useState("");

  useEffect(() => {
    const h = window.location.hash;
    const qs = window.location.search || (h.includes("?") ? h.slice(h.indexOf("?")) : "");
    const p = new URLSearchParams(qs).get("price");
    if (p && /^\d+$/.test(p) && Number(p) > 0) { setV((x) => ({ ...x, price: p })); setNote(`Nightly price set to ${inr(Number(p))} from the area you chose.`); }
  }, []);

  const errors = useMemo(() => Object.fromEntries(ALL.map((d) => [d.k, check(d, v[d.k])])) as Record<Key, string>, [v]);
  const valid = Object.values(errors).every((e) => !e);
  const r = useMemo(() => (valid ? compute(Object.fromEntries(ALL.map((d) => [d.k, Number(v[d.k].replace(/,/g, ""))])) as CalcInput) : null), [v, valid]);
  const horizon = Number(v.horizon);

  const input = (d: FieldDef) => (
    <div className="field" key={d.k}>
      <label htmlFor={`c-${d.k}`}>{d.label} <span className="muted">({d.unit})</span></label>
      <input id={`c-${d.k}`} className="input num" inputMode="decimal" value={v[d.k]} onChange={(e) => setV((x) => ({ ...x, [d.k]: e.target.value }))} aria-invalid={!!errors[d.k]} aria-describedby={`c-${d.k}-h`} />
      <span id={`c-${d.k}-h`} className={errors[d.k] ? "error" : "hint"}>{errors[d.k] || d.hint || " "}</span>
    </div>
  );

  const better = r ? (r.rent.end >= r.buy.end ? "rent" : "buy") : null;
  const gap = r ? Math.abs(r.rent.end - r.buy.end) : 0;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader
        title="Rent vs buy"
        lead="Estimate what renting or buying a property for guests could look like on your own numbers. Change any value and results update instantly."
        actions={<button type="button" className="btn btn-secondary" onClick={() => { setV(DEFAULTS); setNote("Values reset to the defaults."); }}><RotateCcw aria-hidden="true" />Reset</button>}
      />
      {note && <p className="status info" role="status">{note}</p>}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate aria-label="Calculator inputs">
          <fieldset className="card" style={{ margin: 0 }}><legend className="sr">Income and running costs</legend><h2 style={{ fontSize: 18, marginBottom: 16 }}>Income and running costs</h2><div className="grid-2">{COMMON.map(input)}</div></fieldset>
          <fieldset className="card" style={{ margin: 0 }}><legend className="sr">If you rent</legend><h2 style={{ fontSize: 18, marginBottom: 16 }}>If you rent</h2><div className="grid-2">{RENT.map(input)}</div></fieldset>
          <fieldset className="card" style={{ margin: 0 }}><legend className="sr">If you buy</legend><h2 style={{ fontSize: 18, marginBottom: 16 }}>If you buy</h2><div className="grid-2">{BUY.map(input)}</div></fieldset>
        </form>

        <section className="stack" aria-labelledby="res-h" aria-live="polite" style={{ position: "sticky", top: "calc(var(--topbar) + 16px)" }}>
          <div className="card">
            <h2 id="res-h" style={{ fontSize: 20, marginBottom: 16 }}>Results</h2>
            {!r ? (
              <p className="status err">Fix the highlighted fields to see results.</p>
            ) : (
              <div className="stack">
                <div className="grid-2">
                  <div className="stat"><b className="num">{inr(r.revenue)}</b><span>Monthly revenue ({r.nights.toFixed(1)} nights)</span></div>
                  <div className="stat"><b className="num">{inr(r.running)}</b><span>Commission and running costs</span></div>
                </div>
                <div className="tbl-wrap">
                  <table className="tbl" style={{ minWidth: 0 }}>
                    <thead><tr><th scope="col"></th><th scope="col" className="num">Rent</th><th scope="col" className="num">Buy</th></tr></thead>
                    <tbody>
                      <tr><th scope="row">Cash needed upfront</th><td className="num">{inr(r.rent.upfront)}</td><td className="num">{inr(r.buy.upfront)}</td></tr>
                      <tr><th scope="row">Monthly housing cost</th><td className="num">{inr(Number(v.rent))}</td><td className="num">{inr(r.buy.emi + Number(v.maintenance) / 12)}</td></tr>
                      <tr><th scope="row">Monthly profit</th><td className="num" style={{ color: r.rent.monthly < 0 ? "var(--bad)" : undefined }}>{inr(r.rent.monthly)}</td><td className="num" style={{ color: r.buy.monthly < 0 ? "var(--bad)" : undefined }}>{inr(r.buy.monthly)}</td></tr>
                      <tr><th scope="row">Pays back upfront cash in</th><td className="num">{months(r.rent.payback)}</td><td className="num">{months(r.buy.payback)}</td></tr>
                      <tr><th scope="row">Break-even occupancy</th><td className="num">{pct(r.rent.breakEven)}</td><td className="num">{pct(r.buy.breakEven)}</td></tr>
                      <tr><th scope="row">Position after {horizon} {horizon === 1 ? "year" : "years"}</th><td className="num"><b>{inr(r.rent.end)}</b></td><td className="num"><b>{inr(r.buy.end)}</b></td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="muted">Buy position = cash from operations minus upfront costs, plus equity (estimated value {inr(r.buy.value)} minus loan still owed). Rent position includes the returned deposit.</p>
                <p className="status info" style={{ fontSize: 15 }}>
                  On these inputs, <b>{better === "rent" ? "renting" : "buying"}</b> leaves you about <b>{inr(gap)}</b> ahead after {horizon} {horizon === 1 ? "year" : "years"}.
                </p>
                {better === "buy" && r.buy.monthly < 0 && (
                  <p className="status err" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                    Buying only comes out ahead because of the assumed {v.appreciation}% yearly price growth. From operations alone it loses about {inr(Math.abs(r.buy.monthly))} a month.
                  </p>
                )}
              </div>
            )}
          </div>
          <p className="muted" style={{ display: "flex", gap: 8 }}><Info size={16} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />A simple estimate for planning, not financial or investment advice. It ignores income tax, seasonality and vacancy between leases. Check the numbers with a chartered accountant before committing money.</p>
        </section>
      </div>
    </div>
  );
}
