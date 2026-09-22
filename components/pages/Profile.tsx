/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Download, Trash2, Database, PlugZap, UserRound, Monitor, Sun, Moon, HelpCircle, CreditCard, Mail, Shield, FileText, LogOut, KeyRound, Gauge, Save, Loader2,
} from "lucide-react";
import { KEYS, useLocal, clearAllLocal, EMPTY_SELECTION, type Selection } from "@/lib/storage";
import { useAuth, logout, updateName, updatePassword, PASSWORD_MIN } from "@/lib/auth";
import { usage } from "@/lib/live";
import { Live, PageHeader } from "@/lib/ui";

type ThemePref = "system" | "light" | "dark";
type Usage = Awaited<ReturnType<typeof usage>>;

export default function Profile() {
  const router = useRouter();
  const { user } = useAuth();
  const [theme, setTheme] = useLocal<ThemePref>(KEYS.theme, "system");
  const [saved] = useLocal<unknown[]>(KEYS.saved, []);
  const [alerts] = useLocal<unknown[]>(KEYS.alerts, []);
  const [property] = useLocal<Record<string, unknown>>(KEYS.property, {});
  const [sel] = useLocal<Selection>(KEYS.selection, EMPTY_SELECTION);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [use, setUse] = useState<Usage | null>(null);
  const [useErr, setUseErr] = useState(false);

  useEffect(() => { if (user) usage().then(setUse).catch(() => setUseErr(true)); }, [user]);

  const exportData = () => {
    const data: Record<string, unknown> = {};
    try { Object.values(KEYS).forEach((k) => { const v = localStorage.getItem(k); if (v) data[k] = JSON.parse(v); }); } catch { /* ignore */ }
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exported: new Date().toISOString(), account: user?.email, data }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "stayscout-my-data.json"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg({ kind: "ok", text: "Your data on this device was downloaded." });
  };
  const clear = () => { clearAllLocal(); document.documentElement.removeAttribute("data-theme"); setConfirming(false); setMsg({ kind: "ok", text: "Saved areas, alerts, property details and preferences were deleted from this device." }); };
  const signOut = async () => { await logout(); router.push("/login/"); };

  const THEMES: { v: ThemePref; l: string; I: typeof Sun }[] = [{ v: "system", l: "System", I: Monitor }, { v: "light", l: "Light", I: Sun }, { v: "dark", l: "Dark", I: Moon }];

  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader title="Settings" lead="Your account, data usage, appearance and what’s stored on this device." />
      <Live message={msg?.text ?? ""} />
      {msg && <p className={`status ${msg.kind}`}>{msg.text}</p>}

      {user && <Account key={user.id} name={user.name} email={user.email} provider={user.provider} createdAt={user.createdAt} onSignOut={signOut} />}

      <section className="card" aria-labelledby="us-h">
        <div className="card-h"><h2 id="us-h"><Gauge size={18} aria-hidden="true" style={{ verticalAlign: -3 }} /> Data usage this month</h2></div>
        <p className="muted" style={{ marginBottom: 16 }}>Each new city analysis uses up to 2 data fetches (Google Maps and Airbnb). Each guest-review analysis uses 1. Cities and localities analysed in the last 7 days are free to open again.</p>
        {use ? (
          <div className="grid-2">
            {use.you && <Meter label="Your fetches" runs={use.you.runs} cap={use.you.cap} />}
            <Meter label="StayScout total" runs={use.site.runs} cap={use.site.cap} />
          </div>
        ) : useErr ? <p className="status err">Usage isn’t available right now.</p> : <p className="muted"><Loader2 size={16} className="spin" aria-hidden="true" style={{ verticalAlign: -3 }} /> Loading…</p>}
      </section>

      <section className="card" aria-labelledby="ap-h">
        <div className="card-h"><h2 id="ap-h">Appearance</h2></div>
        <div className="seg" role="radiogroup" aria-labelledby="ap-h" style={{ maxWidth: 420 }}>
          {THEMES.map(({ v, l, I }) => (
            <button key={v} type="button" role="radio" aria-checked={theme === v} aria-pressed={theme === v} onClick={() => { setTheme(v); setMsg({ kind: "ok", text: `Theme set to ${l.toLowerCase()}.` }); }}>
              <I size={16} aria-hidden="true" style={{ verticalAlign: -3, marginRight: 6 }} />{l}
            </button>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="ld-h">
        <div className="card-h"><h2 id="ld-h"><Database size={18} aria-hidden="true" style={{ verticalAlign: -3 }} /> Saved on this device</h2></div>
        <p className="muted" style={{ marginBottom: 16 }}>Saved areas, alerts and property details stay in this browser. City analyses are stored on StayScout’s server and shared by everyone who looks at the same city.</p>
        <dl className="grid-4" style={{ margin: 0 }}>
          <div className="stat"><dt><span>Saved areas</span></dt><dd style={{ margin: 0 }}><b className="num">{saved.length}</b></dd></div>
          <div className="stat"><dt><span>Alerts</span></dt><dd style={{ margin: 0 }}><b className="num">{alerts.length}</b></dd></div>
          <div className="stat"><dt><span>Property details</span></dt><dd style={{ margin: 0 }}><b>{Object.keys(property).length ? "Saved" : "None"}</b></dd></div>
          <div className="stat"><dt><span>Current city</span></dt><dd style={{ margin: 0 }}><b style={{ fontSize: 18 }}>{sel.city || "None"}</b></dd></div>
        </dl>
        <div className="row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={exportData}><Download aria-hidden="true" />Download my data</button>
          {!confirming ? (
            <button type="button" className="btn btn-ghost" style={{ color: "var(--bad)" }} onClick={() => setConfirming(true)}><Trash2 aria-hidden="true" />Delete data on this device</button>
          ) : (
            <div className="row status err" role="alert" style={{ gap: 8 }}>
              <span>Delete saved areas, alerts, property details and preferences from this device? This can’t be undone.</span>
              <button type="button" className="btn btn-primary" style={{ background: "var(--bad)", color: "#fff" }} onClick={clear}>Delete</button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="cn-h">
        <div className="card-h"><h2 id="cn-h"><PlugZap size={18} aria-hidden="true" style={{ verticalAlign: -3 }} /> Where the data comes from</h2></div>
        <div className="tbl-wrap">
          <table className="tbl rtbl">
            <tbody>
              <tr><th scope="row" className="rt-full">Stays, ratings and prices</th><td data-label="Source">Google Maps and Airbnb, collected through Apify</td></tr>
              <tr><th scope="row" className="rt-full">Airports, stations, hospitals, colleges</th><td data-label="Source">OpenStreetMap</td></tr>
              <tr><th scope="row" className="rt-full">Summaries, problems and fixes</th><td data-label="Source">AI (Google Gemini) reading only the collected numbers and reviews</td></tr>
              <tr><th scope="row" className="rt-full">Email alerts</th><td data-label="Status"><span className="pill warn">Not switched on yet</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <nav className="card" aria-label="More">
        <ul className="grid-3" style={{ listStyle: "none", margin: 0, padding: 0, gap: 8 }}>
          {([["/plans", "Plans", CreditCard], ["/help", "Help", HelpCircle], ["/contact", "Contact", Mail], ["/privacy", "Privacy", Shield], ["/terms", "Terms", FileText]] as const).map(([href, label, I]) => (
            <li key={href}><Link href={href} className="btn btn-secondary" style={{ width: "100%", justifyContent: "flex-start" }}><I aria-hidden="true" />{label}</Link></li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Meter({ label, runs, cap }: { label: string; runs: number; cap: number }) {
  const pct = cap ? Math.min(100, Math.round((runs / cap) * 100)) : 0;
  return (
    <div className="stat">
      <b className="num">{runs} <span className="muted" style={{ fontSize: 16, fontWeight: 500 }}>of {cap}</span></b>
      <span>{label}</span>
      <div className="bar" style={{ marginTop: 10 }} role="img" aria-label={`${runs} of ${cap} used`}><i style={{ width: `${pct}%`, background: pct >= 90 ? "var(--bad)" : undefined }} /></div>
    </div>
  );
}

function Account({ name, email, provider, createdAt, onSignOut }: { name: string; email: string; provider: string; createdAt: string; onSignOut: () => void }) {
  const [n, setN] = useState(name);
  const [nameMsg, setNameMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [pwTouched, setPwTouched] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<"" | "name" | "pw">("");
  const pwErr = {
    next: pw.next.length < PASSWORD_MIN ? `Use at least ${PASSWORD_MIN} characters.` : "",
    confirm: pw.confirm !== pw.next ? "The passwords don’t match." : "",
  };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!n.trim()) { setNameMsg({ kind: "err", text: "Enter your name." }); return; }
    setBusy("name"); setNameMsg(null);
    try { await updateName(n); setNameMsg({ kind: "ok", text: "Name saved." }); }
    catch (err) { setNameMsg({ kind: "err", text: (err as Error).message }); }
    finally { setBusy(""); }
  };
  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwTouched(true); setPwMsg(null);
    if (pwErr.next || pwErr.confirm) return;
    setBusy("pw");
    try { await updatePassword(pw.next); setPw({ next: "", confirm: "" }); setPwTouched(false); setPwMsg({ kind: "ok", text: "Password changed." }); }
    catch (err) { setPwMsg({ kind: "err", text: (err as Error).message }); }
    finally { setBusy(""); }
  };

  return (
    <section className="card stack" id="account" aria-labelledby="ac-h" style={{ scrollMarginTop: 96 }}>
      <div className="card-h" style={{ marginBottom: 0 }}>
        <h2 id="ac-h"><UserRound size={18} aria-hidden="true" style={{ verticalAlign: -3 }} /> Account</h2>
        <button type="button" className="btn btn-secondary" onClick={onSignOut}><LogOut aria-hidden="true" />Sign out</button>
      </div>
      <p className="muted">Signed in as <b style={{ color: "var(--ink)" }}>{email}</b>{provider && provider !== "email" ? ` with ${provider[0].toUpperCase()}${provider.slice(1)}` : ""}{createdAt ? ` · member since ${new Date(createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}` : ""}</p>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <form className="stack" onSubmit={saveName} noValidate aria-label="Your name">
          <div className="field">
            <label htmlFor="acc-name">Name</label>
            <input id="acc-name" className="input" autoComplete="name" value={n} onChange={(e) => setN(e.target.value)} />
          </div>
          {nameMsg && <p className={`status ${nameMsg.kind}`} role={nameMsg.kind === "err" ? "alert" : "status"}>{nameMsg.text}</p>}
          <div><button type="submit" className="btn btn-secondary" disabled={busy === "name"}>{busy === "name" ? <Loader2 className="spin" aria-hidden="true" /> : <Save aria-hidden="true" />}Save name</button></div>
        </form>
        {provider === "email" || !provider ? (
          <form className="stack" onSubmit={savePw} noValidate aria-label="Change password">
            <div className="field">
              <label htmlFor="acc-pw">New password</label>
              <input id="acc-pw" className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} aria-invalid={pwTouched && !!pwErr.next} aria-describedby="acc-pw-h" />
              <span id="acc-pw-h" className={pwTouched && pwErr.next ? "error" : "hint"}>{pwTouched && pwErr.next ? pwErr.next : `At least ${PASSWORD_MIN} characters.`}</span>
            </div>
            <div className="field">
              <label htmlFor="acc-pw2">Confirm new password</label>
              <input id="acc-pw2" className="input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} aria-invalid={pwTouched && !!pwErr.confirm} aria-describedby={pwTouched && pwErr.confirm ? "acc-pw2-e" : undefined} />
              {pwTouched && pwErr.confirm && <span id="acc-pw2-e" className="error">{pwErr.confirm}</span>}
            </div>
            {pwMsg && <p className={`status ${pwMsg.kind}`} role={pwMsg.kind === "err" ? "alert" : "status"}>{pwMsg.text}</p>}
            <div><button type="submit" className="btn btn-secondary" disabled={busy === "pw"}>{busy === "pw" ? <Loader2 className="spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}Change password</button></div>
          </form>
        ) : <p className="muted">You sign in with {provider}, so your password is managed there.</p>}
      </div>
    </section>
  );
}
