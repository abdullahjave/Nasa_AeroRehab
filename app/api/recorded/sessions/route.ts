import { createSession } from "@/lib/db/repo";
import { writeDb } from "@/lib/db/store";
import { readJson, respond, serverError } from "@/lib/db/http";

// POST /api/recorded/sessions: save a new manual knee session (validated server-side).
export async function POST(req: Request) {
  const j = await readJson(req);
  if (!j.ok) return j.res;
  try {
    return await respond(await writeDb((db) => createSession(db, j.body), (r) => r.ok));
  } catch (e) {
    console.error("[recorded] session save failed:", (e as Error).message.slice(0, 120));
    return serverError();
  }
}
