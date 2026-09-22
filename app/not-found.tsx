/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
import Link from "next/link";
import { MapPinOff } from "lucide-react";

export default function NotFound() {
  return (
    <div className="card empty" style={{ maxWidth: 560, margin: "40px auto" }}>
      <MapPinOff aria-hidden="true" />
      <h1 style={{ fontSize: 24 }}>Page not found</h1>
      <p className="muted">This page doesn’t exist or has moved.</p>
      <Link href="/" className="btn btn-primary">Find a location</Link>
    </div>
  );
}
