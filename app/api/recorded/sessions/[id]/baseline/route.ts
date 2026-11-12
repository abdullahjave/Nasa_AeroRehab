import { clearBaseline, setBaseline } from "@/lib/db/repo";
import { writeDb } from "@/lib/db/store";
import { respond, serverError } from "@/lib/db/http";

// PUT = use this saved session as the baseline for its own astronaut, side, movement and protocol. DELETE = clear it.
export async function PUT(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try { return await respond(await writeDb((db) => setBaseline(db, id), (r) => r.ok)); }
  catch (e) { console.error("[recorded] baseline save failed:", (e as Error).message.slice(0, 120)); return serverError(); }
}
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try { return await respond(await writeDb((db) => clearBaseline(db, id), (r) => r.ok)); }
  catch (e) { console.error("[recorded] baseline clear failed:", (e as Error).message.slice(0, 120)); return serverError(); }
}
