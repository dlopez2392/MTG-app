// Pure ban-list change detection over Scryfall legality values. No network.

export type LegalityStatus = "legal" | "not_legal" | "restricted" | "banned";
export type TransitionStatus = "banned" | "restricted" | "unbanned";

const BAN_RELEVANT = (s: LegalityStatus | undefined): boolean =>
  s === "banned" || s === "restricted";

/**
 * Classify a legality change for one card in one format.
 * Returns null when there is nothing worth alerting:
 *  - no prior snapshot (undefined prev) → silent baseline
 *  - unchanged
 *  - a change that touches neither `banned` nor `restricted` (e.g. rotation)
 */
export function legalityTransition(
  prev: LegalityStatus | undefined,
  curr: LegalityStatus | undefined
): TransitionStatus | null {
  if (prev === undefined || curr === undefined) return null;
  if (prev === curr) return null;
  if (!BAN_RELEVANT(prev) && !BAN_RELEVANT(curr)) return null;
  if (curr === "banned") return "banned";
  if (curr === "restricted") return "restricted";
  // curr is legal/not_legal and prev was banned/restricted
  return "unbanned";
}
