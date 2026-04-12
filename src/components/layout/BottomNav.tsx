"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";

const leftTabs = [
  {
    href: "/",
    label: "Home",
    exact: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/decks",
    label: "Decks",
    exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
];

const rightTabs = [
  {
    href: "/collection",
    label: "Collection",
    exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  {
    href: "/life",
    label: "Life",
    exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "More",
    exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },
];

function NavTab({
  href,
  label,
  icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      suppressHydrationWarning
      className={cn(
        "relative flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors",
        isActive ? "text-accent" : "text-text-muted hover:text-text-secondary"
      )}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-accent shadow-[0_0_8px_2px_rgba(237,154,87,0.5)]" />
      )}
      {icon}
      <span className="text-[9px] font-medium tracking-wide">{label}</span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const isScanActive = pathname === "/scan";
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  if (isFullscreen) return null;

  function isTabActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary/95 backdrop-blur border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto relative">
        {/* Left tabs */}
        {leftTabs.map((tab) => (
          <NavTab
            key={tab.href}
            href={tab.href}
            label={tab.label}
            icon={tab.icon}
            isActive={isTabActive(tab.href, tab.exact)}
          />
        ))}

        {/* Center scan button */}
        <Link
          href="/scan"
          className="flex items-center justify-center w-full h-full relative"
        >
          <div
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200",
              isScanActive
                ? "bg-accent text-black shadow-[0_0_20px_4px_rgba(237,154,87,0.4)]"
                : "bg-accent/90 text-black hover:bg-accent hover:shadow-[0_0_16px_2px_rgba(237,154,87,0.3)] shadow-lg"
            )}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </div>
        </Link>

        {/* Right tabs */}
        {rightTabs.map((tab) => (
          <NavTab
            key={tab.href}
            href={tab.href}
            label={tab.label}
            icon={tab.icon}
            isActive={isTabActive(tab.href, tab.exact)}
          />
        ))}
      </div>
    </nav>
  );
}
