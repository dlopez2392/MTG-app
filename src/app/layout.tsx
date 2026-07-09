import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Big_Shoulders, Cinzel_Decorative } from "next/font/google";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import BottomNav from "@/components/layout/BottomNav";
import MergeGuestPrompt from "@/components/layout/MergeGuestPrompt";
import PageBackground from "@/components/layout/PageBackground";
import SideNav from "@/components/layout/SideNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  display: "swap",
});

const cinzel = Cinzel_Decorative({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mtghoudini.com"),
  title: "MTG Houdini",
  description: "Your ultimate Magic: The Gathering companion app",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MTG Houdini",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
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
        className={`${geistSans.variable} ${geistMono.variable} ${bigShoulders.variable} ${cinzel.variable} h-full antialiased`}
      >
        <head>
          <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        </head>
        <body className="min-h-full flex flex-col bg-bg-primary text-text-primary" suppressHydrationWarning>
          <Script id="sw-register" strategy="afterInteractive">
            {`if("serviceWorker"in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js")})}`}
          </Script>
          <PageBackground />
          <SideNav />
          <div className="relative z-10 flex-1 flex flex-col lg:pl-56">{children}</div>
          <BottomNav />
          <MergeGuestPrompt />
        </body>
      </html>
    </ClerkProvider>
  );
}
