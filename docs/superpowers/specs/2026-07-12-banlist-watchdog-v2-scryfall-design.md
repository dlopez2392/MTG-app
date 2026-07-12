# Ban-list Watchdog v2 — Scryfall legality change detection

**Date:** 2026-07-12
**Status:** Approved (danlo, 2026-07-12)
**Supersedes source of:** Phase 3c ban-list watchdog (RSS-based detection)

## Problem

The v1 watchdog parsed WotC's news RSS (`https://magic.wizards.com/en/rss/news`) for B&R
announcements. That feed now returns **HTTP 404** — WotC no longer publishes RSS there
(every candidate URL 404s; other feeds like mtgazone still work, so it is not a network
issue). Consequently v1 detects **zero** real B&R events in production; it only passed QA
via a manually seeded DB event. Prose-parsing was also fragile (code review flagged
substring false-positives, 200-char description truncation, and item-wide format
attribution).

## Approach

Replace the event **source** with **change detection over Scryfall card legalities**
(the app already models `legalities: Record<Format, "legal"|"not_legal"|"restricted"|"banned">`
and decks store `format` using Scryfall's lowercase keys). Detection becomes authoritative
and needs no prose parsing. **Everything downstream is reused unchanged**: the dashboard
alert, the push pipeline, and the three tables from migration 010.

## Data model

New table (migration 011), global, one row per card, no RLS (app-layer, consistent with app):

```
card_legality_snapshot (
  scryfall_id text primary key,
  card_name   text not null,
  legalities  jsonb not null,       -- { "modern": "banned", "commander": "legal", ... }
  updated_at  timestamptz not null default now()
)
```

## Scan flow (rewrite of `GET /api/banlist/scan`)

1. Load user's decks (`id, name, format`) and deck cards (`scryfall_id, name, deck_id`).
2. **Watch set** = deck cards whose deck has a non-empty, recognized `format`. Untagged
   decks (`format === ""`) are skipped (no legality key to check).
3. Read `card_legality_snapshot` for those `scryfall_id`s. **Refetch** rows that are missing
   or whose `updated_at` is older than **24h**, via `POST https://api.scryfall.com/cards/collection`
   (identifiers `{id}`, 75 per chunk — existing pattern in `import-deck/route.ts`).
4. **Per-format diff** (pure fn `legalityDiff`): for each watch-set card compare
   `current.legalities[deck.format]` vs `snapshot.legalities[deck.format]`.
   - **Alert-worthy transition** = the two differ AND at least one side ∈ {`banned`,`restricted`}.
     - legal/not_legal → banned  ⇒ status `banned`
     - legal/not_legal → restricted ⇒ status `restricted`
     - restricted → banned ⇒ `banned`; banned → restricted ⇒ `restricted`
     - banned/restricted → legal ⇒ status `unbanned`
   - Pure `legal`↔`not_legal` (rotation) is **ignored**.
   - **No prior snapshot row ⇒ silent baseline** (record current, emit nothing).
5. On each transition, upsert a **global `banlist_event`**: `id = hash(scryfall_id|format|status)`,
   `card_name`, `format`, `status`, `announced_at = now`, `source_url = <card Scryfall page>`,
   `source_title = "<Card> — <Format> legality changed"`.
6. **Upsert snapshot** to current legalities for every fetched card (also the baseline write).
7. **Cross-ref** `banlist_events` from the **last 90 days** against the user's decks
   (a deck whose `format` equals the event format and which runs that card) → upsert
   `banlist_notifications` (`onConflict user_id,event_id`, `ignoreDuplicates`). **This is the
   one behavioral change from v1's cross-ref:** it matches DB events (not only this scan's
   freshly-detected ones), so a ban detected during one user's scan fans out to every affected
   user on their next dashboard load.
8. Fire push for `pushed=false` notifications, mark `pushed=true` (unchanged from v1).
9. Return joined notifications in the existing shape (unchanged) → `BanlistAlert.tsx` needs
   **no changes**.

## Kept unchanged

`banlist_events`, `banlist_notifications`, `push_subscriptions`, migration 010,
`/api/banlist/seen`, `BanlistAlert.tsx`, `src/lib/push/*`, `/api/push/subscribe`,
`public/sw.js` push/notificationclick handlers.

## Removed / retired

- `src/lib/banlist/detect.ts` (RSS B&R parser) and its use in the scan route.
- The WotC-feed fetch inside the scan route.
- This retires code-review findings #1 (truncation), #2 (substring matching), #3 (item-wide
  format attribution) entirely.

## Edge cases

- Untagged decks skipped (documented limitation; future deck-legality validator can cover).
- Scryfall fetch failure → best-effort; scan still returns existing notifications, no crash.
- Detection latency ≤ ~24h after a ban (snapshot TTL) — acceptable for scheduled B&R.
- Unknown/absent Scryfall ids → no snapshot row, skipped.
- `status` maps onto the existing `BanlistStatus` union already handled by `BanlistAlert`.

## Testing

- Pure `src/lib/banlist/legalityDiff.ts` unit-tested via tsx temp scripts: legal→banned,
  legal→restricted, restricted→banned, unbanned, no-change, not_legal ignored,
  missing-prior = silent (null).
- Scan integration verified against danlo's real deck by forcing a stale/edited snapshot
  value, then confirming event → notification → push through the (already-verified) pipeline.
- `npx tsc --noEmit`, `npx eslint <changed files>`, `npx next build` all green before review.

## Out of scope (flagged separately)

The dead WotC feed also leaves the **News feature's WotC tab silently empty**. Not addressed
here; tracked as a separate follow-up.
