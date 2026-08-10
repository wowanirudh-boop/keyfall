import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Keyfall — Piano practice in flow",
  description: "An interactive falling-note piano practice player for learning at your own pace.",
  openGraph: {
    title: "Keyfall — Piano practice in flow",
    description: "See the music. Feel the timing.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Keyfall falling-note piano practice player" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Keyfall — Piano practice in flow",
    description: "See the music. Feel the timing.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={geist.variable}>{children}</body>
    </html>
  );
}
