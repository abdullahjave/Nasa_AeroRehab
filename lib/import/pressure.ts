import type { PressureFrame, PressureSample } from "../pressure/types";
import { IssueList, MAX_PRESSURE_FRAMES, MAX_PRESSURE_ROWS, checkHeader, columnIndex, isBlank, parseNumber, readCsv, type CsvIssue } from "./csv";
import type { ParseFailure, PressurePreview, PressureRow, SensorGeometry } from "./types";

// AeroRehab pressure CSV, one row per sensor reading:
//   time_ms,foot,sensor_id,pressure_kpa,area_cm2,x_mm,y_mm
// time_ms      elapsed milliseconds inside the assessment (>= 0). Several sensors share one timestamp = one frame.
// foot         left | right
// sensor_id    1-24 letters, digits, "_" or "-". One id belongs to one foot and always has the same area and position.
// pressure_kpa kilopascals, >= 0. 0 is a real measured zero. A BLANK cell is a missing reading (never 0).
// area_cm2     active sensing area of that sensor, > 0 and <= 100
// x_mm, y_mm   sensor centre in the foot-local frame (identical for both feet): origin at the heel centre,
//              +y toward the toes (anterior), +x toward the other foot (medial), -x lateral. Millimetres.
// Rows must be ordered by time_ms. A sensor that has no row in a frame is also treated as missing for that frame.

export const PRESSURE_COLUMNS = ["time_ms", "foot", "sensor_id", "pressure_kpa", "area_cm2", "x_mm", "y_mm"] as const;
export const PRESSURE_TEMPLATE_NAME = "AeroRehab pressure CSV v1";
export const PRESSURE_TEMPLATE_CSV = [
  PRESSURE_COLUMNS.join(","),
  "0,left,L-heel,120,6,0,25",
  "0,left,L-mt1,60,3,25,190",
  "0,right,R-heel,180,6,0,25",
  "0,right,R-mt1,90,3,25,190",
  "100,left,L-heel,130,6,0,25",
  "100,left,L-mt1,,3,25,190",
  "100,right,R-heel,170,6,0,25",
  "100,right,R-mt1,95,3,25,190",
  "",
].join("\n");

const HINTS: Record<string, string> = {
  time_s: 'Time must be in milliseconds: rename "time_s" to "time_ms" and multiply the values by 1000.',
  time: 'Use the column name "time_ms" and give elapsed time in milliseconds.',
  pressure_pa: 'Pressure must be in kilopascals: use "pressure_kpa" and divide Pa by 1000.',
  pressure_psi: 'Pressure must be in kilopascals: use "pressure_kpa" (1 psi = 6.895 kPa).',
  pressure: 'Use the column name "pressure_kpa" and give kilopascals.',
  pressure_n: 'This template takes pressure in kPa per sensor, not force. Use "pressure_kpa".',
  area_mm2: 'Area must be in square centimetres: use "area_cm2" and divide mm² by 100.',
  area_m2: 'Area must be in square centimetres: use "area_cm2".',
  x_cm: 'Positions must be in millimetres: use "x_mm" and multiply cm by 10.',
  y_cm: 'Positions must be in millimetres: use "y_mm" and multiply cm by 10.',
  x_m: 'Positions must be in millimetres: use "x_mm".',
  y_m: 'Positions must be in millimetres: use "y_mm".',
};

const MAX_TIME_MS = 3_600_000;
const MAX_KPA = 5000;
const MAX_AREA = 100;
const MAX_ABS_X = 200;
const Y_RANGE: [number, number] = [-100, 400];
const POS_EPS = 1e-6;
const SENSOR_ID = /^[A-Za-z0-9_-]{1,24}$/;

export type ParsedPressure = { ok: true; geometry: SensorGeometry[]; rows: PressureRow[]; preview: PressurePreview };

