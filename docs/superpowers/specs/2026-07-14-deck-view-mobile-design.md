# Mobile-friendly Deck View — Design

**Date:** 2026-07-14 · **Status:** Approved (danlo)

## Problem
The deck-detail view (click a deck → `DeckEditorPageClient` header + `DeckEditor` toolbar) crams ~6 header + ~6 toolbar icon-only buttons that rely on desktop hover tooltips, so they're opaque and cramped on mobile ("hard to tell what the icons are for").

## Solution
Consolidate secondary actions into **labeled overflow menus** (icon + text rows), keeping only the few frequently-used, self-explanatory controls visible. Two menus in their natural components (avoids lifting state across components).

### New component `DeckActionsMenu`
Reusable dropdown: a trigger button (⋯) → a panel of rows (`{icon, label, onClick, danger?, active?}`). Closes on outside-click and Esc; ≥40px tap targets; destructive rows red and separated at the bottom. Positioned below-right of the trigger; glass-card styling; `z` above content.

### Header (`DeckEditorPageClient`)
Keep: `‹ back`, truncating deck name, `[Bracket N]` chip (taps → stats). Replace the icon cluster with one `DeckActionsMenu`:
- Make public / Make private (toggle; label + active state reflect `deck.public`)
- Copy share link (only when `deck.public`)
- Log a game
- Deck stats
- Delete deck (danger, separated)

### Toolbar (`DeckEditor`)
Keep visible: `[Filter…]`, Sort & Group ⚙, List/Grid toggle, `+ Add`. Move into a `DeckActionsMenu`:
- Card packages
- Test hand (hand simulator)
- Import / Export

### Mobile polish
Header never overflows on narrow widths (name truncates; chip + menu pinned right). Toolbar wraps gracefully. Retained icons keep `title` for desktop, but no critical action is hover-only.

## Scope
Deck-detail view only: `DeckEditorPageClient` (header), `DeckEditor` (toolbar), new `DeckActionsMenu`. Decklist rows, primer, and the stats page are unchanged. No API/DB changes.

## Testing
`tsc`/`eslint`/`next build` green. Live: at mobile width, header + toolbar are uncluttered; each menu opens with readable labels; every prior action still reachable (public toggle, copy link, log game, stats, delete, packages, hand sim, import/export); outside-click/Esc close.
