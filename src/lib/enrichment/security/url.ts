import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import type { Result } from "../types";

export type DnsLookup = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

function unsafeIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

function unsafeIpv6(ip: string): boolean {
  const value = ip.toLowerCase().split("%")[0];
  if (value === "::" || value === "::1" || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb") || value.startsWith("fc") || value.startsWith("fd")) return true;
  if (value.startsWith("::ffff:")) return unsafeIpv4(value.slice(7));
  return false;
}

export function isUnsafeIp(ip: string): boolean {
  const family = isIP(ip);
  return family === 4 ? unsafeIpv4(ip) : family === 6 ? unsafeIpv6(ip) : true;
}

const defaultLookup: DnsLookup = async (hostname) => lookup(hostname, { all: true, verbatim: true });

export async function validatePublicUrl(raw: string, dnsLookup: DnsLookup = defaultLookup): Promise<Result<URL>> {
  let url: URL;
  try { url = new URL(raw); } catch { return { ok: false, error: { code: "UNSAFE_URL", message: "URL is malformed.", retryable: false } }; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return { ok: false, error: { code: "UNSAFE_URL", message: "Only credential-free HTTP and HTTPS URLs are allowed.", retryable: false } };
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return { ok: false, error: { code: "UNSAFE_URL", message: "Local network destinations are blocked.", retryable: false } };
  if (isIP(hostname)) return isUnsafeIp(hostname) ? { ok: false, error: { code: "UNSAFE_URL", message: "Private and reserved network destinations are blocked.", retryable: false } } : { ok: true, value: url };
  try {
    const addresses = await dnsLookup(hostname);
    if (!addresses.length || addresses.some(({ address }) => isUnsafeIp(address))) return { ok: false, error: { code: "UNSAFE_URL", message: "Destination resolves to a private or reserved network.", retryable: false } };
    return { ok: true, value: url };
  } catch (cause) {
    return { ok: false, error: { code: "DNS", message: "Could not resolve the destination host.", retryable: true, cause: cause instanceof Error ? cause.message : String(cause) } };
  }
}
