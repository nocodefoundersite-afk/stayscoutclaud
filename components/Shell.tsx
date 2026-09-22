/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin, LayoutDashboard, Compass, Home, Tags, Calculator, Bell, HelpCircle, Settings, UserRound,
  Search, CreditCard, MoreHorizontal, LogIn, Loader2, MessageSquareText,
} from "lucide-react";
import { STATES } from "@/lib/data";
import { KEYS, useLocal, type Selection, EMPTY_SELECTION } from "@/lib/storage";
import { useAuth, verify, fromOAuthHash } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Find a location", icon: MapPin },
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/areas", label: "Explore areas", icon: Compass },
  { href: "/property", label: "My property", icon: Home },
  { href: "/insights", label: "Price & amenities", icon: Tags },
  { href: "/calculator", label: "Rent vs buy", icon: Calculator },
  { href: "/alerts", label: "Alerts", icon: Bell },
];
const FOOT = [
  { href: "/plans", label: "Plans", icon: CreditCard },
  { href: "/help", label: "Help", icon: HelpCircle },
  { href: "/profile", label: "Settings", icon: Settings },
];
const MOBILE = [
  { href: "/", label: "Find", icon: MapPin },
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/areas", label: "Areas", icon: Compass },
  { href: "/property", label: "Property", icon: Home },
  { href: "/profile", label: "More", icon: MoreHorizontal },
];
const BARE = ["/login", "/register", "/forgot-password", "/reset-password"];
/** Pages anyone can open. Everything else needs a signed-in account. */
const PUBLIC = [...BARE, "/help", "/privacy", "/terms", "/contact", "/plans"];
const CITIES = Object.entries(STATES).flatMap(([state, list]) => list.map((city) => ({ state, city })));

type ThemePref = "system" | "light" | "dark";
export function applyTheme(t: ThemePref) {
  const r = document.documentElement;
  if (t === "system") r.removeAttribute("data-theme");
  else r.setAttribute("data-theme", t);
}

function Logo({ size = 18 }: { size?: number }) {
  return (
    <i aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" />
      </svg>
    </i>
  );
}

type Toast = { kind: "ok" | "err"; text: string } | null;

