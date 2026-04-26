"use client";

import { cn } from "@/lib/utils/cn";

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  size?: "sm" | "md";
  className?: string;
}

export default function Toggle({ value, onChange, size = "md", className }: ToggleProps) {
  const isSm = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        "relative inline-flex items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
        value ? "bg-accent" : "bg-border",
        isSm ? "h-5 w-9" : "h-6 w-11",
        className
      )}
    >
      <span
        className={cn(
          "inline-block transform rounded-full bg-white shadow transition-transform",
          isSm ? "h-3.5 w-3.5" : "h-4 w-4",
          value
            ? (isSm ? "translate-x-[18px]" : "translate-x-6")
            : "translate-x-1"
        )}
      />
    </button>
  );
}
