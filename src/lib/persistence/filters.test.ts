import { describe, expect, it } from "vitest";
import { matchesLeadQuery } from "./filters";
import type { LeadListItem, LeadQuery } from "./types";

const lead = { companyName:"Atlas Homes",domain:"atlas.example",grade:"A",investmentBranch:"recurring_payout",reachability:"direct_email",primaryContactName:"Ada Obi",primaryContactRole:"Managing Director",secondaryContactName:"Fola Ade",secondaryContactRole:"Finance Manager" } as LeadListItem;
const query = (overrides: Partial<Pick<LeadQuery,"search"|"grades"|"branches"|"reachability">>) => ({search:"",grades:[],branches:[],reachability:[],...overrides});

describe("lead queue filters", () => {
  it("filters grades and ICP branches", () => { expect(matchesLeadQuery(lead,query({grades:["A"],branches:["recurring_payout"]}))).toBe(true); expect(matchesLeadQuery(lead,query({grades:["B"]}))).toBe(false); expect(matchesLeadQuery(lead,query({branches:["buyback_maturity"]}))).toBe(false); });
  it("filters reachability", () => expect(matchesLeadQuery(lead,query({reachability:["phone_or_whatsapp"]}))).toBe(false));
  it.each(["atlas","ATLAS.EXAMPLE","ada obi","managing","finance manager"])("searches relevant queue field: %s", (search) => expect(matchesLeadQuery(lead,query({search}))).toBe(true));
  it("rejects unrelated search text", () => expect(matchesLeadQuery(lead,query({search:"Oakridge"}))).toBe(false));
});
