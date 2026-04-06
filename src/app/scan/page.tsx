"use client";

import dynamic from "next/dynamic";

const ScanPageClient = dynamic(
  () => import("@/components/scan/ScanPageClient"),
  { ssr: false }
);

export default function ScanPage() {
  return <ScanPageClient />;
}
