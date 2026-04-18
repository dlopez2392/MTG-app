import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import BottomNav from "@/components/layout/BottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MTG Houdini",
  description: "Your ultimate Magic: The Gathering companion app",
};

export const viewport: Viewport = {
  themeColor: "#0B0E14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,        // Allow accessibility zoom (iOS WCAG requirement)
  viewportFit: "cover",  // iPhone notch / Dynamic Island support
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-bg-primary text-text-primary" suppressHydrationWarning>
          <div className="flex-1 flex flex-col">{children}</div>
          <BottomNav />
        </body>
      </html>
    </ClerkProvider>
  );
}
