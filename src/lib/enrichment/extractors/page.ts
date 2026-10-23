import * as cheerio from "cheerio";
import type { CrawledPage, PersonCandidate } from "../types";

const rolePattern = /(founder|co-founder|chief executive officer|ceo|managing director|head of investments?|director of investments?|investment manager|chief financial officer|cfo|head of finance|finance manager|chief operating officer|coo|operations? director|operations? manager|executive director)/i;
const investmentPattern = /(monthly|quarterly|periodic|scheduled)\s+(payout|roi|returns?|distribution)|recurring investment income|buy[ -]?back|matur(?:e|ity)|fixed\s+(?:investment\s+)?tenure|principal.{0,40}(?:returned|return|roi)|(?:6|9|12|18)[ -]?month.{0,50}(?:tenure|matur|return|settlement)/i;

function clean(value: string): string { return value.replace(/\s+/g, " ").trim(); }
function unique(values: string[]): string[] { return [...new Set(values.filter(Boolean))]; }

export function roleCategory(title: string): PersonCandidate["roleCategory"] {
  if (/(founder|chief executive|ceo|managing director|executive director)/i.test(title)) return "economic_buyer";
  if (/investment/i.test(title)) return "investment";
  if (/(financial|finance|cfo)/i.test(title)) return "finance";
  if (/(operat|coo)/i.test(title)) return "operations";
  return "other";
}

function person(name: string, title: string, url: string, snippet: string, confidence = 0.72): PersonCandidate | undefined {
  const cleanName = clean(name).replace(/^[|,:–—-]+|[|,:–—-]+$/g, "");
  const cleanTitle = clean(title);
  if (!/^[\p{L}][\p{L}.'’ -]{2,80}$/u.test(cleanName) || cleanName.split(/\s+/).length < 2 || !rolePattern.test(cleanTitle)) return;
  const category = roleCategory(cleanTitle);
  return { name: cleanName, title: cleanTitle, roleCategory: category, relevance: category === "economic_buyer" ? "economic_buyer" : ["investment", "finance", "operations"].includes(category) ? "pain_owner" : "other", confidence, sourceUrls: [url], evidenceSnippet: clean(snippet).slice(0, 500) };
}

function jsonLdPeople($: cheerio.CheerioAPI, url: string): PersonCandidate[] {
  const found: PersonCandidate[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const raw: unknown = JSON.parse($(element).text());
      const walk = (node: unknown) => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) { node.forEach(walk); return; }
        const value = node as Record<string, unknown>;
        if (value["@type"] === "Person" && typeof value.name === "string") {
          const title = typeof value.jobTitle === "string" ? value.jobTitle : "";
          const candidate = person(value.name, title, url, `${value.name}, ${title}`, 0.9);
          if (candidate) found.push(candidate);
        }
        Object.values(value).forEach(walk);
      };
      walk(raw);
    } catch { /* malformed structured data is ignored */ }
  });
  return found;
}

export function extractPage(html: string, pageUrl: string): CrawledPage {
  const $ = cheerio.load(html);
  $("script:not([type='application/ld+json']),style,noscript,template,svg").remove();
  const title = clean($("title").first().text());
  const headings = unique($("h1,h2,h3").map((_, el) => clean($(el).text())).get()).slice(0, 50);
  const text = clean($("body").text()).slice(0, 120_000);
  const emails = unique($('a[href^="mailto:"]').map((_, el) => clean(($(el).attr("href") ?? "").slice(7).split("?")[0].toLowerCase())).get());
  const phones = unique($('a[href^="tel:"]').map((_, el) => clean(($(el).attr("href") ?? "").slice(4))).get());
  const whatsapp = unique($("a[href]").map((_, el) => {
    const href = $(el).attr("href") ?? "";
    return /(?:wa\.me|api\.whatsapp\.com|whatsapp:\/\/)/i.test(href) ? new URL(href, pageUrl).toString() : "";
  }).get());
  const origin = new URL(pageUrl).origin;
  const internalLinks = unique($("a[href]").map((_, el) => {
    try { const target = new URL($(el).attr("href") ?? "", pageUrl); target.hash = ""; return target.origin === origin && ['http:', 'https:'].includes(target.protocol) ? target.toString() : ""; } catch { return ""; }
  }).get());
  const people = jsonLdPeople($, pageUrl);
  $("article,section,li,div").each((_, el) => {
    const block = clean($(el).text());
    if (block.length < 8 || block.length > 500 || !rolePattern.test(block)) return;
    const lines = $(el).find("h1,h2,h3,h4,h5,h6,strong,b,p,span").map((__, node) => clean($(node).text())).get().filter(Boolean);
    const titleIndex = lines.findIndex((line) => rolePattern.test(line));
    if (titleIndex >= 0) {
      const roleMatch = lines[titleIndex].match(rolePattern)?.[0] ?? lines[titleIndex];
      const nearby = [lines[titleIndex - 1], lines[titleIndex + 1]].filter(Boolean);
      for (const possibleName of nearby) { const candidate = person(possibleName, roleMatch, pageUrl, block); if (candidate) { people.push(candidate); break; } }
    }
  });
  const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => investmentPattern.test(sentence)).map((sentence) => sentence.slice(0, 450));
  return { url: pageUrl, title, headings, text, emails, phones, whatsapp, internalLinks, people: dedupePeople(people), investmentSnippets: unique(sentences).slice(0, 12) };
}

export function dedupePeople(people: PersonCandidate[]): PersonCandidate[] {
  const map = new Map<string, PersonCandidate>();
  for (const candidate of people) {
    const key = candidate.name.toLowerCase(); const existing = map.get(key);
    if (!existing) map.set(key, candidate);
    else map.set(key, { ...existing, confidence: Math.min(1, Math.max(existing.confidence, candidate.confidence) + 0.08), sourceUrls: unique([...existing.sourceUrls, ...candidate.sourceUrls]) });
  }
  return [...map.values()];
}
