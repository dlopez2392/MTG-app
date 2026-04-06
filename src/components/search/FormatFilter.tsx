"use client";

import { FORMATS } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";

interface FormatFilterProps {
  value: string;
  onChange: (format: string) => void;
}

export default function FormatFilter({ value, onChange }: FormatFilterProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="format-filter" className="text-xs text-text-muted">
        Format
      </label>
      <select
        id="format-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary capitalize",
          "focus:outline-none focus:border-accent transition-colors"
        )}
      >
        <option value="">All Formats</option>
        {FORMATS.map((format) => (
          <option key={format} value={format} className="capitalize">
            {format.charAt(0).toUpperCase() + format.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}
