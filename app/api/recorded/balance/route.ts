import { createBalance } from "@/lib/db/repo";
import { writeDb } from "@/lib/db/store";
import { readJson, respond, serverError } from "@/lib/db/http";

// POST /api/recorded/balance: save a manual balance assessment. Validated server-side.
export async function POST(req: Request) {
  const j = await readJson(req);
  if (!j.ok) return j.res;
  try {
    return await respond(await writeDb((db) => createBalance(db, j.body), (r) => r.ok));
  } catch (e) {
    console.error("[recorded] balance save failed:", (e as Error).message.slice(0, 120));
    return serverError();
  }
}
