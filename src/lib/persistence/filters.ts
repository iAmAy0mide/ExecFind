import type { LeadListItem, LeadQuery } from "./types";

/** Mirrors the queue's database filter contract for deterministic testing and local consumers. */
export function matchesLeadQuery(lead: LeadListItem, query: Pick<LeadQuery, "search" | "grades" | "branches" | "reachability">) {
  if (query.grades.length && !query.grades.includes(lead.grade)) return false;
  if (query.branches.length && !query.branches.includes(lead.investmentBranch)) return false;
  if (query.reachability.length && !query.reachability.includes(lead.reachability)) return false;
  const search = query.search.trim().toLocaleLowerCase("en");
  if (!search) return true;
  return [lead.companyName, lead.domain, lead.primaryContactName, lead.primaryContactRole, lead.secondaryContactName, lead.secondaryContactRole]
    .some((value) => value?.toLocaleLowerCase("en").includes(search));
}
