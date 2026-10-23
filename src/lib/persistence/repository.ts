import type { EnrichmentError, EnrichmentInput, EnrichmentResult } from "../enrichment/types";
import { contactsFromResult, snapshotFromResult } from "./mappers";
import { leadIdentity } from "./identity";
import { leadDetailSchema, leadListResponseSchema, type LeadDetail, type LeadListResponse, type LeadQuery } from "./types";

export type RpcResult = Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
export type PersistenceDatabase = { rpc(name: string, params: Record<string, unknown>): RpcResult };

export interface LeadRepository {
  beginRun(input: EnrichmentInput, leadId?: string): Promise<{ leadId: string; runId: string }>;
  completeRun(leadId: string, runId: string, input: EnrichmentInput, result: EnrichmentResult): Promise<{ leadId: string; runId: string }>;
  failRun(leadId: string, runId: string, error: EnrichmentError): Promise<void>;
  list(query: LeadQuery): Promise<LeadListResponse>;
  get(id: string): Promise<LeadDetail | null>;
}

function databaseError(action: string, error: { message: string; code?: string } | null): never {
  throw new Error(`Persistence ${action} failed${error?.code ? ` (${error.code})` : ""}: ${error?.message ?? "No data returned."}`);
}

export class SupabaseLeadRepository implements LeadRepository {
  constructor(private readonly database: PersistenceDatabase) {}

  async beginRun(input: EnrichmentInput, leadId?: string) {
    const identity = leadIdentity({ companyName: input.companyName, website: input.website });
    const { data, error } = await this.database.rpc("execfind_begin_run", {
      p_input: input, p_normalized_name: identity.normalizedCompanyName, p_identity_domain: identity.normalizedDomain ?? null,
      p_lead_id: leadId ?? null,
    });
    if (error || !data) databaseError("begin", error);
    const value = data as { lead_id?: unknown; run_id?: unknown };
    if (typeof value.lead_id !== "string" || typeof value.run_id !== "string") databaseError("begin", null);
    return { leadId: value.lead_id, runId: value.run_id };
  }

  async completeRun(leadId: string, runId: string, input: EnrichmentInput, result: EnrichmentResult) {
    const { data, error } = await this.database.rpc("execfind_complete_run", {
      p_lead_id: leadId, p_run_id: runId, p_input: input, p_result: result, p_snapshot: snapshotFromResult(result),
      p_contacts: contactsFromResult(result), p_evidence: result.evidence, p_score: result.score, p_warnings: result.warnings,
    });
    if (error || !data) databaseError("completion", error);
    const value = data as { lead_id?: unknown; run_id?: unknown };
    if (typeof value.lead_id !== "string" || typeof value.run_id !== "string") databaseError("completion", null);
    return { leadId: value.lead_id, runId: value.run_id };
  }

  async failRun(leadId: string, runId: string, errorValue: EnrichmentError) {
    const { error } = await this.database.rpc("execfind_fail_run", { p_lead_id: leadId, p_run_id: runId, p_error: errorValue });
    if (error) databaseError("failure recording", error);
  }

  async list(query: LeadQuery) {
    const { data, error } = await this.database.rpc("execfind_list_leads", {
      p_search: query.search, p_grades: query.grades, p_branches: query.branches, p_reachability: query.reachability,
      p_sort: query.sort, p_limit: query.limit, p_offset: query.offset,
    });
    if (error) databaseError("list", error);
    return leadListResponseSchema.parse(data);
  }

  async get(id: string) {
    const { data, error } = await this.database.rpc("execfind_get_lead", { p_lead_id: id });
    if (error) databaseError("detail", error);
    return data ? leadDetailSchema.parse(data) : null;
  }
}
