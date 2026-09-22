/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import Link from "next/link";
import { Loader2, MapPin, Radar, AlertTriangle, RefreshCw } from "lucide-react";
import type { CityResult } from "@/lib/data";
import { useCity } from "@/lib/live";

/** Shows the right state for the chosen city and renders children only when its analysis is ready. */
export default function CityGate({ state, city, children, what = "this page" }: {
  state: string; city: string; what?: string;
  children: (r: CityResult, key: string, readyAt?: number) => React.ReactNode;
}) {
  const c = useCity(state, city);
  const st = c.job.status;
  if (!state || !city) {
    return (
      <div className="card empty">
        <MapPin aria-hidden="true" />
        <h2 style={{ fontSize: 20 }}>Choose a city first</h2>
        <p className="muted" style={{ maxWidth: "52ch" }}>Pick a state and city in the finder. Once it’s analysed, {what} fills with live prices, ratings and localities.</p>
        <Link href="/" className="btn btn-primary">Find a location</Link>
      </div>
    );
  }
  if (st === "checking" || st === "idle") {
    return <div className="card empty" aria-busy="true"><Loader2 className="spin" aria-hidden="true" /><p className="muted">Loading {city}…</p></div>;
  }
  if (st === "running" || st === "analyzing") {
    return (
      <div className="card empty" aria-busy="true">
        <Loader2 className="spin" aria-hidden="true" />
        <h2 style={{ fontSize: 20 }}>{city} is being analysed</h2>
        <p className="muted">{c.job.step || "Collecting stays…"} This page fills in when it’s done.</p>
        <Link href="/" className="btn btn-secondary">Watch progress in the finder</Link>
      </div>
    );
  }
  if (st === "error") {
    return (
      <div className="card empty">
        <AlertTriangle aria-hidden="true" />
        <h2 style={{ fontSize: 20 }}>Couldn’t load {city}</h2>
        <p className="muted">{c.job.error}</p>
        <button type="button" className="btn btn-secondary" onClick={c.retry}><RefreshCw aria-hidden="true" />Try again</button>
      </div>
    );
  }
  if (st !== "ready" || !c.job.result || !c.key) {
    return (
      <div className="card empty">
        <Radar aria-hidden="true" />
        <h2 style={{ fontSize: 20 }}>{city} hasn’t been analysed this week</h2>
        <p className="muted" style={{ maxWidth: "52ch" }}>Run a live analysis from the finder. It takes a few minutes and the results appear here too.</p>
        <Link href="/" className="btn btn-primary">Analyse {city}</Link>
      </div>
    );
  }
  return <>{children(c.job.result, c.key, c.job.readyAt)}</>;
}
