/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import { useEffect, useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Live, PageHeader } from "@/lib/ui";

const TOPICS = ["Question about the data", "Account or sign-in", "Interested in a paid plan", "Report a problem", "Delete my account", "Something else"];
const EMPTY = { name: "", email: "", topic: TOPICS[0], message: "", website: "" };

export default function Contact() {
  const { user } = useAuth();
  const [f, setF] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => { if (user) setF((p) => ({ ...p, name: p.name || user.name, email: p.email || user.email })); }, [user]);

  const errors: Partial<Record<"name" | "email" | "message", string>> = {};
  if (!f.name.trim()) errors.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) errors.email = "Enter a valid email address, e.g. name@example.com.";
  if (f.message.trim().length < 10) errors.message = "Write at least 10 characters.";
  else if (f.message.length > 2000) errors.message = "Keep your message under 2,000 characters.";
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true); setStatus(null);
    if (Object.keys(errors).length) { setStatus({ kind: "err", text: "Please fix the highlighted fields." }); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Your message couldn’t be sent. Try again.");
      setF({ ...EMPTY, name: f.name, email: f.email });
      setTouched(false);
      setStatus({ kind: "ok", text: `Thanks. Your message was sent and we’ll reply to ${f.email.trim()}.` });
    } catch (err) {
      setStatus({ kind: "err", text: (err as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <div className="stack" style={{ gap: 24, maxWidth: 720 }}>
      <PageHeader title="Contact" lead="Questions about the data, your account or a paid plan. We reply by email." />
      <Live message={status?.text ?? ""} />
      <form className="card stack" onSubmit={submit} noValidate aria-label="Contact form">
        <div className="grid-2">
          <div className="field">
            <label htmlFor="ct-name">Name</label>
            <input id="ct-name" className="input" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-invalid={!!show("name")} aria-describedby={show("name") ? "ct-name-e" : undefined} />
            {show("name") && <span id="ct-name-e" className="error">{show("name")}</span>}
          </div>
          <div className="field">
            <label htmlFor="ct-email">Email</label>
            <input id="ct-email" type="email" className="input" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-invalid={!!show("email")} aria-describedby={show("email") ? "ct-email-e" : undefined} />
            {show("email") && <span id="ct-email-e" className="error">{show("email")}</span>}
          </div>
        </div>
        <div className="field">
          <label htmlFor="ct-topic">Topic</label>
          <select id="ct-topic" className="select" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>{TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <div className="field">
          <label htmlFor="ct-msg">Message</label>
          <textarea id="ct-msg" className="textarea" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} aria-invalid={!!show("message")} aria-describedby="ct-msg-h" />
          <span id="ct-msg-h" className={show("message") ? "error" : "hint"}>{show("message") ?? `${f.message.length}/2,000`}</span>
        </div>
        <div className="sr" aria-hidden="true">
          <label htmlFor="ct-web">Leave this empty</label>
          <input id="ct-web" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
        </div>
        {status && <p className={`status ${status.kind}`} role={status.kind === "err" ? "alert" : "status"}>{status.kind === "ok" && <CheckCircle2 size={16} aria-hidden="true" style={{ verticalAlign: -3 }} />} {status.text}</p>}
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Loader2 className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />}{busy ? "Sending…" : "Send message"}</button>
        </div>
      </form>
    </div>
  );
}
