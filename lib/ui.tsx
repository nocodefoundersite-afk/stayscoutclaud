/* Copyright (c) 2026 Tanshu Singh / StayScout. All rights reserved. Proprietary and confidential. */
import type { ReactNode } from "react";

export const tone = (score: number) => (score >= 70 ? "good" : score >= 55 ? "warn" : "bad");

export function ScoreBadge({ score }: { score: number }) {
  return <span className={`score ${tone(score)}`} aria-label={`Score ${score} out of 100`}>{score}</span>;
}

export function PageHeader({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-h">
      <div>
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

/** Polite screen-reader announcements for status changes. */
export function Live({ message }: { message: string }) {
  return <p className="sr" role="status" aria-live="polite">{message}</p>;
}
