import "server-only";
import { enrichLead } from "./pipeline/enrich";
import { BraveSearchProvider } from "./providers/brave";
import { HunterProvider } from "./providers/hunter";

export function runEnrichment(input: unknown) {
  const hunter = process.env.HUNTER_API_KEY ? new HunterProvider({ apiKey: process.env.HUNTER_API_KEY, allowCreditedCalls: process.env.HUNTER_ALLOW_CREDITED_CALLS === "true" }) : undefined;
  const brave = process.env.BRAVE_SEARCH_API_KEY ? new BraveSearchProvider(process.env.BRAVE_SEARCH_API_KEY) : undefined;
  return enrichLead(input, { domainResolver: hunter, contactProvider: hunter, searchProvider: brave, crawlOptions: { userAgent: process.env.ENRICHER_USER_AGENT || "LeadEnricher/1.0 (+internal-research)", maxPages: 20, concurrency: 3 } });
}