/** Handles links from confirmation / password-reset emails and Google sign-in, which arrive as URL hash tokens. */
function useAuthLinks(setToast: (t: Toast) => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const h = window.location.hash.replace(/^#\/?/, "");
    if (!h || !/(confirmation_token|recovery_token|access_token|error_description|invite_token)=/.test(h)) return;
    const p = new URLSearchParams(h);
    history.replaceState(null, "", window.location.pathname + window.location.search);
    setBusy(true);
    (async () => {
      try {
        if (p.get("confirmation_token")) {
          await verify(p.get("confirmation_token") as string, "signup");
          setToast({ kind: "ok", text: "Your email is confirmed and you’re signed in." });
        } else if (p.get("recovery_token")) {
          await verify(p.get("recovery_token") as string, "recovery");
          router.push("/reset-password");
        } else if (p.get("access_token")) {
          await fromOAuthHash(p);
          setToast({ kind: "ok", text: "You’re signed in." });
        } else if (p.get("invite_token")) {
          setToast({ kind: "err", text: "Invitations aren’t used on StayScout. Create an account instead." });
        } else if (p.get("error_description")) {
          setToast({ kind: "err", text: p.get("error_description") as string });
        }
      } catch (e) {
        setToast({ kind: "err", text: (e as Error).message });
      } finally {
        setBusy(false);
      }
    })();
  }, [router, setToast]);
  return busy;
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = (usePathname() || "/").replace(/\/$/, "") || "/";
  const router = useRouter();
  const { user, ready: authReady } = useAuth();
  const [theme, setTheme, themeReady] = useLocal<ThemePref>(KEYS.theme, "system");
  const [sel, setSel] = useLocal<Selection>(KEYS.selection, EMPTY_SELECTION);
  const [alerts] = useLocal<{ id: string }[]>(KEYS.alerts, []);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const linkBusy = useAuthLinks(setToast);

  useEffect(() => { if (themeReady) applyTheme(theme); }, [theme, themeReady]);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 7000); return () => window.clearTimeout(t); }, [toast]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return CITIES.filter((c) => c.city.toLowerCase().includes(t) || c.state.toLowerCase().includes(t)).slice(0, 7);
  }, [q]);
  const pickCity = (c: { state: string; city: string }) => {
    setSel({ ...EMPTY_SELECTION, state: c.state, city: c.city, type: sel.type || "All" });
    setOpen(false); setQ("");
    if (path === "/") window.location.reload(); else router.push("/");
  };

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const market = [sel.city, sel.state].filter(Boolean).join(", ") || "No market selected";
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();
  const isPublic = PUBLIC.some((b) => path.startsWith(b));
  const locked = !isPublic && (!authReady || !user);
  useEffect(() => {
    if (authReady && !user && !isPublic && !linkBusy) router.replace(`/login/?next=${encodeURIComponent(path + window.location.search)}`);
  }, [authReady, user, isPublic, linkBusy, path, router]);
  const toastEl = toast && <p className={`status ${toast.kind} toast`} role={toast.kind === "err" ? "alert" : "status"}>{toast.text}</p>;

  if (BARE.some((b) => path.startsWith(b))) {
    return (
      <div className="auth-shell">
        <header className="auth-top">
          <Link href="/" className="brand" style={{ padding: 0 }}><Logo />StayScout</Link>
          <Link href="/help/" className="btn btn-ghost"><HelpCircle aria-hidden="true" />Help</Link>
        </header>
        <main id="main" className="auth-main" tabIndex={-1}>
          <div className="auth-grid">
            <section className="auth-pitch" aria-label="What StayScout does">
              <p className="eyebrow">For hoteliers, homestay and villa owners</p>
              <h2>Big plans. Start with the right place.</h2>
              <ul>
                <li><MapPin aria-hidden="true" /><span><b>Rank every locality</b> in an Indian city by demand, guest ratings and access to airports, stations and hospitals.</span></li>
                <li><Tags aria-hidden="true" /><span><b>Price from live listings</b> on Google Maps and Airbnb, compared only with stays like yours.</span></li>
                <li><MessageSquareText aria-hidden="true" /><span><b>Fix what guests complain about</b> and turn each fix into a line for your listing.</span></li>
              </ul>
            </section>
            {children}
          </div>
        </main>
        {toastEl}
      </div>
    );
  }

  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <aside className="sidebar" aria-label="Main navigation">
        <Link href="/" className="brand"><Logo />StayScout</Link>
        <nav>
          <ul className="navlist">
            {NAV.map(({ href, label, icon: Icon }) => (
              <li key={href}><Link href={href} className="navlink" aria-current={isActive(href) ? "page" : undefined}><Icon aria-hidden="true" />{label}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="spacer" />
        <ul className="navlist foot">
          {FOOT.map(({ href, label, icon: Icon }) => (
            <li key={label}><Link href={href} className="navlink" aria-current={isActive(href) ? "page" : undefined}><Icon aria-hidden="true" />{label}</Link></li>
          ))}
          <li>
            {user ? (
              <Link href="/profile#account" className="navlink"><UserRound aria-hidden="true" /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name || user.email}</span></Link>
            ) : (
              <Link href="/login" className="navlink"><LogIn aria-hidden="true" />Sign in</Link>
            )}
          </li>
        </ul>
      </aside>

      <div className="main">
        <header className="topbar">
          <Link href="/" className="mbrand" aria-label="StayScout home"><Logo size={16} /></Link>
          <div className="market" title={market}><MapPin size={18} aria-hidden="true" /><span className="sr">Selected market:</span><b>{market}</b></div>
          <div className="gsearch" ref={boxRef}>
            <Search aria-hidden="true" />
            <label htmlFor="gsearch" className="sr">Search cities</label>
            <input
              id="gsearch" type="search" placeholder="Search a city, e.g. Udaipur" value={q} autoComplete="off"
              onChange={(e) => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => { if (e.key === "Enter" && results[0]) pickCity(results[0]); if (e.key === "Escape") setOpen(false); }}
              aria-controls="gresults" aria-expanded={open && results.length > 0}
            />
            {open && q.trim() && (
              <div className="gresults" id="gresults" role="listbox">
                {results.length ? results.map((c) => (
                  <button key={c.state + c.city} type="button" role="option" aria-selected="false" className="gres" onClick={() => pickCity(c)}>
                    <span>{c.city}</span><span className="muted">{c.state}</span>
                  </button>
                )) : <p className="muted" style={{ padding: "10px 12px" }}>No city matches “{q}”. Pick the nearest city in the finder.</p>}
              </div>
            )}
          </div>
          <label htmlFor="theme" className="sr">Appearance</label>
          <select id="theme" className="theme-sel" value={theme} onChange={(e) => setTheme(e.target.value as ThemePref)}>
            <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
          <Link href="/alerts" className="iconbtn" aria-label={`Alerts${alerts.length ? `, ${alerts.length} saved` : ""}`}>
            <Bell aria-hidden="true" />{alerts.length > 0 && <span className="badge">{alerts.length}</span>}
          </Link>
          {authReady && (user ? (
            <Link href="/profile#account" className="acct" aria-label={`Your account: ${user.email}`}><span className="av" aria-hidden="true">{initial}</span><span className="nm">Account</span></Link>
          ) : (
            <Link href={`/login/?next=${encodeURIComponent(path)}`} className="btn btn-primary signin-btn"><LogIn aria-hidden="true" /><span>Sign in</span></Link>
          ))}
        </header>
        <main id="main" className="content" tabIndex={-1}>
          {locked ? <div className="card empty" aria-busy="true"><Loader2 className="spin" aria-hidden="true" /><p className="muted">{linkBusy ? "Signing you in…" : "Checking your sign-in…"}</p></div> : children}
        </main>
        <footer className="sitefoot">
          <span>© 2026 StayScout. Research tool, not investment advice.</span>
          <nav aria-label="Legal and support">
            <Link href="/help">Help</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link>
          </nav>
        </footer>
      </div>

      <nav className="bottomnav" aria-label="Mobile navigation">
        {MOBILE.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined}><Icon aria-hidden="true" />{label}</Link>
        ))}
      </nav>
      {toastEl}
    </>
  );
}
