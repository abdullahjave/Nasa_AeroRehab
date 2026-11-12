import { createHash } from "node:crypto";
import type { Database, SqlValue } from "sql.js";
import { BALANCE_TEMPLATE_NAME, parseBalanceCsv } from "../import/balance";
import { MAX_FILE_BYTES, byteLength, type CsvIssue } from "../import/csv";
import { PRESSURE_TEMPLATE_NAME, parsePressureCsv } from "../import/pressure";
import { summarizeBalanceRows, summarizePressureRows } from "../import/summary";
import type { BalanceRow, ImportKind, ImportMeta, ImportPreview, PressureRow, RecordedImport, SensorGeometry } from "../import/types";
import type { FieldErrors } from "../recorded/types";

// Sensor CSV imports: validate, preview and save pressure / balance samples against ONE saved assessment.
// Pure functions on a sql.js Database (no file access), so tests use :memory:. The route validates, but everything is re-checked here.
//   - the assessment must exist AND belong to the astronaut named in the request (otherwise nothing is parsed or saved);
//   - the file is parsed completely before the first write; any problem rejects the whole import;
//   - the import row and all its samples are written in ONE transaction (or not at all);
//   - the same file submitted twice for the same assessment is a no-op; a different file needs replace=true, and replacing
//     deletes the old import and inserts the new one in the same transaction.

type Row = Record<string, SqlValue>;
function all(db: Database, sql: string, params: SqlValue[] = []): Row[] {
  const st = db.prepare(sql);
  try {
    st.bind(params);
    const out: Row[] = [];
    while (st.step()) out.push(st.getAsObject() as Row);
    return out;
  } finally { st.free(); }
}
const one = (db: Database, sql: string, params: SqlValue[] = []) => all(db, sql, params)[0] ?? null;

export type ImportFail = { ok: false; status: number; errors: FieldErrors; issues?: CsvIssue[]; hidden?: number };
export type ImportOk<T> = { ok: true; value: T };
export type ImportResult<T> = ImportOk<T> | ImportFail;
const fail = (status: number, form: string, extra: Partial<ImportFail> = {}): ImportFail => ({ ok: false, status, errors: { form }, ...extra });

export type ImportRequest = { kind: unknown; astronautId: unknown; assessmentId: unknown; fileName: unknown; csv: unknown; replace?: unknown };

type Target = {
  kind: ImportKind; astronautId: string; assessmentId: string; fileName: string; csv: string; replace: boolean;
  context: ImportMeta["context"]; table: "pressure_assessments" | "balance_assessments";
};

const ID = /^[A-Za-z0-9:._-]{1,120}$/;

/** Safe display name: the last path part, no control characters, at most 120 characters. */
export function cleanFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const t = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
  return t || "sensor.csv";
}

/** Checks the request and the assessment's owner. Nothing is parsed before this passes. */
function resolveTarget(db: Database, req: ImportRequest): ImportResult<Target> {
  const { kind, astronautId, assessmentId, fileName, csv } = req;
  if (kind !== "pressure" && kind !== "balance") return fail(400, "Choose whether this file is a pressure or a balance recording.");
  if (typeof astronautId !== "string" || !ID.test(astronautId) || typeof assessmentId !== "string" || !ID.test(assessmentId)) return fail(400, "The astronaut or assessment is missing. Nothing was imported.");
  if (typeof csv !== "string") return fail(400, "No file content was received. Nothing was imported.");
  if (byteLength(csv) > MAX_FILE_BYTES) return fail(413, `The file is larger than ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB. Nothing was imported.`);
  const table = kind === "pressure" ? "pressure_assessments" : "balance_assessments";
  const row = one(db, `SELECT * FROM ${table} WHERE id = ?`, [assessmentId]);
  if (!row) return fail(404, "That assessment was not found. Nothing was imported.");
  if (String(row.astronaut_id) !== astronautId) return fail(403, "That assessment belongs to a different astronaut than the one selected. Nothing was imported.");
  const context: ImportMeta["context"] = kind === "balance"
    ? { side: row.trial_side as "left" | "right", protocol: String(row.protocol) }
    : { protocol: String(row.protocol) };
  return { ok: true, value: { kind, astronautId, assessmentId, fileName: cleanFileName(typeof fileName === "string" ? fileName : ""), csv, replace: req.replace === true, context, table } };
}

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const col = (k: ImportKind) => (k === "pressure" ? "pressure_assessment_id" : "balance_assessment_id");

function metaOf(r: Row): ImportMeta {
  const kind = r.kind as ImportKind;
  return {
    id: String(r.id), kind, assessmentId: String(kind === "pressure" ? r.pressure_assessment_id : r.balance_assessment_id), astronautId: String(r.astronaut_id),
    fileName: String(r.file_name), importedAt: String(r.imported_at), template: String(r.template),
    preview: JSON.parse(String(r.preview_json)) as ImportPreview, context: JSON.parse(String(r.context_json)) as ImportMeta["context"],
  };
}

