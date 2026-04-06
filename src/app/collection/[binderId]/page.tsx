"use client";

import { use } from "react";
import dynamic from "next/dynamic";

const BinderDetailClient = dynamic(
  () => import("@/components/collection/BinderDetailClient"),
  { ssr: false }
);

export default function BinderDetailPage({
  params,
}: {
  params: Promise<{ binderId: string }>;
}) {
  const { binderId } = use(params);
  return <BinderDetailClient binderId={binderId} />;
}
