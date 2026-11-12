import { connection } from "next/server";
import { snapshot } from "@/lib/db/repo";
import { readDb } from "@/lib/db/store";
import { NO_STORE, serverError } from "@/lib/db/http";

// GET /api/recorded: the saved mission, astronaut profiles, knee sessions and baselines (local SQLite). Server-side only.
export async function GET() {
  await connection();
  try {
    return Response.json({ ok: true, snapshot: await readDb(snapshot) }, { headers: NO_STORE });
  } catch (e) {
    console.error("[recorded] read failed:", (e as Error).message.slice(0, 120));
    return serverError();
  }
}
