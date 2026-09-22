/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: { default: "StayScout", template: "%s · StayScout" },
  description: "Find the right neighbourhood for your homestay, hotel or villa: compare nightly prices and guest reviews, then plan your property.",
  robots: { index: true, follow: true, "max-image-preview": "none" },
  other: { robots: "noai, noimageai" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

const themeBoot = `try{var t=JSON.parse(localStorage.getItem("ss.theme")||'"system"');if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBoot }} /></head>
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
