import { classifyInvestment } from "../classification/investment";
import { crawlWebsite, type CrawlOptions } from "../crawl/crawler";
import { normalizeInput } from "../normalize";
import type { ContactProvider, DomainResolver, SearchHit, SearchProvider } from "../providers/interfaces";
import { selectContacts } from "../ranking/people";
import { scoreLead, selectBestRoute } from "../scoring/score";
import type { ContactCandidate, ContactRoute, EnrichmentResult, EnrichmentStage, Evidence, PersonCandidate, Result } from "../types";

export type PipelineDependencies = { domainResolver?: DomainResolver; searchProvider?: SearchProvider; contactProvider?: ContactProvider; crawlOptions?: CrawlOptions; crawl?: typeof crawlWebsite; now?: () => Date };

function stage(key: EnrichmentStage["key"], status: EnrichmentStage["status"], message: string): EnrichmentStage { return { key, status, message }; }
function routeEvidence(route: ContactRoute, retrievedAt: string): Evidence { return { sourceUrl: route.sourceUrl, sourceType: route.sourceUrl === "https://hunter.io/" ? "hunter" : "company_site", snippet: `${route.type}: ${route.value}`, supports: ["bestRoute"], retrievedAt }; }
function corroboratedDomain(hits: SearchHit[], companyName: string): { domain: string; hit: SearchHit } | undefined {
  const excluded = /(^|\.)(linkedin|facebook|instagram|x|twitter|youtube|crunchbase)\.com$/i;
  const token = companyName.toLowerCase().split(/\s+/).find((part) => part.length >= 4);
  const candidates = new Map<string, { count: number; hit: SearchHit }>();
  for (const hit of hits) {
    try {
      const host = new URL(hit.url).hostname.replace(/^www\./, "");
      if (excluded.test(host) || (token && !`${hit.title} ${hit.snippet} ${host}`.toLowerCase().includes(token))) continue;
      const current = candidates.get(host); candidates.set(host, { count: (current?.count ?? 0) + 1, hit: current?.hit ?? hit });
    } catch { /* ignore malformed provider URLs */ }
  }
  const ranked = [...candidates.entries()].sort((a, b) => b[1].count - a[1].count);
  return ranked[0]?.[1].count >= 2 && ranked[0][1].count > (ranked[1]?.[1].count ?? 0) ? { domain: ranked[0][0], hit: ranked[0][1].hit } : undefined;
}
function searchPeople(hits: SearchHit[], retrievedAt: string): { people: PersonCandidate[]; evidence: Evidence[] } {
  const role = /(Founder|Co-Founder|CEO|Chief Executive Officer|Managing Director|Head of Investments?|Director of Investments?|Investment Manager|CFO|Chief Financial Officer|Head of Finance|Finance Manager|COO|Operations Director)/i;
  const name = /\b([A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+){1,3})\b/;
  const people: PersonCandidate[] = []; const evidence: Evidence[] = [];
  for (const hit of hits) {
    const text = `${hit.title}. ${hit.snippet}`; const roleMatch = text.match(role); const nameMatch = text.match(name); if (!roleMatch || !nameMatch) continue;
    const title = roleMatch[0]; const category = /founder|ceo|chief executive|managing director/i.test(title) ? "economic_buyer" : /investment/i.test(title) ? "investment" : /finance|cfo/i.test(title) ? "finance" : "operations";
    people.push({ name: nameMatch[1], title, roleCategory: category, relevance: category === "economic_buyer" ? "economic_buyer" : "pain_owner", confidence: 0.48, sourceUrls: [hit.url], evidenceSnippet: hit.snippet.slice(0, 500) });
    evidence.push({ sourceUrl: hit.url, sourceType: "web_search", title: hit.title, snippet: hit.snippet.slice(0, 500), supports: ["contacts.candidate"], retrievedAt });
  }
  return { people, evidence };
}

