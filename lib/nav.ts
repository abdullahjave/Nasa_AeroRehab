export type NavItem = { label: string; href: string; icon: string; blurb: string };

// Icon values are SVG path data on a 24x24 stroke grid.
export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z", blurb: "Mission-level summary of the rehabilitation programme." },
  { label: "Joint Analytics", href: "/joint-analytics", icon: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2", blurb: "Joint angles, range of motion and symmetry." },
  { label: "Gait Analysis", href: "/gait-analysis", icon: "M14 4a1.6 1.6 0 100 3.2A1.6 1.6 0 0014 4zM12 8l-3 3 2 3-3 6M12 8l3 3 3 1M11 14l4 2 1 4", blurb: "Stride, cadence and gait-cycle breakdown." },
  { label: "Load & Pressure", href: "/load-pressure", icon: "M6 3v7M6 14v7M12 3v3M12 10v11M18 3v10M18 17v4M4 10h4M10 6h4M16 13h4", blurb: "Plantar pressure and load distribution." },
  { label: "Stability & Balance", href: "/stability-balance", icon: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 1v3M12 20v3M1 12h3M20 12h3", blurb: "Postural sway and balance control." },
  { label: "AI Insights", href: "/ai-insights", icon: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 9a3 3 0 100 6 3 3 0 000-6zM12 3v6M12 15v6M3 12h6M15 12h6", blurb: "Model-generated observations and flags." },
  { label: "Rehabilitation", href: "/rehabilitation", icon: "M5 3h14v18H5zM9 7h6M8 11h8M8 15h3M13 15h3", blurb: "Recovery plan, exercises and milestones." },
  { label: "Reports", href: "/reports", icon: "M5 21V9l5-3v15M10 21V4l9 4v13M3 21h18M13 11h3M13 15h3", blurb: "Clinical summaries and exports." },
  { label: "Patient Management", href: "/patient-management", icon: "M12 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8M12 3a9 9 0 019 9", blurb: "Crew roster and patient records." },
  { label: "Settings", href: "/settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13a7.5 7.5 0 000-2l2-1.5-2-3.5-2.3 1a7.5 7.5 0 00-1.7-1L15 3.5h-4L10.6 6a7.5 7.5 0 00-1.7 1l-2.3-1-2 3.5 2 1.5a7.5 7.5 0 000 2l-2 1.5 2 3.5 2.3-1a7.5 7.5 0 001.7 1l.4 2.5h4l.4-2.5a7.5 7.5 0 001.7-1l2.3 1 2-3.5z", blurb: "Device, display and data preferences." },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
