export type RobotsPolicy = { disallowed: string[]; sitemaps: string[] };
export function parseRobots(text: string, userAgent = "LeadEnricher"): RobotsPolicy {
  const groups: Array<{ agents: string[]; disallowed: string[] }> = [];
  const sitemaps: string[] = [];
  let current: { agents: string[]; disallowed: string[] } | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim(); const index = line.indexOf(":"); if (index < 0) continue;
    const key = line.slice(0, index).trim().toLowerCase(); const value = line.slice(index + 1).trim();
    if (key === "sitemap" && value) { sitemaps.push(value); continue; }
    if (key === "user-agent") { if (!current || current.disallowed.length) { current = { agents: [], disallowed: [] }; groups.push(current); } current.agents.push(value.toLowerCase()); }
    if (key === "disallow" && current && value) current.disallowed.push(value);
  }
  const name = userAgent.toLowerCase(); const exact = groups.filter((group) => group.agents.some((agent) => name.includes(agent))); const wildcard = groups.filter((group) => group.agents.includes("*"));
  return { disallowed: [...new Set((exact.length ? exact : wildcard).flatMap((group) => group.disallowed))], sitemaps: [...new Set(sitemaps)] };
}
export function isAllowed(url: URL, policy: RobotsPolicy): boolean { return !policy.disallowed.some((path) => path === "/" || (path && url.pathname.startsWith(path.replace(/\*.*$/, "")))); }
