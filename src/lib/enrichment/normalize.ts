import { enrichmentInputSchema, type EnrichmentInput, type Result } from "./types";

export function canonicalizeUrl(raw: string): string {
  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error("Unsafe URL");
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function normalizeInput(raw: unknown): Result<EnrichmentInput> {
  const parsed = enrichmentInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION", message: parsed.error.issues[0]?.message ?? "Invalid input", retryable: false } };
  try {
    return {
      ok: true,
      value: {
        ...parsed.data,
        companyName: parsed.data.companyName.replace(/\s+/g, " "),
        website: parsed.data.website ? canonicalizeUrl(parsed.data.website) : undefined,
      },
    };
  } catch {
    return { ok: false, error: { code: "VALIDATION", message: "Website must be a valid HTTP or HTTPS URL.", retryable: false } };
  }
}
