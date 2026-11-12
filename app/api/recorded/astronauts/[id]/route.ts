import { updateProfile } from "@/lib/db/repo";
import { writeDb } from "@/lib/db/store";
import { readJson, respond, serverError } from "@/lib/db/http";

// PATCH /api/recorded/astronauts/:id: edit profile fields. Only the whitelisted fields are accepted.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const j = await readJson(req);
  if (!j.ok) return j.res;
  try {
    return await respond(await writeDb((db) => updateProfile(db, id, j.body), (r) => r.ok));
  } catch (e) {
    console.error("[recorded] profile save failed:", (e as Error).message.slice(0, 120));
    return serverError();
  }
}
