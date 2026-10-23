"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ResultView } from "../../workspace";
import type { EnrichmentResult } from "@/src/lib/enrichment/types";

const progressLabels = ["Resolving company", "Reading official site", "Detecting offer", "Ranking decision makers", "Checking contact routes", "Saving new snapshot"];

export function LeadDetailClient({ leadId, result }: { leadId: string; result: EnrichmentResult }) {
  const router = useRouter(); const [loading,setLoading] = useState(false); const [error,setError] = useState<string>();
  async function reenrich() {
    setLoading(true); setError(undefined);
    try { const response = await fetch(`/api/leads/${leadId}/reenrich`, { method: "POST" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? "Re-enrichment failed."); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Re-enrichment failed."); } finally { setLoading(false); }
  }
  return <><div className="detail-action-row"><button className="primary-action compact-action" onClick={reenrich} disabled={loading}>{loading ? "Re-enriching…" : "Re-enrich lead"}<span aria-hidden>↻</span></button>{error && <p className="inline-error">{error}</p>}</div>{loading && <div className="compact-progress" role="status"><span className="live-dot" />{progressLabels.map((label) => <span key={label}>{label}</span>)}</div>}<div className="detail-result"><ResultView result={result} /></div></>;
}
