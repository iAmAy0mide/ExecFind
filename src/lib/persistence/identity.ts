import { canonicalizeUrl } from "../enrichment/normalize";

export function normalizeCompanyName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function normalizeDomain(value?: string): string | undefined {
  if (!value) return undefined;
  const url = new URL(canonicalizeUrl(value));
  return url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

export function leadIdentity(input: { companyName: string; website?: string; domain?: string }) {
  return {
    normalizedCompanyName: normalizeCompanyName(input.companyName),
    normalizedDomain: normalizeDomain(input.domain ?? input.website),
  };
}
