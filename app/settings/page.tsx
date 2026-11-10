import type { Metadata } from "next";
import Settings from "@/components/settings/Settings";
import { backdropAssets } from "@/lib/backdrop-assets";
import { NAV_ITEMS } from "@/lib/nav";

export const metadata: Metadata = {
  title: NAV_ITEMS.find((n) => n.href === "/settings")!.label + " | AeroRehab",
};

export default function Page() {
  return <Settings assets={backdropAssets()} />;
}
