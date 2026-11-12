import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Database, SqlJsStatic } from "sql.js";
import { createBalance, createPressure, migrate, seed, snapshot } from "../db/repo";
import { getImportData, previewImport, saveImport } from "../db/imports";
import { SEED_ASTRONAUTS } from "../db/seed";
import { recordedAstronaut } from "../recorded/build";
import { effectivePeak, effectiveShares, effectiveSway, assessmentRows } from "../recorded/assessments";
import { copPath, valueOf } from "../pressure/compute";
import { BALANCE_TEMPLATE_CSV, parseBalanceCsv, samplesFromRows } from "./balance";
import { MAX_FILE_BYTES, MAX_PRESSURE_ROWS, parseNumber, readCsv } from "./csv";
import { PRESSURE_TEMPLATE_CSV, parsePressureCsv } from "./pressure";
import { analyzeBalanceRows, analyzePressureRows } from "./summary";

const fx = (n: string) => fs.readFileSync(path.join(process.cwd(), "fixtures", "sensor-csv", n), "utf8");
const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));
let SQL: SqlJsStatic;
const fresh = async (): Promise<Database> => { SQL ??= await requireFromRoot("sql.js")(); const db = new SQL.Database(); db.run("PRAGMA foreign_keys = ON"); migrate(db); seed(db); return db; };
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const count = (db: Database, table: string) => Number(db.exec(`SELECT COUNT(*) FROM ${table}`)[0].values[0][0]);

const P = { astronautId: "astro-chen", recordedAt: "2026-11-10T09:00", protocol: "quiet-standing", leftForceN: "40", rightForceN: "60" };
const B = { astronautId: "astro-chen", recordedAt: "2026-11-10T09:30", protocol: "single-leg-stance-eyes-open", trialSide: "left", durationS: "28", mlRmsMm: "3.2", apRmsMm: "4.1" };
async function withAssessments() {
  const db = await fresh();
  const p = createPressure(db, P); const b = createBalance(db, B);
  const p2 = createPressure(db, { ...P, astronautId: "astro-okafor" });
  assert.ok(p.ok && b.ok && p2.ok);
  return { db, pid: (p as { value: { id: string } }).value.id, bid: (b as { value: { id: string } }).value.id, okaforPid: (p2 as { value: { id: string } }).value.id };
}
const reqP = (pid: string, csv = fx("pressure-synthetic.csv"), extra: object = {}) => ({ kind: "pressure", astronautId: "astro-chen", assessmentId: pid, fileName: "pressure-synthetic.csv", csv, ...extra });
const reqB = (bid: string, csv = fx("balance-gap.csv"), extra: object = {}) => ({ kind: "balance", astronautId: "astro-chen", assessmentId: bid, fileName: "balance-gap.csv", csv, ...extra });

// ---------------------------------------------------------------- CSV reader
test("csv reader: BOM, CRLF, quoted values, blank lines and strict numbers", () => {
  const r = readCsv("﻿a,b\r\n\"1,5\",2\r\n\r\n3,\"x\"\"y\"\r\n", 100);
  assert.ok(r.ok);
  if (r.ok) { assert.deepEqual(r.table.header, ["a", "b"]); assert.deepEqual(r.table.rows.map((x) => x.cells), [["1,5", "2"], ["3", 'x"y']]); }
  assert.equal(parseNumber("12"), 12); assert.equal(parseNumber(" -0.5 "), -0.5); assert.equal(parseNumber("1e2"), 100);
  for (const bad of ["", "1,5", "12 kPa", "NaN", "Infinity", "0x10", "--1", "."]) assert.equal(parseNumber(bad), null, bad);
  assert.equal(readCsv('a\n"open', 10).ok, false);
  assert.equal(readCsv("", 10).ok, false);
  assert.equal(readCsv("a,b\n", 10).ok, false);
});