const existingOf = (db: Database, t: Pick<Target, "kind" | "assessmentId">) => one(db, `SELECT * FROM sensor_imports WHERE ${col(t.kind)} = ?`, [t.assessmentId]);

export type PreviewValue = {
  preview: ImportPreview;
  fileName: string;
  template: string;
  context: ImportMeta["context"];
  /** The assessment already has an imported file. */
  existing: { fileName: string; importedAt: string; sameFile: boolean } | null;
  /** Foot geometry for the preview map (pressure only). */
  geometry?: SensorGeometry[];
};

/** Parses and validates the file against the selected assessment. Writes nothing. */
export function previewImport(db: Database, req: ImportRequest): ImportResult<PreviewValue> {
  const t = resolveTarget(db, req);
  if (!t.ok) return t;
  const parsed = t.value.kind === "pressure" ? parsePressureCsv(t.value.csv) : parseBalanceCsv(t.value.csv);
  if (!parsed.ok) return { ok: false, status: 422, errors: { form: "The file was not accepted. Nothing was imported." }, issues: parsed.issues, hidden: parsed.hidden };
  const ex = existingOf(db, t.value);
  return {
    ok: true,
    value: {
      preview: parsed.preview, fileName: t.value.fileName,
      template: t.value.kind === "pressure" ? PRESSURE_TEMPLATE_NAME : BALANCE_TEMPLATE_NAME, context: t.value.context,
      existing: ex ? { fileName: String(ex.file_name), importedAt: String(ex.imported_at), sameFile: String(ex.content_sha256) === sha256(t.value.csv) } : null,
      geometry: "geometry" in parsed ? parsed.geometry : undefined,
    },
  };
}

export type SaveValue = { meta: ImportMeta; duplicate: boolean; replaced: boolean };

