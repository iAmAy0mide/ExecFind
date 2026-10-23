import { describe, expect, it, vi } from "vitest";
import type { EnrichmentInput, EnrichmentResult } from "../enrichment/types";
import { deserializeResult, snapshotFromResult } from "./mappers";
import { SupabaseLeadRepository, type LeadRepository, type PersistenceDatabase } from "./repository";
import { enrichAndPersist, EnrichmentRunError } from "./service";

const input: EnrichmentInput = { companyName: "Atlas Homes", website: "https://atlas.example/", sourcePlatform: "manual", sourceUrl: undefined, investmentOfferHint: undefined };
const result: EnrichmentResult = {
  company:{name:"Atlas Homes",domain:"atlas.example",website:"https://atlas.example/"},
  investment:{detected:true,branch:"recurring_payout",offerSummary:"Monthly investor returns.",confidence:.9,evidence:[]},
  contacts:{primary:{name:"Ada Obi",title:"CEO",roleCategory:"economic_buyer",relevance:"economic_buyer",confidence:.9,sourceUrls:["https://atlas.example/team"],evidenceSnippet:"Ada Obi, CEO",routes:[{type:"email",value:"ada@atlas.example",sourceUrl:"https://atlas.example/team",public:true,verification:"public",personName:"Ada Obi"}]},others:[]},
  bestRoute:{type:"email",value:"ada@atlas.example",sourceUrl:"https://atlas.example/team",public:true,verification:"public",personName:"Ada Obi"},
  score:{icpFit:40,decisionMaker:20,reachability:5,total:65,grade:"B"},evidence:[],warnings:[],stages:[],
};

describe("persistence mapping", () => {
  it("maps an enrichment result into an indexed lead snapshot", () => expect(snapshotFromResult(result)).toMatchObject({ normalizedDomain:"atlas.example",investmentBranch:"recurring_payout",primaryContactName:"Ada Obi",primaryEmail:"ada@atlas.example",grade:"B" }));
  it("round-trips stored structured results through schema validation", () => expect(deserializeResult(JSON.parse(JSON.stringify(result)))).toEqual(result));
});

describe("Supabase repository", () => {
  it("passes normalized domain identity when resolving an existing lead", async () => {
    const rpc = vi.fn().mockResolvedValue({ data:{lead_id:"00000000-0000-4000-8000-000000000001",run_id:"00000000-0000-4000-8000-000000000002"},error:null });
    await new SupabaseLeadRepository({ rpc } as PersistenceDatabase).beginRun(input);
    expect(rpc).toHaveBeenCalledWith("execfind_begin_run", expect.objectContaining({ p_identity_domain:"atlas.example",p_normalized_name:"atlas homes" }));
  });
  it("uses an explicit lead id for re-enrichment and still creates a new run", async () => {
    const rpc = vi.fn().mockResolvedValue({ data:{lead_id:"00000000-0000-4000-8000-000000000001",run_id:"00000000-0000-4000-8000-000000000099"},error:null });
    const saved = await new SupabaseLeadRepository({ rpc } as PersistenceDatabase).beginRun(input,"00000000-0000-4000-8000-000000000001");
    expect(saved.runId).toBe("00000000-0000-4000-8000-000000000099");
    expect(rpc).toHaveBeenCalledWith("execfind_begin_run",expect.objectContaining({p_lead_id:"00000000-0000-4000-8000-000000000001"}));
  });
});

describe("persistent enrichment service", () => {
  function repository() {
    return { beginRun:vi.fn().mockResolvedValue({leadId:"lead-1",runId:"run-2"}),completeRun:vi.fn().mockResolvedValue({leadId:"lead-1",runId:"run-2"}),failRun:vi.fn().mockResolvedValue(undefined),list:vi.fn(),get:vi.fn() } satisfies LeadRepository;
  }
  it("completes a successful new run and updates the snapshot", async () => {
    const repo=repository(); await enrichAndPersist(input,repo,{runner:async()=>({ok:true,value:result})});
    expect(repo.beginRun).toHaveBeenCalledOnce(); expect(repo.completeRun).toHaveBeenCalledWith("lead-1","run-2",input,result); expect(repo.failRun).not.toHaveBeenCalled();
  });
  it("records a failed re-enrichment without completing over the prior snapshot", async () => {
    const repo=repository(); const failure={code:"HTTP" as const,message:"Site unavailable",retryable:true};
    await expect(enrichAndPersist(input,repo,{leadId:"lead-1",runner:async()=>({ok:false,error:failure})})).rejects.toBeInstanceOf(EnrichmentRunError);
    expect(repo.beginRun).toHaveBeenCalledWith(input,"lead-1"); expect(repo.failRun).toHaveBeenCalledWith("lead-1","run-2",failure); expect(repo.completeRun).not.toHaveBeenCalled();
  });
});
