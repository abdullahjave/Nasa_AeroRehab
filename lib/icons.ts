// 24x24 stroke icon paths used in panel headers.
export const ICONS = {
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  foot: "M9 3c3 0 4 3 4 6 0 2-1 3-1 5 0 3 2 4 2 6H8c-2-2-3-5-3-8 0-5 1-9 4-9z",
  balance: "M12 3v18M4 9l8-6 8 6M6 21h12",
  brain: "M12 3a4 4 0 00-4 4 4 4 0 00-3 4 4 4 0 003 4 4 4 0 008 0 4 4 0 003-4 4 4 0 00-3-4 4 4 0 00-4-4z",
  chart: "M4 20h16M7 20V10M12 20V4M17 20v-7",
  walk: "M13 4a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 20l2-6-3-3 2-5 4 3 3 1M12 14l4 6",
  user: "M12 11a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.5-7 8-7s8 3 8 7",
  chip: "M7 7h10v10H7zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4",
  load: "M12 21s-7-5-7-11a4 4 0 017-2 4 4 0 017 2c0 6-7 11-7 11z",
  check: "M5 13l4 4 10-10",
  warn: "M12 3l10 18H2zM12 10v5M12 18v.5",
  joint: "M6 4a2 2 0 100 4 2 2 0 000-4zM18 16a2 2 0 100 4 2 2 0 000-4zM7.5 7.5l9 9",
  compare: "M7 4v16M17 4v16M4 8h6M14 16h6",
  timeline: "M3 12h18M6 8v8M12 6v12M18 9v6",
} as const;
export type IconName = keyof typeof ICONS;
