import "server-only";
import { snapshot, type Result } from "./repo";
import { readDb } from "./store";
import type { Database } from "sql.js";

// Shared helpers for the /api/recorded routes: strict JSON body parsing and one response shape.
const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY = 8 * 1024;

export async function readJson(req: Request): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; res: Response }> {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return { ok: false, res: Response.json({ ok: false, errors: { form: "Send JSON." } }, { status: 415, headers: NO_STORE }) };
  const raw = await req.text();
  if (raw.length > MAX_BODY) return { ok: false, res: Response.json({ ok: false, errors: { form: "Request too large." } }, { status: 413, headers: NO_STORE }) };
  try {
    const b = JSON.parse(raw);
    if (b && typeof b === "object" && !Array.isArray(b)) return { ok: true, body: b as Record<string, unknown> };
  } catch { /* fall through */ }
  return { ok: false, res: Response.json({ ok: false, errors: { form: "Invalid JSON." } }, { status: 400, headers: NO_STORE }) };
}

/** Success returns the saved value plus a fresh snapshot, so the browser updates every page from one source. */
export async function respond<T>(r: Result<T>): Promise<Response> {
  if (!r.ok) return Response.json({ ok: false, errors: r.errors }, { status: r.status, headers: NO_STORE });
  const snap = await readDb((db: Database) => snapshot(db));
  return Response.json({ ok: true, value: r.value, snapshot: snap }, { headers: NO_STORE });
}

export const serverError = () => Response.json({ ok: false, errors: { form: "The database could not be used. Nothing was saved." } }, { status: 500, headers: NO_STORE });
export { NO_STORE };
