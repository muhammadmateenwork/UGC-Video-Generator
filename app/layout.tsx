import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";

// One confident, modern grotesque for both display and body — restrained
// on purpose after moving away from a louder, playful display face.
// Consistent weight use (medium/semibold/bold) does the differentiation
// instead of mixing families.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "UGC Video Generator",
  description:
    "Send a product URL, get a short UGC-style marketing video back — background, trending audio, GIF, and caption, all picked and assembled automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} h-full`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
