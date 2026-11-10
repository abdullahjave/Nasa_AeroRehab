// Clinical record notes (fictional demo data). Pure helpers, no React.

export type ClinicalRecord = {
  /** Stable ID. Seeded records keep their ID when edited, so an edit updates the same record. */
  id: string;
  title: string;
  /** ISO date yyyy-mm-dd. */
  date: string;
  text: string;
  status: string;
  seeded: boolean;
};

export type NoteDraft = { title: string; date: string; text: string };
export type NoteErrors = Partial<Record<keyof NoteDraft, string>>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function validateNote(d: NoteDraft): NoteErrors {
  const e: NoteErrors = {};
  if (!d.title.trim()) e.title = "Title is required.";
  if (!d.text.trim()) e.text = "Note text is required.";
  const ok = ISO.test(d.date) && !Number.isNaN(Date.parse(d.date + "T00:00:00Z")) && new Date(d.date + "T00:00:00Z").toISOString().slice(0, 10) === d.date;
  if (!ok) e.date = "Enter a valid date.";
  return e;
}

/** Stored edits/additions for one astronaut: recordId -> record. */
export type NoteStore = Record<string, ClinicalRecord>;

/** Seeded records with edits applied on top (same id = same record), plus added notes; newest first. */
export function mergeRecords(seed: ClinicalRecord[], stored: NoteStore): ClinicalRecord[] {
  const byId = new Map<string, ClinicalRecord>(seed.map((r) => [r.id, r]));
  for (const r of Object.values(stored)) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));
}

/** Saves a draft: updates the record with `id` (keeping its status/seeded flag) or creates a new note. */
export function saveNote(seed: ClinicalRecord[], stored: NoteStore, draft: NoteDraft, id: string | null, newId: string): NoteStore {
  const base = id ? mergeRecords(seed, stored).find((r) => r.id === id) : undefined;
  const rec: ClinicalRecord = {
    id: base?.id ?? newId,
    title: draft.title.trim(),
    date: draft.date,
    text: draft.text.trim(),
    status: base?.status ?? "Note",
    seeded: base?.seeded ?? false,
  };
  return { ...stored, [rec.id]: rec };
}
