import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Database, SqlJsStatic } from "sql.js";
import { createBalance, createPressure, createSession, createWalking, migrate, seed, snapshot } from "../db/repo";
import { saveImport } from "../db/imports";
import { SEED_ASTRONAUTS } from "../db/seed";
import { recordedAstronaut } from "../recorded/build";
import { reportAssessments } from "../recorded/assessments";
import { buildReport, latestRecordDay, visibleMetrics } from "./records";

const fx = (n: string) => fs.readFileSync(path.join(process.cwd(), "fixtures", "sensor-csv", n), "utf8");
const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));
let SQL: SqlJsStatic;
const fresh = async (): Promise<Database> => { SQL ??= await requireFromRoot("sql.js")(); const db = new SQL.Database(); db.run("PRAGMA foreign_keys = ON"); migrate(db); seed(db); return db; };
const chen = (db: Database) => recordedAstronaut(SEED_ASTRONAUTS[0], snapshot(db));
const ok = <T,>(r: { ok: boolean; value?: T }) => { assert.ok(r.ok); return (r as { value: T }).value; };
const full = { start: 1, end: 42 };
const scope = { kind: "history", range: full } as const;

const P = { astronautId: "astro-chen", recordedAt: "2026-11-10T09:00", protocol: "quiet-standing", leftForceN: "", rightForceN: "" };
const B = { astronautId: "astro-chen", recordedAt: "2026-11-10T09:30", protocol: "single-leg-stance-eyes-open", trialSide: "left", durationS: "28", mlRmsMm: "", apRmsMm: "" };
const K = { astronautId: "astro-chen", recordedAt: "2026-11-10T08:00", activity: "Knee mobility", side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", minAngleDeg: "4", maxAngleDeg: "120", torqueNm: "55" };
const W = { astronautId: "astro-chen", recordedAt: "2026-11-10T10:00", distanceM: "400", durationS: "300", steps: "500" };

test("reports: no records at all is an empty scope, not a knee-session error", async () => {
  const a = chen(await fresh());
  const r = buildReport(a, scope);
  assert.equal(r.hasData, false);
  assert.equal(latestRecordDay(a), null);
  assert.deepEqual(visibleMetrics(r, true), []);
});

test("reports: an imported pressure assessment alone makes the report eligible, with the CSV values and source", async () => {
  const db = await fresh();
  const p = ok(createPressure(db, { ...P, leftPeakKpa: "77" }));
  assert.ok(saveImport(db, { kind: "pressure", astronautId: "astro-chen", assessmentId: p.id, fileName: "pressure-synthetic.csv", csv: fx("pressure-synthetic.csv") }).ok);
  const a = chen(db);
  const r = buildReport(a, scope);
  assert.equal(r.hasData, true);
  assert.equal(r.pressure.length, 1); assert.equal(r.balance.length, 0); assert.equal(r.kneeCount, 0); assert.equal(r.walkingCount, 0);
  assert.deepEqual(visibleMetrics(r, true), []);           // no knee/walking sections invented
  assert.equal(latestRecordDay(a), 42);
  const { pressure, balance } = reportAssessments(a, r.range);
  assert.equal(balance.length, 0);
  const x = pressure[0];
  assert.equal(x.csvFile, "pressure-synthetic.csv");
  const v = (l: string) => x.values.find((q) => q.label === l)!;
  assert.equal(v("Left load share").text, "43.3 %"); assert.equal(v("Left load share").origin, "csv");   // 130 N / 300 N over complete frames
  assert.equal(v("Right load share").text, "56.7 %");
  assert.equal(v("Left peak pressure").text, "77.0 kPa"); assert.equal(v("Left peak pressure").origin, "manual"); // typed value kept
  assert.equal(v("Right peak pressure").text, "40.0 kPa"); assert.equal(v("Right peak pressure").origin, "csv");
  assert.equal(v("Left force").text, "not available");
});

test("reports: date filter keeps only records in the range; an out-of-range scope is empty", async () => {
  const db = await fresh();
  ok(createPressure(db, { ...P, leftPeakKpa: "50" }));
  const a = chen(db);
  assert.equal(buildReport(a, { kind: "history", range: { start: 1, end: 41 } }).hasData, false);
  assert.equal(buildReport(a, { kind: "history", range: { start: 42, end: 42 } }).hasData, true);
  assert.equal(reportAssessments(a, { start: 1, end: 41 }).pressure.length, 0);
});

test("reports: walking-only, balance-only and knee-only each populate only their own sections", async () => {
  let db = await fresh();
  ok(createWalking(db, W));
  let r = buildReport(chen(db), scope);
  assert.equal(r.hasData, true); assert.equal(r.walkingCount, 1); assert.equal(r.kneeCount, 0); assert.equal(r.pressure.length + r.balance.length, 0);
  assert.deepEqual(visibleMetrics(r, true), ["speedMs", "cadenceSpm"]);

  db = await fresh();
  const b = ok(createBalance(db, { ...B, mlRmsMm: "3.2" }));
  assert.ok(saveImport(db, { kind: "balance", astronautId: "astro-chen", assessmentId: b.id, fileName: "balance-gap.csv", csv: fx("balance-gap.csv") }).ok);
  const ab = chen(db);
  r = buildReport(ab, scope);
  assert.equal(r.hasData, true); assert.equal(r.balance.length, 1); assert.equal(r.cur.length, 0);
  assert.deepEqual(visibleMetrics(r, true), []);
  const item = reportAssessments(ab, r.range).balance[0];
  const bv = (l: string) => item.values.find((q) => q.label === l)!;
  assert.deepEqual([bv("ML sway RMS").text, bv("ML sway RMS").origin], ["3.2 mm", "manual"]);   // manual wins
  assert.deepEqual([bv("AP sway RMS").text, bv("AP sway RMS").origin], ["2.0 mm", "csv"]);       // blank filled from CSV
  assert.equal(bv("Path length").text, "66.0 mm");
  assert.equal(bv("Duration (entered by hand)").text, "28.0 s"); assert.equal(bv("Duration observed in CSV").text, "2.4 s");

  db = await fresh();
  ok(createSession(db, K));
  r = buildReport(chen(db), scope);
  assert.equal(r.hasData, true); assert.equal(r.kneeCount, 1); assert.equal(r.pressure.length + r.balance.length, 0);
  assert.deepEqual(visibleMetrics(r, true), ["romDeg"]);
});

test("reports: demo mode keeps all four metric rows", async () => {
  const a = chen(await fresh());
  const r = buildReport(a, scope);
  assert.equal(visibleMetrics(r, false).length, 4);
});
