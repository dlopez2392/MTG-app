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
        "sticky top-0 z-40 flex items-center h-14 px-4 bg-bg-secondary/95 backdrop-blur border-b border-border",
        className
      )}
    >
      {showBack && (
        <button
          onClick={() => router.back()}
          className="mr-2 p-1.5 -ml-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <h1 className="font-display text-lg font-bold uppercase tracking-wide text-text-primary truncate">
        {title}
      </h1>
      {rightContent && (
        <div className="ml-auto flex items-center gap-2">{rightContent}</div>
      )}
    </header>
  );
}
