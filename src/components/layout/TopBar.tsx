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
            className="mr-2 p-1.5 -ml-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-secondary"
            suppressHydrationWarning
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
