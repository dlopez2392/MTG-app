"use client";

import dynamic from "next/dynamic";

const SettingsPageClient = dynamic(
  () => import("@/components/settings/SettingsPageClient"),
  { ssr: false }
);

export default function SettingsPage() {
  return <SettingsPageClient />;
}
