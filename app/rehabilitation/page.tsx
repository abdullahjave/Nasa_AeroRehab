import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import Rehabilitation from "@/components/rehab/Rehabilitation";
import { EXERCISES } from "@/lib/rehab";

export const metadata: Metadata = { title: "Rehabilitation | AeroRehab" };

// Checked at build time so missing exercise images never cause failed browser requests.
const assets = Object.fromEntries(
  Object.keys(EXERCISES).map((id) => [id, fs.existsSync(path.join(process.cwd(), "public/images/rehab", `${id}.webp`))]),
);

export default function Page() {
  return <Rehabilitation assets={assets} />;
}
