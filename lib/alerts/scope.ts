// What a status covers. The alert rules evaluate knee movement only (range of motion against a personal baseline, plus movement events and
// sensor/data checks). These readings have NO alert rule, so a status never covers them: the UI lists them as "Not assessed".
export const NOT_ASSESSED = [
  { label: "Walking pace", href: "/gait-analysis", pattern: /\b(gait|walking|walk|cadence|stride|steps?)\b/i },
  { label: "Load & pressure", href: "/load-pressure", pattern: /\b(pressure|load share|weight|insole|foot force|kpa)\b/i },
  { label: "Balance", href: "/stability-balance", pattern: /\b(balance|sway|stability|stance|centre of pressure|center of pressure)\b/i },
] as const;
