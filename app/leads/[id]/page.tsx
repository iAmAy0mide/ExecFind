import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createLeadRepository } from "@/src/lib/persistence/client";
import { LeadDetailClient } from "./lead-detail";

export const instant = false;

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await params).id); if (!id.success) notFound();
  let detail; try { detail = await createLeadRepository().get(id.data); } catch (cause) { return <main className="workspace"><header className="masthead"><Link href="/" className="wordmark"><span>EF</span> Execfind</Link></header><section className="queue-message error-state"><strong>Lead record unavailable</strong><p>{cause instanceof Error ? cause.message : "The lead could not be loaded."}</p><Link href="/leads">Return to lead queue</Link></section></main>; }
  if (!detail) notFound();
  const current = detail.runs.find((run) => run.id === detail.lead.latestEnrichmentRunId)?.result;
  if (!current) return <main className="workspace"><section className="queue-message"><strong>No successful enrichment snapshot exists.</strong><Link href="/leads">Return to lead queue</Link></section></main>;
  return <main className="workspace detail-workspace">
    <header className="masthead"><Link href="/" className="wordmark"><span>EF</span> Execfind</Link><nav className="primary-nav" aria-label="Primary"><Link href="/">Enrich</Link><Link className="active" href="/leads">Leads</Link></nav><div className="mast-meta"><Link href="/leads">Back to queue</Link></div></header>
    <section className="detail-heading"><div><p className="field-label">Saved lead record</p><h1>{detail.lead.companyName}</h1><p>{detail.lead.sourcePlatform ? `Discovered via ${detail.lead.sourcePlatform.replace("_", " ")}` : "Source platform not recorded"}{detail.lead.sourceUrl && <> · <a href={detail.lead.sourceUrl} target="_blank" rel="noreferrer">Open discovery source</a></>}</p></div></section>
    <div className="detail-layout"><div><LeadDetailClient leadId={detail.lead.id} result={current} /></div><aside className="history-panel"><p className="field-label">Enrichment history</p><h2>{detail.runs.length} run{detail.runs.length === 1 ? "" : "s"}</h2><ol>{detail.runs.map((run,index) => <li key={run.id} className={`history-${run.status}`}><div><strong>{run.status === "succeeded" ? `Run ${detail.runs.length-index}` : run.status}</strong><time>{new Intl.DateTimeFormat("en-NG", { dateStyle:"medium", timeStyle:"short" }).format(new Date(run.startedAt))}</time></div>{run.score && <p>{run.score.grade} grade · {run.score.total}/100 · {run.result?.investment.branch.replaceAll("_", " ")}</p>}{run.error && <p>{typeof run.error.message === "string" ? run.error.message : "The run did not complete."}</p>}</li>)}</ol></aside></div>
    <footer><span>Execfind Phase 2</span><span>Current snapshot with preserved run history</span></footer>
  </main>;
}
