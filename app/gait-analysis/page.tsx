import type { Metadata } from "next";
import GaitAnalysis from "@/components/gait/GaitAnalysis";

export const metadata: Metadata = { title: "Gait Analysis | AeroRehab" };

export default function Page() {
  return <GaitAnalysis />;
}
