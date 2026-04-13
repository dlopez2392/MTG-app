import type { Legality } from "@/types/card";

export interface LegalityBadge {
  label: string;
  classes: string;
}

export function getLegalityBadge(legality: Legality | undefined): LegalityBadge | null {
  switch (legality) {
    case "legal":
      return { label: "Legal", classes: "bg-legal/20 text-legal" };
    case "restricted":
      return { label: "Restricted", classes: "bg-restricted/20 text-restricted" };
    case "banned":
      return { label: "Banned", classes: "bg-banned/20 text-banned" };
    case "not_legal":
      return { label: "Not Legal", classes: "bg-bg-hover text-text-muted" };
    default:
      return null;
  }
}
