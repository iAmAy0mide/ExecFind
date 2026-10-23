import type { ContactRoute, Evidence, PersonCandidate, Result } from "../types";

export type DomainCandidate = { domain: string; companyName?: string; confidence: number; evidence: Evidence };
export type SearchHit = { title: string; url: string; snippet: string };
export interface DomainResolver { resolve(companyName: string): Promise<Result<DomainCandidate[]>>; }
export interface SearchProvider { searchCompany(companyName: string): Promise<Result<SearchHit[]>>; }
export interface ContactProvider {
  domainSearch(domain: string): Promise<Result<ContactRoute[]>>;
  findEmail(domain: string, person: PersonCandidate): Promise<Result<ContactRoute | undefined>>;
  verifyEmail(email: string): Promise<Result<"verified" | "unknown">>;
}