const median = (v: number[]) => {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function parsePressureCsv(text: string): ParsedPressure | ParseFailure {
  const read = readCsv(text, MAX_PRESSURE_ROWS);
  if (!read.ok) return { ok: false, issues: read.issues, hidden: 0 };
  const { header, rows: table } = read.table;
  const head = checkHeader(header, PRESSURE_COLUMNS, HINTS);
  if (head.length) return { ok: false, issues: head.slice(0, 12), hidden: Math.max(0, head.length - 12) };
  const col = columnIndex(header, PRESSURE_COLUMNS);
  const issues = new IssueList();

  const geo = new Map<string, SensorGeometry>(); // key: sensor id (one id = one foot)
  const rows: PressureRow[] = [];
  const seen = new Set<string>();
  let lastTime = -1;
  let anyValue = false;

  for (const r of table) {
    const c = r.cells;
    if (c.length !== PRESSURE_COLUMNS.length) {
      issues.add(r.line, null, `Expected ${PRESSURE_COLUMNS.length} values but found ${c.length}.`);
      continue;
    }
    let bad = false;
    const fail = (name: string, msg: string) => { issues.add(r.line, name, msg); bad = true; };

    const tRaw = c[col.time_ms];
    const t = isBlank(tRaw) ? null : parseNumber(tRaw);
    if (t === null) fail("time_ms", `time_ms "${tRaw.trim()}" is not a number (milliseconds, e.g. 1500).`);
    else if (t < 0) fail("time_ms", "time_ms cannot be negative.");
    else if (t > MAX_TIME_MS) fail("time_ms", `time_ms is above ${MAX_TIME_MS.toLocaleString("en-US")} (one hour). Is the time in microseconds?`);

    const footRaw = c[col.foot].trim().toLowerCase();
    if (footRaw !== "left" && footRaw !== "right") fail("foot", `foot must be "left" or "right", not "${c[col.foot].trim()}".`);

    const id = c[col.sensor_id].trim();
    if (!SENSOR_ID.test(id)) fail("sensor_id", `sensor_id "${id}" must be 1 to 24 letters, digits, "_" or "-".`);

    const kRaw = c[col.pressure_kpa];
    let kpa: number | null = null;
    if (!isBlank(kRaw)) {
      kpa = parseNumber(kRaw);
      if (kpa === null) fail("pressure_kpa", `pressure_kpa "${kRaw.trim()}" is not a number. Use kilopascals, or leave it blank if the sensor gave no reading.`);
      else if (kpa < 0) fail("pressure_kpa", "pressure_kpa cannot be negative.");
      else if (kpa > MAX_KPA) fail("pressure_kpa", `pressure_kpa is above ${MAX_KPA}. Check the unit (kilopascals).`);
    }

    const aRaw = c[col.area_cm2];
    const area = isBlank(aRaw) ? null : parseNumber(aRaw);
    if (area === null) fail("area_cm2", "area_cm2 is required on every row and must be a number.");
    else if (!(area > 0) || area > MAX_AREA) fail("area_cm2", `area_cm2 must be above 0 and at most ${MAX_AREA} (square centimetres).`);

    const xRaw = c[col.x_mm];
    const x = isBlank(xRaw) ? null : parseNumber(xRaw);
    if (x === null) fail("x_mm", "x_mm is required on every row and must be a number (millimetres).");
    else if (Math.abs(x) > MAX_ABS_X) fail("x_mm", `x_mm must be within ±${MAX_ABS_X} mm in the foot-local frame.`);

    const yRaw = c[col.y_mm];
    const y = isBlank(yRaw) ? null : parseNumber(yRaw);
    if (y === null) fail("y_mm", "y_mm is required on every row and must be a number (millimetres).");
    else if (y < Y_RANGE[0] || y > Y_RANGE[1]) fail("y_mm", `y_mm must be between ${Y_RANGE[0]} and ${Y_RANGE[1]} mm in the foot-local frame (0 = heel centre).`);

    if (bad || t === null || area === null || x === null || y === null) continue;
    const foot = footRaw as "left" | "right";

    if (t < lastTime) { issues.add(r.line, "time_ms", `time_ms goes backwards (${t} after ${lastTime}). Rows must be ordered by time.`); continue; }
    lastTime = t;

    const key = `${t}|${foot}|${id}`;
    if (seen.has(key)) { issues.add(r.line, null, `Duplicate reading: time_ms ${t}, ${foot} foot, sensor ${id} appears more than once.`); continue; }
    seen.add(key);

    const known = geo.get(id);
    if (known) {
      if (known.foot !== foot) issues.add(r.line, "sensor_id", `sensor_id ${id} is used for both feet. Each sensor belongs to one foot.`);
      else if (Math.abs(known.areaCm2 - area) > POS_EPS || Math.abs(known.xMm - x) > POS_EPS || Math.abs(known.yMm - y) > POS_EPS) {
        issues.add(r.line, null, `Sensor ${id} changes geometry: area ${area} cm², position (${x}, ${y}) mm, but earlier rows have ${known.areaCm2} cm² at (${known.xMm}, ${known.yMm}) mm.`);
      }
    } else geo.set(id, { foot, sensorId: id, areaCm2: area, xMm: x, yMm: y });

    if (kpa !== null) anyValue = true;
    rows.push({ timeMs: t, foot, sensorId: id, pressureKpa: kpa });
  }

  // Two sensors of one foot at the same position would hide each other in the heatmap.
  const list = [...geo.values()];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.foot === b.foot && Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm) < 0.5) issues.add(null, "sensor_id", `Sensors ${a.sensorId} and ${b.sensorId} have the same position on the ${a.foot} foot.`);
  }

  // Orientation: both feet use the same foot-local frame (+x medial). If the two feet's sensors sit on OPPOSITE sides of x = 0
  // on average, the file is almost certainly in a shared (lab) frame or mirrored, so reject instead of drawing it wrongly.
  const meanX = (f: "left" | "right") => { const s = list.filter((g) => g.foot === f); return s.length ? s.reduce((a, g) => a + g.xMm, 0) / s.length : null; };
  const mxl = meanX("left"), mxr = meanX("right");
  let orientation = "Only one foot is in the file, so the left/right orientation cannot be cross-checked. Use the foot map below to confirm that the big-toe side faces the other foot.";
  if (mxl !== null && mxr !== null) {
    if (Math.abs(mxl) > 5 && Math.abs(mxr) > 5 && Math.sign(mxl) !== Math.sign(mxr)) {
      issues.add(null, "x_mm", `The feet look mirrored or in a shared frame: the left foot's sensors average x = ${mxl.toFixed(1)} mm and the right foot's ${mxr.toFixed(1)} mm. x_mm must be foot-local for BOTH feet (+x medial, toward the other foot), so the two averages have the same sign.`);
    } else orientation = `Both feet use the same foot-local frame (mean x: left ${mxl.toFixed(1)} mm, right ${mxr.toFixed(1)} mm; same side of the midline, so left and right are consistent).`;
  }

  if (rows.length === 0 && !issues.any) issues.add(null, null, "The file has no usable readings.");
  else if (!anyValue && !issues.any) issues.add(null, "pressure_kpa", "Every pressure_kpa value is blank, so there is nothing to import.");
  const frameTimes = new Set(rows.map((r) => r.timeMs));
  if (frameTimes.size > MAX_PRESSURE_FRAMES) issues.add(null, "time_ms", `The file has ${frameTimes.size.toLocaleString("en-US")} frames; the limit is ${MAX_PRESSURE_FRAMES.toLocaleString("en-US")}.`);
  if (issues.any) return { ok: false, issues: issues.items, hidden: issues.hidden };

  const geometry = list.sort((a, b) => a.foot.localeCompare(b.foot) || a.sensorId.localeCompare(b.sensorId));
  return { ok: true, geometry, rows, preview: previewPressure(geometry, rows, orientation) };
}

