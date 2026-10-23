import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyInvestment } from "../classification/investment";
import { extractPage } from "./page";

const fixture = (name: string) => readFileSync(join(process.cwd(), "src/lib/enrichment/__fixtures__", name), "utf8");
describe("page extraction and classification", () => {
  it("extracts public routes and same-origin links", () => { const page = extractPage(fixture("contact.html"), "https://atlas.example/contact"); expect(page.emails).toEqual(["hello@atlas.example"]); expect(page.phones).toEqual(["+2348012345678"]); expect(page.whatsapp[0]).toContain("wa.me"); expect(page.internalLinks).toContain("https://atlas.example/team"); });
  it("extracts semantic and JSON-LD people", () => { const page = extractPage(fixture("team.html"), "https://atlas.example/team"); expect(page.people.map((p) => p.name)).toEqual(expect.arrayContaining(["Ada Okafor", "Bola Adeyemi"])); });
  it.each([["recurring.html", "recurring_payout"], ["maturity.html", "buyback_maturity"], ["combined.html", "both"], ["irrelevant.html", "unknown"]])("classifies %s as %s", (name, branch) => { const page = extractPage(fixture(name), `https://atlas.example/${name}`); expect(classifyInvestment([page]).branch).toBe(branch); });
});
