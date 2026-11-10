import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Shell from "@/components/Shell";
import { AstronautProvider } from "@/components/AstronautProvider";
import SpaceBackdrop from "@/components/SpaceBackdrop";
import { backdropAssets } from "@/lib/backdrop-assets";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AeroRehab",
  description: "AeroRehab rehabilitation monitoring dashboard (simulated data).",
};

const { videoSrc, hasPoster } = backdropAssets();

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>
        <SpaceBackdrop hasPoster={hasPoster} videoSrc={videoSrc} />
        <AstronautProvider>
          <Shell>{children}</Shell>
        </AstronautProvider>
      </body>
    </html>
  );
}
