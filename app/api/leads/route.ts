import { NextResponse } from "next/server";
import { z } from "zod";
import { createLeadRepository, PersistenceConfigurationError } from "@/src/lib/persistence/client";
import { parseLeadQuery } from "@/src/lib/persistence/query";

export async function GET(request: Request) {
  try {
    const query = parseLeadQuery(new URL(request.url).searchParams);
    return NextResponse.json(await createLeadRepository().list(query), { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    const status = cause instanceof PersistenceConfigurationError ? 503 : cause instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: { message: cause instanceof Error ? cause.message : "Lead queue could not be loaded." } }, { status });
  }
}