// ---------------------------------------------------------------- pressure
test("pressure CSV: the supplied template parses and the fixture has the documented shape", () => {
  assert.ok(parsePressureCsv(PRESSURE_TEMPLATE_CSV).ok);
  const r = parsePressureCsv(fx("pressure-synthetic.csv"));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.preview.rowCount, 18);
  assert.equal(r.preview.frameCount, 5);
  assert.equal(r.preview.startMs, 0); assert.equal(r.preview.endMs, 400); assert.equal(r.preview.intervalMs, 100);
  assert.deepEqual(r.preview.sensorCount, { left: 2, right: 2 });
  assert.equal(r.preview.blankReadings, 1);          // R-heel at t=200
  assert.equal(r.preview.absentReadings, 0);
  assert.deepEqual(r.preview.missingFootFrames, { left: 1, right: 0 }); // no left rows at t=400
  assert.equal(r.preview.incompleteFrames, 2);       // t=200 (blank) and t=400 (left foot absent)
  assert.equal(r.preview.bilateralFrames, 3);        // t=0, 100, 300
});

test("pressure: one frame with 40 N left and 60 N right gives 40% / 60%, a 20 pp difference and hand-checked CoPs", () => {
  const r = parsePressureCsv(fx("pressure-synthetic.csv"));
  assert.ok(r.ok);
  if (!r.ok) return;
  const { analyses, session } = analyzePressureRows(r.geometry, r.rows);
  const f0 = analyses[0];
  near(valueOf(f0.left.forceN) as number, 40); near(valueOf(f0.right.forceN) as number, 60);   // kPa x cm2 x 0.1
  const sh = valueOf(f0.shares) as { leftPct: number; rightPct: number };
  near(sh.leftPct, 40); near(sh.rightPct, 60); near(valueOf(f0.differencePp) as number, 20);
  const cl = valueOf(f0.left.copMm) as { x: number; y: number }; near(cl.x, 5); near(cl.y, 65);            // (30*0+10*20)/40, (30*25+10*185)/40
  const cr = valueOf(f0.right.copMm) as { x: number; y: number }; near(cr.x, 20 / 3); near(cr.y, 235 / 3);  // (20*20)/60, (40*25+20*185)/60
  // Frames change what is drawn: CoP moves between frames.
  const c1 = valueOf(analyses[1].left.copMm) as { x: number; y: number }; near(c1.x, 10); near(c1.y, 105);
  assert.notEqual(c1.y, cl.y);
  // Frame 2: blank right heel -> right foot unavailable, so NO share (a missing foot is never read as 100% on the other side).
  assert.equal(analyses[2].right.state, "missing-sensor");
  assert.equal(analyses[2].shares.kind, "unavailable");
  assert.equal(analyses[2].left.state, "ok");
  // Frame 3: a measured zero is a real value (the foot is still valid), not missing.
  assert.equal(analyses[3].left.state, "ok"); near(valueOf(analyses[3].left.forceN) as number, 40);
  const z = analyses[3].left.sensors.find((s) => s.sensorId === "L-fore"); assert.equal(z?.pressureKpa, 0);
  // Frame 4: no left rows at all -> missing foot; right still reports.
  assert.equal(analyses[4].left.state, "missing-foot"); assert.equal(analyses[4].right.state, "ok");
  assert.equal(analyses[4].shares.kind, "unavailable");
  // Session: only frames where both feet are complete (t=0,100,300) enter the mean share: L 130 N, R 170 N.
  assert.equal(session.completeFrames, 3);
  const m = valueOf(session.meanShares) as { leftPct: number; rightPct: number }; near(m.leftPct, (130 / 300) * 100); near(m.rightPct, (170 / 300) * 100);
  near(valueOf(session.peakKpa.overall) as number, 40);
  // The per-foot CoP trace does not bridge the frame without a left CoP (t=400) and uses foot-local coordinates only.
  const path = copPath(analyses, "left", 0, 400); assert.equal(path.kind, "value");
  if (path.kind === "value") assert.equal(path.value.points.length, 4); // t=0,100,200,300
});

