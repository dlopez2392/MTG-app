"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface DeckActionItem {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  hidden?: boolean;
}

/**
 * A labeled overflow menu (⋯) for deck actions. Rows show icon + text so nothing
 * relies on hover tooltips (mobile-friendly). Closes on outside-click / Esc.
 */
export default function DeckActionsMenu({
  items,
  label = "More actions",
}: {
  items: DeckActionItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = items.filter((i) => !i.hidden);
  if (visible.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="p-2 rounded-lg text-text-secondary hover:text-text-primary transition-colors"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 6.75a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM12 13.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM12 20.25a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-56 glass-card border border-border rounded-xl py-1 z-50 shadow-xl"
        >
          {visible.map((it, idx) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors hover:bg-bg-hover",
                it.danger ? "text-banned mt-1 border-t border-border/50" : "text-text-primary",
                idx === 0 && "rounded-t-lg"
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 shrink-0",
                  it.danger ? "text-banned" : it.active ? "text-accent" : "text-text-secondary"
                )}
              >
                {it.icon}
              </span>
              <span className="flex-1">{it.label}</span>
              {it.active && <span className="text-[10px] font-semibold text-accent">ON</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
