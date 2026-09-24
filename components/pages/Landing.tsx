/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
/**
 * The public front door: what StayScout does, for someone who has never seen it.
 * Everything claimed here is something the product actually produces — see components/pages/Insights.tsx
 * and netlify/functions/city-analyze-background.mjs for where each number comes from.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Tags, MessageSquareText, Building2, Compass, ShieldCheck, ChevronRight, HelpCircle, Layers } from "lucide-react";
import { COUNTRY, STATES } from "@/lib/data";
import { KEYS, useLocal, EMPTY_SELECTION, type Selection } from "@/lib/storage";
import s from "@/components/landing.module.css";

function Logo({ size = 18 }: { size?: number }) {
  return (
    <i aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" />
      </svg>
    </i>
  );
}

/* What a city analysis contains. Each line maps to a real section of the app. */
const FEATURES = [
  {
    icon: Compass,
    title: "Every locality, ranked",
    body: "A score out of 100 for each neighbourhood in the city, built from guest demand, room for new supply, the complaints a better stay could fix, and how close it sits to the airport, station, hospital and colleges.",
    tag: "Scores compare localities inside one city, never across cities",
  },
  {
    icon: Tags,
    title: "The price on three channels",
    body: "What a night costs on Google Maps, on the booking sites Google quotes — Booking.com, Agoda, Expedia and hotels’ own pages — and on Airbnb, side by side, with the number of rates behind each figure.",
    tag: "Foreign-currency rates are converted to rupees and flagged",
  },
  {
    icon: Layers,
    title: "The facilities gap",
    body: "The share of stays around you offering each facility, read from every property’s own page. Under 40% is a gap you can win on. Over 80% is something guests already assume you have.",
    tag: "Counted across hotels and Airbnb listings together",
  },
  {
    icon: MessageSquareText,
    title: "Complaints, and what to do",
    body: "The problems guests keep raising in recent reviews, what each fix costs, and a line you can paste straight into your listing once you have fixed it. Themes only — we never quote a guest.",
    tag: "From the newest reviews, not a scraped archive",
  },
  {
    icon: Building2,
    title: "Who you are up against",
    body: "The properties Google puts in front of a guest looking at your street, with their rating, review count and how their price compares with yours.",
    tag: "Google’s own “similar hotels nearby”, per property",
  },
  {
    icon: ShieldCheck,
    title: "Open here, or don’t",
    body: "A plain verdict for the locality with the numbers behind it, plus what the analysis could not see — a source that came back short is shown as short, never filled in.",
    tag: "Research, not investment advice",
  },
];

const STEPS = [
  { t: "Pick the city", b: "Choose a state and a city. India is the launch country, with more than a hundred cities to choose from." },
  { t: "We read the market", b: "Every hotel, homestay, resort, hostel and villa the city lists, plus its Airbnb listings and the landmarks around them. Three to six minutes, and you can close the tab." },
  { t: "You get the plan", b: "Ranked localities, prices by channel, facility gaps, guest complaints with fixes, and a verdict you can act on." },
];

const WHO = [
  { t: "Hoteliers", q: "“Is my rate right for this street?”", a: "Compare your nightly price with equivalent stays in the same locality, on the channel your guests actually book through, and see which facilities your neighbours offer that you don’t." },
  { t: "Homestay, villa and Airbnb owners", q: "“What do I add before next season?”", a: "The facilities almost nobody nearby offers, the complaints guests raise about places like yours, and listing lines written from the fixes you have made." },
  { t: "First-time investors", q: "“Which neighbourhood, and is it already full?”", a: "Every locality scored against the others in that city, with supply, demand and guest satisfaction separated out, so a crowded street reads differently from a busy one." },
];

const SOURCES = [
  { t: "Google Maps", b: "Stays, categories, ratings, the full 1★–5★ breakdown, facilities from each property’s page, and the prices Google quotes from booking sites." },
  { t: "Airbnb", b: "Live nightly rates for one night a month ahead, with facilities, bedrooms, capacity and the cleanliness, location and value sub-scores." },
  { t: "OpenStreetMap", b: "Airports, railway stations, hospitals, colleges and bus stations around the city, used for distance and for the access part of each score." },
];

