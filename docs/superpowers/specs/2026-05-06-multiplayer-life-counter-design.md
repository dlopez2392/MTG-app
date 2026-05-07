# Multiplayer Life Counter — Design Specification

**Date:** 2026-05-06
**Status:** Approved
**Feature:** Real-time multiplayer life counter sync via Supabase Realtime

---

## Overview

Players at the same table can link their phones to sync life totals in real-time. Each device shows the player's own life panel full-screen, with a compact opponent bar displaying other players' states. When the game ends, match history is automatically saved for all connected players.

## Technical Approach

**Supabase Realtime** (Broadcast + Presence) with room codes. Zero new dependencies — `@supabase/supabase-js` already includes the Realtime client.

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Browser-safe Supabase client using `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `src/hooks/useMultiplayerRoom.ts` | Room lifecycle, Presence tracking, Broadcast events |
| `src/components/life/MultiplayerLobby.tsx` | Create/join room UI with player list |
| `src/components/life/OpponentBar.tsx` | Compact read-only bar showing remote players' states |

### Modified Files

| File | Change |
|------|--------|
| `src/components/life/PlayerSetup.tsx` | Add multiplayer toggle and room creation/joining flow |
| `src/app/life/page.tsx` | Support single-panel mode when in multiplayer, render OpponentBar, handle multiplayer End Game broadcast |
| `src/hooks/useLifeCounter.ts` | Expose state updates for sync (no structural changes needed — Presence reads from existing state) |

---

## UX Flow

### Setup Phase

1. PlayerSetup screen shows a **"Multiplayer"** section below existing options
2. **Create Room:** Player enters their name, picks a color, selects starting life → taps "Create Room" → 5-character room code generated and displayed large
3. **Join Room:** Player enters room code + their name, picks a color → joins the lobby
4. **Lobby view:** Shows all connected players (name, color, ready status). Host sees a "Start Game" button.
5. Host sets game options (starting life) — these propagate to all players via Broadcast.
6. Host taps "Start Game" → all devices transition to game mode simultaneously.

### In-Game (Per Device)

- **Full-screen single panel** for the local player's life total (reuses existing `PlayerPanel` component)
- **Opponent bar** (fixed at bottom): shows each remote player as a compact chip with color dot, name, and life total — updated in real-time via Presence
- Tapping a player chip in the opponent bar expands to show their poison/energy/commander damage (stretch goal for v2)
- Game timer and turn timer remain local-only (each player can run their own)

### End Game

1. Host taps the center menu → "End & Save"
2. Host selects winner (or draw) via existing EndGameModal
3. Match result payload broadcasts to all connected players
4. Each player's device saves the match to their own game history:
   - Signed-in users: saved to Supabase via `/api/matches` and `/api/game-log`
   - Guest users: saved to localStorage/IndexedDB
5. If connected players exist in each other's playgroups, head-to-head stats update automatically

### Disconnect Handling

- Disconnected player's last-known state stays visible in opponent bar (grayed out)
- Reconnection resumes state sync automatically (Supabase Presence handles rejoin)
- Host disconnect does NOT kill the room — channels are serverless, any player can end game
- If all players disconnect, channel naturally expires (Supabase garbage collects idle channels)

---

## State Synced via Presence

Each player tracks their full state in Presence:

```typescript
interface MultiplayerPlayerState {
  playerId: string;       // stable across reconnects
  name: string;
  color: string;
  life: number;
  poisonCounters: number;
  energyCounters: number;
  experienceCounters: number;
  isMonarch: boolean;
  hasInitiative: boolean;
  dungeonLevel: number;
  commanderDamage: Record<string, number>;
}
```

Presence `track()` is called on every state change. All clients receive `sync` events with the full room state.

## Broadcast Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `game-start` | `{ startingLife, gameOptions }` | Host starts game |
| `game-end` | `{ winner, players, duration, format, notes }` | Host ends game |
| `game-reset` | `{}` | Host resets game |
| `player-kick` | `{ playerId }` | Host removes player (stretch) |

---

## Room Code System

- **Generation:** 5-character alphanumeric, uppercase (e.g., "X7K3M")
- **Namespace:** Channel name = `life-room-{CODE}` (e.g., `life-room-X7K3M`)
- **No server registry:** The channel itself IS the room. Subscribing puts you in.
- **Collision risk:** 36^5 = ~60M possible codes. Negligible for concurrent sessions.
- **URL support:** `mtghoudini.com/life?room=X7K3M` auto-joins (stretch goal for QR codes)

---

## Game History Integration

### Match Data Broadcast

When the host ends and saves the game, a `game-end` broadcast contains:

```typescript
interface GameEndPayload {
  players: Array<{
    name: string;
    finalLife: number;
    isWinner: boolean;
    color: string;
  }>;
  startingLife: number;
  playerCount: number;
  format: string;
  durationSecs: number;
  notes?: string;
  endedAt: string;
}
```

### Per-Player Save Logic

Each connected device receives the broadcast and saves using existing hooks:
- `useMatchHistory.saveMatch()` — creates match record with all players
- `useGameLog.addEntry()` — logs the result from that player's perspective (win/loss/draw)
- Playgroup linkage: if opponent names match playgroup members, stats auto-update

### Guest vs Signed-In

- **Signed-in (Clerk):** Match saved to Supabase via API routes (existing flow)
- **Guest:** Match saved to localStorage (existing guest flow in useMatchHistory/useGameLog)

---

## Environment Setup

Already configured in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://jffcyqwhfbegnctpdzpn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

No additional env vars needed. Supabase Realtime uses the anon key for client-side Broadcast/Presence.

---

## Constraints & Decisions

- **Internet required:** Multiplayer mode needs an active connection. Local-only games remain fully offline.
- **No authentication required for rooms:** Any device with the room code can join. No Clerk sign-in needed for the Realtime channel itself.
- **Latency target:** <200ms for life total updates (Supabase Realtime typically 50-150ms).
- **Max players:** 6 (same as existing life counter limit).
- **Free tier limits:** 200 concurrent connections, 2M messages/month. A 6-player game uses ~100 messages/session — thousands of games per month within free tier.

---

## Out of Scope (v2 Stretch Goals)

- QR code scanning to join rooms
- Expanded opponent card showing full counter details on tap
- Spectator mode (view-only connection)
- Player kick functionality
- Persistent room history (rooms are ephemeral)
- Cross-table remote play (designed for same-table, but works remotely too)
