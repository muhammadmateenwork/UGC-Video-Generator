import type { Metadata } from "next";
import { Karla, Unbounded } from "next/font/google";
import "./globals.css";

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

// Chunky, rounded display face for headlines and buttons — the "Neon Tape"
// direction's loud, collage-and-sticker energy needs a display face with
// real character, not a neutral system sans standing in for one.
const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

export const metadata: Metadata = {
  title: "UGC Video Generator",
  description:
    "Send a product URL, get a short UGC-style marketing video back — background, trending audio, GIF, and caption, all picked and assembled automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${karla.variable} ${unbounded.variable} h-full`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
