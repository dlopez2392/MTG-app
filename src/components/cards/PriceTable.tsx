import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/prices";
import type { ScryfallCard } from "@/types/card";

interface PriceTableProps {
  printings: ScryfallCard[];
  className?: string;
  deckId?: string | null;
  category?: string | null;
}

function getThumbnailUrl(card: ScryfallCard): string | null {
  if (card.image_uris) return card.image_uris.small;
  if (card.card_faces?.[0]?.image_uris) return card.card_faces[0].image_uris.small;
  return null;
}

export default function PriceTable({ printings, className, deckId, category }: PriceTableProps) {
  if (printings.length === 0) {
    return (
      <p className="text-sm text-text-secondary">No pricing data available.</p>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-secondary">
            <th className="pb-2 pr-3 font-medium">Set</th>
            <th className="pb-2 pr-3 font-medium">#</th>
            <th className="pb-2 pr-3 font-medium text-right">Normal</th>
            <th className="pb-2 font-medium text-right">Foil</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {printings.map((card) => {
            const thumb = getThumbnailUrl(card);
            const deckQuery = deckId ? `?deckId=${deckId}&category=${category ?? "main"}` : "";
            return (
              <tr key={card.id} className="transition-colors hover:bg-bg-card/50 cursor-pointer">
                <td className="py-2 pr-3">
                  <Link href={`/search/${card.id}${deckQuery}`} className="flex items-center gap-2">
                    {thumb && (
                      <Image
                        src={thumb}
                        alt={card.set_name}
                        width={30}
                        height={42}
                        className="rounded-sm"
                      />
                    )}
                    <span className="text-text-primary hover:text-accent transition-colors">{card.set_name}</span>
                  </Link>
                </td>
                <td className="py-2 pr-3 text-text-secondary">
                  <Link href={`/search/${card.id}${deckQuery}`} className="block">
                    {card.collector_number}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-right text-text-primary">
                  <Link href={`/search/${card.id}${deckQuery}`} className="block">
                    {formatPrice(card.prices.usd)}
                  </Link>
                </td>
                <td className="py-2 text-right text-text-primary">
                  <Link href={`/search/${card.id}${deckQuery}`} className="block">
                    {formatPrice(card.prices.usd_foil)}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
