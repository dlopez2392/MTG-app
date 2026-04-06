import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/prices";
import type { ScryfallCard } from "@/types/card";

interface PriceTableProps {
  printings: ScryfallCard[];
  className?: string;
}

function getThumbnailUrl(card: ScryfallCard): string | null {
  if (card.image_uris) return card.image_uris.small;
  if (card.card_faces?.[0]?.image_uris) return card.card_faces[0].image_uris.small;
  return null;
}

export default function PriceTable({ printings, className }: PriceTableProps) {
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
            return (
              <tr key={card.id} className="transition-colors hover:bg-bg-card/50">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    {thumb && (
                      <Image
                        src={thumb}
                        alt={card.set_name}
                        width={30}
                        height={42}
                        className="rounded-sm"
                      />
                    )}
                    <span className="text-text-primary">{card.set_name}</span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-text-secondary">
                  {card.collector_number}
                </td>
                <td className="py-2 pr-3 text-right text-text-primary">
                  {formatPrice(card.prices.usd)}
                </td>
                <td className="py-2 text-right text-text-primary">
                  {formatPrice(card.prices.usd_foil)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
