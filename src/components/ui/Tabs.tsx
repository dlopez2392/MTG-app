"use client";

import { cn } from "@/lib/utils/cn";

interface TabsProps {
  tabs: { value: string; label: string; icon?: React.ReactNode }[];
  active: string;
  onChange: (value: string) => void;
  variant?: "pill" | "underline";
  className?: string;
}

export default function Tabs({ tabs, active, onChange, variant = "pill", className }: TabsProps) {
  if (variant === "underline") {
    return (
      <div className={cn("flex border-b border-border", className)}>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 pt-3 pb-2 text-xs font-bold uppercase tracking-widest transition-colors",
              active === tab.value ? "text-accent" : "text-text-muted hover:text-text-secondary"
            )}
          >
            {tab.icon}
            {tab.label}
            <div className={cn(
              "h-0.5 rounded-full transition-all duration-200",
              active === tab.value ? "w-8 bg-accent" : "w-0 bg-transparent"
            )} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex gap-1 bg-bg-card rounded-xl p-1", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-card",
            active === tab.value
              ? "btn-gradient"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
