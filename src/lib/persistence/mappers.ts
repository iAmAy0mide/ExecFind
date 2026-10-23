import { enrichmentResultSchema, type ContactCandidate, type EnrichmentResult } from "../enrichment/types";
import { leadIdentity } from "./identity";
import type { PersistenceContact } from "./types";

function route(candidate: ContactCandidate, type: "email" | "phone" | "whatsapp") {
  return candidate.routes.find((item) => item.type === type);
}

function contact(candidate: ContactCandidate, status: PersistenceContact["status"]): PersistenceContact {
  const email = route(candidate, "email");
  return {
    name: candidate.name, title: candidate.title, roleCategory: candidate.roleCategory, relevance: candidate.relevance,
    workEmail: email?.value ?? null, emailVerification: email?.verification ?? null,
    businessPhone: route(candidate, "phone")?.value ?? null, businessWhatsapp: route(candidate, "whatsapp")?.value ?? null,
    confidence: candidate.confidence, status, sourceUrls: candidate.sourceUrls, evidenceSnippet: candidate.evidenceSnippet,
  };
}

export function contactsFromResult(result: EnrichmentResult): PersistenceContact[] {
  const contacts: PersistenceContact[] = [];
  if (result.contacts.primary) contacts.push(contact(result.contacts.primary, "primary"));
  if (result.contacts.secondary) contacts.push(contact(result.contacts.secondary, "secondary"));
  contacts.push(...result.contacts.others.map((item) => contact(item, "other")));
  return contacts;
}

export function reachabilityFromResult(result: EnrichmentResult) {
  const route = result.bestRoute;
  if (!route) return "none" as const;
  if (route.type === "email" && (route.personName || ["verified", "found"].includes(route.verification))) return "direct_email" as const;
  if (route.type === "phone" || route.type === "whatsapp") return "phone_or_whatsapp" as const;
  return "company_route" as const;
}

export function snapshotFromResult(result: EnrichmentResult) {
  const primary = result.contacts.primary;
  const secondary = result.contacts.secondary;
  const email = primary && route(primary, "email");
  const identity = leadIdentity({ companyName: result.company.name, domain: result.company.domain, website: result.company.website });
  return {
    companyName: result.company.name, normalizedCompanyName: identity.normalizedCompanyName,
    domain: result.company.domain ?? null, normalizedDomain: identity.normalizedDomain ?? null, website: result.company.website ?? null,
    investmentBranch: result.investment.branch, offerSummary: result.investment.offerSummary ?? null,
    investmentConfidence: result.investment.confidence, totalScore: result.score.total, icpFitScore: result.score.icpFit,
    decisionMakerScore: result.score.decisionMaker, reachabilityScore: result.score.reachability, grade: result.score.grade,
    primaryContactName: primary?.name ?? null, primaryContactRole: primary?.title ?? null, primaryEmail: email?.value ?? null,
    primaryEmailVerification: email?.verification ?? null, primaryPhone: primary ? route(primary, "phone")?.value ?? null : null,
    primaryWhatsapp: primary ? route(primary, "whatsapp")?.value ?? null : null,
    secondaryContactName: secondary?.name ?? null, secondaryContactRole: secondary?.title ?? null,
    bestRouteType: result.bestRoute?.type ?? null, bestRouteValue: result.bestRoute?.value ?? null,
    reachability: reachabilityFromResult(result),
  };
}

export function deserializeResult(value: unknown): EnrichmentResult {
  return enrichmentResultSchema.parse(value);
}