/** Saves the import in one transaction. Repeating the same submit changes nothing; replacing is explicit and atomic. */
export function saveImport(db: Database, req: ImportRequest, now: () => string = () => new Date().toISOString()): ImportResult<SaveValue> {
  const t = resolveTarget(db, req);
  if (!t.ok) return t;
  const { kind, assessmentId, astronautId, csv } = t.value;
  const hash = sha256(csv);
  const ex = existingOf(db, t.value);
  if (ex && String(ex.content_sha256) === hash) return { ok: true, value: { meta: metaOf(ex), duplicate: true, replaced: false } };
  if (ex && !t.value.replace) {
    return fail(409, `This assessment already has an imported file (${String(ex.file_name)}, ${String(ex.imported_at).slice(0, 16).replace("T", " ")} UTC). Choose "Replace the existing import" to swap it for this file. Nothing was changed.`);
  }
  const parsed = kind === "pressure" ? parsePressureCsv(csv) : parseBalanceCsv(csv);
  if (!parsed.ok) return { ok: false, status: 422, errors: { form: "The file was not accepted. Nothing was imported." }, issues: parsed.issues, hidden: parsed.hidden };

  const id = `imp-${crypto.randomUUID()}`;
  const template = kind === "pressure" ? PRESSURE_TEMPLATE_NAME : BALANCE_TEMPLATE_NAME;
  db.run("BEGIN");
  try {
    if (ex) db.run("DELETE FROM sensor_imports WHERE id = ?", [String(ex.id)]); // cascades to the old samples
    db.run(
      `INSERT INTO sensor_imports (id, astronaut_id, kind, ${col(kind)}, file_name, content_sha256, template, context_json, preview_json, imported_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, astronautId, kind, assessmentId, t.value.fileName, hash, template, JSON.stringify(t.value.context), JSON.stringify(parsed.preview), now()],
    );
    if (parsed.ok && "geometry" in parsed) {
      const g = db.prepare("INSERT INTO pressure_sensors (import_id, foot, sensor_id, area_cm2, x_mm, y_mm) VALUES (?,?,?,?,?,?)");
      const s = db.prepare("INSERT INTO pressure_samples (import_id, time_ms, foot, sensor_id, pressure_kpa) VALUES (?,?,?,?,?)");
      try {
        for (const x of parsed.geometry) g.run([id, x.foot, x.sensorId, x.areaCm2, x.xMm, x.yMm]);
        for (const r of parsed.rows) s.run([id, r.timeMs, r.foot, r.sensorId, r.pressureKpa]);
      } finally { g.free(); s.free(); }
    } else if (parsed.ok) {
      const s = db.prepare("INSERT INTO balance_samples (import_id, time_ms, ml_mm, ap_mm) VALUES (?,?,?,?)");
      try { for (const r of (parsed as { rows: BalanceRow[] }).rows) s.run([id, r.timeMs, r.mlMm, r.apMm]); } finally { s.free(); }
    }
    db.run("COMMIT");
  } catch (e) {
    try { db.run("ROLLBACK"); } catch { /* already rolled back */ }
    throw e;
  }
  return { ok: true, value: { meta: metaOf(one(db, "SELECT * FROM sensor_imports WHERE id = ?", [id]) as Row), duplicate: false, replaced: !!ex } };
}

export type ImportData =
  | { meta: ImportMeta; kind: "pressure"; geometry: SensorGeometry[]; rows: PressureRow[] }
  | { meta: ImportMeta; kind: "balance"; rows: BalanceRow[] };

/** Saved samples of one assessment's import. The astronaut in the request must own the assessment. */
export function getImportData(db: Database, kind: string, assessmentId: string, astronautId: string): ImportResult<ImportData | null> {
  if ((kind !== "pressure" && kind !== "balance") || !ID.test(assessmentId) || !ID.test(astronautId)) return fail(400, "Invalid request.");
  const table = kind === "pressure" ? "pressure_assessments" : "balance_assessments";
  const a = one(db, `SELECT astronaut_id FROM ${table} WHERE id = ?`, [assessmentId]);
  if (!a) return fail(404, "That assessment was not found.");
  if (String(a.astronaut_id) !== astronautId) return fail(403, "That assessment belongs to a different astronaut.");
  const r = one(db, `SELECT * FROM sensor_imports WHERE ${col(kind)} = ?`, [assessmentId]);
  if (!r) return { ok: true, value: null };
  const meta = metaOf(r);
  if (kind === "pressure") {
    const geometry = all(db, "SELECT foot, sensor_id, area_cm2, x_mm, y_mm FROM pressure_sensors WHERE import_id = ? ORDER BY foot, sensor_id", [meta.id])
      .map((g): SensorGeometry => ({ foot: g.foot as "left" | "right", sensorId: String(g.sensor_id), areaCm2: Number(g.area_cm2), xMm: Number(g.x_mm), yMm: Number(g.y_mm) }));
    const rows = all(db, "SELECT time_ms, foot, sensor_id, pressure_kpa FROM pressure_samples WHERE import_id = ? ORDER BY time_ms, foot, sensor_id", [meta.id])
      .map((x): PressureRow => ({ timeMs: Number(x.time_ms), foot: x.foot as "left" | "right", sensorId: String(x.sensor_id), pressureKpa: x.pressure_kpa === null ? null : Number(x.pressure_kpa) }));
    return { ok: true, value: { meta, kind: "pressure", geometry, rows } };
  }
  const rows = all(db, "SELECT time_ms, ml_mm, ap_mm FROM balance_samples WHERE import_id = ? ORDER BY time_ms", [meta.id])
    .map((x): BalanceRow => ({ timeMs: Number(x.time_ms), mlMm: x.ml_mm === null ? null : Number(x.ml_mm), apMm: x.ap_mm === null ? null : Number(x.ap_mm) }));
  return { ok: true, value: { meta, kind: "balance", rows } };
}

// Summaries are a pure function of the saved samples, and an import never changes after it is saved (a replacement gets a new id),
// so they are cached by import id. They are never written to the database: changing a calculation changes every screen at once.
const summaryCache = new Map<string, RecordedImport["summary"]>();

/** Metadata + calculated summary of every import, for the snapshot (no samples are sent to the browser here). */
export function listImports(db: Database): RecordedImport[] {
  return all(db, "SELECT * FROM sensor_imports ORDER BY imported_at, id").map((r) => {
    const meta = metaOf(r);
    let summary = summaryCache.get(meta.id);
    if (!summary) {
      if (meta.kind === "pressure") {
        const geometry = all(db, "SELECT foot, sensor_id, area_cm2, x_mm, y_mm FROM pressure_sensors WHERE import_id = ?", [meta.id])
          .map((g): SensorGeometry => ({ foot: g.foot as "left" | "right", sensorId: String(g.sensor_id), areaCm2: Number(g.area_cm2), xMm: Number(g.x_mm), yMm: Number(g.y_mm) }));
        const rows = all(db, "SELECT time_ms, foot, sensor_id, pressure_kpa FROM pressure_samples WHERE import_id = ? ORDER BY time_ms", [meta.id])
          .map((x): PressureRow => ({ timeMs: Number(x.time_ms), foot: x.foot as "left" | "right", sensorId: String(x.sensor_id), pressureKpa: x.pressure_kpa === null ? null : Number(x.pressure_kpa) }));
        summary = { kind: "pressure", session: summarizePressureRows(geometry, rows) };
      } else {
        const rows = all(db, "SELECT time_ms, ml_mm, ap_mm FROM balance_samples WHERE import_id = ? ORDER BY time_ms", [meta.id])
          .map((x): BalanceRow => ({ timeMs: Number(x.time_ms), mlMm: x.ml_mm === null ? null : Number(x.ml_mm), apMm: x.ap_mm === null ? null : Number(x.ap_mm) }));
        summary = { kind: "balance", trial: summarizeBalanceRows(rows) };
      }
      summaryCache.set(meta.id, summary);
    }
    return { ...meta, summary };
  });
}
