/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "leaflet/dist/leaflet.css";
import type { CityResult } from "@/lib/data";

const TIER = { best: "#1B8A4B", medium: "#D98E04", worst: "#C2321F" } as const;

/** Localities as circles (green strong, amber mixed, red weak) with airports and stations as dots. */
export default function AreaMap({ result, hrefFor }: { result: CityResult; hrefFor: (id: string) => string }) {
  const el = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("leaflet");
        const L = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof import("leaflet");
        if (cancelled || !el.current) return;
        map = L.map(el.current, { scrollWheelZoom: false, zoomControl: true }).setView([result.center.lat, result.center.lng], 12);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        result.areas.filter((a) => isFinite(a.lat) && isFinite(a.lng)).forEach((a) =>
          L.circle([a.lat, a.lng], { radius: Math.max(350, Math.min(a.radiusKm, 3) * 700), color: TIER[a.tier], fillColor: TIER[a.tier], fillOpacity: 0.22, weight: 2 })
            .bindTooltip(`<b>${a.name.replace(/</g, "&lt;")}</b><br>Score ${a.score} · ${a.stays} stays`, { sticky: true })
            .on("click", () => router.push(hrefFor(a.id)))
            .addTo(map as import("leaflet").Map),
        );
        for (const p of result.pois.filter((x) => x.type === "airport" || x.type === "railway").slice(0, 40)) {
          L.circleMarker([p.lat, p.lng], { radius: 5, color: "#1D4ED8", weight: 2, fillColor: "#fff", fillOpacity: 1 })
            .bindTooltip(`${p.type === "airport" ? "Airport" : "Station"}: ${p.name.replace(/</g, "&lt;")}`)
            .addTo(map);
        }
        // Circles can only measure themselves once the map has a view, so fit to the centre points.
        const pts = result.areas.filter((a) => isFinite(a.lat) && isFinite(a.lng)).map((a) => [a.lat, a.lng] as [number, number]);
        if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 15 });
        else map.setView(pts[0] || [result.center.lat, result.center.lng], 13);
      } catch (e) {
        console.warn("Map failed to load", e);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [result, hrefFor, router]);

  if (failed) return <p className="status info">The map couldn’t load. The list below has the same localities.</p>;
  return (
    <figure className="areamap-wrap">
      <div ref={el} className="areamap" role="img" aria-label={`Map of ${result.areas.length} localities in ${result.summary.city}. The list below has the same information.`} />
      <figcaption className="row muted" style={{ gap: 16, fontSize: 13 }}>
        <span><i className="dot" style={{ background: TIER.best }} /> Strong</span>
        <span><i className="dot" style={{ background: TIER.medium }} /> Mixed</span>
        <span><i className="dot" style={{ background: TIER.worst }} /> Weak</span>
        <span><i className="dot ring" /> Airport or station</span>
        <span>Click a circle to open the locality.</span>
      </figcaption>
    </figure>
  );
}
