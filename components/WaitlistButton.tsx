/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import Link from "next/link";
import { useState } from "react";
import { BellPlus, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

/** Adds the signed-in account's email to the waitlist for a paid plan (Netlify Database). */
export default function WaitlistButton({ plan }: { plan: string }) {
  const { user, ready } = useAuth();
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [err, setErr] = useState("");
  if (!ready) return null;
  if (!user) return <Link href={`/login/?next=${encodeURIComponent("/plans")}`} className="btn btn-secondary">Sign in to join the waitlist</Link>;
  const join = async () => {
    setState("busy"); setErr("");
    try {
      const r = await fetch("/api/notify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: user.email, city: `plan:${plan}` }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn’t join right now. Try again.");
      setState("done");
    } catch (e) { setErr((e as Error).message); setState("err"); }
  };
  if (state === "done") return <p className="status ok" role="status"><Check size={16} aria-hidden="true" style={{ verticalAlign: -3 }} /> You’re on the list. We’ll email {user.email} when {plan} opens.</p>;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <button type="button" className="btn btn-secondary" onClick={join} disabled={state === "busy"}>
        {state === "busy" ? <Loader2 className="spin" aria-hidden="true" /> : <BellPlus aria-hidden="true" />}Tell me when it opens
      </button>
      {state === "err" && <p className="status err" role="alert">{err}</p>}
    </div>
  );
}
