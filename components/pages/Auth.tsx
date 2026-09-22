/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, MailCheck, LogIn, UserPlus, KeyRound, LogOut } from "lucide-react";
import {
  login, signup, recover, updatePassword, logout, googleUrl, identitySettings, useAuth, safeNext, PASSWORD_MIN, type IdentitySettings,
} from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function useParams() {
  const [p, setP] = useState<URLSearchParams>(() => new URLSearchParams());
  useEffect(() => { setP(new URLSearchParams(window.location.search)); }, []);
  return p;
}

function useSettings() {
  const [s, setS] = useState<IdentitySettings | null>(null);
  useEffect(() => { identitySettings().then(setS); }, []);
  return s;
}

function Password({ id, label, value, onChange, error, autoComplete, hint }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string; autoComplete: string; hint?: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw">
        <input id={id} className="input" type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete}
          aria-invalid={!!error} aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined} />
        <button type="button" onClick={() => setShow((x) => !x)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
          {show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
      {error ? <span id={`${id}-e`} className="error">{error}</span> : hint ? <span id={`${id}-h`} className="hint">{hint}</span> : null}
    </div>
  );
}

function strength(pw: string) {
  let n = 0;
  if (pw.length >= PASSWORD_MIN) n++;
  if (pw.length >= 12) n++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) n++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) n++;
  return n;
}

