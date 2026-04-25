"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";

interface TopBarProps {
  title: string;
  showBack?: boolean;
  rightContent?: React.ReactNode;
  className?: string;
}

export default function TopBar({ title, showBack, rightContent, className }: TopBarProps) {
  const router = useRouter();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-14 glass border-b border-border/50",
        className
      )}
    >
      <div className="flex items-center h-full max-w-2xl mx-auto px-4">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="mr-2 -ml-1 w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{
              background: "linear-gradient(135deg, rgba(124,92,252,0.3), rgba(124,92,252,0.1))",
              boxShadow: "0 2px 8px rgba(124,92,252,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
            suppressHydrationWarning
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="text-page-title text-text-primary truncate">
          {title}
        </h1>
        {rightContent && (
          <div className="ml-auto flex items-center gap-2">{rightContent}</div>
        )}
      </div>
    </header>
  );
}
