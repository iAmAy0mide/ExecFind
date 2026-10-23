"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { ContactCandidate, EnrichmentResult } from "@/src/lib/enrichment/types";

type SavedResult = EnrichmentResult & { persistence?: { saved: true; leadId: string; runId: string } };

const progressLabels = ["Validating input", "Resolving company", "Reading official site", "Detecting offer", "Ranking decision makers", "Checking contact routes", "Scoring lead"];
const branchNames = { recurring_payout: "Recurring payout", buyback_maturity: "Buy-back / maturity", both: "Both structures", unknown: "Unknown" };

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="text-button" type="button" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1400); }}>{copied ? "Copied" : label}</button>;
}

function Person({ person, label }: { person?: ContactCandidate; label: string }) {
  return <section className="person-block">
    <p className="field-label">{label}</p>
    {person ? <><div className="person-heading"><h3>{person.name}</h3><span className={`confidence confidence-${person.confidence >= .75 ? "high" : "medium"}`}>{Math.round(person.confidence * 100)}% confidence</span></div><p className="person-role">{person.title}</p><p className="snippet">“{person.evidenceSnippet}”</p><a className="source-link" href={person.sourceUrls[0]} target="_blank" rel="noreferrer">Review source</a></> : <p className="unknown">No evidence-backed candidate found.</p>}
  </section>;
}

export function ResultView({ result }: { result: EnrichmentResult }) {
  return <div className="result-shell">
    <header className="result-header">
      <div className={`grade grade-${result.score.grade}`}><strong>{result.score.grade}</strong><span>{result.score.total}/100</span></div>
      <div><p className="field-label">Enrichment result</p><h2>{result.company.name}</h2><p className="domain">{result.company.domain ?? "Official domain unresolved"}</p></div>
      <div className="result-actions"><CopyButton label="Copy result" value={JSON.stringify(result, null, 2)} /><button className="text-button" type="button" onClick={() => { const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }); const href = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = href; anchor.download = `${result.company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-enrichment.json`; anchor.click(); URL.revokeObjectURL(href); }}>Export JSON</button></div>
    </header>
    <div className="score-strip" aria-label="Score breakdown"><span><b>{result.score.icpFit}</b>/40 ICP fit</span><span><b>{result.score.decisionMaker}</b>/30 decision maker</span><span><b>{result.score.reachability}</b>/30 reachability</span></div>
    <div className="result-grid">
      <main className="result-main">
        <section className="finding">
          <div className="finding-title"><p className="field-label">Investment programme</p><span className={result.investment.detected ? "status-detected" : "status-unknown"}>{result.investment.detected ? "Detected" : "Not confirmed"}</span></div>
          <h3>{branchNames[result.investment.branch]}</h3><p>{result.investment.offerSummary ?? "No qualifying recurring-payout or maturity language was found."}</p><p className="confidence-line">Classification confidence {Math.round(result.investment.confidence * 100)}%</p>
        </section>
        <div className="people-grid"><Person label="Primary decision maker" person={result.contacts.primary} /><Person label="Secondary / pain owner" person={result.contacts.secondary} /></div>
        <section className="finding route-block"><p className="field-label">Best legitimate route</p>{result.bestRoute ? <><h3>{result.bestRoute.type.replace("_", " ")}</h3><div className="route-value"><span>{result.bestRoute.value}</span><CopyButton value={result.bestRoute.value} /></div><p className="confidence-line">{result.bestRoute.verification} · {result.bestRoute.public ? "public business route" : "provider-supplied professional route"}</p></> : <p className="unknown">No public professional route found.</p>}</section>
      </main>
      <aside className="evidence-rail">
        <section><p className="field-label">Evidence ledger</p><p className="rail-count">{result.evidence.length} source record{result.evidence.length === 1 ? "" : "s"}</p><ol className="evidence-list">{result.evidence.map((item, index) => <li key={`${item.sourceUrl}-${index}`}><div><span>{item.sourceType.replace("_", " ")}</span><a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source</a></div>{item.title && <strong>{item.title}</strong>}<p>{item.snippet ?? "Source supports the linked conclusion."}</p><small>Supports: {item.supports.join(", ")}</small></li>)}</ol></section>
        {result.warnings.length > 0 && <section className="warnings"><p className="field-label">Uncertainty & limits</p><ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section>}
      </aside>
    </div>
  </div>;
}

