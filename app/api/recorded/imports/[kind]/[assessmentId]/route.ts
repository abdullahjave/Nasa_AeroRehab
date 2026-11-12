import { connection } from "next/server";
import { getImportData } from "@/lib/db/imports";
import { NO_STORE, serverError } from "@/lib/db/http";
import { readDb } from "@/lib/db/store";

// GET /api/recorded/imports/:kind/:assessmentId?astronautId=...: the saved samples of one assessment's CSV import.
// The astronaut in the query must own the assessment, so one astronaut's samples are never served for another's.
export async function GET(req: Request, ctx: { params: Promise<{ kind: string; assessmentId: string }> }) {
  await connection();
  const { kind, assessmentId } = await ctx.params;
  const astronautId = new URL(req.url).searchParams.get("astronautId") ?? "";
  try {
    const r = await readDb((db) => getImportData(db, kind, assessmentId, astronautId));
    if (!r.ok) return Response.json({ ok: false, errors: r.errors }, { status: r.status, headers: NO_STORE });
    return Response.json({ ok: true, data: r.value }, { headers: NO_STORE });
  } catch (e) {
    console.error("[import] read failed:", (e as Error).message.slice(0, 120));
    return serverError();
  }
}
