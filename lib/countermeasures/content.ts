// NASA Countermeasure Guide content (Rehabilitation). Short, plain-language, educational.
// EVERY statement below is tied to a NASA page that was opened and read on 2026-11-12 (see `sources`). `evidence` holds the supporting NASA wording
// (short, kept for audit and tests). Nothing here prescribes exercise type, load, intensity or duration, and nothing claims what equipment is in use
// today beyond what the dated NASA page says.

export type CountermeasureKind = "strength" | "locomotion" | "aerobic";

export type Source = {
  id: string;
  title: string;
  url: string;
  publisher: "NASA";
  /** The date NASA shows on the page (or null when the page shows none). */
  pageDate: string | null;
  /** Date this guide's author read the page. */
  retrievedOn: string;
};

export type Fact = {
  text: string;
  /** Source ids that support this statement. At least one. */
  sources: string[];
  /** Short NASA wording behind the statement (verbatim, at most 40 words). */
  evidence: string;
};

export type Countermeasure = {
  id: "ared" | "colbert" | "cevis";
  kind: CountermeasureKind;
  /** Short name shown on the card. */
  name: string;
  /** NASA's full name for it. */
  fullName: string;
  /** One-line plain description. */
  tagline: string;
  facts: Fact[];
  /** How this relates to the app's own demo plan. An app note, NOT a NASA statement. */
  appNote: string;
};

const R = "2026-11-12";

export const SOURCES: Source[] = [
  { id: "exercise", title: "Astronaut Exercise", url: "https://www.nasa.gov/missions/station/iss-research/astronaut-exercise/", publisher: "NASA", pageDate: "Article May 20, 2024; page updated Feb 3, 2025", retrievedOn: R },
  { id: "ascr", title: "Astronaut Strength, Conditioning and Rehabilitation", url: "https://www.nasa.gov/directorates/esdmd/hhp/astronaut-strength-conditioning-and-rehabilitation/", publisher: "NASA", pageDate: "Updated Aug 15, 2023", retrievedOn: R },
  { id: "t2", title: "Astronaut Luca Parmitano on Treadmill", url: "https://nasa.gov/mission_pages/station/multimedia/gallery/iss036e005384.html", publisher: "NASA", pageDate: "Jun 2, 2013", retrievedOn: R },
  { id: "ared-2006", title: "Mechanism Development, Testing, and Lessons Learned for the Advanced Resistive Exercise Device (NTRS)", url: "https://ntrs.nasa.gov/citations/20060028227", publisher: "NASA", pageDate: "May 1, 2006", retrievedOn: R },
  { id: "ared-2009", title: "Muscle Volume Increases Following 16 Weeks of Resistive Exercise Training with ARED and Free Weights (NTRS)", url: "https://ntrs.nasa.gov/citations/20090020693", publisher: "NASA", pageDate: "May 27, 2009", retrievedOn: R },
  { id: "cevis-2023", title: "Teal Cycle Ergometer Vibration Isolation and Stabilization System Human-in-the-Loop Ground Evaluation (NTRS)", url: "https://ntrs.nasa.gov/citations/20230007815", publisher: "NASA", pageDate: "2023 (ACSM poster)", retrievedOn: R },
  { id: "ochmo", title: "OCHMO-TB-031 Exercise Overview", url: "https://www.nasa.gov/ochmo-tb-031-exercise-overview-2/", publisher: "NASA", pageDate: null, retrievedOn: R },
];

export const INTRO: Fact = {
  text: "NASA prescribes exercise to astronauts to counter the effects of altered gravity and to keep crews healthy. On the space station the regular equipment is a lifting machine, a treadmill and an exercise bike.",
  sources: ["ochmo", "ascr"],
  evidence: "Exercise is prescribed to astronauts as a countermeasure to altered gravity and is vital to maintaining optimal crew health and performance.",
};