export async function enrichLead(raw: unknown, dependencies: PipelineDependencies = {}): Promise<Result<EnrichmentResult>> {
  const normalized = normalizeInput(raw); if (!normalized.ok) return normalized;
  const input = normalized.value; const retrievedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const warnings: string[] = []; const evidence: Evidence[] = []; const stages: EnrichmentStage[] = [stage("intake", "complete", "Input validated and normalized.")];
  let searchHits: SearchHit[] = []; let searchAttempted = false;
  let website = input.website; let domain = website ? new URL(website).hostname.replace(/^www\./, "") : undefined;
  if (website) evidence.push({ sourceUrl: website, sourceType: "user_input", snippet: "Website supplied by the user.", supports: ["company.website", "company.domain"], retrievedAt });
  if (!website && dependencies.domainResolver) {
    const resolution = await dependencies.domainResolver.resolve(input.companyName);
    if (resolution.ok && resolution.value.length === 1 && resolution.value[0].confidence >= 0.8) { domain = resolution.value[0].domain; website = `https://${domain}/`; evidence.push(resolution.value[0].evidence); }
    else if (resolution.ok && resolution.value.length > 0) warnings.push(`Domain resolution returned ${resolution.value.length} candidates; none was selected automatically.`);
    else if (!resolution.ok) warnings.push(resolution.error.message);
  }
  if (!website && dependencies.searchProvider) {
    searchAttempted = true;
    const searched = await dependencies.searchProvider.searchCompany(input.companyName);
    if (searched.ok) {
      searchHits = searched.value;
      const resolved = corroboratedDomain(searchHits, input.companyName);
      if (resolved) {
        domain = resolved.domain; website = `https://${domain}/`;
        evidence.push({ sourceUrl: resolved.hit.url, sourceType: "web_search", title: resolved.hit.title, snippet: resolved.hit.snippet.slice(0, 500), supports: ["company.domain"], retrievedAt });
      } else if (searchHits.length) warnings.push("Search results did not corroborate one unambiguous official domain.");
    } else warnings.push(searched.error.message);
  }
  stages.push(stage("domain", website ? "complete" : "degraded", website ? `Using ${domain}.` : "No unambiguous official domain was resolved."));
  const crawl = dependencies.crawl ?? crawlWebsite;
  const crawled = website ? await crawl(website, dependencies.crawlOptions) : { pages: [], warnings: ["Website crawl skipped because no official domain was available."] };
  warnings.push(...crawled.warnings);
  stages.push(stage("crawl", crawled.pages.length ? "complete" : "degraded", crawled.pages.length ? `Read ${crawled.pages.length} public HTML page${crawled.pages.length === 1 ? "" : "s"}.` : "No official-site pages were read."));
  const investment = classifyInvestment(crawled.pages, input.investmentOfferHint, retrievedAt); evidence.push(...investment.evidence);
  stages.push(stage("classification", investment.detected ? "complete" : "degraded", investment.detected ? `Detected ${investment.branch.replaceAll("_", " ")}.` : "No qualifying payout or maturity language was found."));
  const people = crawled.pages.flatMap((page) => page.people);
  if (dependencies.searchProvider && people.length < 2 && !searchAttempted) {
    searchAttempted = true;
    const searched = await dependencies.searchProvider.searchCompany(input.companyName);
    if (searched.ok) searchHits = searched.value;
    else warnings.push(searched.error.message);
  }
  if (searchHits.length) { const extracted = searchPeople(searchHits, retrievedAt); people.push(...extracted.people); evidence.push(...extracted.evidence); }
  if (!dependencies.searchProvider) warnings.push("Brave Search is not configured; web corroboration was skipped.");
  let routes: ContactRoute[] = crawled.pages.flatMap((page) => [
    ...page.emails.map((value): ContactRoute => ({ type: "email", value, sourceUrl: page.url, public: true, verification: "public" })),
    ...page.phones.map((value): ContactRoute => ({ type: "phone", value, sourceUrl: page.url, public: true, verification: "public" })),
    ...page.whatsapp.map((value): ContactRoute => ({ type: "whatsapp", value, sourceUrl: page.url, public: true, verification: "public" })),
    ...(new URL(page.url).pathname.toLowerCase().includes("contact") ? [{ type: "contact_page" as const, value: page.url, sourceUrl: page.url, public: true, verification: "public" as const }] : []),
  ]);
  if (dependencies.contactProvider && domain) {
    const enriched = await dependencies.contactProvider.domainSearch(domain);
    if (enriched.ok) routes.push(...enriched.value); else if (!/disabled/i.test(enriched.error.message)) warnings.push(enriched.error.message); else warnings.push("Hunter credited calls are disabled; only website contacts were used.");
  } else if (!dependencies.contactProvider) warnings.push("Hunter is not configured; professional email enrichment was skipped.");
  routes = [...new Map(routes.map((route) => [`${route.type}:${route.value.toLowerCase()}`, route])).values()];
  const contactsWithRoutes: ContactCandidate[] = people.map((candidate) => ({ ...candidate, routes: routes.filter((route) => route.personName?.toLowerCase() === candidate.name.toLowerCase()) }));
  const contacts = selectContacts(contactsWithRoutes);
  stages.push(stage("people", contacts.primary ? "complete" : "degraded", contacts.primary ? `Ranked ${contactsWithRoutes.length} decision-maker candidate${contactsWithRoutes.length === 1 ? "" : "s"}.` : "No evidence-backed decision maker was found."));
  const bestRoute = selectBestRoute(routes); if (bestRoute) evidence.push(routeEvidence(bestRoute, retrievedAt));
  stages.push(stage("contacts", bestRoute ? "complete" : "degraded", bestRoute ? `Selected a ${bestRoute.type.replace("_", " ")} route.` : "No legitimate public contact route was found."));
  const score = scoreLead({ investment, primary: contacts.primary, secondary: contacts.secondary, routes });
  stages.push(stage("scoring", "complete", `Lead scored ${score.total}/100 (${score.grade}).`));
  const result: EnrichmentResult = { company: { name: input.companyName, domain, website }, investment, contacts, bestRoute, score, evidence: [...new Map(evidence.map((item) => [`${item.sourceUrl}:${item.snippet ?? ""}`, item])).values()], warnings: [...new Set(warnings)], stages };
  return { ok: true, value: result };
}
