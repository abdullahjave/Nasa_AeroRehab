import type { Metadata } from "next";
import PatientManagement from "@/components/patients/PatientManagement";

export const metadata: Metadata = { title: "Patient Management | AeroRehab" };

export default function Page() {
  return <PatientManagement />;
}
