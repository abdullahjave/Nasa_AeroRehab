import type { Metadata } from "next";
import JointAnalytics from "@/components/joint/JointAnalytics";

export const metadata: Metadata = { title: "Joint Analytics | AeroRehab" };

export default function Page() {
  return <JointAnalytics />;
}
