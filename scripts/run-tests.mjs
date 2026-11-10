// Minimal test runner: transpiles lib/**/*.ts (and *.test.ts) with the installed TypeScript compiler into a
// temp folder as CommonJS, then runs `node --test` on the compiled tests. No extra dependencies and no native code.
import ts from "typescript";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const libDir = path.join(root, "lib");
const out = mkdtempSync(path.join(tmpdir(), "aerorehab-tests-"));

function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

const tests = [];
for (const file of walk(libDir)) {
  const rel = path.relative(root, file);
  const dest = path.join(out, rel.replace(/\.ts$/, ".js"));
  mkdirSync(path.dirname(dest), { recursive: true });
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  writeFileSync(dest, js);
  if (file.endsWith(".test.ts")) tests.push(dest);
}
if (tests.length === 0) { console.error("no *.test.ts files found under lib/"); process.exit(1); }

const r = spawnSync(process.execPath, ["--test", ...tests], { stdio: "inherit" });
rmSync(out, { recursive: true, force: true });
process.exit(r.status ?? 1);
