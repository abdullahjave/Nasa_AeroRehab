// npm run dev: builds the CSS once, watches for changes, and runs `next dev`.
// The watcher and the Next.js server start and stop together.
import { spawn, spawnSync } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCss, isRelevant, SCAN_DIRS, SOURCE_CSS } from "./build-css.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const log = (m) => console.log(`[css] ${m}`);

// Initial build must succeed before the server starts.
try {
  const r = await buildCss();
  log(`${r.changed ? "built" : "up to date"} (${r.bytes} bytes)`);
} catch (e) {
  console.error("[css] initial build failed:", e);
  process.exit(1);
}

// Serialized, debounced rebuilds. A change that arrives mid-build triggers one more run.
let timer = null;
let building = false;
let again = false;
async function rebuild() {
  if (building) { again = true; return; }
  building = true;
  try {
    const r = await buildCss();
    if (r.changed) log(`rebuilt (${r.bytes} bytes)`);
  } catch (e) {
    console.error("[css] rebuild failed (keeping last good CSS):", e.message ?? e);
  } finally {
    building = false;
    if (again) { again = false; schedule(); }
  }
}
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 80);
}

// Recursive watchers pick up files and folders added after startup.
const watchers = [...SCAN_DIRS, path.dirname(SOURCE_CSS)].map((dir) =>
  watch(dir, { recursive: true }, (_evt, name) => {
    if (name && isRelevant(path.join(dir, name.toString()))) schedule();
  }),
);
for (const w of watchers) w.on("error", (e) => console.error("[css] watcher error:", e.message));
log("watching app/, components/, lib/, styles/globals.src.css");

// `--css-only`: watcher without Next.js, for when a dev server is already running (npm run css:watch).
const cssOnly = process.argv.includes("--css-only");
const nextArgs = process.argv.slice(2).filter((a) => a !== "--css-only");

const nextBin = path.join(root, "node_modules/next/dist/bin/next");
const child = cssOnly ? null : spawn(process.execPath, [nextBin, "dev", ...nextArgs], { cwd: root, stdio: "inherit" });

let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  clearTimeout(timer);
  for (const w of watchers) w.close();
  if (child && child.exitCode === null) {
    // Kill only the process tree this script started.
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  process.exit(code);
}
child?.on("exit", (code) => shutdown(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) process.on(sig, () => shutdown(0));
