"use client";

import { cn } from "@/lib/utils/cn";
import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
}

export default function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95",
        {
          "bg-accent text-black hover:bg-accent-dark shadow-[0_2px_12px_rgba(237,154,87,0.25)] hover:shadow-[0_2px_16px_rgba(237,154,87,0.4)]":
            variant === "primary",
          "bg-bg-card text-text-primary hover:bg-bg-hover border border-border hover:border-accent/40":
            variant === "secondary",
          "text-text-secondary hover:text-text-primary hover:bg-bg-card":
            variant === "ghost",
          "bg-banned text-white hover:bg-red-700":
            variant === "danger",
          "border border-accent/50 text-accent hover:bg-accent/10 hover:border-accent":
            variant === "outline",
        },
        {
          "px-3 py-1.5 text-sm": size === "sm",
          "px-4 py-2 text-sm": size === "md",
          "px-6 py-3 text-base": size === "lg",
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