test("pressure validation: header, units, values, duplicates, geometry, ordering, orientation", () => {
  const T = "time_ms,foot,sensor_id,pressure_kpa,area_cm2,x_mm,y_mm";
  const bad = (csv: string) => { const r = parsePressureCsv(csv); assert.equal(r.ok, false); return r.ok ? [] : r.issues; };
  const msg = (csv: string) => bad(csv).map((i) => `${i.line ?? "-"}:${i.column ?? "-"}:${i.message}`).join(" | ");
  assert.match(msg("time_s,foot,sensor_id,pressure_kpa,area_cm2,x_mm,y_mm\n0,left,A,1,1,0,0\n"), /milliseconds/);
  assert.match(msg("time_ms,foot,sensor_id,pressure_psi,area_cm2,x_mm,y_mm\n0,left,A,1,1,0,0\n"), /kilopascals/);
  assert.match(msg("time_ms,foot,sensor_id,pressure_kpa,area_mm2,x_mm,y_mm\n0,left,A,1,1,0,0\n"), /square centimetres/);
  assert.match(msg("time_ms,foot,sensor_id,pressure_kpa,area_cm2,x_cm,y_mm\n0,left,A,1,1,0,0\n"), /millimetres/);
  assert.match(msg("time_ms,foot,sensor_id,pressure_kpa\n0,left,A,1\n"), /Missing required column "area_cm2"/);
  assert.match(msg(`${T}\n0,left,A,abc,1,0,0\n`), /pressure_kpa.*not a number/);
  assert.match(msg(`${T}\n0,left,A,-3,1,0,0\n`), /cannot be negative/);
  assert.match(msg(`${T}\n0,left,A,9999,1,0,0\n`), /above 5000/);
  assert.match(msg(`${T}\n0,center,A,1,1,0,0\n`), /"left" or "right"/);
  assert.match(msg(`${T}\n0,left,A,1,0,0,0\n`), /area_cm2 must be above 0/);
  assert.match(msg(`${T}\n0,left,A,1,1,999,0\n`), /within ±200/);
  assert.match(msg(`${T}\n0,left,A B,1,1,0,0\n`), /sensor_id/);
  assert.match(msg(`${T}\n0,left,A,1,1,0\n`), /Expected 7 values but found 6/);
  assert.match(msg(`${T}\n100,left,A,1,1,0,0\n50,left,A,1,1,0,0\n`), /goes backwards/);
  assert.match(msg(`${T}\n0,left,A,1,1,0,0\n0,left,A,2,1,0,0\n`), /Duplicate reading/);
  assert.match(msg(`${T}\n0,left,A,1,1,0,0\n100,left,A,1,2,0,0\n`), /changes geometry/);
  assert.match(msg(`${T}\n0,left,A,1,1,0,0\n0,right,A,1,1,0,0\n`), /both feet/);
  assert.match(msg(`${T}\n0,left,A,1,1,10,50\n0,left,B,1,1,10,50\n`), /same position/);
  assert.match(msg(`${T}\n0,left,A,,1,0,0\n`), /every pressure_kpa value is blank/i);
  // Orientation: the feet average on opposite sides of x = 0, i.e. a mirrored / shared-frame export.
  assert.match(msg(`${T}\n0,left,L1,5,1,30,50\n0,right,R1,5,1,-30,50\n`), /mirrored or in a shared frame/);
  // Same sign on both feet is accepted; errors carry line numbers.
  assert.ok(parsePressureCsv(`${T}\n0,left,L1,5,1,30,50\n0,right,R1,5,1,30,50\n`).ok);
  assert.equal(bad(`${T}\n0,left,A,-1,1,0,0\n`)[0].line, 2);
});

test("pressure limits: file size and row count are rejected before parsing", () => {
  const big = "time_ms,foot,sensor_id,pressure_kpa,area_cm2,x_mm,y_mm\n" + "0,left,A,1,1,0,0\n".repeat(Math.ceil(MAX_FILE_BYTES / 17) + 10);
  const r = parsePressureCsv(big);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.issues[0].message, /larger than 2 MB/);
  const rows = "time_ms,foot,sensor_id,pressure_kpa,area_cm2,x_mm,y_mm\n" + "0,left,A,1,1,0,0\n".repeat(MAX_PRESSURE_ROWS + 1);
  assert.ok(rows.length < MAX_FILE_BYTES);
  const r2 = parsePressureCsv(rows);
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.match(r2.issues[0].message, /more than 60,000 data rows/);
});

