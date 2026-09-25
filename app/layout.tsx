import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif, Inter } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

// Three voices, each with one job: Instrument Serif for editorial
// headlines, Geist for the interface, Geist Mono for anything measured —
// timecodes, durations, the activity log.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

// Only for the caption inside the live preview — the renderer burns the same
// Inter ExtraBold into the video, so the preview has to match it exactly.
const captionFont = Inter({ variable: "--font-caption", subsets: ["latin"], weight: "800" });

export const metadata: Metadata = {
  title: { default: "Cutroom — product link in, UGC ad out", template: "%s · Cutroom" },
  description:
    "Paste a product link. Cutroom reads the page, plans one creative idea, sources real footage, a reaction GIF and music, and cuts a 7-second vertical ad you can edit layer by layer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable} ${captionFont.variable}`}>
      <body className="min-h-dvh font-sans text-ink">
        <SiteHeader />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
