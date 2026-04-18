"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Modal({ open, onClose, title, children, className }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus first focusable element when opened
  useEffect(() => {
    if (open) {
      const el = contentRef.current?.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      el?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop — explicit div works on all browsers including iOS Safari */}
      <div
        className="fixed inset-0 bg-black/60 z-[90]"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog panel */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[91]",
          "bg-bg-secondary text-text-primary rounded-2xl border border-border/50 p-0 shadow-2xl",
          "w-[90vw] max-w-lg max-h-[85dvh] flex flex-col",
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-secondary"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </>
  );
}
