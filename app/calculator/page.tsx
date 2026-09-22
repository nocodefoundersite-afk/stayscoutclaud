/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
import type { Metadata } from "next";
import Calculator from "@/components/pages/Calculator";

export const metadata: Metadata = { title: "Rent vs buy" };
export default function Page() { return <Calculator />; }
