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
  themeColor: "#121212",
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
        <body className="min-h-full flex flex-col bg-bg-primary text-text-primary">
          <div className="flex-1 flex flex-col">{children}</div>
          <footer className="fixed bottom-16 left-0 right-0 z-40 pointer-events-none">
            <p className="text-center text-[10px] text-text-muted py-1">
              Designed by Dan Lopez
            </p>
          </footer>
          <BottomNav />
        </body>
      </html>
    </ClerkProvider>
  );
}