const FAQ = [
  { q: "Where do the numbers come from?", a: "Live listings on Google Maps and Airbnb, and landmarks from OpenStreetMap, fetched when you run a city. Nothing is estimated, and nothing is carried over from another city. Where a source comes back short, the page says so instead of showing a blank." },
  { q: "How current is a city analysis?", a: "An analysis is kept for seven days so a second look costs you nothing. After that, or whenever you press Refresh data, the city is fetched again from scratch." },
  { q: "Does it tell me whether to buy or rent?", a: "It gives you the numbers that decision rests on — the nightly rate equivalent stays achieve, how full the locality already is, and what guests there complain about — and a rent-versus-buy calculator you fill in with your own figures. StayScout is a research tool, not investment advice." },
  { q: "Do you quote guest reviews?", a: "No. Reviews are read to find the themes people raise and are summarised as problems and fixes. Individual reviews are never republished." },
  { q: "Which countries are covered?", a: "India, across every state and union territory. Other countries will follow." },
];

export default function Landing() {
  const router = useRouter();
  const [sel, setSel] = useLocal<Selection>(KEYS.selection, EMPTY_SELECTION);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [err, setErr] = useState("");
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const cities = state ? STATES[state] || [] : [];

  /* The picker works before sign-in: we remember the choice and hand it to the finder after registration,
     so nobody has to pick their city twice. */
  function go(e: React.FormEvent) {
    e.preventDefault();
    if (!state) { setErr("Choose a state or union territory."); return; }
    if (!city) { setErr("Choose a city."); return; }
    setSel({ ...EMPTY_SELECTION, state, city, type: sel.type || "All" });
    router.push(`/register/?next=${encodeURIComponent("/")}`);
  }

  return (
    <div className={s.page}>
      <a href="#main" className="skip">Skip to content</a>

      <header className={s.nav} data-stuck={stuck}>
        <Link href="/" className="brand" style={{ padding: 0 }}><Logo />StayScout</Link>
        <nav className={s.navLinks} aria-label="About StayScout">
          <a href="#what">What you get</a>
          <a href="#how">How it works</a>
          <a href="#sources">Our data</a>
          <Link href="/plans/">Plans</Link>
        </nav>
        <div className={s.navCta}>
          <Link href="/login/" className={`btn btn-ghost ${s.navSignIn}`}>Sign in</Link>
          <Link href="/register/" className="btn btn-primary">Create account</Link>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        {/* ---------------- hero ---------------- */}
        <section className={`${s.wrap} ${s.hero}`}>
          <div className={s.heroGrid}>
            <div className={s.heroText}>
              <p className={s.eyebrow}>For hoteliers, homestay and villa owners, and first-time investors</p>
              <h1>Read every stay in the city <em>before you open one</em>.</h1>
              <p className={s.heroLead}>
                StayScout reads the hotels, homestays and Airbnbs in an Indian city — what they charge on each
                booking channel, what they offer, and what their guests keep complaining about — then ranks the
                localities and tells you what to build, what to charge and what to fix.
              </p>
              <p className={s.heroNote}>Free to start. No card. Your first city takes about five minutes.</p>
            </div>

            <form className={s.pick} onSubmit={go} noValidate>
              <p className={s.pickHead}>Start with a city</p>
              <p className="muted">Pick where you are looking. You can change it any time.</p>
              <div className={s.pickFields}>
                <div className="field">
                  <label htmlFor="l-country">Country</label>
                  <select id="l-country" className="select" value={COUNTRY} disabled><option>{COUNTRY}</option></select>
                </div>
                <div className="field">
                  <label htmlFor="l-state">State or union territory</label>
                  <select id="l-state" className="select" value={state} onChange={(e) => { setState(e.target.value); setCity(""); setErr(""); }}>
                    <option value="">Select</option>
                    {Object.keys(STATES).map((st) => <option key={st}>{st}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="l-city">City</label>
                  <select id="l-city" className="select" value={city} disabled={!state} onChange={(e) => { setCity(e.target.value); setErr(""); }}>
                    <option value="">{state ? "Select" : "Choose a state first"}</option>
                    {cities.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {err && <p className="status err" role="alert" style={{ marginBottom: 14 }}>{err}</p>}
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }}>
                Analyse this city<ChevronRight aria-hidden="true" />
              </button>
              <p className="hint" style={{ marginTop: 12, textAlign: "center" }}>
                Already have an account? <Link href="/login/">Sign in</Link>
              </p>
            </form>
          </div>
        </section>

        {/* ---------------- what a run reads ---------------- */}
        <section className={`${s.wrap} ${s.section}`} aria-labelledby="proof-h" style={{ paddingTop: 32 }}>
          <h2 id="proof-h" className="sr">What each city analysis reads</h2>
          <div className={s.proof}>
            <div className={s.proofItem}><b>12</b><span>searches per city, from hotels to farm stays and serviced apartments</span></div>
            <div className={s.proofItem}><b>3</b><span>booking channels priced against each other</span></div>
            <div className={s.proofItem}><b>1★–5★</b><span>every review counted, not just the average</span></div>
            <div className={s.proofItem}><b>4</b><span>landmark types mapped: airports, stations, hospitals, colleges</span></div>
          </div>
        </section>

        {/* ---------------- the hot-area motif ---------------- */}
        <section className={s.wrap} aria-labelledby="map-h">
          <h2 id="map-h" className="sr">How a city is drawn</h2>
          <HotAreas />
          <p className={s.caption}>
            <span><i className={s.dot} aria-hidden="true" />Each circle is a locality, drawn over the stays inside it and sized by how much guest demand sits there.</span>
            <span><i className={s.pinDot} aria-hidden="true" />Airports, stations, hospitals and colleges are mapped too, because what you are near sets what you can charge.</span>
          </p>
        </section>

        {/* ---------------- features ---------------- */}
        <section id="what" className={`${s.wrap} ${s.section}`} aria-labelledby="what-h">
          <div className={s.sectionHead}>
            <p className={s.eyebrow}>What you get</p>
            <h2 id="what-h">Six answers, counted from live listings</h2>
            <p>Not a market report written last year. Each one is worked out from the stays that are open in your city today.</p>
          </div>
          <div className={s.features}>
            {FEATURES.map(({ icon: Icon, title, body, tag }) => (
              <article key={title} className={s.feature}>
                <span className={s.featureIcon}><Icon size={20} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{body}</p>
                <p className={s.featureTag}>{tag}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------------- how it works ---------------- */}
        <section id="how" className={`${s.wrap} ${s.section}`} aria-labelledby="how-h">
          <div className={s.sectionHead}>
            <p className={s.eyebrow}>How it works</p>
            <h2 id="how-h">Three steps, one of which is waiting</h2>
          </div>
          <ol className={s.steps} style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {STEPS.map((x, i) => (
              <li key={x.t} className={s.step}>
                <span className={s.stepNo} aria-hidden="true">{i + 1}</span>
                <h3>{x.t}</h3>
                <p>{x.b}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------- who it is for ---------------- */}
        <section className={`${s.wrap} ${s.section}`} aria-labelledby="who-h">
          <div className={s.sectionHead}>
            <p className={s.eyebrow}>Who it’s for</p>
            <h2 id="who-h">One question each, answered with numbers</h2>
          </div>
          <div className={s.who}>
            {WHO.map((x) => (
              <article key={x.t} className={s.whoCard}>
                <h3>{x.t}</h3>
                <p className={s.whoQ}>{x.q}</p>
                <p className={s.whoA}>{x.a}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------------- sources ---------------- */}
        <section id="sources" className={`${s.wrap} ${s.section}`} aria-labelledby="src-h">
          <div className={s.sectionHead}>
            <p className={s.eyebrow}>Where the numbers come from</p>
            <h2 id="src-h">Three live sources, and nothing invented</h2>
            <p>Every figure on every page is counted from the rows below. Where a source comes back short, the page tells you which one and why, rather than quietly showing less.</p>
          </div>
          <div className={s.sources}>
            {SOURCES.map((x) => (
              <div key={x.t} className={s.source}><b>{x.t}</b><span>{x.b}</span></div>
            ))}
          </div>
        </section>

        {/* ---------------- faq ---------------- */}
        <section className={`${s.wrap} ${s.section}`} aria-labelledby="faq-h">
          <div className={s.sectionHead}>
            <p className={s.eyebrow}>Questions</p>
            <h2 id="faq-h">Before you start</h2>
          </div>
          <div className={s.faq}>
            {FAQ.map((f) => (
              <details key={f.q} className={s.faqItem}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------------- closing ---------------- */}
        <section className={`${s.wrap} ${s.section}`} style={{ paddingTop: 0 }}>
          <div className={s.cta}>
            <h2>Find the street before you sign the lease</h2>
            <p>Create an account and run your first city. It is free, and you keep the analysis.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <Link href="/register/" className="btn btn-primary btn-lg">Create your account<ChevronRight aria-hidden="true" /></Link>
              <Link href="/help/" className="btn btn-secondary btn-lg"><HelpCircle aria-hidden="true" />See how it works</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <div className={s.footInner}>
          <span>© 2026 StayScout. Research tool, not investment advice.</span>
          <nav className={s.footLinks} aria-label="Footer">
            <Link href="/plans/">Plans</Link>
            <Link href="/help/">Help</Link>
            <Link href="/contact/">Contact</Link>
            <Link href="/privacy/">Privacy</Link>
            <Link href="/terms/">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/**
 * The product's own picture: localities as circles sized by how much demand sits in them,
 * with the landmarks that move the price. No data is implied — it is the shape of the map,
 * which is what the finder draws once a city has been read.
 */
function HotAreas() {
  const circles = [
    { cx: 300, cy: 150, r: 74, o: 0.20 },
    { cx: 470, cy: 205, r: 52, o: 0.16 },
    { cx: 205, cy: 250, r: 44, o: 0.13 },
    { cx: 620, cy: 122, r: 38, o: 0.11 },
    { cx: 560, cy: 300, r: 30, o: 0.09 },
  ];
  const pins = [
    { x: 118, y: 108, label: "Airport", anchor: "start" as const, dx: 20 },
    { x: 690, y: 236, label: "Station", anchor: "end" as const, dx: -20 },
    { x: 396, y: 332, label: "Hospital", anchor: "start" as const, dx: 20 },
  ];
  return (
    <svg className={s.motif} viewBox="0 0 800 380" role="img" aria-label="Localities drawn as circles on a city map, sized by guest demand, with airport, station and hospital markers">
      <defs>
        <pattern id="ls-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0v40" fill="none" stroke="var(--line)" strokeWidth="1" />
        </pattern>
        <radialGradient id="ls-glow">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="380" fill="url(#ls-grid)" />
      {/* a couple of arterial roads, so it reads as a city rather than graph paper */}
      <path d="M0 268 C 180 250, 300 300, 800 210" fill="none" stroke="var(--line-2)" strokeWidth="6" strokeLinecap="round" />
      <path d="M150 380 C 210 240, 250 160, 330 0" fill="none" stroke="var(--line-2)" strokeWidth="5" strokeLinecap="round" />
      {circles.map((c) => (
        <g key={`${c.cx}-${c.cy}`}>
          <circle cx={c.cx} cy={c.cy} r={c.r * 1.6} fill="url(#ls-glow)" opacity={c.o * 1.4} />
          <circle cx={c.cx} cy={c.cy} r={c.r} fill="var(--brand)" fillOpacity={c.o} stroke="var(--brand)" strokeOpacity="0.55" strokeWidth="1.5" />
          <circle cx={c.cx} cy={c.cy} r="3.5" fill="var(--brand)" />
        </g>
      ))}
      {pins.map((p) => (
        <g key={p.label} transform={`translate(${p.x} ${p.y})`}>
          <circle r="13" fill="var(--surface)" stroke="var(--line-2)" strokeWidth="1.5" />
          <path d="M0 6s-4-3.6-4-6.6A4 4 0 0 1 4 -.6C4 2.4 0 6 0 6z" fill="none" stroke="var(--ink-3)" strokeWidth="1.6" strokeLinejoin="round" />
          <text x={p.dx} y="5" textAnchor={p.anchor} fill="var(--ink-3)" fontSize="15" fontWeight="600" fontFamily="inherit">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}
