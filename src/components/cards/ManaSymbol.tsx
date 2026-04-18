import { cn } from "@/lib/utils/cn";

interface ManaSymbolProps {
  symbol: string;
  size?: number;
  className?: string;
}

const SCRYFALL_SVG = "https://svgs.scryfall.io/card-symbols";

export function manaSymbolUrl(symbol: string): string {
  return `${SCRYFALL_SVG}/${encodeURIComponent(symbol)}.svg`;
}

export default function ManaSymbol({ symbol, size = 16, className }: ManaSymbolProps) {
  return (
    <img
      src={manaSymbolUrl(symbol)}
      alt={`{${symbol}}`}
      width={size}
      height={size}
      className={cn("inline-block rounded-full", className)}
      loading="lazy"
    />
  );
}
