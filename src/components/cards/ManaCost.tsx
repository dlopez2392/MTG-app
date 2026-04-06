import { cn } from "@/lib/utils/cn";
import { parseManaCost, getManaSymbolColor } from "@/lib/utils/mana";

interface ManaCostProps {
  cost: string;
  className?: string;
}

function getSymbolTextColor(symbol: string): string {
  if (symbol === "W") return "text-black";
  return "text-white";
}

export default function ManaCost({ cost, className }: ManaCostProps) {
  const symbols = parseManaCost(cost);

  if (symbols.length === 0) return null;

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {symbols.map((symbol, i) => (
        <span
          key={`${symbol}-${i}`}
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold leading-none",
            getSymbolTextColor(symbol)
          )}
          style={{ backgroundColor: getManaSymbolColor(symbol) }}
          title={`{${symbol}}`}
        >
          {symbol}
        </span>
      ))}
    </span>
  );
}
