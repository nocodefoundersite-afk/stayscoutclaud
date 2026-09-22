/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Star, ChevronRight, ArrowLeft, Bookmark, BookmarkCheck, SearchX, CheckCircle2, SlidersHorizontal,
  Loader2, Radar, AlertTriangle, ExternalLink, LogIn, RefreshCw,
} from "lucide-react";
import {
  PROPERTY_TYPES, STATES, COUNTRY, inr, areaStats, placesIn, priceOf, rankScore, nearLine, tierLabel,
  type CityResult, type LiveArea, type Place, type TypeFilter,
} from "@/lib/data";
import { KEYS, useLocal, EMPTY_SELECTION, savedId, type Selection, type SavedArea } from "@/lib/storage";
import { useCity } from "@/lib/live";
import { useAuth } from "@/lib/auth";
import { tone } from "@/lib/ui";
import Plan from "./Plan";
import s from "./finder.module.css";

type View = "areas" | "properties" | "plan";
type Sort = "score" | "price" | "reviews";
const RATINGS = [{ v: "any", l: "Any" }, { v: "4", l: "4.0+" }, { v: "4.5", l: "4.5+" }, { v: "4.8", l: "4.8+" }];

export function validatePrices(min: string, max: string) {
  const e: { min?: string; max?: string } = {};
  const check = (raw: string, example: string) => {
    const v = raw.trim().replace(/,/g, "");
    if (v === "") return { n: null as number | null };
    const n = Number(v);
    if (!isFinite(n)) return { n: null, err: `Enter a number, e.g. ${example}.` };
    if (n < 0) return { n: null, err: "Price can’t be negative." };
    return { n };
  };
  const a = check(min, "2000"), b = check(max, "6000");
  if (a.err) e.min = a.err;
  if (b.err) e.max = b.err;
  if (!e.min && !e.max && a.n !== null && b.n !== null && a.n > b.n) e.max = "Maximum must be higher than minimum.";
  return { errors: e, min: e.min ? null : a.n, max: e.max ? null : b.n };
}

export const typeWord = (t: TypeFilter, plural = false) => (t === "All" ? (plural ? "stays" : "stay") : `${t.toLowerCase()}${plural ? "s" : ""}`);

