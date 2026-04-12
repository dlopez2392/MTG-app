import { cn } from "@/lib/utils/cn";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function PageContainer({ children, className, noPadding }: PageContainerProps) {
  return (
    <main className={cn("flex-1", !noPadding && "px-4 pt-4", "pb-24", className)}>
      {children}
    </main>
  );
}
