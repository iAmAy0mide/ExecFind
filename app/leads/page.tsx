import Link from "next/link";
import { createLeadRepository } from "@/src/lib/persistence/client";
import { queryString } from "@/src/lib/persistence/query";
import { leadQuerySchema, type LeadQuery, type LeadListResponse } from "@/src/lib/persistence/types";

export const instant = false;

const branchNames = { recurring_payout: "Recurring payout", buyback_maturity: "Buy-back / maturity", both: "Both", unknown: "Unknown" };
const reachabilityNames = { direct_email: "Direct email", phone_or_whatsapp: "Phone / WhatsApp", company_route: "Company route", none: "No route" };

function values(value: string | string[] | undefined) { return value == null ? [] : Array.isArray(value) ? value : [value]; }

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const parsed = leadQuerySchema.safeParse({ search: typeof raw.search === "string" ? raw.search : "", grades: values(raw.grade), branches: values(raw.branch), reachability: values(raw.reachability), sort: typeof raw.sort === "string" ? raw.sort : undefined, limit: 100, offset: 0 });
  const query: LeadQuery = parsed.success ? parsed.data : leadQuerySchema.parse({});
  let data: LeadListResponse | undefined; let error: string | undefined;
  try { data = await createLeadRepository().list(query); } catch (cause) { error = cause instanceof Error ? cause.message : "Lead queue could not be loaded."; }
  const exportHref = `/api/leads/export?${queryString(query)}`;
  return <main className="workspace queue-workspace">
    <header className="masthead"><Link href="/" className="wordmark"><span>EF</span> Execfind</Link><nav className="primary-nav" aria-label="Primary"><Link href="/">Enrich</Link><Link className="active" href="/leads">Leads</Link></nav><div className="mast-meta"><span className="live-dot" /> Prospect queue</div></header>
    <section className="queue-heading"><div><p className="field-label">Saved research</p><h1>Lead queue</h1><p>Prioritized by evidence-backed fit and reachability.</p></div>{data && data.total > 0 && <a className="secondary-action" href={exportHref}>Export filtered CSV</a>}</section>
    <form className="queue-filters" action="/leads">
      <label className="search-filter">Search<input name="search" defaultValue={query.search} placeholder="Company, domain, person, role" /></label>
      <fieldset><legend>Grade</legend>{(["A","B","C"] as const).map((item) => <label key={item}><input type="checkbox" name="grade" value={item} defaultChecked={query.grades.includes(item)} />{item}</label>)}</fieldset>
      <fieldset><legend>ICP branch</legend>{Object.entries(branchNames).map(([value,label]) => <label key={value}><input type="checkbox" name="branch" value={value} defaultChecked={query.branches.includes(value as LeadQuery["branches"][number])} />{label}</label>)}</fieldset>
      <fieldset><legend>Reachability</legend>{Object.entries(reachabilityNames).map(([value,label]) => <label key={value}><input type="checkbox" name="reachability" value={value} defaultChecked={query.reachability.includes(value as LeadQuery["reachability"][number])} />{label}</label>)}</fieldset>
      <label className="sort-filter">Sort<select name="sort" defaultValue={query.sort}><option value="score_desc">Score high to low</option><option value="newest">Newest enriched</option><option value="oldest">Oldest enriched</option><option value="company_asc">Company A–Z</option></select></label>
      <button className="filter-action">Apply filters</button><Link className="clear-filter" href="/leads">Clear</Link>
    </form>
    {error ? <section className="queue-message error-state"><strong>Lead queue unavailable</strong><p>{error}</p><p>Configure Supabase and apply the Phase 2 migration before using persistence.</p></section> : data && <>
      <div className="queue-summary"><strong>{data.summary.total} lead{data.summary.total === 1 ? "" : "s"}</strong><span>{data.summary.gradeA} A-grade</span><span>{data.summary.recurringPayout} recurring</span><span>{data.summary.buybackMaturity} buy-back</span><span>{data.summary.both} both</span></div>
      {data.items.length === 0 ? <section className="queue-message"><strong>No leads match this view.</strong><p>Clear filters or enrich a company to add the first saved record.</p><Link href="/">Enrich a company</Link></section> : <div className="queue-table-wrap"><table className="queue-table"><thead><tr><th>Priority</th><th>Company / offer</th><th>ICP branch</th><th>Decision maker</th><th>Best route</th><th>Last enriched</th></tr></thead><tbody>{data.items.map((lead) => <tr key={lead.id}><td><Link className={`queue-grade grade-${lead.grade}`} href={`/leads/${lead.id}`}><strong>{lead.grade}</strong><span>{lead.totalScore}</span></Link></td><td><Link className="company-link" href={`/leads/${lead.id}`}>{lead.companyName}</Link><small>{lead.domain ?? "Domain unresolved"}</small>{lead.offerSummary && <p>{lead.offerSummary}</p>}</td><td><span className={`branch-tag branch-${lead.investmentBranch}`}>{branchNames[lead.investmentBranch]}</span></td><td>{lead.primaryContactName ? <><strong>{lead.primaryContactName}</strong><small>{lead.primaryContactRole}</small></> : <span className="unknown">Not found</span>}</td><td>{lead.bestRouteValue ? <><strong className="route-type">{lead.bestRouteType?.replace("_", " ")}</strong><small>{lead.bestRouteValue}</small></> : <span className="unknown">No usable route</span>}</td><td><time dateTime={lead.lastEnrichedAt ?? undefined}>{lead.lastEnrichedAt ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(lead.lastEnrichedAt)) : "Never"}</time></td></tr>)}</tbody></table></div>}
    </>}
    <footer><span>Execfind Phase 2</span><span>Current snapshots backed by immutable enrichment history</span></footer>
  </main>;
}
