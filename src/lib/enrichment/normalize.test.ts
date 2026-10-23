import { describe, expect, it } from "vitest";
import { canonicalizeUrl, normalizeInput } from "./normalize";

describe("input normalization", () => {
  it("normalizes names and canonicalizes domains", () => {
    expect(canonicalizeUrl("Example.COM/path/#x")).toBe("https://example.com/path");
    const result = normalizeInput({ companyName: "  Atlas   Homes ", website: "atlas.example" });
    expect(result.ok && result.value).toMatchObject({ companyName: "Atlas Homes", website: "https://atlas.example/" });
  });
  it("retains explicit source metadata", () => {
    const result = normalizeInput({ companyName: "Atlas", sourcePlatform: "meta_ads", sourceUrl: "https://example.com/ad", investmentOfferHint: "monthly ROI" });
    expect(result.ok && result.value.sourcePlatform).toBe("meta_ads");
  });
  it("rejects non-web and credential-bearing websites", () => {
    expect(normalizeInput({ companyName: "Atlas", website: "file:///etc/passwd" }).ok).toBe(false);
    expect(normalizeInput({ companyName: "Atlas", website: "https://user:pass@example.com" }).ok).toBe(false);
  });
});