/** Frames in time order with EVERY sensor of every reported foot present: a blank cell or an absent row is a "missing" sample. */
export function framesFromRows(geometry: SensorGeometry[], rows: PressureRow[]): PressureFrame[] {
  const feet = new Set(geometry.map((g) => g.foot));
  const byTime = new Map<number, Map<string, number | null>>();
  for (const r of rows) {
    let m = byTime.get(r.timeMs);
    if (!m) byTime.set(r.timeMs, (m = new Map()));
    m.set(`${r.foot}|${r.sensorId}`, r.pressureKpa);
  }
  const times = [...byTime.keys()].sort((a, b) => a - b);
  return times.map((t) => {
    const m = byTime.get(t) as Map<string, number | null>;
    const samples: PressureSample[] = [];
    for (const g of geometry) {
      if (!feet.has(g.foot)) continue;
      const k = `${g.foot}|${g.sensorId}`;
      const v = m.has(k) ? (m.get(k) as number | null) : null;
      samples.push({
        timestampMs: t, sensorId: g.sensorId, side: g.foot, pressureKpa: v, areaCm2: g.areaCm2,
        positionMm: { x: g.xMm, y: g.yMm }, status: v === null ? "missing" : "ok",
      });
    }
    return { timestampMs: t, samples };
  });
}

export function previewPressure(geometry: SensorGeometry[], rows: PressureRow[], orientation: string): PressurePreview {
  const frames = framesFromRows(geometry, rows);
  const times = frames.map((f) => f.timestampMs);
  const given = new Map<number, Set<string>>();
  let blank = 0;
  for (const r of rows) {
    let s = given.get(r.timeMs);
    if (!s) given.set(r.timeMs, (s = new Set()));
    s.add(`${r.foot}|${r.sensorId}`);
    if (r.pressureKpa === null) blank++;
  }
  let absent = 0, incomplete = 0, bilateral = 0;
  const missingFoot = { left: 0, right: 0 };
  const footCount = { left: geometry.filter((g) => g.foot === "left").length, right: geometry.filter((g) => g.foot === "right").length };
  for (const f of frames) {
    const g = given.get(f.timestampMs) as Set<string>;
    let complete = true;
    const ok = { left: footCount.left > 0, right: footCount.right > 0 };
    for (const foot of ["left", "right"] as const) {
      if (footCount[foot] === 0) continue;
      const mine = f.samples.filter((s) => s.side === foot);
      const present = mine.filter((s) => g.has(`${foot}|${s.sensorId}`)).length;
      if (present === 0) missingFoot[foot]++;
      else absent += mine.length - present;
      if (mine.some((s) => s.status === "missing")) { complete = false; ok[foot] = false; }
    }
    if (!complete) incomplete++;
    if (ok.left && ok.right) bilateral++;
  }
  const gaps = times.slice(1).map((t, i) => t - times[i]).filter((d) => d > 0);
  return {
    kind: "pressure", rowCount: rows.length, frameCount: frames.length,
    startMs: times[0] ?? 0, endMs: times[times.length - 1] ?? 0, intervalMs: median(gaps),
    sensorCount: footCount, incompleteFrames: incomplete, blankReadings: blank, absentReadings: absent,
    missingFootFrames: missingFoot, bilateralFrames: bilateral, orientation,
  };
}

export type { CsvIssue };
