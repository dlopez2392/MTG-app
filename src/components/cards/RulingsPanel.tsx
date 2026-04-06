import { cn } from "@/lib/utils/cn";
import type { ScryfallRuling } from "@/types/card";

interface RulingsPanelProps {
  rulings: ScryfallRuling[];
  className?: string;
}

export default function RulingsPanel({ rulings, className }: RulingsPanelProps) {
  if (rulings.length === 0) {
    return (
      <p className="text-sm text-text-secondary">No rulings available for this card.</p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {rulings.map((ruling, i) => (
        <div
          key={`${ruling.published_at}-${i}`}
          className="rounded-md bg-bg-card p-3"
        >
          <time className="mb-1 block text-xs font-medium text-text-secondary">
            {ruling.published_at}
          </time>
          <p className="text-sm leading-relaxed text-text-primary">
            {ruling.comment}
          </p>
        </div>
      ))}
    </div>
  );
}
