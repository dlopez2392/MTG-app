import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <h1 className="text-4xl font-bold text-text-primary mb-2">404</h1>
      <p className="text-text-secondary mb-6">This page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="btn-gradient px-6 py-2.5 rounded-xl font-semibold text-sm inline-block"
      >
        Back to Home
      </Link>
    </div>
  );
}
