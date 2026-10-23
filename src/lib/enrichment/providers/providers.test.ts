import { describe, expect, it, vi } from "vitest";
import { BraveSearchProvider } from "./brave";
import { HunterProvider } from "./hunter";

describe("provider adapters", () => {
  it("uses Hunter Domain Finder without the credited-call gate", async () => { const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: [{ domain: "atlas.example", company_name: "Atlas" }] }), { status: 200 })); const provider = new HunterProvider({ apiKey: "test", fetchImpl: fetchMock }); const result = await provider.resolve("Atlas"); expect(result.ok && result.value[0].domain).toBe("atlas.example"); expect(String(fetchMock.mock.calls[0][0])).toContain("domain-finder"); });
  it("blocks credited Hunter calls by default", async () => { const provider = new HunterProvider({ apiKey: "test", fetchImpl: vi.fn() }); const result = await provider.domainSearch("atlas.example"); expect(result.ok).toBe(false); });
  it("sends bounded Brave role searches with its auth header", async () => { const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ web: { results: [{ title: "Atlas CEO", url: "https://example.com", description: "Ada Obi is CEO" }] } }), { status: 200 })); const result = await new BraveSearchProvider("secret", fetchMock).searchCompany("Atlas"); expect(result.ok && result.value).toHaveLength(1); expect(fetchMock).toHaveBeenCalledTimes(4); expect((fetchMock.mock.calls[0][1]?.headers as Record<string,string>)["X-Subscription-Token"]).toBe("secret"); });
});