test("pressure: a sensor with no row in a frame is missing (absent), kept explicit", () => {
  const T = "time_ms,foot,sensor_id,pressure_kpa,area_cm2,x_mm,y_mm";
  const r = parsePressureCsv(`${T}\n0,left,A,5,1,10,50\n0,left,B,5,1,10,100\n100,left,A,5,1,10,50\n`);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.preview.absentReadings, 1); assert.equal(r.preview.incompleteFrames, 1);
  const { analyses } = analyzePressureRows(r.geometry, r.rows);
  assert.equal(analyses[1].left.state, "missing-sensor");
});

// ---------------------------------------------------------------- balance
test("balance: a 3 x 4 mm square gives path 14 mm and the hand-checked RMS values", () => {
  assert.ok(parseBalanceCsv(BALANCE_TEMPLATE_CSV).ok);
  const r = parseBalanceCsv(fx("balance-square.csv"));
  assert.ok(r.ok);
  if (!r.ok) return;
  const { summary } = analyzeBalanceRows(r.rows);
  assert.equal(summary.pathLengthMm.kind, "value");
  near(valueOf(summary.pathLengthMm as never) as number, 14);
  near(valueOf(summary.rmsMlMm as never) as number, Math.sqrt(10.8 / 5)); // ML 0,3,3,0,0 about its mean 1.2
  near(valueOf(summary.rmsApMm as never) as number, Math.sqrt(19.2 / 5)); // AP 0,0,4,4,0 about its mean 1.6
  near(r.preview.observedDurationS, 0.4);
  assert.equal(r.preview.coverage, 1);
});

test("balance: a missing interval breaks the path (66 mm in three runs, never bridged) and states its coverage", () => {
  const r = parseBalanceCsv(fx("balance-gap.csv"));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.preview.rowCount, 23);
  assert.equal(r.preview.skippedSlots, 2);
  assert.equal(r.preview.validSamples, 22); assert.equal(r.preview.missingSamples, 3);
  near(r.preview.coverage, 22 / 25);
  assert.equal(r.preview.intervalMs, 100);
  assert.deepEqual(r.preview.gaps, [{ fromS: 0.4, toS: 0.6 }, { fromS: 1.1, toS: 1.4 }]);
  const { summary, samples } = analyzeBalanceRows(r.rows);
  assert.equal(samples.length, 25);
  near(valueOf(summary.pathLengthMm as never) as number, 14 + 17 + 35);
  assert.equal(summary.partial, true);
  assert.equal(summary.ellipse.kind, "value");
});

test("balance: low coverage reports Unavailable instead of inventing statistics", () => {
  const rows = ["time_ms,ml_mm,ap_mm", "0,0,0", "100,1,1", "200,2,0", "1000,0,3", "1100,1,2"].join("\n");
  const r = parseBalanceCsv(rows);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok(r.preview.coverage < 0.8);
  const { summary } = analyzeBalanceRows(r.rows);
  assert.equal(summary.pathLengthMm.kind, "unavailable");
  assert.equal(samplesFromRows(r.rows).samples.filter((s) => s.status === "missing").length, 7);
});