export default function Finder() {
  const router = useRouter();
  const { user } = useAuth();
  const [sel, setSel, ready] = useLocal<Selection>(KEYS.selection, EMPTY_SELECTION);
  const [saved, setSaved] = useLocal<SavedArea[]>(KEYS.saved, []);
  const [, setProperty] = useLocal<Record<string, unknown>>(KEYS.property, {});
  const [phase, setPhase] = useState<"intro" | "explore">("intro");
  const [view, setView] = useState<View>("areas");
  const [sort, setSort] = useState<Sort>("score");
  const [openProp, setOpenProp] = useState<string | null>(null);
  const [useLocality, setUseLocality] = useState(false);
  const [locQuery, setLocQuery] = useState("");
  const [introErr, setIntroErr] = useState("");
  const [announce, setAnnounce] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const resultsRef = useRef<HTMLHeadingElement>(null);

  const exploring = phase === "explore";
  const city = useCity(exploring ? sel.state : "", exploring ? sel.city : "");
  const result = city.job.status === "ready" ? (city.job.result as CityResult) : null;

  useEffect(() => {
    if (!ready) return;
    if (sel.state && sel.city) setPhase("explore");
    if (sel.locality) { setUseLocality(true); setView("properties"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const update = (patch: Partial<Selection>) => setSel((p) => ({ ...p, ...patch }));
  const cities = sel.state ? STATES[sel.state] || [] : [];
  const prices = validatePrices(sel.minPrice, sel.maxPrice);
  const minRating = sel.minRating === "any" ? 0 : Number(sel.minRating);
  const type = (sel.type || "All") as TypeFilter;

  const rows = useMemo(() => {
    if (!result) return [];
    const list = result.areas
      .map((a) => ({ a, st: areaStats(result, a, type) }))
      .filter(({ st }) => st.count > 0)
      .filter(({ st }) => (prices.min === null || (st.price !== null && st.price >= prices.min)) && (prices.max === null || (st.price !== null && st.price <= prices.max)))
      .filter(({ st }) => !minRating || (st.rating !== null && st.rating >= minRating));
    list.sort((x, y) =>
      sort === "score" ? y.a.score - x.a.score
        : sort === "price" ? (x.st.price ?? Infinity) - (y.st.price ?? Infinity)
          : y.st.reviews - x.st.reviews);
    return list;
  }, [result, type, prices.min, prices.max, minRating, sort]);
  const typeFound = !!result && (type === "All" || result.areas.some((a) => placesIn(result, a, type).length > 0));

  const area = result?.areas.find((a) => a.id === sel.locality) ?? null;
  const areaPlaces = useMemo(() => {
    if (!result || !area) return { list: [] as Place[], noPrice: 0 };
    const all = placesIn(result, area, type);
    const priceFilter = prices.min !== null || prices.max !== null;
    let noPrice = 0;
    const list = all.filter((p) => {
      const pr = priceOf(p);
      if (priceFilter && pr === null) { noPrice++; return false; }
      if (pr !== null && ((prices.min !== null && pr < prices.min) || (prices.max !== null && pr > prices.max))) return false;
      return !minRating || (p.rating !== null && p.rating >= minRating);
    }).sort((a, b) => rankScore(b) - rankScore(a));
    return { list, noPrice };
  }, [result, area, type, prices.min, prices.max, minRating]);

  const focusResults = (msg: string) => { setAnnounce(msg); requestAnimationFrame(() => resultsRef.current?.focus()); };
  const isSaved = (a: LiveArea) => !!city.key && saved.some((x) => savedId(x) === `${city.key}/${a.id}`);

  function start() {
    if (!sel.state) { setIntroErr("Choose a state or union territory."); return; }
    if (!sel.city) { setIntroErr("Choose a city."); return; }
    setIntroErr(""); setPhase("explore"); setView("areas"); focusResults(`Looking up ${sel.city}.`);
  }
  function pickLocality(id: string) {
    update({ locality: id }); setView("properties"); setOpenProp(null);
    const a = result?.areas.find((x) => x.id === id); focusResults(`Showing hot properties in ${a?.name}.`);
  }
  function toggleSave(a: LiveArea) {
    if (!city.key) return;
    const id = `${city.key}/${a.id}`;
    const was = saved.some((x) => savedId(x) === id);
    setSaved((p) => (was ? p.filter((x) => savedId(x) !== id) : [...p, { key: city.key as string, id: a.id, name: a.name, city: sel.city, state: sel.state, score: a.score }]));
    setAnnounce(was ? `${a.name} removed from saved areas.` : `${a.name} saved.`);
  }
  function planProperty(price: number | null) {
    if (!area || !city.key) return;
    setProperty((p) => ({ ...p, key: city.key, state: sel.state, city: sel.city, areaId: area.id, type: type === "All" ? "Homestay" : type, price: price ?? "" }));
    router.push("/property");
  }

  /* ---------------- intro ---------------- */
  if (phase === "intro") {
    return (
      <div className={s.intro}>
        <div className={s.introText}>
          <h1>Big plans. Start with the right place.</h1>
          <p>Narrow India down to one neighbourhood. Compare what similar stays charge and what their guests say, then plan a property that fits the street it’s on.</p>
        </div>
        <form className={`${s.introBox} card`} onSubmit={(e) => { e.preventDefault(); start(); }} noValidate>
          <div className={s.introFields}>
            <div className="field">
              <label htmlFor="i-country">Country</label>
              <select id="i-country" className="select" value={COUNTRY} disabled aria-describedby="i-country-h"><option>{COUNTRY}</option></select>
              <span className="hint" id="i-country-h">India is our launch country.</span>
            </div>
            <div className="field">
              <label htmlFor="i-state">State or union territory</label>
              <select id="i-state" className="select" value={sel.state} onChange={(e) => update({ state: e.target.value, city: "", locality: "" })}>
                <option value="">Select</option>
                {Object.keys(STATES).map((st) => <option key={st}>{st}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="i-city">City</label>
              <select id="i-city" className="select" value={sel.city} disabled={!sel.state} onChange={(e) => update({ city: e.target.value, locality: "" })}>
                <option value="">{sel.state ? "Select" : "Choose a state first"}</option>
                {cities.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <ol className={s.steps}>
            <li><span>1</span><div><b>Location</b><small>State → City → Locality</small></div></li>
            <li><span>2</span><div><b>Prices</b><small>Nightly price range</small></div></li>
            <li><span>3</span><div><b>Customer reviews</b><small>Guest ratings and feedback</small></div></li>
          </ol>
          {introErr && <p className="status err" role="alert">{introErr}</p>}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="submit" className="btn btn-primary btn-lg">Choose a location<ChevronRight aria-hidden="true" /></button>
          </div>
        </form>
      </div>
    );
  }

  /* ---------------- explore ---------------- */
  const areasForList = result?.areas ?? [];
  const locMatches = areasForList.filter((a) => a.name.toLowerCase().includes(locQuery.trim().toLowerCase()));
  const st = city.job.status;

  return (
    <div className={s.explore}>
      <p className="sr" role="status" aria-live="polite">{announce}</p>
      <aside className={s.left} aria-label="Your search">
        <nav aria-label="Selected location" className={s.tree}>
          <button type="button" onClick={() => { update({ state: "", city: "", locality: "" }); setPhase("intro"); }}>{COUNTRY}</button>
          {sel.state && <><ChevronRight aria-hidden="true" /><button type="button" onClick={() => { update({ city: "", locality: "" }); setPhase("intro"); }}>{sel.state}</button></>}
          {sel.city && <><ChevronRight aria-hidden="true" /><button type="button" aria-current={!area ? "location" : undefined} onClick={() => { update({ locality: "" }); setView("areas"); }}>{sel.city}</button></>}
          {area && <><ChevronRight aria-hidden="true" /><button type="button" aria-current="location" onClick={() => setView("properties")}>{area.name}</button></>}
        </nav>
        <button type="button" className={`btn btn-secondary ${s.filterToggle}`} aria-expanded={filtersOpen} aria-controls="filter-body" onClick={() => setFiltersOpen((o) => !o)}>
          <SlidersHorizontal aria-hidden="true" />{filtersOpen ? "Hide filters" : "Location, price and rating filters"}
        </button>
        <div id="filter-body" className={s.filterBody} data-open={filtersOpen}>
          <section className={s.block} aria-labelledby="st-loc">
            <h2 id="st-loc"><span>1</span>Location</h2>
            <div className="field"><label htmlFor="f-country">Country</label><select id="f-country" className="select" value={COUNTRY} disabled><option>{COUNTRY}</option></select></div>
            <div className="field">
              <label htmlFor="f-state">State or union territory</label>
              <select id="f-state" className="select" value={sel.state} onChange={(e) => { update({ state: e.target.value, city: (STATES[e.target.value] || [])[0] || "", locality: "" }); setView("areas"); }}>
                {Object.keys(STATES).map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-city">City</label>
              <select id="f-city" className="select" value={sel.city} onChange={(e) => { update({ city: e.target.value, locality: "" }); setView("areas"); }}>
                {cities.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <label className="check"><input type="checkbox" checked={useLocality} onChange={(e) => { setUseLocality(e.target.checked); if (!e.target.checked) { update({ locality: "" }); setView("areas"); } }} />Search a specific locality</label>
            {useLocality && (
              <div className="field">
                <label htmlFor="f-loc">Locality</label>
                <input id="f-loc" className="input" type="search" placeholder={areasForList.length ? "Type to filter localities" : "Available once the city is analysed"} value={locQuery} onChange={(e) => setLocQuery(e.target.value)} disabled={!areasForList.length} aria-controls="f-loc-list" />
                {areasForList.length > 0 && (
                  <ul id="f-loc-list" className={s.locList} role="listbox" aria-label="Localities">
                    {locMatches.map((a) => (
                      <li key={a.id}><button type="button" role="option" aria-selected={sel.locality === a.id} onClick={() => pickLocality(a.id)}>{a.name}<small>{a.stays} stays</small></button></li>
                    ))}
                    {!locMatches.length && <li className="muted" style={{ padding: 8 }}>No locality matches “{locQuery}”.</li>}
                  </ul>
                )}
                <span className="hint">Localities are grouped from stay addresses, so results may include surrounding areas.</span>
              </div>
            )}
          </section>

          <section className={s.block} aria-labelledby="st-price">
            <h2 id="st-price"><span>2</span>Prices</h2>
            <div className="field">
              <label htmlFor="f-type">Property type</label>
              <select id="f-type" className="select" value={type} onChange={(e) => update({ type: e.target.value })}>
                <option value="All">All stays</option>
                {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className={s.priceRow}>
              <div className="field">
                <label htmlFor="f-min">Min per night (₹)</label>
                <input id="f-min" className="input num" inputMode="numeric" placeholder="0" value={sel.minPrice} onChange={(e) => update({ minPrice: e.target.value })} aria-invalid={!!prices.errors.min} aria-describedby={prices.errors.min ? "f-min-e" : undefined} />
                {prices.errors.min && <span className="error" id="f-min-e">{prices.errors.min}</span>}
              </div>
              <div className="field">
                <label htmlFor="f-max">Max per night (₹)</label>
                <input id="f-max" className="input num" inputMode="numeric" placeholder="Any" value={sel.maxPrice} onChange={(e) => update({ maxPrice: e.target.value })} aria-invalid={!!prices.errors.max} aria-describedby={prices.errors.max ? "f-max-e" : undefined} />
                {prices.errors.max && <span className="error" id="f-max-e">{prices.errors.max}</span>}
              </div>
            </div>
            <span className="hint">We compare only equivalent properties of the same type.</span>
          </section>

          <section className={s.block} aria-labelledby="st-rev">
            <h2 id="st-rev"><span>3</span>Customer reviews</h2>
            <div className="field">
              <span className="lbl" id="f-rating">Minimum guest rating</span>
              <div className="seg" role="group" aria-labelledby="f-rating">
                {RATINGS.map((r) => <button key={r.v} type="button" aria-pressed={sel.minRating === r.v} onClick={() => update({ minRating: r.v })}>{r.l}</button>)}
              </div>
              <span className="hint">Ratings are out of five, from Google Maps.</span>
            </div>
          </section>
          <button type="button" className="btn btn-ghost" onClick={() => { setSel({ ...EMPTY_SELECTION, state: sel.state, city: sel.city }); setUseLocality(false); setView("areas"); }}>Reset filters</button>
        </div>
      </aside>

      <section className={s.right} aria-labelledby="results-h">
        {st === "checking" || st === "idle" ? (
          <div className="card empty" aria-busy="true">
            <Loader2 className="spin" aria-hidden="true" />
            <h2 id="results-h" ref={resultsRef} tabIndex={-1} className={s.rh}>Looking up {sel.city}…</h2>
            <p className="muted">Checking for an analysis from the last 7 days.</p>
          </div>
        ) : st === "none" || st === "failed" ? (
          <Analyse
            cityName={sel.city} signedIn={!!user} failedError={st === "failed" ? city.job.error : undefined}
            starting={city.starting} startError={city.startError} onStart={city.start} headingRef={resultsRef}
          />
        ) : st === "running" || st === "analyzing" ? (
          <Progress cityName={sel.city} step={city.job.step} headingRef={resultsRef} />
        ) : st === "error" ? (
          <div className="card empty">
            <AlertTriangle aria-hidden="true" />
            <h2 id="results-h" ref={resultsRef} tabIndex={-1} className={s.rh}>Couldn’t load {sel.city}</h2>
            <p className="muted">{city.job.error}</p>
            <button type="button" className="btn btn-secondary" onClick={city.retry}><RefreshCw aria-hidden="true" />Try again</button>
          </div>
        ) : result && (view === "areas" || !area) ? (
          <>
          {result.ai?.error && (
            <div className="status warn row" role="note" style={{ justifyContent: "space-between", marginBottom: 16 }}>
              <span>{result.ai.error} The rankings, prices and distances below are still live.</span>
              <button type="button" className="btn btn-secondary" onClick={city.retryAi} disabled={city.starting}>
                {city.starting ? <Loader2 className="spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}Retry AI summary (free)
              </button>
            </div>
          )}
          {city.startError && <p className="status err" role="alert" style={{ marginBottom: 16 }}>{city.startError.message}</p>}
          <AreasTable
            result={result} city={sel.city} type={type} rows={rows} sort={sort} setSort={setSort} typeFound={typeFound}
            readyAt={city.job.readyAt} onPick={pickLocality} headingRef={resultsRef} isSaved={isSaved} onSave={toggleSave}
            onAllTypes={() => update({ type: "All" })} onReset={() => update({ minPrice: "", maxPrice: "", minRating: "any" })}
          />
          </>
        ) : result && area && view === "properties" ? (
          <Properties
            result={result} area={area} type={type} list={areaPlaces.list} noPrice={areaPlaces.noPrice} openProp={openProp} setOpenProp={setOpenProp} headingRef={resultsRef}
            back={() => { setView("areas"); update({ locality: "" }); focusResults(`Showing localities in ${sel.city}.`); }}
            choose={() => { setView("plan"); focusResults(`Your plan for ${area.name}.`); }}
            saved={isSaved(area)} onSave={() => toggleSave(area)}
          />
        ) : result && area ? (
          <Plan
            result={result} area={area} type={type} cityKey={city.key as string} cityName={sel.city} signedIn={!!user} headingRef={resultsRef}
            back={() => setView("properties")} onPlan={planProperty} saved={isSaved(area)} onSave={() => toggleSave(area)}
          />
        ) : null}
      </section>
    </div>
  );
}

/* ---------------- analysis states ---------------- */
function Analyse(props: {
  cityName: string; signedIn: boolean; failedError?: string; starting: boolean; startError: { message: string; status: number } | null;
  onStart: () => void; headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const { cityName, signedIn } = props;
  const next = "/login/?next=/";
  return (
    <div className="card stack" style={{ gap: 16 }}>
      <Radar aria-hidden="true" style={{ width: 40, height: 40, color: "var(--accent-text)" }} />
      <h2 id="results-h" ref={props.headingRef} tabIndex={-1} className={s.rh}>
        {props.failedError ? `The last analysis of ${cityName} didn’t finish` : `${cityName} hasn’t been analysed this week`}
      </h2>
      {props.failedError && <p className="status err">{props.failedError}</p>}
      <p style={{ color: "var(--ink-2)", maxWidth: "62ch" }}>
        We’ll collect hotels, homestays, resorts, hostels and villas from Google Maps, up to 20 Airbnb listings, and nearby airports, stations,
        hospitals and colleges from OpenStreetMap. Then we rank the localities and summarise what’s working.
      </p>
      <ul className="list" style={{ color: "var(--ink-2)" }}>
        <li>Takes about 3 to 6 minutes. You can leave and come back.</li>
        <li>Uses 2 of your monthly data fetches. Results are saved for 7 days, so anyone who looks up {cityName} this week sees them straight away.</li>
      </ul>
      {props.startError && (
        <p className="status err" role="alert">
          {props.startError.message}{" "}
          {props.startError.status === 401 && <Link href={next}>Sign in again</Link>}
        </p>
      )}
      <div className="row">
        {signedIn ? (
          <button type="button" className="btn btn-primary btn-lg" onClick={props.onStart} disabled={props.starting}>
            {props.starting ? <Loader2 className="spin" aria-hidden="true" /> : <Radar aria-hidden="true" />}
            {props.starting ? "Starting…" : `Analyse ${cityName}`}
          </button>
        ) : (
          <>
            <Link href={next} className="btn btn-primary btn-lg"><LogIn aria-hidden="true" />Sign in to analyse</Link>
            <Link href="/register/?next=/" className="btn btn-secondary btn-lg">Create a free account</Link>
          </>
        )}
      </div>
    </div>
  );
}

function Progress({ cityName, step, headingRef }: { cityName: string; step?: string; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  const [t0] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const i = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(i); }, []);
  const sec = Math.max(0, Math.round((now - t0) / 1000));
  return (
    <div className="card stack" aria-busy="true" style={{ gap: 16 }}>
      <div className="row"><Loader2 className="spin" aria-hidden="true" style={{ width: 28, height: 28, color: "var(--accent-text)" }} />
        <h2 id="results-h" ref={headingRef} tabIndex={-1} className={s.rh}>Analysing {cityName}</h2></div>
      <p role="status" aria-live="polite" style={{ fontWeight: 600 }}>{step || "Working…"}</p>
      <div className={s.track} aria-hidden="true"><i /></div>
      <p className="muted">{Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")} on this page. This usually takes 3 to 6 minutes. You can leave; the analysis keeps going and will be here when you come back.</p>
    </div>
  );
}

/* ---------------- ranked localities ---------------- */
function AreasTable(props: {
  result: CityResult; city: string; type: TypeFilter; rows: { a: LiveArea; st: ReturnType<typeof areaStats> }[]; sort: Sort; setSort: (s: Sort) => void;
  typeFound: boolean; readyAt?: number; onPick: (id: string) => void; headingRef: React.RefObject<HTMLHeadingElement | null>;
  isSaved: (a: LiveArea) => boolean; onSave: (a: LiveArea) => void; onAllTypes: () => void; onReset: () => void;
}) {
  const { result, city, type, rows, sort, setSort } = props;
  const sm = result.summary;
  return (
    <div className="stack">
      <div className="card-h" style={{ marginBottom: 0 }}>
        <div>
          <h2 id="results-h" ref={props.headingRef} tabIndex={-1} className={s.rh}>Best localities in {city}</h2>
          <p className="muted">
            {type === "All" ? "All stays" : `${type}s only`} · {sm.stays} stays from Google Maps{sm.airbnbListings ? ` and ${sm.airbnbListings} Airbnb listings` : ""}
            {props.readyAt ? ` · updated ${new Date(props.readyAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
          </p>
        </div>
        <div className="seg" role="group" aria-label="Sort by" style={{ minWidth: 300 }}>
          <button type="button" aria-pressed={sort === "score"} onClick={() => setSort("score")}>Highest score</button>
          <button type="button" aria-pressed={sort === "price"} onClick={() => setSort("price")}>Lowest price</button>
          <button type="button" aria-pressed={sort === "reviews"} onClick={() => setSort("reviews")}>Most reviews</button>
        </div>
      </div>
      {result.ai?.headline && !result.ai.error && <p className={s.headline}>{result.ai.headline}</p>}
      {!props.typeFound ? (
        <div className="card empty">
          <SearchX aria-hidden="true" />
          <h3>No {typeWord(type, true)} found in {city}</h3>
          <p className="muted">Google Maps didn’t list any stays of this type here.</p>
          <button type="button" className="btn btn-secondary" onClick={props.onAllTypes}>Show all stays</button>
        </div>
      ) : !rows.length ? (
        <div className="card empty">
          <SearchX aria-hidden="true" />
          <h3>No localities match these filters</h3>
          <p className="muted">Try a wider price range or a lower minimum rating. Localities without price data are hidden while a price filter is on.</p>
          <button type="button" className="btn btn-secondary" onClick={props.onReset}>Clear price and rating</button>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl rtbl wide">
            <caption className="sr">Localities in {city} ranked for {typeWord(type, true)}. Scores compare localities within this city only.</caption>
            <thead><tr><th scope="col" className="num">Rank</th><th scope="col">Locality</th><th scope="col">Score <span style={{ textTransform: "none" }}>/100</span></th><th scope="col" className="num">Typical nightly price</th><th scope="col" className="num">Guest rating</th><th scope="col" className="num">Reviews</th><th scope="col"><span className="sr">Actions</span></th></tr></thead>
            <tbody>
              {rows.map(({ a, st }, i) => (
                <tr key={a.id}>
                  <td className="num rt-hide">{i + 1}</td>
                  <td className="rt-full" style={{ minWidth: 200 }}>
                    <button type="button" className={s.nameBtn} onClick={() => props.onPick(a.id)}><span className="rt-show" aria-hidden="true">{i + 1}. </span>{a.name}</button>
                    <div className="muted clamp2">{st.count} {st.count === 1 ? "stay" : "stays"}{nearLine(a) ? ` · ${nearLine(a)}` : ""}</div>
                  </td>
                  <td data-label="Score /100" style={{ whiteSpace: "nowrap" }}>
                    <span className={`score ${tone(a.score)}`}>{a.score}</span><span className="sr"> out of 100</span>
                    <div className="muted" style={{ fontSize: 12 }}>{tierLabel(a.tier)} · {a.confidence} confidence</div>
                  </td>
                  <td className="num" data-label="Typical nightly price">{st.price ? inr(st.price) : <span className="muted">No price data</span>}</td>
                  <td className="num" data-label="Guest rating" style={{ whiteSpace: "nowrap" }}>{st.rating ? <><Star size={14} aria-hidden="true" style={{ verticalAlign: -2, color: "var(--brand)" }} /> {st.rating.toFixed(1)}<span className="sr"> out of five</span></> : "—"}</td>
                  <td className="num" data-label="Reviews">{st.reviews.toLocaleString("en-IN")}</td>
                  <td className="rt-full">
                    <div className="row" style={{ flexWrap: "nowrap", justifyContent: "flex-end", gap: 4 }}>
                      <button className="btn btn-ghost" style={{ padding: 0, width: 44 }} onClick={() => props.onSave(a)} aria-label={props.isSaved(a) ? `Remove ${a.name} from saved` : `Save ${a.name}`} aria-pressed={props.isSaved(a)}>
                        {props.isSaved(a) ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
                      </button>
                      <button className="btn btn-secondary" onClick={() => props.onPick(a.id)} aria-label={`Explore properties in ${a.name}`}>Explore<ChevronRight aria-hidden="true" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">Scores compare localities within {city}: guest demand (35%), room for new supply (20%), guest problems a better stay can fix (25%) and access to airports, stations, hospitals and colleges (20%). Research, not investment advice.</p>
    </div>
  );
}

/* ---------------- hot properties ---------------- */
function Properties(props: {
  result: CityResult; area: LiveArea; type: TypeFilter; list: Place[]; noPrice: number; openProp: string | null; setOpenProp: (id: string | null) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>; back: () => void; choose: () => void; saved: boolean; onSave: () => void;
}) {
  const { result, area, type, list } = props;
  const st = areaStats(result, area, type);
  return (
    <div className="stack">
      <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={props.back}><ArrowLeft aria-hidden="true" />All localities</button>
      <div className="card-h" style={{ marginBottom: 0 }}>
        <div>
          <h2 id="results-h" ref={props.headingRef} tabIndex={-1} className={s.rh}>Hot properties in {area.name}</h2>
          <p className="muted">{type === "All" ? "All stays" : `Comparable ${typeWord(type, true)}`}, ranked by rating and number of reviews</p>
        </div>
        <div className="row">
          <button className="btn btn-secondary" onClick={props.onSave} aria-pressed={props.saved}>{props.saved ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}{props.saved ? "Saved" : "Save area"}</button>
          <button className="btn btn-primary" onClick={props.choose}><CheckCircle2 aria-hidden="true" />Choose this area</button>
        </div>
      </div>
      <div className="grid-4">
        <div className="stat"><b className="num">{area.score}</b><span>score /100 in this city</span></div>
        <div className="stat"><b className="num">{st.price ? inr(st.price) : "—"}</b><span>typical {typeWord(type)} price{st.priceSamples ? ` (${st.priceSamples} prices)` : ""}</span></div>
        <div className="stat"><b className="num">{st.rating ? st.rating.toFixed(1) : "—"}</b><span>average guest rating</span></div>
        <div className="stat"><b className="num">{st.count}</b><span>{typeWord(type, true)} found</span></div>
      </div>
      {nearLine(area) && <p className="muted">Nearest: {nearLine(area)} (straight-line distance)</p>}
      {props.noPrice > 0 && <p className="status info">{props.noPrice} {props.noPrice === 1 ? "stay is" : "stays are"} hidden because {props.noPrice === 1 ? "it doesn’t" : "they don’t"} show a price and a price filter is on.</p>}
      {!list.length ? (
        <div className="card empty">
          <SearchX aria-hidden="true" />
          <h3>No comparable {typeWord(type, true)} match your filters</h3>
          <p className="muted">Widen the price range or lower the minimum rating on the left.</p>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl rtbl">
            <caption className="sr">{type === "All" ? "Stays" : `${type}s`} in {area.name}, from Google Maps.</caption>
            <thead><tr><th scope="col">Property</th><th scope="col" className="num">Nightly price</th><th scope="col" className="num">Rating</th><th scope="col" className="num">Reviews</th><th scope="col"><span className="sr">Details</span></th></tr></thead>
            <tbody>
              {list.slice(0, 25).map((p) => {
                const open = props.openProp === p.id;
                return <PropertyRow key={p.id} p={p} open={open} toggle={() => props.setOpenProp(open ? null : p.id)} />;
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">Guest problems and fixes for {area.name} come from the review analysis in your plan. We summarise themes and never quote individual guests.</p>
    </div>
  );
}

function PropertyRow({ p, open, toggle }: { p: Place; open: boolean; toggle: () => void }) {
  const id = `prop-${p.id.replace(/[^a-z0-9]/gi, "").slice(-24)}`;
  const price = priceOf(p);
  return (
    <>
      <tr className={open ? "sel" : undefined}>
        <td className="rt-full"><b>{p.name}</b><div className="muted">{p.cat || "Stay"}</div></td>
        <td className="num" data-label="Nightly price">{price ? inr(price) : <span className="muted">Not listed</span>}</td>
        <td className="num" data-label="Rating">{p.rating ? <>{p.rating.toFixed(1)}<span className="sr"> out of five</span></> : "—"}</td>
        <td className="num" data-label="Reviews">{p.reviews.toLocaleString("en-IN")}</td>
        <td style={{ textAlign: "right" }}><button className="btn btn-ghost" aria-expanded={open} aria-controls={id} onClick={toggle} aria-label={`${open ? "Hide" : "Show"} details for ${p.name}`}>{open ? "Hide" : "Details"}</button></td>
      </tr>
      {open && (
        <tr id={id} className="rt-detail">
          <td colSpan={5} className="rt-full" style={{ background: "var(--surface-2)" }}>
            <div className="stack" style={{ gap: 12, padding: "4px 0" }}>
              <div>
                <h4 className={s.mini}>Amenities listed</h4>
                {p.amenities?.length ? <ul className={s.chips}>{p.amenities.map((a) => <li key={a}>{a}</li>)}</ul> : <p className="muted">This stay doesn’t list amenities on Google Maps.</p>}
              </div>
              {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ alignSelf: "flex-start" }}>Open on Google Maps<ExternalLink aria-hidden="true" /></a>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
