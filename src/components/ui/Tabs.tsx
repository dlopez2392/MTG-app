"use client";

import { cn } from "@/lib/utils/cn";

interface TabsProps {
  tabs: { value: string; label: string }[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn("flex gap-1 bg-bg-card rounded-xl p-1", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-card",
            active === tab.value
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
