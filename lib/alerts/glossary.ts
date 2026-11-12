// Plain-language wording for the readings, in one place so Overview, AI Insights and the alert text say the same thing.
// Each meaning describes the metric that is actually displayed (see "shows"). Units and exact values stay in the details.

export type ReadingKey = "knee" | "walking" | "pressure" | "balance";

export type Reading = {
  /** Plain label, shown first. */
  label: string;
  /** One short sentence for a first-time reader. */
  meaning: string;
  /** Technical name, shown in the expanded details. */
  technical: string;
  /** What the app actually displays for this reading. */
  shows: string;
};

export const READINGS: Record<ReadingKey, Reading> = {
  knee: { label: "Knee movement", meaning: "How far your knee bends and straightens.", technical: "Range of motion (ROM)", shows: "peak bend minus the straightest angle in the session, in degrees" },
  walking: { label: "Walking pace", meaning: "How fast you walked.", technical: "Walking speed", shows: "average walking speed in the session, in metres per second" },
  pressure: { label: "Foot pressure", meaning: "Where your feet press down the most.", technical: "Peak pressure", shows: "highest pressure under each foot, in kilopascals (kPa)" },
  balance: { label: "Balance", meaning: "How much you moved while trying to stand still.", technical: "Postural sway", shows: "sway area and RMS sway of a single-leg stance trial, in mm² and mm" },
};

/** Second pressure reading: the left/right split. */
export const WEIGHT_SHARE = { label: "Weight sharing", meaning: "How your weight was shared between your feet.", technical: "Left/right load share (%)" };

/** Shown for readings that have no configured comparison rule. */
export const NO_RULE_NOTE = "No comparison rule is set for this reading, so no status is given.";

/** The one meaning of ROM used in alert explanations. */
export const ROM_MEANING = `${READINGS.knee.meaning} The app measures it as the ${READINGS.knee.shows}.`;
