"use client";

import { useMemo } from "react";
import { renderSVG } from "uqr";
import { cn } from "@/lib/utils/cn";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

/** QR code on a white tile (quiet zone included) so it scans against the dark theme. */
export default function QrCode({ value, size = 160, className }: QrCodeProps) {
  const svg = useMemo(() => renderSVG(value, { border: 2 }), [value]);
  return (
    <div
      className={cn("inline-block rounded-xl bg-white p-2", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`QR code: ${value}`}
      // uqr returns a self-contained <svg> string; it renders our own trusted value only.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
