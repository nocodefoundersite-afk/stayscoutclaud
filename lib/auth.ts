/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
/**
 * Sign-in with Netlify Identity (GoTrue API at /.netlify/identity).
 * Email confirmation is required by the site settings, so new accounts must click the link in their email.
 */
import { useEffect, useState } from "react";

const BASE = "/.netlify/identity";
const KEY = "ss.auth";
const EVT = "ss-auth";

export type AuthUser = { id: string; email: string; name: string; provider: string; createdAt: string };
type Session = { access_token: string; refresh_token: string; expires_at: number; user: AuthUser };
type TokenResponse = { access_token: string; refresh_token: string; expires_in: number; token_type?: string };
type GoTrueUser = { id: string; email: string; created_at?: string; user_metadata?: { full_name?: string }; app_metadata?: { provider?: string } };

export class AuthError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function read(): Session | null {
  try { const v = localStorage.getItem(KEY); return v ? (JSON.parse(v) as Session) : null; } catch { return null; }
}
function write(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY);
  } catch { /* storage blocked: session lasts for this page only */ }
  mem = s;
  window.dispatchEvent(new Event(EVT));
}
let mem: Session | null = null;
const current = () => mem ?? (mem = read());

const toUser = (u: GoTrueUser): AuthUser => ({
  id: u.id, email: u.email, name: u.user_metadata?.full_name || "", provider: u.app_metadata?.provider || "email", createdAt: u.created_at || "",
});

/** Turn GoTrue's error bodies into sentences people can act on. */
function friendly(raw: string, status: number) {
  const m = raw.toLowerCase();
  if (m.includes("email not confirmed")) return "Confirm your email first. Check your inbox for the link we sent.";
  if (m.includes("no user found") || m.includes("invalid") && m.includes("password")) return "That email and password don’t match. Check them and try again.";
  if (m.includes("already been registered") || m.includes("already registered")) return "An account with this email already exists. Sign in instead, or reset your password.";
  if (m.includes("password") && (m.includes("short") || m.includes("characters"))) return "Use a longer password: at least 8 characters.";
  if (m.includes("signups not allowed") || m.includes("signup") && m.includes("disabled")) return "New registrations are closed right now.";
  if (m.includes("user not found") || m.includes("token") && (m.includes("expired") || m.includes("invalid") || m.includes("not found")))
    return "This link has expired or was already used. Request a new one.";
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  if (status >= 500) return "The sign-in service isn’t responding. Try again in a moment.";
  return raw || "Something went wrong. Try again.";
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try { r = await fetch(BASE + path, init); }
  catch { throw new AuthError("Can’t reach the sign-in service. Check your connection and try again.", 0); }
  const text = await r.text();
  let body: Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) : {}; } catch { /* non-JSON */ }
  if (!r.ok) {
    if (r.status === 404 && !text.trim().startsWith("{")) throw new AuthError("Sign-in isn’t available on this copy of the site.", 404);
    const msg = String(body.error_description || body.msg || body.message || body.error || "");
    throw new AuthError(friendly(msg, r.status), r.status);
  }
  return body as T;
}

async function sessionFrom(t: TokenResponse): Promise<Session> {
  const u = await call<GoTrueUser>("/user", { headers: { authorization: `Bearer ${t.access_token}` } });
  const s: Session = { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (t.expires_in || 3600) * 1000, user: toUser(u) };
  write(s);
  return s;
}

export async function login(email: string, password: string) {
  const t = await call<TokenResponse>("/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", username: email.trim(), password }).toString(),
  });
  return (await sessionFrom(t)).user;
}

/** Returns true when the account needs email confirmation before signing in. */
export async function signup(name: string, email: string, password: string) {
  const u = await call<GoTrueUser & { confirmed_at?: string | null }>("/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password, data: { full_name: name.trim() } }),
  });
  if (u.confirmed_at) { await login(email, password); return false; }
  return true;
}

export async function verify(token: string, type: "signup" | "recovery") {
  const t = await call<TokenResponse>("/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, type }) });
  return (await sessionFrom(t)).user;
}

/** Google sign-in returns tokens in the URL hash. */
export async function fromOAuthHash(p: URLSearchParams) {
  return (await sessionFrom({ access_token: p.get("access_token") || "", refresh_token: p.get("refresh_token") || "", expires_in: Number(p.get("expires_in") || 3600) })).user;
}
export const googleUrl = () => `${BASE}/authorize?provider=google`;

export async function recover(email: string) {
  await call("/recover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
}

export async function accessToken(): Promise<string | null> {
  const s = current();
  if (!s) return null;
  if (s.expires_at - Date.now() > 60_000) return s.access_token;
  try {
    const t = await call<TokenResponse>("/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: s.refresh_token }).toString(),
    });
    const next = { ...s, access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (t.expires_in || 3600) * 1000 };
    write(next);
    return next.access_token;
  } catch {
    write(null);
    return null;
  }
}

export async function updatePassword(password: string) {
  const token = await accessToken();
  if (!token) throw new AuthError("Your reset link has expired. Request a new one.", 401);
  await call("/user", { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ password }) });
}

export async function updateName(name: string) {
  const token = await accessToken();
  if (!token) throw new AuthError("Sign in again to update your name.", 401);
  const u = await call<GoTrueUser>("/user", { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ data: { full_name: name.trim() } }) });
  const s = current();
  if (s) write({ ...s, user: toUser(u) });
}

export async function logout() {
  const s = current();
  write(null);
  if (s) await fetch(BASE + "/logout", { method: "POST", headers: { authorization: `Bearer ${s.access_token}` } }).catch(() => {});
}

export type IdentitySettings = { external: Record<string, boolean>; disable_signup: boolean; autoconfirm: boolean };
let settingsCache: Promise<IdentitySettings | null> | null = null;
export const identitySettings = () => (settingsCache ??= call<IdentitySettings>("/settings").catch(() => null));

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setUser(current()?.user ?? null);
    mem = read();
    sync();
    setReady(true);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) { mem = read(); sync(); } };
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", onStorage); };
  }, []);
  return { user, ready };
}

/** Only allow same-site paths as a post-login destination. */
export const safeNext = (v: string | null) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/");
export const PASSWORD_MIN = 8;
