import type { ContactCandidate, ContactRoute, InvestmentClassification, LeadScore } from "../types";

export type ScoreInput = { investment: InvestmentClassification; primary?: ContactCandidate; secondary?: ContactCandidate; routes: ContactRoute[] };
export function gradeForTotal(total: number): LeadScore["grade"] { return total >= 80 ? "A" : total >= 60 ? "B" : "C"; }
export function scoreLead(input: ScoreInput): LeadScore {
  let icpFit = 0;
  if (input.investment.detected) icpFit += 15;
  if (input.investment.branch !== "unknown") icpFit += 15;
  if (["recurring_payout", "both"].includes(input.investment.branch)) icpFit += 10;
  let decisionMaker = input.primary && input.primary.roleCategory !== "other" ? 15 : 0;
  if (input.secondary?.relevance === "pain_owner" || input.primary?.relevance === "pain_owner") decisionMaker += 10;
  if ([input.primary, input.secondary].some((candidate) => candidate && candidate.sourceUrls.length > 1)) decisionMaker += 5;
  let reachability = input.routes.some((route) => route.type === "email" && route.verification === "verified" && route.personName) ? 15 : 0;
  if (input.routes.some((route) => ["phone", "whatsapp"].includes(route.type) && route.personName)) reachability += 10;
  if (input.routes.length) reachability += 5;
  icpFit = Math.min(40, icpFit); decisionMaker = Math.min(30, decisionMaker); reachability = Math.min(30, reachability);
  const total = icpFit + decisionMaker + reachability;
  return { icpFit, decisionMaker, reachability, total, grade: gradeForTotal(total) };
}

export function selectBestRoute(routes: ContactRoute[]): ContactRoute | undefined {
  const value = (route: ContactRoute) => (route.verification === "verified" ? 40 : route.verification === "found" ? 30 : 10) + (route.personName ? 20 : 0) + ({ email: 4, whatsapp: 3, phone: 2, contact_page: 1 }[route.type]);
  return [...routes].sort((a, b) => value(b) - value(a))[0];
}
