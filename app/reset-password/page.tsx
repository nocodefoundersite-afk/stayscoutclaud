/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
import type { Metadata } from "next";
import { Reset } from "@/components/pages/Auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };
export default function Page() { return <Reset />; }