test("balance validation: unique increasing time, finite pairs, units, limits", () => {
  const T = "time_ms,ml_mm,ap_mm";
  const msg = (csv: string) => { const r = parseBalanceCsv(csv); assert.equal(r.ok, false); return r.ok ? "" : r.issues.map((i) => `${i.line ?? "-"}:${i.message}`).join(" | "); };
  assert.match(msg(`${T}\n0,0,0\n0,1,1\n`), /Duplicate timestamp/);
  assert.match(msg(`${T}\n100,0,0\n50,1,1\n`), /goes backwards/);
  assert.match(msg(`${T}\n0,1,\n100,1,1\n`), /both have a value, or both be blank/);
  assert.match(msg(`${T}\n0,abc,1\n100,1,1\n`), /ml_mm "abc" is not a number/);
  assert.match(msg(`${T}\n0,NaN,1\n100,1,1\n`), /not a number/);
  assert.match(msg(`${T}\n0,9999,1\n100,1,1\n`), /within ±500/);
  assert.match(msg(`${T}\n0,,\n100,,\n`), /every sample is blank|nothing to import/i);
  assert.match(msg(`${T}\n0,1,1\n`), /at least two samples/);
  assert.match(msg("time_s,ml_mm,ap_mm\n0,1,1\n"), /milliseconds/);
  assert.match(msg("time_ms,ml_cm,ap_mm\n0,1,1\n"), /millimetres/);
  assert.match(msg("time_ms,x_mm,y_mm\n0,1,1\n"), /Use "ml_mm"|Missing required column "ml_mm"/);
  assert.match(msg("time_ms,ml_mm\n0,1\n"), /Missing required column "ap_mm"/);
});

// ---------------------------------------------------------------- database
test("migration 4 adds only new tables; manual fields are untouched by an import", async () => {
  const { db, pid } = await withAssessments();
  const before = JSON.stringify(snapshot(db).pressureAssessments.map((x) => ({ ...x, updatedAt: "" })));
  const r = saveImport(db, reqP(pid));
  assert.ok(r.ok);
  const after = JSON.stringify(snapshot(db).pressureAssessments.map((x) => ({ ...x, updatedAt: "" })));
  assert.equal(before, after);
  const a = recordedAstronaut(SEED_ASTRONAUTS[0], snapshot(db));
  const x = a.pressure?.[0];
  assert.equal(x?.leftForceN, 40);                // manual value preserved
  assert.equal(x?.csvImport?.fileName, "pressure-synthetic.csv");
});

test("saving a pressure CSV stores every row and geometry in one go, and the import reopens identically", async () => {
  const { db, pid } = await withAssessments();
  const r = saveImport(db, reqP(pid));
  assert.ok(r.ok && !r.value.duplicate && !r.value.replaced);
  assert.equal(count(db, "sensor_imports"), 1); assert.equal(count(db, "pressure_samples"), 18); assert.equal(count(db, "pressure_sensors"), 4);
  const d = getImportData(db, "pressure", pid, "astro-chen");
  assert.ok(d.ok && d.value && d.value.kind === "pressure");
  if (d.ok && d.value && d.value.kind === "pressure") {
    assert.equal(d.value.rows.length, 18); assert.equal(d.value.geometry.length, 4);
    assert.equal(d.value.rows.find((x) => x.timeMs === 200 && x.sensorId === "R-heel")?.pressureKpa, null);      // blank stays null
    assert.equal(d.value.rows.find((x) => x.timeMs === 300 && x.sensorId === "L-fore")?.pressureKpa, 0);         // zero stays 0
    const { session } = analyzePressureRows(d.value.geometry, d.value.rows);
    near((valueOf(session.meanShares) as { leftPct: number }).leftPct, (130 / 300) * 100);
  }
});

