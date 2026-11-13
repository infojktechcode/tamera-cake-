import type { Metadata } from "next";
import type { Viewport } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import { MotionConfig } from "motion/react";
import { getSiteUrl } from "@/lib/supabase/env";
import "./globals.css";
import { Toaster } from "sonner";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#e8587a",
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Tamera's Cakes & Bakery",
    template: "%s | Tamera's Cakes",
  },
  description:
    "Fresh cakes, pastries and custom celebration bakes in Kitengela, Kenya. Order online, reserve a deposit, and pick up or arrange delivery.",
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_KE",
    url: getSiteUrl(),
    title: "Tamera's Cakes & Bakery",
    description:
      "Fresh cakes, pastries and custom celebration bakes in Kitengela, Kenya. Order online, reserve a deposit, and pick up or arrange delivery.",
    siteName: "Tamera's Cakes & Bakery",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tamera's Cakes & Bakery",
    description:
      "Fresh cakes, pastries and custom celebration bakes in Kitengela, Kenya. Order online, reserve a deposit, and pick up or arrange delivery.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh antialiased">
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
