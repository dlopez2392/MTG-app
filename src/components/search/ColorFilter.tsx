"use client";

import type { Color } from "@/types/card";
import { MTG_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";

interface ColorFilterProps {
  selected: Color[];
  onChange: (colors: Color[]) => void;
}

export default function ColorFilter({ selected, onChange }: ColorFilterProps) {
  const toggle = (code: Color) => {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-muted mr-1">Colors</span>
      {MTG_COLORS.map(({ code, name, bg }) => {
        const isSelected = selected.includes(code as Color);
        return (
          <button
            key={code}
            type="button"
            title={name}
            onClick={() => toggle(code as Color)}
            className={cn(
              "h-8 w-8 rounded-full border-2 text-xs font-bold transition-all",
              isSelected
                ? "border-accent scale-110 shadow-md"
                : "border-border opacity-50 hover:opacity-80"
            )}
            style={{
              backgroundColor: isSelected ? bg : undefined,
              color: isSelected
                ? code === "W"
                  ? "#1a1a1a"
                  : "#fff"
                : undefined,
            }}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