export function EnrichmentWorkspace() {
  const [result, setResult] = useState<SavedResult>(); const [error, setError] = useState<string>(); const [loading, setLoading] = useState(false); const [progress, setProgress] = useState(0);
  useEffect(() => { if (!loading) return; const timer = setInterval(() => setProgress((value) => Math.min(progressLabels.length - 1, value + 1)), 1100); return () => clearInterval(timer); }, [loading]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(undefined); setResult(undefined); setProgress(0);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try { const response = await fetch("/api/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? "Enrichment failed."); setResult(payload); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Enrichment failed."); } finally { setLoading(false); }
  }
  return <main className="workspace">
    <header className="masthead"><Link href="/" className="wordmark"><span>EF</span> Execfind</Link><nav className="primary-nav" aria-label="Primary"><Link className="active" href="/">Enrich</Link><Link href="/leads">Leads</Link></nav><div className="mast-meta"><span className="live-dot" /> Persistent research</div></header>
    <section className="intro"><p>Evidence-first company intelligence</p><h1>Turn a company into a lead you can verify.</h1><span>Enter what you know. Execfind reads the official public site, classifies the investment model, and ranks legitimate decision-maker routes.</span></section>
    <section className="workbench">
      <form className="intake" onSubmit={submit}>
        <div className="panel-heading"><div><p className="field-label">Research brief</p><h2>New enrichment</h2></div><span>One company per run</span></div>
        <label>Company name <em>required</em><input name="companyName" required minLength={2} placeholder="e.g. Oakridge Properties" /></label>
        <label>Official website <em>optional</em><input name="website" inputMode="url" placeholder="company.com" /></label>
        <div className="form-row"><label>Source platform<select name="sourcePlatform" defaultValue="manual"><option value="manual">Manual research</option><option value="google_maps">Google Maps</option><option value="meta_ads">Meta Ads Library</option><option value="other">Other</option></select></label><label>Source URL<input name="sourceUrl" inputMode="url" placeholder="https://…" /></label></div>
        <label>Investment-offer hint <em>optional</em><textarea name="investmentOfferHint" rows={3} placeholder="Paste a short phrase from the ad or listing." /></label>
        <button className="primary-action" disabled={loading}>{loading ? "Enriching…" : "Enrich lead"}<span aria-hidden>↗</span></button>
        <p className="form-note">Public professional information only. No outreach is sent.</p>
      </form>
      <div className="output" aria-live="polite">
        {loading && <div className="progress-panel"><div className="radar" aria-hidden><i /><i /><i /></div><p className="field-label">Enrichment in progress</p><h2>{progressLabels[progress]}</h2><ol>{progressLabels.map((label, index) => <li className={index < progress ? "done" : index === progress ? "active" : ""} key={label}><span>{index < progress ? "✓" : index + 1}</span>{label}</li>)}</ol><p>Some sites respond slowly. The run will stop at the configured safety limits.</p></div>}
        {!loading && error && <div className="empty-state error-state"><span>!</span><h2>Run could not complete</h2><p>{error}</p><p>Check the company name or website and try again.</p></div>}
        {!loading && !error && !result && <div className="empty-state"><div className="empty-mark" aria-hidden><span /><span /><span /></div><p className="field-label">Ready for a company</p><h2>Your evidence dossier will appear here.</h2><p>Results show unknowns plainly and link every important conclusion back to its source.</p><div className="empty-columns"><span>Investment model</span><span>Decision makers</span><span>Contact route</span></div></div>}
        {!loading && result && <>{result.persistence && <div className="saved-notice"><span>Saved to the lead queue</span><Link href={`/leads/${result.persistence.leadId}`}>Open lead record</Link></div>}<ResultView result={result} /></>}
      </div>
    </section>
    <footer><span>Execfind Phase 2</span><span>Persistent history · deterministic analysis · source-backed output</span></footer>
  </main>;
}
