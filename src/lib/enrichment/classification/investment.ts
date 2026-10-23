import type { CrawledPage, Evidence, InvestmentClassification } from "../types";

const recurring = /(?:monthly|quarterly|periodic|scheduled)\s+(?:payout|roi|returns?|distribution)|recurring investment income|regular investor income/i;
const maturity = /buy[ -]?back|maturity|fixed\s+(?:investment\s+)?tenure|(?:capital|principal).{0,45}(?:returned|return)|principal\s*(?:\+|plus)\s*(?:roi|returns?)|(?:6|9|12|18)[ -]?month.{0,60}(?:tenure|matur|settlement)/i;

export function classifyInvestment(pages: CrawledPage[], hint?: string, retrievedAt = new Date().toISOString()): InvestmentClassification {
  const matches = pages.flatMap((page) => page.investmentSnippets.map((snippet) => ({ page, snippet })));
  const recurringMatches = matches.filter(({ snippet }) => recurring.test(snippet));
  const maturityMatches = matches.filter(({ snippet }) => maturity.test(snippet));
  const hintRecurring = Boolean(hint && recurring.test(hint));
  const hintMaturity = Boolean(hint && maturity.test(hint));
  const hasRecurring = recurringMatches.length > 0 || hintRecurring;
  const hasMaturity = maturityMatches.length > 0 || hintMaturity;
  const branch = hasRecurring && hasMaturity ? "both" : hasRecurring ? "recurring_payout" : hasMaturity ? "buyback_maturity" : "unknown";
  const selected = [...recurringMatches, ...maturityMatches].filter((entry, index, all) => all.findIndex((other) => other.page.url === entry.page.url && other.snippet === entry.snippet) === index).slice(0, 6);
  const evidence: Evidence[] = selected.map(({ page, snippet }) => ({ sourceUrl: page.url, sourceType: "company_site", title: page.title || undefined, snippet, supports: ["investment.branch", "investment.detected"], retrievedAt }));
  if (hint && (hintRecurring || hintMaturity)) evidence.push({ sourceUrl: "https://user-input.invalid/offer-hint", sourceType: "user_input", snippet: hint.slice(0, 500), supports: ["investment.hint"], retrievedAt });
  const websiteSignals = recurringMatches.length + maturityMatches.length;
  return { detected: branch !== "unknown", branch, offerSummary: branch === "both" ? "Public language indicates recurring payouts and a fixed-maturity or buy-back structure." : branch === "recurring_payout" ? "Public language indicates returns paid during the investment tenure." : branch === "buyback_maturity" ? "Public language indicates principal or returns settled at maturity or through buy-back." : undefined, confidence: branch === "unknown" ? 0 : Math.min(0.95, (websiteSignals ? 0.65 : 0.35) + Math.min(0.25, websiteSignals * 0.08)), evidence };
}
