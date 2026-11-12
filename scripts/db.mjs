// Database CLI for the local SQLite file (Backend Phase 1).
//   npm run db:migrate   create the file if needed, apply pending migrations, seed the mission + 3 profiles (idempotent)
//   npm run db:status    show the path, applied migrations and row counts
//   npm run db:reset     delete the file, then migrate + seed again (all recorded data is lost)
// It compiles the same TypeScript the app uses (lib/db, lib/recorded) with the installed TypeScript, so there is one implementation.
import ts from "typescript";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const out = fs.mkdtempSync(path.join(os.tmpdir(), "aerorehab-db-"));

function compile(dir) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) compile(p);
    else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) {
      const dest = path.join(out, path.relative(root, p).replace(/\.ts$/, ".js"));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, ts.transpileModule(fs.readFileSync(p, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText);
    }
  }
}
compile(path.join(root, "lib")); // the repository imports from several lib folders (recorded, import, alerts, demo, ...), so compile them all

const cmd = process.argv[2] ?? "migrate";
const file = process.env.AEROREHAB_DB || path.join(root, "data", "aerorehab.sqlite");
const initSqlJs = require("sql.js");
const SQL = await initSqlJs({ locateFile: (f) => path.join(root, "node_modules", "sql.js", "dist", f) });
const { migrate, seed, snapshot } = require(path.join(out, "lib", "db", "repo.js"));

if (cmd === "reset" && fs.existsSync(file)) { fs.rmSync(file); console.log(`removed ${file}`); }
if (!["migrate", "status", "reset"].includes(cmd)) { console.error("usage: node scripts/db.mjs migrate|status|reset"); process.exit(2); }

const db = fs.existsSync(file) ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database();
db.run("PRAGMA foreign_keys = ON");
if (cmd !== "status") {
  const applied = migrate(db);
  const seeded = seed(db);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`; // same as the app: temp file + rename, so a crash cannot leave a half-written database
  fs.writeFileSync(tmp, Buffer.from(db.export()));
  fs.renameSync(tmp, file);
  console.log(`database: ${file}`);
  console.log(`migrations applied now: ${applied.length ? applied.join(", ") : "none (already up to date)"}`);
  console.log(`seeded now: ${seeded.missions} mission(s), ${seeded.astronauts} astronaut(s)`);
} else {
  console.log(`database: ${file} (${fs.existsSync(file) ? "exists" : "missing"})`);
  if (!fs.existsSync(file)) process.exit(0);
}
const versions = db.exec("SELECT version, name FROM schema_migrations ORDER BY version")[0]?.values ?? [];
console.log(`schema versions: ${versions.map((v) => `${v[0]}:${v[1]}`).join(", ")}`);
const snap = snapshot(db);
console.log(`mission: ${snap.mission.name} (start ${snap.mission.startDate}, ${snap.mission.totalDays} days, demo today = Day ${snap.mission.currentDay})`);
console.log(`astronauts: ${snap.astronauts.length} | sessions: ${snap.sessions.length} | baselines: ${snap.baselines.length}`);
fs.rmSync(out, { recursive: true, force: true });
