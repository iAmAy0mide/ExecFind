import { validatePublicUrl, type DnsLookup } from "./url";
import type { Result } from "../types";

export type SafeFetchOptions = { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; userAgent?: string; dnsLookup?: DnsLookup; fetchImpl?: typeof fetch; accept?: "html" | "text" };
export type SafeResponse = { url: string; status: number; contentType: string; body: string; headers: Headers };

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<Result<SafeResponse>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const maxBytes = options.maxBytes ?? 1_500_000;
  const maxRedirects = options.maxRedirects ?? 3;
  let current = rawUrl;
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const checked = await validatePublicUrl(current, options.dnsLookup);
    if (!checked.ok) return checked;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(checked.value, { redirect: "manual", signal: controller.signal, headers: { "User-Agent": options.userAgent ?? "LeadEnricher/1.0 (+internal-research)", Accept: options.accept === "text" ? "text/plain,text/*;q=.9,*/*;q=.1" : "text/html,application/xhtml+xml;q=.9" } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === maxRedirects) return { ok: false, error: { code: "HTTP", message: "Redirect limit reached.", retryable: false } };
        current = new URL(location, checked.value).toString();
        continue;
      }
      if (!response.ok) return { ok: false, error: { code: "HTTP", message: `Destination returned HTTP ${response.status}.`, retryable: response.status >= 500 } };
      const contentType = response.headers.get("content-type") ?? "";
      if (options.accept !== "text" && !/text\/html|application\/xhtml\+xml/i.test(contentType)) return { ok: false, error: { code: "NON_HTML", message: "Destination did not return HTML.", retryable: false } };
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > maxBytes) return { ok: false, error: { code: "RESPONSE_TOO_LARGE", message: "Response exceeds the configured size limit.", retryable: false } };
      if (!response.body) return { ok: true, value: { url: checked.value.toString(), status: response.status, contentType, body: "", headers: response.headers } };
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel(); return { ok: false, error: { code: "RESPONSE_TOO_LARGE", message: "Response exceeds the configured size limit.", retryable: false } }; }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return { ok: true, value: { url: checked.value.toString(), status: response.status, contentType, body: new TextDecoder().decode(bytes), headers: response.headers } };
    } catch (cause) {
      const timedOut = cause instanceof Error && cause.name === "AbortError";
      return { ok: false, error: { code: timedOut ? "TIMEOUT" : "HTTP", message: timedOut ? "Request timed out." : "Request failed.", retryable: true, cause: cause instanceof Error ? cause.message : String(cause) } };
    } finally { clearTimeout(timeout); }
  }
  return { ok: false, error: { code: "HTTP", message: "Redirect limit reached.", retryable: false } };
}
