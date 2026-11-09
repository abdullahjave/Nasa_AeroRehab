import type { Metadata } from "next";
import PagePlaceholder from "@/components/PagePlaceholder";
import { NAV_ITEMS } from "@/lib/nav";

export const metadata: Metadata = {
  title: NAV_ITEMS.find((n) => n.href === "/settings")!.label + " | AeroRehab",
};

export default function Page() {
  return <PagePlaceholder href="/settings" />;
}
