import type { ClinicalRecord } from "./notes";
import { dayToDate } from "../rehab/records";

const iso = (day: number) => dayToDate(day).toISOString().slice(0, 10);
const rec = (code: string, slug: string, title: string, day: number, status: string, text: string): ClinicalRecord => ({
  id: `rec-${code}-${slug}`, title, date: iso(day), text, status, seeded: true,
});

/** Fictional clinical records (demo only). Dates come from mission days, so they line up with the other pages. */
export const SEED_RECORDS: Record<string, ClinicalRecord[]> = {
  "astro-chen": [
    rec("chen", "baseline", "Baseline Assessment", 3, "Completed", "Baseline knee ROM and gait recorded before the program (simulated note)."),
    rec("chen", "plan", "Rehabilitation Plan (Phase 3)", 22, "Active", "Phase 3 strength and mobility plan assigned (simulated note)."),
    rec("chen", "progress", "Progress Evaluation", 35, "Completed", "Steady gains in ROM and walking speed (simulated note)."),
    rec("chen", "clearance", "Medical Clearance", 40, "Valid", "Cleared for the current exercise plan (fictional record)."),
  ],
  "astro-okafor": [
    rec("okafor", "baseline", "Baseline Assessment", 5, "Completed", "Baseline recorded after meniscus repair (fictional record)."),
    rec("okafor", "plan", "Rehabilitation Plan (Phase 2)", 20, "Active", "Mobility phase; two rest days a week (simulated note)."),
    rec("okafor", "progress", "Progress Evaluation", 36, "Completed", "ROM below baseline, plan unchanged (simulated note)."),
  ],
  "astro-alvarez": [
    rec("alvarez", "baseline", "Baseline Assessment", 2, "Completed", "Baseline recorded after ankle sprain (fictional record)."),
    rec("alvarez", "plan", "Rehabilitation Plan (Phase 3)", 24, "Active", "Balance and strength phase (simulated note)."),
    rec("alvarez", "clearance", "Medical Clearance", 38, "Valid", "Cleared for the current plan (fictional record)."),
  ],
};
