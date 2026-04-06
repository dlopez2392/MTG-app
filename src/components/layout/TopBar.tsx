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
    <header className={cn("sticky top-0 z-40 flex items-center h-14 px-4 bg-bg-secondary border-b border-border", className)}>
      {showBack && (
        <button
          onClick={() => router.back()}
          className="mr-3 p-1 text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <h1 className="text-lg font-semibold truncate">{title}</h1>
      {rightContent && <div className="ml-auto flex items-center gap-2">{rightContent}</div>}
    </header>
  );
}
