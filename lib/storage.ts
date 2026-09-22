/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import { useCallback, useEffect, useState } from "react";

const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** localStorage-backed state that is safe during static rendering and in private windows. */
export function useLocal<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setValue(read(key, fallback));
    setReady(true);
    const on = (e: StorageEvent) => { if (e.key === key) setValue(read(key, fallback)); };
    const onLocal = (e: Event) => { if ((e as CustomEvent).detail === key) setValue(read(key, fallback)); };
    window.addEventListener("storage", on);
    window.addEventListener("ss-local", onLocal);
    return () => { window.removeEventListener("storage", on); window.removeEventListener("ss-local", onLocal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
        window.dispatchEvent(new CustomEvent("ss-local", { detail: key }));
      } catch { /* storage unavailable; keep in memory */ }
      return v;
    });
  }, [key]);
  return [value, set, ready] as const;
}

export const KEYS = {
  saved: "ss.saved.v2",
  selection: "ss.selection.v2",
  property: "ss.property.v2",
  alerts: "ss.alerts.v2",
  theme: "ss.theme",
} as const;

export type Selection = {
  state: string;
  city: string;
  locality: string; // area id from the live analysis
  type: string;     // "All" or a PropertyType
  minPrice: string;
  maxPrice: string;
  minRating: string;
};
export const EMPTY_SELECTION: Selection = { state: "", city: "", locality: "", type: "All", minPrice: "", maxPrice: "", minRating: "any" };

/** A locality the customer bookmarked. Enough to find it again in its city analysis. */
export type SavedArea = { key: string; id: string; name: string; city: string; state: string; score: number };
export const savedId = (a: { key: string; id: string }) => `${a.key}/${a.id}`;

export function clearAllLocal() {
  try {
    const all = [...Object.values(KEYS), "ss.savedAreas", "ss.selection", "ss.property", "ss.alerts"];
    all.forEach((k) => window.localStorage.removeItem(k));
    Object.values(KEYS).forEach((k) => window.dispatchEvent(new CustomEvent("ss-local", { detail: k })));
  } catch { /* ignore */ }
}
