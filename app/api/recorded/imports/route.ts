import { previewImport, saveImport, type ImportFail, type ImportRequest } from "@/lib/db/imports";
import { snapshot } from "@/lib/db/repo";
import { NO_STORE, serverError } from "@/lib/db/http";
import { readDb, writeDb } from "@/lib/db/store";
import { MAX_FILE_BYTES } from "@/lib/import/csv";

// POST /api/recorded/imports: validate / preview / save a sensor CSV against ONE saved pressure or balance assessment.
//   { mode: "preview" | "save", kind, astronautId, assessmentId, fileName, csv, replace? }
// The file is parsed on the server. "preview" never writes. "save" writes the import and all its samples in one transaction, or nothing.
const MAX_BODY = MAX_FILE_BYTES + 64 * 1024; // the CSV text plus a little JSON overhead

const failure = (f: ImportFail) =>
  Response.json({ ok: false, errors: f.errors, issues: f.issues, hidden: f.hidden }, { status: f.status, headers: NO_STORE });

export async function POST(req: Request) {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return failure({ ok: false, status: 415, errors: { form: "Send JSON." } });
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY) return failure({ ok: false, status: 413, errors: { form: `The file is larger than ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB. Nothing was imported.` } });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return failure({ ok: false, status: 413, errors: { form: `The file is larger than ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB. Nothing was imported.` } });
  let body: Record<string, unknown> | null = null;
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === "object" && !Array.isArray(j)) body = j as Record<string, unknown>;
  } catch { /* handled below */ }
  if (!body) return failure({ ok: false, status: 400, errors: { form: "Invalid request." } });

  try {
    if (body.mode === "preview") {
      const r = await readDb((db) => previewImport(db, body as ImportRequest));
      return r.ok ? Response.json({ ok: true, value: r.value }, { headers: NO_STORE }) : failure(r);
    }
    if (body.mode !== "save") return failure({ ok: false, status: 400, errors: { form: "Invalid request." } });
    const r = await writeDb((db) => saveImport(db, body as ImportRequest), (x) => x.ok && !x.value.duplicate);
    if (!r.ok) return failure(r);
    const snap = await readDb((db) => snapshot(db));
    return Response.json({ ok: true, value: r.value, snapshot: snap }, { headers: NO_STORE });
  } catch (e) {
    // Only the outcome class is logged: never file content, names or ids.
    console.error("[import] failed:", (e as Error).message.slice(0, 120));
    return serverError();
  }
}
