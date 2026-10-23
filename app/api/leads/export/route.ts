import { NextResponse } from "next/server";
import { createLeadRepository, PersistenceConfigurationError } from "@/src/lib/persistence/client";
import { leadsToCsv } from "@/src/lib/persistence/csv";
import { parseLeadQuery } from "@/src/lib/persistence/query";

export async function GET(request: Request) {
  try {
    const query = parseLeadQuery(new URL(request.url).searchParams, { limit: 5000, offset: 0 });
    const { items } = await createLeadRepository().list(query);
    return new NextResponse(leadsToCsv(items), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="execfind-leads-${new Date().toISOString().slice(0,10)}.csv"`, "Cache-Control": "no-store" } });
  } catch (cause) {
    const status = cause instanceof PersistenceConfigurationError ? 503 : 400;
    return NextResponse.json({ error: { message: cause instanceof Error ? cause.message : "CSV export failed." } }, { status });
  }
}
