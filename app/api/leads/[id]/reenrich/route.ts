import { NextResponse } from "next/server";
import { z } from "zod";
import { createLeadRepository, PersistenceConfigurationError } from "@/src/lib/persistence/client";
import { enrichAndPersist, EnrichmentRunError } from "@/src/lib/persistence/service";

const idSchema = z.string().uuid();

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = idSchema.parse((await context.params).id);
    const repository = createLeadRepository();
    const detail = await repository.get(id);
    if (!detail) return NextResponse.json({ error: { message: "Lead not found." } }, { status: 404 });
    const input = { companyName: detail.lead.companyName, website: detail.lead.website ?? detail.lead.domain ?? undefined, sourcePlatform: detail.lead.sourcePlatform ?? undefined, sourceUrl: detail.lead.sourceUrl ?? undefined, investmentOfferHint: detail.lead.investmentOfferHint ?? undefined };
    const saved = await enrichAndPersist(input, repository, { leadId: id });
    return NextResponse.json({ ...saved.result, persistence: { saved: true, leadId: saved.leadId, runId: saved.runId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof z.ZodError) return NextResponse.json({ error: { message: "Invalid lead id." } }, { status: 400 });
    if (cause instanceof PersistenceConfigurationError) return NextResponse.json({ error: { message: cause.message } }, { status: 503 });
    if (cause instanceof EnrichmentRunError) return NextResponse.json({ error: cause.detail }, { status: 500 });
    const message = cause instanceof Error ? cause.message : "Re-enrichment failed.";
    return NextResponse.json({ error: { message } }, { status: /already active/i.test(message) ? 409 : 500 });
  }
}
