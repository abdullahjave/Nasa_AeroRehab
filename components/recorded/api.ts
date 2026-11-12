"use client";

import { applySnapshot } from "./store";
import type { FieldErrors, RecordedSnapshot } from "@/lib/recorded/types";
import type { ImportData, PreviewValue, SaveValue } from "@/lib/db/imports";
import type { CsvIssue } from "@/lib/import/csv";

// Browser calls to the /api/recorded routes. The server validates everything again; these helpers only carry the result.
export type ApiResult = { ok: true } | { ok: false; errors: FieldErrors };

async function call<T = unknown>(url: string, method: string, body?: unknown): Promise<(ApiResult & { value?: T })> {
  try {
    const res = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; errors?: FieldErrors; value?: T; snapshot?: RecordedSnapshot } | null;
    if (res.ok && json?.ok && json.snapshot) { applySnapshot(json.snapshot); return { ok: true, value: json.value }; }
    return { ok: false, errors: json?.errors ?? { form: "The data could not be saved. Your entries are still here. Try again." } };
  } catch {
    return { ok: false, errors: { form: "The server could not be reached. Nothing was saved and your entries are still here. Try again." } };
  }
}

export const saveProfile = (id: string, body: Record<string, unknown>) => call(`/api/recorded/astronauts/${encodeURIComponent(id)}`, "PATCH", body);
export const createSessionApi = (body: Record<string, unknown>) => call<{ id: string }>("/api/recorded/sessions", "POST", body);
export const updateSessionApi = (id: string, body: Record<string, unknown>) => call<{ id: string }>(`/api/recorded/sessions/${encodeURIComponent(id)}`, "PUT", body);
export const setBaselineApi = (id: string) => call(`/api/recorded/sessions/${encodeURIComponent(id)}/baseline`, "PUT");
export const clearBaselineApi = (id: string) => call(`/api/recorded/sessions/${encodeURIComponent(id)}/baseline`, "DELETE");
export const createWalkingApi = (body: Record<string, unknown>) => call<{ id: string }>("/api/recorded/walking", "POST", body);
export const updateWalkingApi = (id: string, body: Record<string, unknown>) => call<{ id: string }>(`/api/recorded/walking/${encodeURIComponent(id)}`, "PUT", body);
export const createPressureApi = (body: Record<string, unknown>) => call<{ id: string }>("/api/recorded/pressure", "POST", body);
export const updatePressureApi = (id: string, body: Record<string, unknown>) => call<{ id: string }>(`/api/recorded/pressure/${encodeURIComponent(id)}`, "PUT", body);
export const createBalanceApi = (body: Record<string, unknown>) => call<{ id: string }>("/api/recorded/balance", "POST", body);
export const updateBalanceApi = (id: string, body: Record<string, unknown>) => call<{ id: string }>(`/api/recorded/balance/${encodeURIComponent(id)}`, "PUT", body);

// ---------------------------------------------------------------- sensor CSV imports (Phase 2C)

export type ImportFailure = { ok: false; errors: FieldErrors; issues: CsvIssue[]; hidden: number };
export type ImportRequestBody = { kind: "pressure" | "balance"; astronautId: string; assessmentId: string; fileName: string; csv: string; replace?: boolean };

async function importCall<T>(mode: "preview" | "save", body: ImportRequestBody): Promise<{ ok: true; value: T } | ImportFailure> {
  try {
    const res = await fetch("/api/recorded/imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, ...body }), cache: "no-store" });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; value?: T; errors?: FieldErrors; issues?: CsvIssue[]; hidden?: number; snapshot?: RecordedSnapshot } | null;
    if (res.ok && json?.ok && json.value !== undefined) {
      if (mode === "save" && json.snapshot) applySnapshot(json.snapshot);
      return { ok: true, value: json.value };
    }
    return { ok: false, errors: json?.errors ?? { form: "The file could not be checked. Nothing was imported." }, issues: json?.issues ?? [], hidden: json?.hidden ?? 0 };
  } catch {
    return { ok: false, errors: { form: "The server could not be reached. Nothing was imported." }, issues: [], hidden: 0 };
  }
}
export const previewImportApi = (b: ImportRequestBody) => importCall<PreviewValue>("preview", b);
export const saveImportApi = (b: ImportRequestBody) => importCall<SaveValue>("save", b);

/** Saved samples of one assessment's import (null when it has none). Cached per import id: an import never changes after saving. */
const dataCache = new Map<string, Promise<ImportData | null>>();
export function loadImportData(kind: "pressure" | "balance", astronautId: string, assessmentId: string, importId: string): Promise<ImportData | null> {
  const key = `${importId}`;
  let p = dataCache.get(key);
  if (!p) {
    p = fetch(`/api/recorded/imports/${kind}/${encodeURIComponent(assessmentId)}?astronautId=${encodeURIComponent(astronautId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: ImportData | null }) => { if (!j?.ok) throw new Error("load failed"); return j.data ?? null; });
    p.catch(() => dataCache.delete(key));
    dataCache.set(key, p);
  }
  return p;
}
