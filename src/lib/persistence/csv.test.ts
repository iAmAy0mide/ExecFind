import { describe, expect, it } from "vitest";
import { leadsToCsv } from "./csv";
import type { LeadListItem } from "./types";

const lead: LeadListItem = { id:"00000000-0000-4000-8000-000000000001",companyName:'Atlas, "Homes"',domain:"atlas.example",website:"https://atlas.example/",sourcePlatform:"manual",sourceUrl:null,investmentBranch:"recurring_payout",offerSummary:"Monthly returns\nfor investors",investmentConfidence:.9,totalScore:82,icpFitScore:40,decisionMakerScore:22,reachabilityScore:20,grade:"A",primaryContactName:"Ada Obi",primaryContactRole:"CEO",primaryEmail:"ada@atlas.example",primaryEmailVerification:"verified",primaryPhone:null,primaryWhatsapp:null,secondaryContactName:null,secondaryContactRole:null,bestRouteType:"email",bestRouteValue:"ada@atlas.example",reachability:"direct_email",lastEnrichedAt:"2026-10-23T10:00:00.000Z",createdAt:"2026-10-23T10:00:00.000Z",updatedAt:"2026-10-23T10:00:00.000Z" };

describe("CSV export", () => {
  it("exports intended fields and safely escapes commas, quotes and newlines", () => {
    const csv = leadsToCsv([lead]);
    expect(csv).toContain('"Atlas, ""Homes"""');
    expect(csv).toContain('"Monthly returns\nfor investors"');
    expect(csv).not.toContain("{\"");
  });
  it("returns a header-only CSV for an empty filtered set", () => expect(leadsToCsv([]).split("\r\n")).toHaveLength(2));
});
