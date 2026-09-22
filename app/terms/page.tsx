/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
import type { Metadata } from "next";
import { PageHeader } from "@/lib/ui";

export const metadata: Metadata = { title: "Terms" };

export default function Page() {
  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader title="Terms of use" lead="Last updated September 2026." />
      <article className="card prose">
        <h2>Research, not advice</h2>
        <p>StayScout is a research tool. Nothing here is financial, investment, legal or tax advice. Scores, prices and AI summaries come from public data that can be incomplete or out of date. Check listings, local rules and your numbers before committing money.</p>
        <h2>Your account</h2>
        <p>Keep your password private. One account per person. We may limit or suspend accounts that try to get around monthly data limits or misuse the service.</p>
        <h2>Your content</h2>
        <p>Listing drafts are generated from templates and AI suggestions. You’re responsible for checking that every claim is true before you publish it.</p>
        <h2>Ownership</h2>
        <p>© 2026 Tanshu Singh / StayScout. All rights reserved. The software, design and text may not be copied, scraped or used to train AI systems without written permission.</p>
      </article>
    </div>
  );
}
