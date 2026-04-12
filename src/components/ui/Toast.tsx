"use client";

import { cn } from "@/lib/utils/cn";

interface ToastProps {
  message: string;
  visible: boolean;
}

export default function Toast({ message, visible }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full",
        "bg-bg-card border border-border shadow-lg",
        "text-sm font-medium text-text-primary whitespace-nowrap",
        "transition-all duration-300 pointer-events-none",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
    >
      {message}
    </div>
  );
}