test("rejected imports write no rows: malformed file, wrong owner, bad ids, oversize", async () => {
  const { db, pid, bid, okaforPid } = await withAssessments();
  const empty = () => assert.deepEqual([count(db, "sensor_imports"), count(db, "pressure_samples"), count(db, "pressure_sensors"), count(db, "balance_samples")], [0, 0, 0, 0]);
  const bad = saveImport(db, reqP(pid, "time_ms,foot\n0,left\n"));
  assert.ok(!bad.ok && bad.status === 422 && (bad.issues?.length ?? 0) > 0); empty();
  // One bad row in the middle of an otherwise good file still imports nothing.
  const lines = fx("pressure-synthetic.csv").trim().split("\n"); lines[10] = "200,left,L-heel,-5,10,0,25";
  const half = saveImport(db, reqP(pid, lines.join("\n") + "\n"));
  assert.ok(!half.ok && half.status === 422); empty();
  // Another astronaut's assessment (Okafor's) cannot be written through Chen: 403, nothing saved, nothing parsed.
  const wrong = saveImport(db, reqP(okaforPid)); assert.ok(!wrong.ok && wrong.status === 403); empty();
  const wrongPrev = previewImport(db, reqP(okaforPid)); assert.ok(!wrongPrev.ok && wrongPrev.status === 403);
  // Kind mismatch: a balance id used as a pressure assessment is "not found".
  const nf = saveImport(db, reqP(bid)); assert.ok(!nf.ok && nf.status === 404); empty();
  assert.ok(!saveImport(db, { ...reqP(pid), assessmentId: "x y" }).ok); empty();
  assert.ok(!saveImport(db, { ...reqP(pid), kind: "gait" }).ok); empty();
  assert.ok(!saveImport(db, { ...reqP(pid), csv: 5 }).ok); empty();
  const big = saveImport(db, reqP(pid, "a".repeat(MAX_FILE_BYTES + 5))); assert.ok(!big.ok && big.status === 413); empty();
  assert.equal(count(db, "pressure_assessments"), 2);
});

test("duplicate submit is a no-op; a different file needs explicit replace, which is atomic", async () => {
  const { db, pid } = await withAssessments();
  const a = saveImport(db, reqP(pid)); assert.ok(a.ok);
  const again = saveImport(db, reqP(pid)); assert.ok(again.ok && again.value.duplicate);
  assert.equal(count(db, "sensor_imports"), 1); assert.equal(count(db, "pressure_samples"), 18);
  const other = fx("pressure-synthetic.csv").replace(/^0,left,L-heel,30,/m, "0,left,L-heel,31,");
  const noReplace = saveImport(db, reqP(pid, other)); assert.ok(!noReplace.ok && noReplace.status === 409);
  assert.equal(count(db, "pressure_samples"), 18);
  const pre = previewImport(db, reqP(pid, other)); assert.ok(pre.ok && pre.value.existing && !pre.value.existing.sameFile);
  // A replacement that is invalid leaves the old import exactly as it was.
  const badReplace = saveImport(db, reqP(pid, "time_ms,foot\n", { replace: true })); assert.ok(!badReplace.ok);
  assert.equal(count(db, "sensor_imports"), 1); assert.equal(count(db, "pressure_samples"), 18);
  const rep = saveImport(db, reqP(pid, other, { replace: true }));
  assert.ok(rep.ok && rep.value.replaced && !rep.value.duplicate);
  assert.equal(count(db, "sensor_imports"), 1); assert.equal(count(db, "pressure_samples"), 18);   // old rows gone, new rows in
  const d = getImportData(db, "pressure", pid, "astro-chen");
  assert.ok(d.ok && d.value && d.value.kind === "pressure" && d.value.rows.find((x) => x.timeMs === 0 && x.sensorId === "L-heel")?.pressureKpa === 31);
});

test("balance import: attaches to the selected trial, keeps its side and protocol, manual fields and the observed duration stay separate", async () => {
  const { db, bid } = await withAssessments();
  const r = saveImport(db, reqB(bid)); assert.ok(r.ok);
  assert.equal(count(db, "balance_samples"), 23);
  if (r.ok) { assert.equal(r.value.meta.context.side, "left"); assert.equal(r.value.meta.context.protocol, "single-leg-stance-eyes-open"); }
  const a = recordedAstronaut(SEED_ASTRONAUTS[0], snapshot(db));
  const x = a.balance?.[0]; assert.ok(x);
  assert.equal(x?.durationS, 28);                                  // manual duration kept
  assert.equal(x?.csvImport?.preview.kind === "balance" && x.csvImport.preview.observedDurationS, 2.4); // observed in the file, labelled separately
  const d = getImportData(db, "balance", bid, "astro-chen"); assert.ok(d.ok && d.value);
  assert.ok(!getImportData(db, "balance", bid, "astro-okafor").ok);   // isolation
  assert.ok(!getImportData(db, "balance", bid, "astro-alvarez").ok);
});

