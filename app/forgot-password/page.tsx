/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
import type { Metadata } from "next";
import { Forgot } from "@/components/pages/Auth";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };
export default function Page() { return <Forgot />; }
