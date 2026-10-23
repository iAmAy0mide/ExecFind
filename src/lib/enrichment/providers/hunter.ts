import type { ContactProvider, DomainCandidate, DomainResolver } from "./interfaces";
import type { ContactRoute, PersonCandidate, Result } from "../types";

type HunterOptions = { apiKey: string; allowCreditedCalls?: boolean; fetchImpl?: typeof fetch };
type Json = Record<string, unknown>;

export class HunterProvider implements DomainResolver, ContactProvider {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly options: HunterOptions) { this.fetchImpl = options.fetchImpl ?? fetch; }

  private async request(path: string, params: Record<string, string>, credited: boolean): Promise<Result<Json>> {
    if (credited && !this.options.allowCreditedCalls) return { ok: false, error: { code: "PROVIDER", message: "Hunter credited calls are disabled.", stage: "contacts", retryable: false } };
    const url = new URL(`https://api.hunter.io/v2/${path}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    try {
      const response = await this.fetchImpl(url, { headers: { Accept: "application/json", "X-API-KEY": this.options.apiKey }, signal: AbortSignal.timeout(10_000) });
      const payload = await response.json() as Json;
      if (!response.ok) return { ok: false, error: { code: "PROVIDER", message: `Hunter returned HTTP ${response.status}.`, stage: "contacts", retryable: response.status >= 500 } };
      return { ok: true, value: payload };
    } catch (cause) { return { ok: false, error: { code: "PROVIDER", message: "Hunter request failed.", stage: "contacts", retryable: true, cause: cause instanceof Error ? cause.message : String(cause) } }; }
  }

  async resolve(companyName: string): Promise<Result<DomainCandidate[]>> {
    const response = await this.request("domain-finder", { company: companyName, limit: "3", perfect_match: "true" }, false);
    if (!response.ok) return response;
    const data = Array.isArray(response.value.data) ? response.value.data : [];
    const retrievedAt = new Date().toISOString();
    return { ok: true, value: data.flatMap((raw) => {
      const item = raw as Record<string, unknown>; if (typeof item.domain !== "string") return [];
      return [{ domain: item.domain, companyName: typeof item.company_name === "string" ? item.company_name : undefined, confidence: data.length === 1 ? 0.9 : 0.6, evidence: { sourceUrl: "https://hunter.io/", sourceType: "hunter" as const, snippet: `Hunter matched ${companyName} to ${item.domain}.`, supports: ["company.domain"], retrievedAt } }];
    }) };
  }

  async domainSearch(domain: string): Promise<Result<ContactRoute[]>> {
    const response = await this.request("domain-search", { domain, limit: "10" }, true); if (!response.ok) return response;
    const data = response.value.data as Record<string, unknown> | undefined;
    const emails = Array.isArray(data?.emails) ? data.emails : [];
    return { ok: true, value: emails.flatMap((raw) => {
      const item = raw as Record<string, unknown>; if (typeof item.value !== "string") return [];
      const first = typeof item.first_name === "string" ? item.first_name : ""; const last = typeof item.last_name === "string" ? item.last_name : "";
      const verification = item.verification as Record<string, unknown> | undefined;
      return [{ type: "email" as const, value: item.value, sourceUrl: "https://hunter.io/", public: false, verification: verification?.status === "valid" ? "verified" as const : "found" as const, personName: `${first} ${last}`.trim() || undefined }];
    }) };
  }

  async findEmail(domain: string, person: PersonCandidate): Promise<Result<ContactRoute | undefined>> {
    const response = await this.request("email-finder/found", { domain, full_name: person.name }, true); if (!response.ok) return response;
    const data = response.value.data as Record<string, unknown> | undefined;
    if (typeof data?.email !== "string") return { ok: true, value: undefined };
    const verification = data.verification as Record<string, unknown> | undefined;
    return { ok: true, value: { type: "email", value: data.email, sourceUrl: "https://hunter.io/", public: false, verification: verification?.status === "valid" ? "verified" : "found", personName: person.name } };
  }

  async verifyEmail(email: string): Promise<Result<"verified" | "unknown">> {
    const response = await this.request("email-verifier", { email }, true); if (!response.ok) return response;
    const data = response.value.data as Record<string, unknown> | undefined;
    return { ok: true, value: data?.status === "valid" ? "verified" : "unknown" };
  }
}