test("summary rule: manual values win; CSV values fill blanks and are labelled; reports carry the origin", async () => {
  const { db, pid, bid } = await withAssessments();
  // A pressure assessment with only a manual peak (no forces) + CSV; a balance trial with manual ML only + CSV.
  const p2 = createPressure(db, { ...P, recordedAt: "2026-11-10T10:00", leftForceN: "", rightForceN: "", leftPeakKpa: "77", rightPeakKpa: "" }); assert.ok(p2.ok);
  const p2id = (p2 as { value: { id: string } }).value.id;
  const b2 = createBalance(db, { ...B, recordedAt: "2026-11-10T10:30", mlRmsMm: "9", apRmsMm: "" }); assert.ok(b2.ok);
  const b2id = (b2 as { value: { id: string } }).value.id;
  assert.ok(saveImport(db, reqP(pid)).ok); assert.ok(saveImport(db, reqP(p2id)).ok);
  assert.ok(saveImport(db, reqB(bid)).ok); assert.ok(saveImport(db, reqB(b2id)).ok);
  const a = recordedAstronaut(SEED_ASTRONAUTS[0], snapshot(db));
  const [px1, px2] = a.pressure ?? []; const [bx1, bx2] = a.balance ?? [];
  // Manual forces entered: manual shares (40/60), regardless of the CSV.
  assert.equal(effectiveShares(px1).origin, "manual");
  // No manual forces: the CSV session mean is used and labelled.
  const e2 = effectiveShares(px2); assert.equal(e2.origin, "csv"); assert.ok(e2.shares.kind === "value");
  assert.deepEqual(effectivePeak(px2, "left"), { value: 77, origin: "manual" });    // typed peak is never replaced
  assert.equal(effectivePeak(px2, "right").origin, "csv");
  assert.equal(effectivePeak(px2, "right").value, 40);
  assert.deepEqual(effectiveSway(bx2, "ml"), { value: 9, origin: "manual" });
  assert.equal(effectiveSway(bx2, "ap").origin, "csv");
  assert.equal(effectiveSway(bx1, "ml").origin, "manual");
  const rows = assessmentRows(a, { start: 1, end: 42 });
  const left = rows.find((r) => r.key === "leftShare");
  assert.deepEqual(left?.points.map((p) => p.origin).sort(), ["csv", "manual"]);
  assert.equal(rows.find((r) => r.key === "ap")?.points.find((p) => p.id === bx2.id)?.origin, "csv");
});

test("two astronauts stay isolated: each sees only their own import", async () => {
  const { db, pid, okaforPid } = await withAssessments();
  assert.ok(saveImport(db, reqP(pid)).ok);
  assert.ok(saveImport(db, { ...reqP(okaforPid), astronautId: "astro-okafor", fileName: "o.csv" }).ok);
  const snap = snapshot(db);
  const chen = recordedAstronaut(SEED_ASTRONAUTS[0], snap), okafor = recordedAstronaut(SEED_ASTRONAUTS[1], snap), alvarez = recordedAstronaut(SEED_ASTRONAUTS[2], snap);
  assert.equal(chen.pressure?.[0].csvImport?.fileName, "pressure-synthetic.csv");
  assert.equal(okafor.pressure?.[0].csvImport?.fileName, "o.csv");
  assert.equal(alvarez.pressure?.length, 0);
  assert.equal(chen.pressure?.[0].csvImport?.astronautId, "astro-chen");
});

test("deleting an astronaut's assessment (cascade) removes its samples", async () => {
  const { db, pid } = await withAssessments();
  assert.ok(saveImport(db, reqP(pid)).ok);
  db.run("DELETE FROM pressure_assessments WHERE id = ?", [pid]);
  assert.deepEqual([count(db, "sensor_imports"), count(db, "pressure_samples"), count(db, "pressure_sensors")], [0, 0, 0]);
});

test("default database never contains import samples (they exist only after an explicit import)", async () => {
  const db = await fresh();
  assert.deepEqual([count(db, "sensor_imports"), count(db, "pressure_samples"), count(db, "balance_samples")], [0, 0, 0]);
  assert.equal(snapshot(db).sensorImports.length, 0);
});
