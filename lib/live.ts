/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
/**
 * Live data client. Everything needs a signed-in account (the server checks the token).
 * Reads of cached analyses are free; starting a new analysis spends data credit.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { accessToken } from "./auth";
import { COUNTRY, cityKey, type AreaResult, type CityResult } from "./data";

export type JobStatus = "idle" | "checking" | "none" | "running" | "analyzing" | "ready" | "failed" | "error";
export type Job<T> = { status: JobStatus; step?: string; error?: string; result?: T; readyAt?: number; retryFree?: boolean };

class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const ready = new Map<string, { result: unknown; readyAt?: number }>();
const POLL_MS = 5000;

async function getJSON(url: string) {
  const token = await accessToken();
  if (!token) throw new ApiError("Sign in to see live data.", 401);
  let r: Response;
  try { r = await fetch(url, { cache: "no-store", headers: { authorization: `Bearer ${token}` } }); }
  catch { throw new ApiError("Can’t reach StayScout. Check your connection and try again.", 0); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || `Request failed (${r.status}).`, r.status);
  return j;
}

async function postJSON(url: string, body: unknown) {
  const token = await accessToken();
  if (!token) throw new ApiError("Sign in to run a new analysis.", 401);
  let r: Response;
  try {
    r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  } catch { throw new ApiError("Can’t reach StayScout. Check your connection and try again.", 0); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || `Request failed (${r.status}).`, r.status);
  return j;
}

function useJob<T>(id: string | null, getUrl: string, postUrl: string, postBody: string) {
  const [job, setJob] = useState<Job<T>>({ status: id ? "checking" : "idle" });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<{ message: string; status: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const live = useRef(id);

  const poll = useCallback(async () => {
    const mine = id;
    if (!mine) return;
    window.clearTimeout(timer.current);
    try {
      const j = await getJSON(getUrl);
      if (live.current !== mine) return;
      if (j.status === "ready") { ready.set(mine, { result: j.result, readyAt: j.readyAt }); setJob({ status: "ready", result: j.result as T, readyAt: j.readyAt }); return; }
      if (j.status === "none") { setJob({ status: "none" }); return; }
      if (j.status === "failed") { setJob({ status: "failed", error: j.error, retryFree: !!j.retryFree }); return; }
      // Keep the results already on screen while a step re-runs, so the page doesn't go blank.
      setJob((prev) => ({ status: j.status, step: j.step, result: prev.result, readyAt: prev.readyAt }));
      timer.current = window.setTimeout(poll, POLL_MS);
    } catch (e) {
      if (live.current !== mine) return;
      setJob({ status: "error", error: (e as Error).message });
    }
  }, [id, getUrl]);

  useEffect(() => {
    live.current = id;
    setStartError(null);
    window.clearTimeout(timer.current);
    if (!id) { setJob({ status: "idle" }); return; }
    const hit = ready.get(id);
    if (hit) { setJob({ status: "ready", result: hit.result as T, readyAt: hit.readyAt }); return; }
    setJob({ status: "checking" });
    poll();
    return () => window.clearTimeout(timer.current);
  }, [id, poll]);

  const startWith = useCallback(async (extra?: Record<string, unknown>) => {
    if (!id) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await postJSON(postUrl, { ...JSON.parse(postBody), ...(extra || {}) });
      setJob((prev) => ({
        status: res?.status === "analyzing" ? "analyzing" : "running",
        step: res?.status === "analyzing" ? "Running the AI step again…" : "Starting…",
        result: prev.result, readyAt: prev.readyAt,
      }));
      timer.current = window.setTimeout(poll, 2500);
    } catch (e) {
      const err = e as ApiError;
      setStartError({ message: err.message, status: err.status });
    } finally {
      setStarting(false);
    }
  }, [id, postUrl, postBody, poll]);

  const start = useCallback(() => startWith(), [startWith]);
  return { job, start, startWith, starting, startError, retry: poll };
}

/** A city analysis: localities ranked with prices, ratings and nearby landmarks. */
export function useCity(state: string, city: string) {
  const key = state && city ? cityKey(city, state) : null;
  const r = useJob<CityResult>(
    key,
    `/api/city?key=${encodeURIComponent(key || "")}`,
    "/api/city",
    JSON.stringify({ country: COUNTRY, state, city }),
  );
  /** Re-runs only the AI summary for a ready city whose summary failed. Uses no data fetch. */
  const retryAi = useCallback(() => r.startWith({ retryAi: true }), [r]);
  return { key, ...r, retryAi };
}

/** Guest-review analysis for one locality: problems, fixes and listing lines. */
export function useAreaReview(key: string | null, areaId: string | null) {
  const id = key && areaId ? `${key}/${areaId}` : null;
  return useJob<AreaResult>(
    id,
    `/api/area?key=${encodeURIComponent(key || "")}&area=${encodeURIComponent(areaId || "")}`,
    "/api/area",
    JSON.stringify({ key, area: areaId }),
  );
}

export async function usage() {
  const token = await accessToken();
  const r = await fetch("/api/usage", { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!r.ok) throw new Error("Usage unavailable");
  return (await r.json()) as { month: string; site: { runs: number; cap: number }; you?: { runs: number; cap: number } };
}