function Google({ settings, label }: { settings: IdentitySettings | null; label: string }) {
  if (!settings?.external?.google) return null;
  return (
    <>
      <a href={googleUrl()} className="btn btn-secondary btn-lg" style={{ width: "100%" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" /><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" /></svg>
        {label}
      </a>
      <div className="auth-or">or use your email</div>
    </>
  );
}

function SignedIn({ email, next }: { email: string; next: string }) {
  const router = useRouter();
  return (
    <div className="auth-card">
      <div><h1>You’re signed in</h1><p className="sub">as <b>{email}</b></p></div>
      <div className="row">
        <Link href={next} className="btn btn-primary">Continue</Link>
        <button type="button" className="btn btn-ghost" onClick={async () => { await logout(); router.refresh(); }}><LogOut aria-hidden="true" />Sign out</button>
      </div>
    </div>
  );
}

/* ---------------- sign in ---------------- */
export function Login() {
  const router = useRouter();
  const params = useParams();
  const settings = useSettings();
  const { user, ready } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = safeNext(params.get("next"));

  useEffect(() => { const e = params.get("email"); if (e) setEmail(e); }, [params]);

  const errs = {
    email: !email.trim() ? "Enter your email address." : !EMAIL_RE.test(email.trim()) ? "Enter a valid email, e.g. name@example.com." : "",
    password: !password ? "Enter your password." : "",
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true); setError("");
    if (errs.email || errs.password) return;
    setBusy(true);
    try { await login(email, password); router.push(next); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  if (ready && user) return <SignedIn email={user.email} next={next} />;
  return (
    <form className="auth-card" onSubmit={submit} noValidate aria-labelledby="auth-h">
      <div><h1 id="auth-h">Sign in</h1><p className="sub">Welcome back. Sign in to run live analyses and keep your research.</p></div>
      <Google settings={settings} label="Continue with Google" />
      <div className="field">
        <label htmlFor="l-email">Email</label>
        <input id="l-email" className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          aria-invalid={touched && !!errs.email} aria-describedby={touched && errs.email ? "l-email-e" : undefined} />
        {touched && errs.email && <span id="l-email-e" className="error">{errs.email}</span>}
      </div>
      <Password id="l-pw" label="Password" value={password} onChange={setPassword} error={touched ? errs.password : ""} autoComplete="current-password" />
      <div className="row" style={{ justifyContent: "flex-end", marginTop: -8 }}>
        <Link href={`/forgot-password/${email ? `?email=${encodeURIComponent(email.trim())}` : ""}`}>Forgot password?</Link>
      </div>
      {error && <p className="status err" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy} style={{ width: "100%" }}>
        {busy ? <Loader2 className="spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}{busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="muted" style={{ textAlign: "center" }}>New to StayScout? <Link href={`/register/?next=${encodeURIComponent(next)}`}>Create an account</Link></p>
    </form>
  );
}

/* ---------------- register ---------------- */
export function Register() {
  const params = useParams();
  const settings = useSettings();
  const { user, ready } = useAuth();
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "", terms: false });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [resent, setResent] = useState("");
  const next = safeNext(params.get("next"));
  const router = useRouter();

  const errs = {
    name: !f.name.trim() ? "Enter your name." : f.name.trim().length > 80 ? "Keep your name under 80 characters." : "",
    email: !f.email.trim() ? "Enter your email address." : !EMAIL_RE.test(f.email.trim()) ? "Enter a valid email, e.g. name@example.com." : "",
    password: f.password.length < PASSWORD_MIN ? `Use at least ${PASSWORD_MIN} characters.` : f.password.length > 72 ? "Use 72 characters or fewer." : "",
    confirm: f.confirm !== f.password ? "Passwords don’t match." : "",
    terms: !f.terms ? "Accept the terms to create an account." : "",
  };
  const valid = Object.values(errs).every((x) => !x);
  const score = strength(f.password);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true); setError("");
    if (!valid) return;
    setBusy(true);
    try {
      const needsConfirm = await signup(f.name, f.email, f.password);
      if (needsConfirm) setSentTo(f.email.trim()); else router.push(next);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    setResent("");
    try { await signup(f.name, f.email, f.password); setResent("We sent the email again."); }
    catch (err) { setResent((err as Error).message); }
  };

  if (ready && user) return <SignedIn email={user.email} next={next} />;
  if (sentTo) {
    return (
      <div className="auth-card" role="status">
        <MailCheck aria-hidden="true" style={{ width: 40, height: 40, color: "var(--accent-text)" }} />
        <div><h1>Check your email</h1><p className="sub">We sent a confirmation link to <b>{sentTo}</b>. Open it on this device to finish creating your account.</p></div>
        <ul className="list" style={{ color: "var(--ink-2)" }}>
          <li>The email comes from Netlify on behalf of StayScout.</li>
          <li>Can’t see it after a few minutes? Check spam or promotions.</li>
        </ul>
        <div className="row">
          <button type="button" className="btn btn-secondary" onClick={resend}>Send it again</button>
          <Link href={`/login/?email=${encodeURIComponent(sentTo)}&next=${encodeURIComponent(next)}`} className="btn btn-ghost">Go to sign in</Link>
        </div>
        {resent && <p className="status info">{resent}</p>}
      </div>
    );
  }
  if (settings?.disable_signup) {
    return (
      <div className="auth-card">
        <div><h1>Registrations are closed</h1><p className="sub">We aren’t accepting new accounts right now. <Link href="/contact">Contact us</Link> to join the waiting list.</p></div>
        <Link href="/login" className="btn btn-secondary">I already have an account</Link>
      </div>
    );
  }
  return (
    <form className="auth-card" onSubmit={submit} noValidate aria-labelledby="auth-h">
      <div><h1 id="auth-h">Create your account</h1><p className="sub">Free. Run live analyses of any Indian city, save localities and plan your property.</p></div>
      <Google settings={settings} label="Sign up with Google" />
      <div className="field">
        <label htmlFor="r-name">Full name</label>
        <input id="r-name" className="input" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} aria-invalid={touched && !!errs.name} aria-describedby={touched && errs.name ? "r-name-e" : undefined} />
        {touched && errs.name && <span id="r-name-e" className="error">{errs.name}</span>}
      </div>
      <div className="field">
        <label htmlFor="r-email">Email</label>
        <input id="r-email" className="input" type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} aria-invalid={touched && !!errs.email} aria-describedby={touched && errs.email ? "r-email-e" : undefined} />
        {touched && errs.email && <span id="r-email-e" className="error">{errs.email}</span>}
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <Password id="r-pw" label="Password" value={f.password} onChange={(v) => set("password", v)} error={touched ? errs.password : ""} autoComplete="new-password" hint={`At least ${PASSWORD_MIN} characters. A longer passphrase is stronger.`} />
        <div className="meter" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={i < score ? "on" : undefined} />)}</div>
        <span className="sr" aria-live="polite">{f.password ? `Password strength: ${["too weak", "weak", "fair", "good", "strong"][score]}` : ""}</span>
      </div>
      <Password id="r-pw2" label="Confirm password" value={f.confirm} onChange={(v) => set("confirm", v)} error={touched ? errs.confirm : ""} autoComplete="new-password" />
      <div className="field">
        <label className="check" style={{ alignItems: "flex-start", fontWeight: 400 }}>
          <input type="checkbox" checked={f.terms} onChange={(e) => set("terms", e.target.checked)} aria-invalid={touched && !!errs.terms} aria-describedby={touched && errs.terms ? "r-terms-e" : undefined} style={{ marginTop: 2 }} />
          <span>I agree to the <Link href="/terms" target="_blank">Terms</Link> and <Link href="/privacy" target="_blank">Privacy policy</Link>.</span>
        </label>
        {touched && errs.terms && <span id="r-terms-e" className="error">{errs.terms}</span>}
      </div>
      {error && <p className="status err" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy} style={{ width: "100%" }}>
        {busy ? <Loader2 className="spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}{busy ? "Creating account…" : "Create account"}
      </button>
      <p className="muted" style={{ textAlign: "center" }}>Already have an account? <Link href={`/login/?next=${encodeURIComponent(next)}`}>Sign in</Link></p>
    </form>
  );
}

