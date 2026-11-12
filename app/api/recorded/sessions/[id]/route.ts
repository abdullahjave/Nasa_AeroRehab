import { updateSession } from "@/lib/db/repo";
import { writeDb } from "@/lib/db/store";
import { readJson, respond, serverError } from "@/lib/db/http";

// PUT /api/recorded/sessions/:id: edit the same saved session in place (never creates a second row).
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const j = await readJson(req);
  if (!j.ok) return j.res;
  try {
    return await respond(await writeDb((db) => updateSession(db, id, j.body), (r) => r.ok));
  } catch (e) {
    console.error("[recorded] session update failed:", (e as Error).message.slice(0, 120));
    return serverError();
  }
}
