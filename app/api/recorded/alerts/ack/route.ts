import { acknowledgeAlert, type AckRequest } from "@/lib/db/acks";
import { snapshot } from "@/lib/db/repo";
import { readJson, serverError } from "@/lib/db/http";
import { NO_STORE } from "@/lib/db/http";
import { readDb, writeDb } from "@/lib/db/store";

// POST /api/recorded/alerts/ack  { astronautId, sessionId, alertId }
// Marks one RECORDED alert as seen. The alert and the stored snapshot are rebuilt on the server from the saved records; the browser sends ids only.
// "Seen" never resolves, hides or downgrades the alert. Repeating it for unchanged data is a no-op (duplicate: true).
export async function POST(req: Request) {
  const j = await readJson(req);
  if (!j.ok) return j.res;
  try {
    const r = await writeDb((db) => acknowledgeAlert(db, j.body as AckRequest, snapshot(db)), (x) => x.ok && !x.value.duplicate);
    if (!r.ok) return Response.json({ ok: false, errors: r.errors }, { status: r.status, headers: NO_STORE });
    const snap = await readDb((db) => snapshot(db));
    return Response.json({ ok: true, value: r.value, snapshot: snap }, { headers: NO_STORE });
  } catch (e) {
    console.error("[ack] failed:", (e as Error).message.slice(0, 120));
    return serverError();
  }
}
