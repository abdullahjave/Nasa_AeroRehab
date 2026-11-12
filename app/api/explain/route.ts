import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { handleExplain, newExplainState, type Generate } from "@/lib/alerts/explain-server";

// POST /api/explain: on-demand Gemini explanation for one existing alert. Server only: GEMINI_API_KEY and GEMINI_MODEL are
// read here and never sent to the browser. The request carries three ids; the alert and the numbers are resolved on the
// server from the simulated data, and only the metric, units, values and the app-approved action text go to Gemini.
// (Node.js runtime is the default; a "runtime" segment option is not allowed with cacheComponents.)

const state = newExplainState();

// The time limit is enforced by the caller's AbortSignal. Do not pass httpOptions.timeout: the SDK forwards it to Gemini
// as a request deadline, and Gemini rejects any deadline under 10 seconds (HTTP 400), which made every call fail.
// Gemini 3.x models "think" before answering, which made some calls exceed the time limit. This is a short structured
// rewrite, so thinking is kept minimal and the output capped. One quick retry covers a momentary provider 503.
const generate: Generate = async ({ apiKey, model, system, prompt, schema, signal }) => {
  const ai = new GoogleGenAI({ apiKey });
  const config = {
    systemInstruction: system, responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.2,
    maxOutputTokens: 600, thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }, abortSignal: signal,
  };
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await ai.models.generateContent({ model, contents: prompt, config });
      return res.text;
    } catch (e) {
      // Log only the numeric HTTP status so failures can be told apart (never the message, which may echo request details).
      const status = (e as { status?: unknown })?.status;
      console.error("[explain] upstream http status:", typeof status === "number" ? status : "none");
      if (status === 503 && attempt === 0 && !signal.aborted) { await new Promise((r) => setTimeout(r, 800)); continue; }
      throw e;
    }
  }
};

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return Response.json({ ok: false, error: "invalid-request" }, { status: 415, headers: NO_STORE });
  }
  const raw = await req.text();
  if (raw.length > 2048) return Response.json({ ok: false, error: "invalid-request" }, { status: 413, headers: NO_STORE });
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { /* handled as invalid-request */ }
  const clientId = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim().slice(0, 64) || "local";
  const out = await handleExplain(body, { apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL }, { generate, state, clientId });
  // Sanitized server log: only the outcome class, never keys, prompts, ids or provider messages.
  if (!out.body.ok) {
    const kind = out.body.error === "rate-limited" ? "app-rate-limit" : out.body.error;
    console.error(`[explain] outcome=${kind} http=${out.status}`);
  }
  const headers: Record<string, string> = { ...NO_STORE };
  if (!out.body.ok && out.body.retryAfterSec) headers["Retry-After"] = String(out.body.retryAfterSec);
  return Response.json(out.body, { status: out.status, headers });
}
