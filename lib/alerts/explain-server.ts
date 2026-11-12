import { ASTRONAUTS } from "../demo/fixtures";
import { buildAlerts } from "./build";
import { geminiInputFor, parseModelJson, RESPONSE_SCHEMA, SYSTEM_INSTRUCTION, userPrompt, validateExplanation, type GeminiExplanation } from "./gemini";

// Server-side logic behind POST /api/explain. It never imports the Gemini SDK (the route injects `generate`), so the
// request handling, data minimisation, rate limit and output checks can be tested without a key or a network.

export const TIMEOUT_MS = 25_000; // with minimal thinking, live answers take 2-8 s
export const RATE_PER_CLIENT = 6;
export const RATE_GLOBAL = 30;
export const RATE_WINDOW_MS = 60_000;

export type ExplainError = "invalid-request" | "not-found" | "not-eligible" | "rate-limited" | "provider-quota" | "not-configured" | "timeout" | "upstream-failed" | "invalid-response";
export type ExplainOutcome =
  | { status: 200; body: { ok: true; source: "ai"; explanation: GeminiExplanation } }
  | { status: number; body: { ok: false; error: ExplainError; retryAfterSec?: number } };

export type GenerateArgs = { apiKey: string; model: string; system: string; prompt: string; schema: unknown; signal: AbortSignal; timeoutMs: number };
export type Generate = (a: GenerateArgs) => Promise<string | undefined>;

/** Sliding-window limiter. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {}
  /** Returns 0 when allowed (and records the hit), otherwise the seconds to wait. */
  take(key: string, now: number): number {
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length >= this.max) { this.hits.set(key, arr); return Math.max(1, Math.ceil((arr[0] + this.windowMs - now) / 1000)); }
    arr.push(now);
    this.hits.set(key, arr);
    if (this.hits.size > 500) for (const [k, v] of this.hits) if (!v.some((t) => now - t < this.windowMs)) this.hits.delete(k);
    return 0;
  }
}

export type ExplainState = { perClient: RateLimiter; global: RateLimiter; inflight: Map<string, Promise<ExplainOutcome>> };
export const newExplainState = (): ExplainState => ({
  perClient: new RateLimiter(RATE_PER_CLIENT, RATE_WINDOW_MS),
  global: new RateLimiter(RATE_GLOBAL, RATE_WINDOW_MS),
  inflight: new Map(),
});

const ID = /^[A-Za-z0-9:._-]{1,120}$/;
const fail = (status: number, error: ExplainError, extra: { retryAfterSec?: number } = {}): ExplainOutcome => ({ status, body: { ok: false, error, ...extra } });

export type Env = { apiKey?: string; model?: string };

export async function handleExplain(
  body: unknown,
  env: Env,
  deps: { generate: Generate; state: ExplainState; clientId: string; now?: () => number },
): Promise<ExplainOutcome> {
  // 1. Validate the request shape. Only three ids are accepted; there is no free text.
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "invalid-request");
  const b = body as Record<string, unknown>;
  const { astronautId, sessionId, alertId } = b;
  if (typeof astronautId !== "string" || typeof sessionId !== "string" || typeof alertId !== "string") return fail(400, "invalid-request");
  if (![astronautId, sessionId, alertId].every((x) => ID.test(x))) return fail(400, "invalid-request");

  // 2. Resolve the alert on the server from the simulated data. The client cannot supply values or text.
  const a = ASTRONAUTS.find((x) => x.id === astronautId);
  const s = a?.sessions.find((x) => x.id === sessionId);
  if (!a || !s) return fail(404, "not-found");
  const alert = buildAlerts(a, s).find((x) => x.id === alertId);
  if (!alert) return fail(404, "not-found");
  const input = geminiInputFor(alert, { rehabFocus: a.profile.rehabFocus, affectedLimb: a.profile.affectedLimb, missionDay: s.missionDay });
  if (!input) return fail(422, "not-eligible");

  // 3. Configuration. Both the key and the model name come from the server environment.
  const apiKey = env.apiKey?.trim();
  const model = env.model?.trim();
  if (!apiKey || !model) return fail(503, "not-configured");

  // 4. Duplicate protection: an identical request already in flight shares its result and costs nothing extra.
  const key = `${astronautId}|${sessionId}|${alertId}`;
  const existing = deps.state.inflight.get(key);
  if (existing) return existing;

  // 5. Rate limit (per client and overall) before any upstream call.
  const now = (deps.now ?? Date.now)();
  const wait = Math.max(deps.state.perClient.take(deps.clientId, now), deps.state.global.take("*", now));
  if (wait > 0) return fail(429, "rate-limited", { retryAfterSec: wait });

  const run = (async (): Promise<ExplainOutcome> => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const text = await deps.generate({ apiKey, model, system: SYSTEM_INSTRUCTION, prompt: userPrompt(input), schema: RESPONSE_SCHEMA, signal: ctl.signal, timeoutMs: TIMEOUT_MS });
      const checked = validateExplanation(parseModelJson(text), input);
      if (!checked.ok) return fail(502, "invalid-response");
      return { status: 200, body: { ok: true, source: "ai", explanation: checked.value } };
    } catch (e) {
      // Never log the error object: it can carry request details. Only the outcome class is kept.
      if (ctl.signal.aborted) return fail(504, "timeout");
      // The provider's own quota (HTTP 429 upstream) is reported as "provider-quota" (HTTP 503, no Retry-After). The app's own
      // limiter is "rate-limited" (HTTP 429 with Retry-After), and a slow provider is "timeout" (HTTP 504). They are never mixed up.
      if ((e as { status?: unknown } | null)?.status === 429) return fail(503, "provider-quota");
      return fail(502, "upstream-failed");
    } finally {
      clearTimeout(timer);
    }
  })();
  deps.state.inflight.set(key, run);
  try { return await run; } finally { deps.state.inflight.delete(key); }
}
