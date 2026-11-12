import { updatePressure } from "@/lib/db/repo";
import { writeDb } from "@/lib/db/store";
import { readJson, respond, serverError } from "@/lib/db/http";

// PUT /api/recorded/pressure/:id: edit the same saved assessment in place.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const j = await readJson(req);
  if (!j.ok) return j.res;
  try {
    return await respond(await writeDb((db) => updatePressure(db, id, j.body), (r) => r.ok));
  } catch (e) {
    console.error("[recorded] pressure update failed:", (e as Error).message.slice(0, 120));
    return serverError();
  }
}
