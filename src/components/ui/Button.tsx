"use client";

import { cn } from "@/lib/utils/cn";
import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
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
        "inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        {
          "bg-accent text-black hover:bg-accent-dark": variant === "primary",
          "bg-bg-card text-text-primary hover:bg-bg-hover border border-border": variant === "secondary",
          "text-text-secondary hover:text-text-primary hover:bg-bg-card": variant === "ghost",
          "bg-banned text-white hover:bg-red-700": variant === "danger",
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
