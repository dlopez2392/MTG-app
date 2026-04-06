"use client";

import { lazy, Suspense } from "react";

const SettingsPageClient = lazy(
  () => import("@/components/settings/SettingsPageClient")
);

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col min-h-screen pb-20">
          <div className="px-4 pt-6 pb-2">
            <h1 className="text-xl font-bold text-text-primary">Settings</h1>
          </div>
        </div>
      }
    >
      <SettingsPageClient />
    </Suspense>
  );
}
