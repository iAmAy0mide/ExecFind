import { normalizeInput } from "../enrichment/normalize";
import type { EnrichmentError, EnrichmentResult, Result } from "../enrichment/types";
import type { LeadRepository } from "./repository";

export class EnrichmentRunError extends Error {
  constructor(public readonly detail: EnrichmentError) { super(detail.message); }
}

const unknownError = (cause: unknown): EnrichmentError => ({ code: "UNKNOWN", message: cause instanceof Error ? cause.message : "Enrichment failed unexpectedly.", retryable: false });

export async function enrichAndPersist(raw: unknown, repository: LeadRepository, options: { leadId?: string; runner?: (input: unknown) => Promise<Result<EnrichmentResult>> } = {}) {
  const normalized = normalizeInput(raw);
  if (!normalized.ok) throw new EnrichmentRunError(normalized.error);
  const started = await repository.beginRun(normalized.value, options.leadId);
  try {
    const runner = options.runner ?? (async (input: unknown) => (await import("../enrichment/server")).runEnrichment(input));
    const outcome = await runner(normalized.value);
    if (!outcome.ok) {
      await repository.failRun(started.leadId, started.runId, outcome.error);
      throw new EnrichmentRunError(outcome.error);
    }
    const completed = await repository.completeRun(started.leadId, started.runId, normalized.value, outcome.value);
    return { ...completed, result: outcome.value };
  } catch (cause) {
    if (cause instanceof EnrichmentRunError) throw cause;
    const error = unknownError(cause);
    try { await repository.failRun(started.leadId, started.runId, error); } catch { /* retain the original failure */ }
    throw new EnrichmentRunError(error);
  }
}
