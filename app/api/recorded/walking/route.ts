import { createWalking } from "@/lib/db/repo";
import { writeDb } from "@/lib/db/store";
import { readJson, respond, serverError } from "@/lib/db/http";

// POST /api/recorded/walking: save a manual walking session (distance in m, duration in s, optional steps). Validated server-side.
export async function POST(req: Request) {
  const j = await readJson(req);
  if (!j.ok) return j.res;
  try {
    return await respond(await writeDb((db) => createWalking(db, j.body), (r) => r.ok));
  } catch (e) {
    console.error("[recorded] walking save failed:", (e as Error).message.slice(0, 120));
    return serverError();
  }
}
