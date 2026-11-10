import type { Metadata } from "next";
import LoadPressure from "@/components/pressure/LoadPressure";

export const metadata: Metadata = { title: "Load & Pressure | AeroRehab" };

export default function Page() {
  return <LoadPressure />;
}
