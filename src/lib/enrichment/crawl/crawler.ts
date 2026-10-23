import { extractPage } from "../extractors/page";
import { safeFetch, type SafeFetchOptions } from "../security/fetch";
import type { CrawledPage } from "../types";
import { isAllowed, parseRobots, type RobotsPolicy } from "./robots";

export type CrawlResult = { pages: CrawledPage[]; warnings: string[] };
export type CrawlOptions = SafeFetchOptions & { maxPages?: number; concurrency?: number };
const useful = /(about|team|leadership|management|invest|investment|buyback|contact|director|finance)/i;

function canonical(raw: string): string { const url = new URL(raw); url.hash = ""; url.search = ""; url.pathname = url.pathname.replace(/\/+$/, "") || "/"; return url.toString(); }
function priority(url: string): number { const path = new URL(url).pathname; return path === "/" ? 100 : useful.test(path) ? 80 : 10; }

export async function crawlWebsite(website: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  const maxPages = Math.min(20, Math.max(1, options.maxPages ?? 20)); const concurrency = Math.min(4, Math.max(1, options.concurrency ?? 3));
  const warnings: string[] = []; const pages: CrawledPage[] = []; const seen = new Set<string>(); const queued = new Set<string>();
  let origin = new URL(website).origin; let policy: RobotsPolicy = { disallowed: [], sitemaps: [] };
  const robots = await safeFetch(new URL("/robots.txt", origin).toString(), { ...options, accept: "text", maxBytes: 200_000 });
  if (robots.ok) policy = parseRobots(robots.value.body, options.userAgent?.split("/")[0]);
  const queue: string[] = [];
  const add = (raw: string) => { try { const url = canonical(raw); if (new URL(url).origin === origin && !queued.has(url) && isAllowed(new URL(url), policy)) { queued.add(url); queue.push(url); queue.sort((a, b) => priority(b) - priority(a)); } } catch { /* ignore malformed links */ } };
  add(website);
  const sitemapUrls = [...policy.sitemaps, new URL("/sitemap.xml", origin).toString()].slice(0, 3);
  for (const sitemapUrl of sitemapUrls) {
    const sitemap = await safeFetch(sitemapUrl, { ...options, accept: "text", maxBytes: 500_000 });
    if (sitemap.ok) for (const match of sitemap.value.body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) if (useful.test(match[1])) add(match[1]);
  }
  while (queue.length && pages.length < maxPages) {
    const batch = queue.splice(0, Math.min(concurrency, maxPages - pages.length)).filter((url) => !seen.has(url)); batch.forEach((url) => seen.add(url));
    const fetched = await Promise.all(batch.map(async (url) => ({ url, response: await safeFetch(url, options) })));
    for (const { url, response } of fetched) {
      if (!response.ok) { warnings.push(`${new URL(url).pathname}: ${response.error.message}`); continue; }
      const finalUrl = new URL(response.value.url); if (!pages.length && finalUrl.origin !== origin) { origin = finalUrl.origin; }
      if (finalUrl.origin !== origin) { warnings.push(`${url}: redirect left the official site origin.`); continue; }
      const page = extractPage(response.value.body, response.value.url); pages.push(page); page.internalLinks.forEach(add);
    }
  }
  if (!pages.length) warnings.push("No crawlable HTML pages were available on the supplied website.");
  return { pages, warnings: [...new Set(warnings)].slice(0, 20) };
}
