import { cn } from "@/lib/utils/cn";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "legal" | "banned" | "restricted" | "not_legal";
  className?: string;
}

export default function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium",
        {
          "bg-bg-card text-text-secondary": variant === "default",
          "bg-legal/20 text-legal": variant === "legal",
          "bg-banned/20 text-banned": variant === "banned",
          "bg-restricted/20 text-restricted": variant === "restricted",
          "bg-not-legal/20 text-not-legal": variant === "not_legal",
        },
        className
      )}
    >
      {children}
    </span>
  );
}
