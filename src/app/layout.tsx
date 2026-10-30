import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { DisclaimerBanner } from "@/components/Disclaimer";
import { BackendNotice } from "@/components/BackendNotice";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

const SITE_NAME = "Global Meltdown Index";
const SITE_DESCRIPTION =
  "See financial stress before it becomes a market story. Leading-indicator systemic risk intelligence for global markets and India.";

/**
 * `robots: { index: false }` is the default for the whole app, matching the
 * proxy allowlist (src/lib/supabase/middleware.ts): "/" is the only route a
 * signed-out visitor — or a crawler — can reach without a redirect to
 * /login, so it is the only page that opts back in, explicitly, in its own
 * metadata export (src/app/page.tsx). A route added under /dashboard or
 * /admin later stays unindexed by default rather than needing someone to
 * remember to disallow it.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://globalmeltdownindex.net"),
  title: { default: `${SITE_NAME} — Global Financial Early-Warning Intelligence Terminal`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  robots: { index: false, follow: false },
  verification: { google: "gRcEmL6W1txSfdYZ7gMKEr3AQjBKn78Umg1jxxalA7g" },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
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
