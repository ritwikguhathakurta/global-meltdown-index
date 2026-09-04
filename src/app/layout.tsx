import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { DisclaimerBanner } from "@/components/Disclaimer";
import { BackendNotice } from "@/components/BackendNotice";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://globalmeltdownindex.net"),
  title: "Global Meltdown Index — Global Financial Early-Warning Intelligence Terminal",
  description:
    "See financial stress before it becomes a market story. Leading-indicator systemic risk intelligence for global markets and India.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-bg text-text antialiased">
        <BackendNotice />
        <Nav />
        <main className="flex-1">{children}</main>
        <DisclaimerBanner />
      </body>
    </html>
  );
}
