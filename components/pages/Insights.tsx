/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import { useMemo, useState } from "react";
import { Plane, TrainFront, Hospital, GraduationCap, MapPin } from "lucide-react";
import {
  PROPERTY_TYPES, inr, areaStats, facilityCoverage, priceChannels, rivalsIn, typeOf, median, hasLandmarks,
  type CityResult, type TypeFilter,
} from "@/lib/data";
import { KEYS, useLocal, EMPTY_SELECTION, type Selection } from "@/lib/storage";
import CityGate from "@/components/CityGate";
import { PageHeader } from "@/lib/ui";

const typeWord = (t: TypeFilter, plural = false) => (t === "All" ? (plural ? "stays" : "stay") : `${t.toLowerCase()}${plural ? "s" : ""}`);

export default function Insights() {
  const [sel, , ready] = useLocal<Selection>(KEYS.selection, EMPTY_SELECTION);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader
        title="Price & amenities"
        lead={sel.city ? `What stays in ${sel.city} charge, what they offer and how location changes the price.` : "What stays charge, what they offer and how location changes the price."}
      />
      {ready && (
        <CityGate state={sel.state} city={sel.city} what="this page">
          {(r) => <Body result={r} />}
        </CityGate>
      )}
    </div>
  );
}

function Body({ result }: { result: CityResult }) {
  const [type, setType] = useState<TypeFilter>("All");
  const rows = useMemo(
    () => result.areas.map((a) => ({ a, st: areaStats(result, a, type) })).filter((x) => x.st.count > 0),
    [result, type],
  );
  const priced = rows.filter((x) => x.st.price).sort((x, y) => (y.st.price as number) - (x.st.price as number));
  const unpriced = rows.length - priced.length;
  const max = Math.max(1, ...priced.map((x) => x.st.price as number));
  const typed = type === "All" ? result.places : result.places.filter((p) => typeOf(p.cat) === type);
  const cov = facilityCoverage(typed, type === "All" ? result.airbnb : []);
  const ai = result.ai || {};
  const airbnbPrices = result.airbnb.map((x) => x.price);
  const airbnbMedian = median(airbnbPrices);
  const mix = result.summary.types || [];
  const mixTotal = mix.reduce((t, [, n]) => t + n, 0) || 1;
  const landmarks = hasLandmarks(result);
  const ch = priceChannels(result);
  const rivals = rivalsIn(typed);

  return (
    <>
      <section className="card" aria-label="Filter">
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="i-type">Property type</label>
          <select id="i-type" className="select" value={type} onChange={(e) => setType(e.target.value as TypeFilter)}>
            <option value="All">All stay types</option>
            {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <span className="hint">Prices and amenities compare only {typeWord(type, true)}.</span>
        </div>
      </section>

      <section className="card" aria-labelledby="pr-h">
        <div className="card-h"><h2 id="pr-h">Typical nightly price by locality</h2><span className="muted">Median of live prices</span></div>
        {priced.length === 0 ? (
          <p className="status info">Not enough price data for {typeWord(type, true)} in {result.summary.city}. Many Google Maps listings don’t show a price; try “All stay types”.</p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12 }}>
            {priced.map(({ a, st }) => (
              <li key={a.id} className="pricebar">
                <span>{a.name}</span>
                <div className="bar" style={{ height: 12 }} role="img" aria-label={`${a.name}: ${inr(st.price)} per night from ${st.priceSamples} prices`}><i style={{ width: `${((st.price as number) / max) * 100}%` }} /></div>
                <span className="num"><b>{inr(st.price)}</b> <span className="muted">({st.priceSamples})</span></span>
              </li>
            ))}
          </ul>
        )}
        {unpriced > 0 && priced.length > 0 && <p className="muted" style={{ marginTop: 12 }}>{unpriced} {unpriced === 1 ? "locality has" : "localities have"} no price data and {unpriced === 1 ? "isn’t" : "aren’t"} shown. The number in brackets is how many prices each median uses.</p>}
        {airbnbMedian && (
          <p className="muted" style={{ marginTop: 8 }}>Airbnb listings in {result.summary.city}: median {inr(airbnbMedian)} a night across {airbnbPrices.filter(Boolean).length} listings.</p>
        )}
        {!!result.summary.convertedPrices && (
          <p className="muted" style={{ marginTop: 8 }}>
            {result.summary.convertedPrices} of these prices were listed in dollars, pounds or euros and have been converted to rupees{result.summary.usdRate ? ` at ₹${result.summary.usdRate} to the dollar` : ""}. Google shows foreign currency on stays that sell mainly to overseas guests, so treat those as a guide.
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="ch-h">
        <div className="card-h"><h2 id="ch-h">The same city, three booking channels</h2><span className="muted">Median nightly rate</span></div>
        {!ch.google && !ch.ota && !ch.airbnb ? (
          <p className="status info">No nightly rates came back for {result.summary.city} on any channel.</p>
        ) : (
          <>
            <div className="tbl-wrap">
              <table className="tbl rtbl">
                <thead><tr><th scope="col">Channel</th><th scope="col" className="num">Median a night</th><th scope="col" className="num">Rates used</th><th scope="col">What it tells you</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="rt-full"><b>Google Maps</b></td>
                    <td data-label="Median" className="num">{inr(ch.google)}</td>
                    <td data-label="Rates" className="num">{ch.googleN}</td>
                    <td className="rt-full" data-label="Means">The rate Google shows on the listing card — usually the walk-up or lowest advertised price.</td>
                  </tr>
                  <tr>
                    <td className="rt-full"><b>Booking sites</b></td>
                    <td data-label="Median" className="num">{inr(ch.ota)}</td>
                    <td data-label="Rates" className="num">{ch.otaN}</td>
                    <td className="rt-full" data-label="Means">Live quotes from Booking.com, Agoda, Expedia and hotels’ own sites, as Google lists them.</td>
                  </tr>
                  <tr>
                    <td className="rt-full"><b>Airbnb</b></td>
                    <td data-label="Median" className="num">{inr(ch.airbnb)}</td>
                    <td data-label="Rates" className="num">{ch.airbnbN}</td>
                    <td className="rt-full" data-label="Means">One night, a month out, two guests — the closest match to what a homestay can charge.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {ch.ota && ch.airbnb ? (
              <p className="muted" style={{ marginTop: 12 }}>
                {ch.airbnb > ch.ota
                  ? `Airbnb runs about ${Math.round(((ch.airbnb - ch.ota) / ch.ota) * 100)}% above the booking sites here, so a whole-home or homestay listing can price above the hotels.`
                  : `Booking sites run about ${Math.round(((ch.ota - ch.airbnb) / Math.max(1, ch.airbnb)) * 100)}% above Airbnb here, so hotel-style inventory holds the higher rate.`}
              </p>
            ) : null}
            {ai.channel_advice && !ai.error && <p className="muted" style={{ marginTop: 8 }}>{ai.channel_advice}</p>}
            {!ch.otaN && (
              <p className="status info" style={{ marginTop: 12 }}>
                No booking-site quotes came back for {result.summary.city}. Google shows these on hotel listings; homestays and guest houses usually have none.
              </p>
            )}
          </>
        )}
      </section>

      <section className="card" aria-labelledby="loc-h">
        <div className="card-h"><h2 id="loc-h">Pricing by what you’re near</h2><span className="muted">AI summary of the live numbers</span></div>
        {ai.pricing_by_location?.length ? (
          <div className="tbl-wrap">
            <table className="tbl rtbl">
              <thead><tr><th scope="col">Location</th><th scope="col">Localities</th><th scope="col">Price range</th><th scope="col">Who stays</th><th scope="col">Advice</th></tr></thead>
              <tbody>
                {ai.pricing_by_location.map((p) => (
                  <tr key={p.location}>
                    <td className="rt-full"><b>{p.location}</b></td>
                    <td data-label="Localities">{(p.areas || []).join(", ") || "—"}</td>
                    <td data-label="Price range" className="num">{p.price_range_inr ? (/\d/.test(p.price_range_inr) ? `₹${p.price_range_inr.replace(/^₹/, "")}` : p.price_range_inr) : "—"}</td>
                    <td data-label="Who stays">{p.who_stays}</td>
                    <td className="rt-full" data-label="Advice">{p.advice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="status info">The AI summary for {result.summary.city} didn’t include pricing by location. The distances below still help you position your price.</p>}

        <h3 style={{ fontSize: 16, margin: "24px 0 12px" }}>Distance from each locality</h3>
        {!landmarks && (
          <p className="status warn" role="note" style={{ marginBottom: 12 }}>
            The airport, station, hospital and college data for {result.summary.city} couldn’t be fetched when this analysis ran — the OpenStreetMap service didn’t respond. Every distance below shows “Not fetched”, and the locality scores were worked out from demand, amenity gaps and guest complaints only. Use <b>Refresh data</b> on the Find a location page to try again.
          </p>
        )}
        <div className="tbl-wrap">
          <table className="tbl rtbl wide">
            <thead>
              <tr>
                <th scope="col">Locality</th>
                <th scope="col"><Plane size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> Airport</th>
                <th scope="col"><TrainFront size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> Station</th>
                <th scope="col"><Hospital size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> Hospital</th>
                <th scope="col"><GraduationCap size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> College</th>
              </tr>
            </thead>
            <tbody>
              {result.areas.map((a) => (
                <tr key={a.id}>
                  <td className="rt-full"><b><MapPin size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> {a.name}</b></td>
                  {([["Airport", a.airport], ["Station", a.railway], ["Hospital", a.hospital], ["College", a.college]] as const).map(([label, n]) => (
                    <td key={label} data-label={label}>{n && n.km != null ? <><b className="num">{n.km} km</b><div className="muted clamp2">{n.name}</div></> : <span className="muted">{landmarks ? "None nearby" : "Not fetched"}</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="card" aria-labelledby="am-h">
          <div className="card-h"><h2 id="am-h">What competitors offer</h2><span className="muted">counted on {cov.of} {cov.of === 1 ? "stay" : "stays"}</span></div>
          {cov.of < 3 ? (
            <p className="status warn">
              Only {cov.of} {cov.of === 1 ? "stay lists" : "stays list"} facilities, which is too few to compare. Google publishes facilities on a property’s own page, so this fills in as more properties are read. Use <b>Refresh data</b> on the Find a location page to fetch them again.
            </p>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: 12 }}>
                The share of {typeWord(type, true)} that offer each facility. <span className="pill good">Gap</span> under 40% — few rivals have it, so it sets you apart. <span className="pill">Expected</span> over 80% — guests assume it.
              </p>
              <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12 }}>
                {cov.items.slice(0, 18).map((m) => (
                  <li key={m.name}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span>{m.name} {m.pct < 40 ? <span className="pill good">Gap</span> : m.pct >= 80 ? <span className="pill">Expected</span> : null}</span>
                      <span className="num muted">{m.pct}% <span className="sr">of stays</span>({m.n})</span>
                    </div>
                    <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${m.pct}%` }} /></div>
                  </li>
                ))}
              </ul>
              {cov.items.length > 18 && <p className="muted" style={{ marginTop: 12 }}>{cov.items.length - 18} more facilities counted. The number in brackets is how many stays offer it.</p>}
            </>
          )}
        </section>

        <section className="card" aria-labelledby="mix-h">
          <div className="card-h"><h2 id="mix-h">What’s already there</h2><span className="muted">{result.summary.stays} stays on Google Maps</span></div>
          {mix.length ? (
            <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12 }}>
              {mix.map(([name, n]) => (
                <li key={name}>
                  <div className="row" style={{ justifyContent: "space-between" }}><span>{name || "Other"}</span><span className="num muted">{n}</span></div>
                  <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${Math.round((n / mixTotal) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No category data.</p>}
          {!!ai.opportunities?.length && (
            <>
              <h3 style={{ fontSize: 16, margin: "20px 0 10px" }}>Gaps a new property can win</h3>
              <ul className="list">{ai.opportunities.map((o) => <li key={o}>{o}</li>)}</ul>
            </>
          )}
          {!!ai.must_match?.length && (
            <>
              <h3 style={{ fontSize: 16, margin: "20px 0 10px" }}>What you have to match</h3>
              <ul className="list">{ai.must_match.map((o) => <li key={o}>{o}</li>)}</ul>
            </>
          )}
          {!ai.opportunities?.length && !!cov.gaps.length && (
            <>
              <h3 style={{ fontSize: 16, margin: "20px 0 10px" }}>Gaps a new property can win</h3>
              <ul className="list">{cov.gaps.slice(0, 6).map((g) => <li key={g.name}>Only {g.pct}% offer {g.name.toLowerCase()}.</li>)}</ul>
            </>
          )}
        </section>
      </div>

      {rivals.length >= 3 && (
        <section className="card" aria-labelledby="riv-h">
          <div className="card-h">
            <h2 id="riv-h">Who you’d be competing with</h2>
            <span className="muted">{rivals.length} properties Google lists beside these stays</span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl rtbl wide">
              <thead><tr><th scope="col">Property</th><th scope="col" className="num">Rating</th><th scope="col" className="num">Reviews</th><th scope="col" className="num">Nightly price</th><th scope="col">How Google compares it</th></tr></thead>
              <tbody>
                {rivals.slice(0, 15).map((v) => (
                  <tr key={v.name}>
                    <td className="rt-full"><b>{v.name}</b></td>
                    <td data-label="Rating" className="num">{v.rating ?? "—"}</td>
                    <td data-label="Reviews" className="num">{v.reviews ? v.reviews.toLocaleString("en-IN") : "—"}</td>
                    <td data-label="Price" className="num">{inr(v.price)}</td>
                    <td className="rt-full" data-label="Comparison">{v.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>These are the properties Google puts in front of a guest looking at a stay in {result.summary.city}. Match or beat their rate and rating and you appear in the same shortlist.</p>
        </section>
      )}

      <Coverage result={result} />
    </>
  );
}

/** What each source actually returned. A thin city should read as thin, not as empty. */
function Coverage({ result }: { result: CityResult }) {
  const s = result.summary;
  const rows: { label: string; got: number; of: number; note: string }[] = [
    { label: "Stays read from Google Maps", got: s.stays, of: s.stays, note: `${s.skippedNonStays || 0} results were not places to stay and were dropped` },
    { label: "Stays with facilities listed", got: s.facilitiesFrom ?? 0, of: s.stays, note: "Facilities come from each property’s own Google page" },
    { label: "Stays with a booking-site price", got: s.otaFrom ?? 0, of: s.stays, note: "Google shows these mostly on hotels, rarely on homestays" },
    { label: "Stays with a star classification", got: s.starsFrom ?? 0, of: s.stays, note: "Only hotels carry a star rating" },
    { label: "Airbnb listings with facilities", got: s.airbnbWithAmenities ?? 0, of: s.airbnbListings, note: "Airbnb lists facilities per room" },
  ];
  return (
    <section className="card" aria-labelledby="cov-h">
      <div className="card-h">
        <h2 id="cov-h">What this analysis is built on</h2>
        <span className="muted">{(s.reviewsSeen ?? 0).toLocaleString("en-IN")} guest reviews counted</span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl rtbl">
          <thead><tr><th scope="col">Source</th><th scope="col" className="num">Covered</th><th scope="col">Why it may be short</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="rt-full"><b>{r.label}</b></td>
                <td data-label="Covered" className="num">{r.of ? `${r.got} of ${r.of}` : "—"}{r.of ? <div className="muted" style={{ fontSize: 12 }}>{Math.round((r.got / r.of) * 100)}%</div> : null}</td>
                <td className="rt-full" data-label="Note">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 12 }}>
        Every number on this page is counted from these rows — nothing is estimated or filled in. Where a source came back short, the pages say so rather than showing a blank.
      </p>
    </section>
  );
}
