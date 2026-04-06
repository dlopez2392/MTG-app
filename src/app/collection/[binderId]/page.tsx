"use client";

import { lazy, Suspense, use } from "react";

const BinderDetailClient = lazy(
  () => import("@/components/collection/BinderDetailClient")
);

export default function BinderDetailPage({
  params,
}: {
  params: Promise<{ binderId: string }>;
}) {
  const { binderId } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <BinderDetailClient binderId={binderId} />
    </Suspense>
  );
}
