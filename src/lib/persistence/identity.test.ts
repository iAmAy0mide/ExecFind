import { describe, expect, it } from "vitest";
import { leadIdentity, normalizeCompanyName, normalizeDomain } from "./identity";

describe("lead identity", () => {
  it("normalizes company names deterministically", () => expect(normalizeCompanyName("  Atlas   HOMES  ")).toBe("atlas homes"));
  it("normalizes common domain variations", () => {
    expect(normalizeDomain("HTTPS://WWW.Example.COM:443/about/")).toBe("example.com");
    expect(normalizeDomain("example.com")).toBe("example.com");
  });
  it("prefers a resolved domain over the fallback name", () => expect(leadIdentity({ companyName: "Atlas", domain: "www.atlas.example" })).toEqual({ normalizedCompanyName: "atlas", normalizedDomain: "atlas.example" }));
});
