import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import StabilityBalance from "@/components/balance/StabilityBalance";

export const metadata: Metadata = { title: "Stability & Balance | AeroRehab" };

export default function Page() {
  // Checked when the page renders (build time in production) so a missing artwork file never causes a failed request.
  const hasBalanceArt = fs.existsSync(path.join(process.cwd(), "public/images/astronaut-balance.webp"));
  return <StabilityBalance hasBalanceArt={hasBalanceArt} />;
}
