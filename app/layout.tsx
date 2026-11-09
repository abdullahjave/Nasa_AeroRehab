import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import fs from "node:fs";
import path from "node:path";
import Shell from "@/components/Shell";
import { AstronautProvider } from "@/components/AstronautProvider";
import SpaceBackdrop from "@/components/SpaceBackdrop";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AeroRehab",
  description: "AeroRehab rehabilitation monitoring dashboard (simulated data).",
};

const hasPoster = fs.existsSync(path.join(process.cwd(), "public/images/space-backdrop.webp"));
const hasVideo = fs.existsSync(path.join(process.cwd(), "public/videos/space-loop.mp4"));

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>
        <SpaceBackdrop hasPoster={hasPoster} hasVideo={hasVideo} />
        <AstronautProvider>
          <Shell>{children}</Shell>
        </AstronautProvider>
      </body>
    </html>
  );
}