export const COUNTERMEASURES: Countermeasure[] = [
  {
    id: "ared", kind: "strength", name: "ARED", fullName: "Advanced Resistive Exercise Device",
    tagline: "A weight-lifting machine for the space station.",
    facts: [
      { text: "NASA says ARED, installed in 2008, uses a piston and flywheel system to give loading that mimics weightlifting in weightlessness.", sources: ["exercise"], evidence: "Installed in 2008, ARED uses a piston and flywheel system to provide loading that essentially mimics weightlifting in weightlessness." },
      { text: "It was designed as a multi-exercise, high-load machine for long missions, to help astronauts keep muscle strength and bone mass in microgravity.", sources: ["ared-2006"], evidence: "ARED is a multi-exercise, high-load resistive exercise device, designed for long duration, human space missions." },
      { text: "In a NASA ground study of 20 untrained volunteers over 16 weeks, muscle gains after ARED training were not different from gains after free-weight training.", sources: ["ared-2009"], evidence: "The increase in muscle volume and strength following ARED training is not different than FW training." },
    ],
    appNote: "In this app's demo plan, leg-strength movements such as the Resisted Mini Squat are the closest match. This is an app note, not a NASA statement.",
  },
  {
    id: "colbert", kind: "locomotion", name: "COLBERT (T2)", fullName: "Combined Operational Load Bearing External Resistance Treadmill",
    tagline: "A treadmill in the station's Tranquility node, also called T2.",
    facts: [
      { text: "NASA names it the Combined Operational Load Bearing External Resistance Treadmill (COLBERT), technically Treadmill 2, abbreviated T2.", sources: ["t2"], evidence: "technically named the Treadmill 2 and abbreviated as T2." },
      { text: "NASA shows astronauts running on the station's T2 treadmill, and lists T2 with ARED and CEVIS as equipment astronauts use regularly.", sources: ["exercise", "ascr"], evidence: "ESA astronaut Samantha Cristoforetti runs on the station's T2 treadmill." },
    ],
    appNote: "This demo plan has no treadmill work. Walking sessions are tracked separately under Gait Analysis. This is an app note, not a NASA statement.",
  },
  {
    id: "cevis", kind: "aerobic", name: "CEVIS", fullName: "Cycle Ergometer with Vibration Isolation and Stabilization System",
    tagline: "An exercise bike for the space station.",
    facts: [
      { text: "NASA says CEVIS was installed in 2001 and upgraded in 2023, uses friction and resistance, and is computer-controlled to keep the workload accurate.", sources: ["exercise"], evidence: "CEVIS, installed in 2001 and upgraded in 2023, uses friction and resistance and is computer-controlled to maintain an accurate workload." },
      { text: "Its display shows cycling speed, heart rate, elapsed time and exercise details, and NASA research has used it to measure VO2max, a standard measure of aerobic capacity.", sources: ["exercise"], evidence: "The system displays parameters such as cycling speed, heart rate, elapsed time, and exercise prescription details." },
      { text: "A 2023 NASA poster reported that a new model, Teal CEVIS, was to replace the onboard unit.", sources: ["cevis-2023"], evidence: "Operational since 2001, the onboard CEVIS will be replaced by a new model, known as Teal CEVIS (TC)." },
    ],
    appNote: "This demo plan has no cycling. This is an app note, not a NASA statement.",
  },
];

/** What the guide says about equipment status. It repeats the dated NASA wording and claims nothing newer. */
export const STATUS_NOTE: Fact = {
  text: "NASA's Astronaut Exercise article (May 2024, page updated Feb 2025) lists ARED, T2 and CEVIS as current equipment. This guide does not confirm what is in use today.",
  sources: ["exercise"],
  evidence: "Current equipment includes the Advanced Resistive Exercise Device (ARED) weight-lifting system",
};

export const DISCLAIMER = "Educational summary of NASA public pages. It is not a prescription: this app does not set exercise type, load, intensity or duration. Follow the plan from your crew medical team.";

export const KIND_LABEL: Record<CountermeasureKind, string> = { strength: "Strength", locomotion: "Locomotion", aerobic: "Aerobic" };

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);
