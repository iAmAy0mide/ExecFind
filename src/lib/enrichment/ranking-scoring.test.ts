import { describe, expect, it } from "vitest";
import { rankPeople, selectContacts } from "./ranking/people";
import { gradeForTotal, scoreLead } from "./scoring/score";
import type { ContactCandidate, InvestmentClassification } from "./types";

const candidate = (name: string, title: string, roleCategory: ContactCandidate["roleCategory"], relevance: ContactCandidate["relevance"]): ContactCandidate => ({ name, title, roleCategory, relevance, confidence: .8, sourceUrls: ["https://example.com/team"], evidenceSnippet: `${name}, ${title}`, routes: [] });
const investment = (branch: InvestmentClassification["branch"]): InvestmentClassification => ({ branch, detected: branch !== "unknown", confidence: .9, evidence: [] });
describe("ranking and scoring", () => {
  it("ranks an economic buyer first and preserves a pain owner second", () => { const contacts = selectContacts([candidate("Fola Ade", "Finance Manager", "finance", "pain_owner"), candidate("Ada Obi", "CEO", "economic_buyer", "economic_buyer")]); expect(contacts.primary?.name).toBe("Ada Obi"); expect(contacts.secondary?.name).toBe("Fola Ade"); });
  it("prefers an investment leader over lower-priority finance roles", () => expect(rankPeople([candidate("Fola Ade", "CFO", "finance", "pain_owner"), candidate("Dayo Obi", "Head of Investment", "investment", "pain_owner")])[0].name).toBe("Dayo Obi"));
  it.each([["unknown", "C"], ["buyback_maturity", "C"], ["recurring_payout", "C"]])("scores %s deterministically", (branch, grade) => expect(scoreLead({ investment: investment(branch as InvestmentClassification["branch"]), routes: [] }).grade).toBe(grade));
  it.each([[0, "C"], [59, "C"], [60, "B"], [79, "B"], [80, "A"], [100, "A"]])("maps total %i to grade %s", (total, grade) => expect(gradeForTotal(total)).toBe(grade));
  it("honours grade boundaries", () => { const base = candidate("Ada Obi", "CEO", "economic_buyer", "economic_buyer"); const secondary = candidate("Dayo Obi", "Head of Investment", "investment", "pain_owner"); const strong = scoreLead({ investment: investment("recurring_payout"), primary: { ...base, sourceUrls: ["https://a.com", "https://b.com"] }, secondary, routes: [{ type: "email", value: "ada@example.com", sourceUrl: "https://hunter.io/", public: false, verification: "verified", personName: "Ada Obi" }, { type: "phone", value: "+234", sourceUrl: "https://a.com", public: true, verification: "public", personName: "Ada Obi" }] }); expect(strong).toMatchObject({ total: 100, grade: "A" }); });
});