/* ---------------- forgot password ---------------- */
export function Forgot() {
  const params = useParams();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  useEffect(() => { const e = params.get("email"); if (e) setEmail(e); }, [params]);
  const err = !email.trim() ? "Enter your email address." : !EMAIL_RE.test(email.trim()) ? "Enter a valid email, e.g. name@example.com." : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true); setError("");
    if (err) return;
    setBusy(true);
    try { await recover(email); setSent(email.trim()); }
    catch (x) {
      const status = (x as { status?: number }).status;
      if (status === 404 || status === 422) setSent(email.trim()); // don't reveal whether an account exists
      else setError((x as Error).message);
    } finally { setBusy(false); }
  };

  if (sent) {
    return (
      <div className="auth-card" role="status">
        <MailCheck aria-hidden="true" style={{ width: 40, height: 40, color: "var(--accent-text)" }} />
        <div><h1>Check your email</h1><p className="sub">If there’s an account for <b>{sent}</b>, we’ve sent a link to reset the password. It works once.</p></div>
        <Link href="/login" className="btn btn-secondary">Back to sign in</Link>
      </div>
    );
  }
  return (
    <form className="auth-card" onSubmit={submit} noValidate aria-labelledby="auth-h">
      <div><h1 id="auth-h">Reset your password</h1><p className="sub">Enter the email you signed up with and we’ll send you a reset link.</p></div>
      <div className="field">
        <label htmlFor="f-email">Email</label>
        <input id="f-email" className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={touched && !!err} aria-describedby={touched && err ? "f-email-e" : undefined} />
        {touched && err && <span id="f-email-e" className="error">{err}</span>}
      </div>
      {error && <p className="status err" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy} style={{ width: "100%" }}>
        {busy ? <Loader2 className="spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}{busy ? "Sending…" : "Send reset link"}
      </button>
      <p className="muted" style={{ textAlign: "center" }}>Remembered it? <Link href="/login">Sign in</Link></p>
    </form>
  );
}

/* ---------------- set a new password (after the reset email) ---------------- */
export function Reset() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const errs = {
    pw: pw.length < PASSWORD_MIN ? `Use at least ${PASSWORD_MIN} characters.` : pw.length > 72 ? "Use 72 characters or fewer." : "",
    confirm: confirm !== pw ? "Passwords don’t match." : "",
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true); setError("");
    if (errs.pw || errs.confirm) return;
    setBusy(true);
    try { await updatePassword(pw); setDone(true); }
    catch (x) { setError((x as Error).message); }
    finally { setBusy(false); }
  };

  if (!ready) return <div className="auth-card"><p className="muted"><Loader2 className="spin" aria-hidden="true" style={{ verticalAlign: -4 }} /> Checking your reset link…</p></div>;
  if (done) {
    return (
      <div className="auth-card" role="status">
        <div><h1>Password updated</h1><p className="sub">Use your new password next time you sign in.</p></div>
        <button type="button" className="btn btn-primary" onClick={() => router.push("/")}>Continue to StayScout</button>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="auth-card">
        <div><h1>Open the link from your email</h1><p className="sub">To choose a new password, open the reset link we emailed you. Links work once and expire after a while.</p></div>
        <Link href="/forgot-password" className="btn btn-primary">Send a new reset link</Link>
      </div>
    );
  }
  return (
    <form className="auth-card" onSubmit={submit} noValidate aria-labelledby="auth-h">
      <div><h1 id="auth-h">Choose a new password</h1><p className="sub">For <b>{user.email}</b></p></div>
      <Password id="n-pw" label="New password" value={pw} onChange={setPw} error={touched ? errs.pw : ""} autoComplete="new-password" hint={`At least ${PASSWORD_MIN} characters.`} />
      <Password id="n-pw2" label="Confirm new password" value={confirm} onChange={setConfirm} error={touched ? errs.confirm : ""} autoComplete="new-password" />
      {error && <p className="status err" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy} style={{ width: "100%" }}>
        {busy ? <Loader2 className="spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}{busy ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
