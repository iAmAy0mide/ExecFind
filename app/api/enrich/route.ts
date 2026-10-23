import { NextResponse } from "next/server";
import { createLeadRepository, PersistenceConfigurationError } from "@/src/lib/persistence/client";
import { enrichAndPersist, EnrichmentRunError } from "@/src/lib/persistence/service";

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: { code: "VALIDATION", message: "Request body must be valid JSON." } }, { status: 400 }); }
  try {
    const saved = await enrichAndPersist(input, createLeadRepository());
    return NextResponse.json({ ...saved.result, persistence: { saved: true, leadId: saved.leadId, runId: saved.runId } }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof PersistenceConfigurationError) return NextResponse.json({ error: { code: "PERSISTENCE_UNCONFIGURED", message: cause.message } }, { status: 503 });
    if (cause instanceof EnrichmentRunError) return NextResponse.json({ error: cause.detail }, { status: cause.detail.code === "VALIDATION" || cause.detail.code === "UNSAFE_URL" ? 400 : 500 });
    return NextResponse.json({ error: { code: "PERSISTENCE", message: cause instanceof Error ? cause.message : "The enrichment run could not be saved." } }, { status: 500 });
  }
}
