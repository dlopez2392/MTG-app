import { cn } from "@/lib/utils/cn";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function PageContainer({ children, className, noPadding }: PageContainerProps) {
  return (
    <main className={cn("flex-1 pb-20", !noPadding && "p-4", className)}>
      {children}
    </main>
  );
}
