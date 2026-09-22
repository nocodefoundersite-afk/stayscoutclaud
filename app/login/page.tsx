/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
import type { Metadata } from "next";
import { Login } from "@/components/pages/Auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export default function Page() { return <Login />; }
