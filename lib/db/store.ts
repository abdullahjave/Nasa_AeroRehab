import "server-only";
import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { migrate, seed } from "./repo";

// Server-only access to the local SQLite file. sql.js is SQLite compiled to WebAssembly: no native build step, and it keeps
// the database in memory, so every successful write is saved back to the file (temp file + rename, so a crash cannot leave a
// half-written database). If another process (for example a second server) changed the file, it is reloaded first.
// This is a single-user local prototype. Add authentication and per-astronaut access control before any shared use.

export const DEFAULT_DB_PATH = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "aerorehab.sqlite");
export const dbPath = () => process.env.AEROREHAB_DB || DEFAULT_DB_PATH;

type Cache = { SQL?: Promise<SqlJsStatic>; db?: Database; file?: string; mtime?: number };
const g = globalThis as unknown as { __aerorehabDb?: Cache };
const cache: Cache = (g.__aerorehabDb ??= {});

function sql(): Promise<SqlJsStatic> {
  return (cache.SQL ??= initSqlJs({ locateFile: (f) => path.join(/* turbopackIgnore: true */ process.cwd(), "node_modules", "sql.js", "dist", f) }));
}

async function open(): Promise<Database> {
  const file = dbPath();
  const mtime = fs.existsSync(file) ? fs.statSync(file).mtimeMs : -1;
  if (cache.db && cache.file === file && cache.mtime === mtime) return cache.db;
  const SQL = await sql();
  cache.db?.close();
  const db = mtime >= 0 ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  const applied = migrate(db);
  const seeded = seed(db);
  cache.db = db; cache.file = file; cache.mtime = mtime;
  if (mtime < 0 || applied.length || seeded.astronauts || seeded.missions) persist(db, file);
  return db;
}

function persist(db: Database, file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(db.export()));
  fs.renameSync(tmp, file);
  cache.mtime = fs.statSync(file).mtimeMs;
  db.run("PRAGMA foreign_keys = ON"); // export() resets connection settings
}

/** Runs a read. */
export async function readDb<T>(fn: (db: Database) => T): Promise<T> {
  return fn(await open());
}

/** Runs a write and saves the file. If the callback throws or reports failure, the in-memory copy is reloaded from disk. */
export async function writeDb<T>(fn: (db: Database) => T, ok: (r: T) => boolean = () => true): Promise<T> {
  const db = await open();
  try {
    const r = fn(db);
    if (ok(r)) persist(db, dbPath());
    return r;
  } catch (e) {
    cache.mtime = undefined; // force a reload from the last saved file
    throw e;
  }
}
