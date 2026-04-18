import { cn } from "@/lib/utils/cn";
import { parseManaCost } from "@/lib/utils/mana";
import ManaSymbol from "./ManaSymbol";

interface ManaCostProps {
  cost: string;
  size?: number;
  className?: string;
}

export default function ManaCost({ cost, size = 16, className }: ManaCostProps) {
  const symbols = parseManaCost(cost);

  if (symbols.length === 0) return null;

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {symbols.map((symbol, i) => (
        <ManaSymbol key={`${symbol}-${i}`} symbol={symbol} size={size} />
      ))}
    </span>
  );
}
