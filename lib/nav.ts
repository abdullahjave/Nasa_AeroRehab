export type NavItem = { label: string; href: string; icon: string; blurb: string };

// Icon values are SVG path data on a 24x24 stroke grid.
export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: "M3 12l9-8 9 8M5 10v10h14V10", blurb: "Mission-level summary of the rehabilitation programme." },
  { label: "Joint Analytics", href: "/joint-analytics", icon: "M6 4a2 2 0 100 4 2 2 0 000-4zM18 16a2 2 0 100 4 2 2 0 000-4zM7.5 7.5l9 9", blurb: "Joint angles, range of motion and symmetry." },
  { label: "Gait Analysis", href: "/gait-analysis", icon: "M4 20l4-8 4 4 4-10 4 6", blurb: "Stride, cadence and gait-cycle breakdown." },
  { label: "Load & Pressure", href: "/load-pressure", icon: "M4 20h16M7 20V10M12 20V4M17 20v-7", blurb: "Plantar pressure and load distribution." },
  { label: "Stability & Balance", href: "/stability-balance", icon: "M12 3v18M4 9l8-6 8 6M6 21h12", blurb: "Postural sway and balance control." },
  { label: "AI Insights", href: "/ai-insights", icon: "M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z", blurb: "Model-generated observations and flags." },
  { label: "Rehabilitation", href: "/rehabilitation", icon: "M12 21s-8-5-8-11a4.5 4.5 0 018-3 4.5 4.5 0 018 3c0 6-8 11-8 11z", blurb: "Recovery plan, exercises and milestones." },
  { label: "Reports", href: "/reports", icon: "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6", blurb: "Clinical summaries and exports." },
  { label: "Patient Management", href: "/patient-management", icon: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 8h4M19 6v4", blurb: "Crew roster and patient records." },
  { label: "Settings", href: "/settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 1-2-1-1-2h-4l-1 2-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1z", blurb: "Device, display and data preferences." },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
