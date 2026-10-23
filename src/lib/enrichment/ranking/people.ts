import { dedupePeople } from "../extractors/page";
import type { ContactCandidate, PersonCandidate } from "../types";

const priority: Record<PersonCandidate["roleCategory"], number> = { economic_buyer: 50, investment: 45, finance: 35, operations: 25, other: 0 };
export function rankPeople(candidates: PersonCandidate[]): PersonCandidate[] {
  return dedupePeople(candidates).sort((a, b) => (priority[b.roleCategory] + b.confidence * 10 + b.sourceUrls.length * 3) - (priority[a.roleCategory] + a.confidence * 10 + a.sourceUrls.length * 3));
}

export function selectContacts(candidates: ContactCandidate[]): { primary?: ContactCandidate; secondary?: ContactCandidate; others: ContactCandidate[] } {
  const ranked = rankPeople(candidates) as ContactCandidate[];
  const primary = ranked[0];
  const secondary = ranked.find((candidate) => candidate.name !== primary?.name && candidate.relevance !== primary?.relevance) ?? ranked[1];
  return { primary, secondary, others: ranked.filter((candidate) => candidate !== primary && candidate !== secondary) };
}
