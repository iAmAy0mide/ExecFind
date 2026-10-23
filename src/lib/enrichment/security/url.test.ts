import { describe, expect, it } from "vitest";
import { isUnsafeIp, validatePublicUrl } from "./url";

describe("URL safety", () => {
  it.each(["127.0.0.1", "10.0.0.2", "172.20.1.1", "192.168.1.2", "169.254.4.2", "::1", "fc00::1"])("rejects private or reserved %s", (ip) => expect(isUnsafeIp(ip)).toBe(true));
  it("rejects private DNS answers", async () => { const result = await validatePublicUrl("https://example.com", async () => [{ address: "10.0.0.1", family: 4 }]); expect(result.ok).toBe(false); });
  it("accepts public DNS answers", async () => { const result = await validatePublicUrl("https://example.com", async () => [{ address: "93.184.216.34", family: 4 }]); expect(result.ok).toBe(true); });
  it("rejects non-web protocols and URL credentials", async () => { expect((await validatePublicUrl("file:///etc/passwd")).ok).toBe(false); expect((await validatePublicUrl("https://user:pass@example.com")).ok).toBe(false); });
});
