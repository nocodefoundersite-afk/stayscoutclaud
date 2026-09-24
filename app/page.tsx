/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
"use client";
import { Loader2 } from "lucide-react";
import Finder from "@/components/Finder";
import Landing from "@/components/pages/Landing";
import { useAuth } from "@/lib/auth";

/** Signed out, "/" is the front door; signed in, it is the finder. */
export default function Page() {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div className="card empty" aria-busy="true" style={{ border: 0, background: "transparent", minHeight: "60vh", justifyContent: "center" }}>
        <Loader2 className="spin" aria-hidden="true" />
        <p className="muted">Loading StayScout…</p>
      </div>
    );
  }
  return user ? <Finder /> : <Landing />;
}
