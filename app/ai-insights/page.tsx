import type { Metadata } from "next";
import AIInsights from "@/components/insights/AIInsights";

export const metadata: Metadata = { title: "AI Insights | AeroRehab" };

export default function Page() {
  return <AIInsights />;
}
