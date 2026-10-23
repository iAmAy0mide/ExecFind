import type { Result } from "../types";
import type { SearchHit, SearchProvider } from "./interfaces";

export class BraveSearchProvider implements SearchProvider {
  constructor(private readonly apiKey: string, private readonly fetchImpl: typeof fetch = fetch) {}
  async searchCompany(companyName: string): Promise<Result<SearchHit[]>> {
    const roles = ["CEO founder Managing Director", '"Head of Investment" "Investment Manager"', 'CFO "Head of Finance"', 'site:linkedin.com/in executive'];
    try {
      const results = await Promise.all(roles.map(async (role) => {
        const url = new URL("https://api.search.brave.com/res/v1/web/search");
        url.searchParams.set("q", `"${companyName}" ${role}`); url.searchParams.set("count", "3"); url.searchParams.set("country", "NG");
        const response = await this.fetchImpl(url, { headers: { Accept: "application/json", "X-Subscription-Token": this.apiKey }, signal: AbortSignal.timeout(8_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json() as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } };
        return (payload.web?.results ?? []).flatMap((item) => item.url ? [{ title: item.title ?? "Search result", url: item.url, snippet: item.description ?? "" }] : []);
      }));
      const unique = new Map(results.flat().map((item) => [item.url, item]));
      return { ok: true, value: [...unique.values()].slice(0, 10) };
    } catch (cause) { return { ok: false, error: { code: "PROVIDER", message: "Brave Search request failed.", stage: "people", retryable: true, cause: cause instanceof Error ? cause.message : String(cause) } }; }
  }
}
