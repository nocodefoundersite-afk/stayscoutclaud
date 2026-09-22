/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
import type { Metadata } from "next";
import PropertyPage from "@/components/pages/Property";

export const metadata: Metadata = { title: "My property" };
export default function Page() { return <PropertyPage />; }
