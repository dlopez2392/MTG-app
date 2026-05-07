# Multiplayer Life Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable players to sync life counters in real-time across devices using Supabase Realtime with room codes.

**Architecture:** Client-side Supabase instance connects to Realtime channels. Each player tracks state via Presence. Broadcast events handle game-start/end coordination. Single-panel focus mode with an opponent bar for remote players.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Realtime (Broadcast + Presence), Tailwind CSS v4

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/supabase/client.ts` | Browser-safe singleton Supabase client (anon key) |
| `src/hooks/useMultiplayerRoom.ts` | Room lifecycle: create, join, leave, Presence tracking, Broadcast send/receive |
| `src/components/life/MultiplayerLobby.tsx` | UI for creating/joining rooms, displaying lobby with connected players |
| `src/components/life/OpponentBar.tsx` | Compact bottom bar showing remote players' life/state |
| `src/components/life/PlayerSetup.tsx` | Modified: add multiplayer section that triggers lobby |
| `src/app/life/page.tsx` | Modified: single-panel multiplayer mode, opponent bar, game-end broadcast handling |

---

### Task 1: Client-Side Supabase Instance

**Files:**
- Create: `src/lib/supabase/client.ts`

- [ ] **Step 1: Create the client module**

```typescript
// src/lib/supabase/client.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let instance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!instance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    instance = createClient(url, key, {
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });
  }
  return instance;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | findstr /i "error"`
Expected: No errors related to `client.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/client.ts
git commit -m "feat: add client-side Supabase instance for Realtime"
```

---

### Task 2: useMultiplayerRoom Hook

**Files:**
- Create: `src/hooks/useMultiplayerRoom.ts`

- [ ] **Step 1: Create the hook with types and room code generation**

```typescript
// src/hooks/useMultiplayerRoom.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface MultiplayerPlayerState {
  playerId: string;
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

export interface GameEndPayload {
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

interface UseMultiplayerRoomReturn {
  roomCode: string | null;
  isHost: boolean;
  isConnected: boolean;
  remotePlayers: MultiplayerPlayerState[];
  gameStarted: boolean;
  gameEndPayload: GameEndPayload | null;
  createRoom: () => void;
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
  trackState: (state: MultiplayerPlayerState) => void;
  broadcastGameStart: (startingLife: number) => void;
  broadcastGameEnd: (payload: GameEndPayload) => void;
  broadcastGameReset: () => void;
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function useMultiplayerRoom(): UseMultiplayerRoomReturn {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [remotePlayers, setRemotePlayers] = useState<MultiplayerPlayerState[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEndPayload, setGameEndPayload] = useState<GameEndPayload | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localPlayerIdRef = useRef<string>("");

  const subscribe = useCallback((code: string) => {
    const supabase = getSupabaseClient();
    const channel = supabase.channel(`life-room-${code}`, {
      config: { presence: { key: localPlayerIdRef.current } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<MultiplayerPlayerState>();
        const players: MultiplayerPlayerState[] = [];
        for (const key of Object.keys(state)) {
          if (key === localPlayerIdRef.current) continue;
          const presences = state[key];
          if (presences && presences.length > 0) {
            players.push(presences[0] as unknown as MultiplayerPlayerState);
          }
        }
        setRemotePlayers(players);
      })
      .on("broadcast", { event: "game-start" }, (payload) => {
        if (!isHost) {
          setGameStarted(true);
        }
      })
      .on("broadcast", { event: "game-end" }, ({ payload }) => {
        setGameEndPayload(payload as GameEndPayload);
      })
      .on("broadcast", { event: "game-reset" }, () => {
        setGameStarted(false);
        setGameEndPayload(null);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        }
      });

    channelRef.current = channel;
  }, [isHost]);

  const createRoom = useCallback(() => {
    const code = generateRoomCode();
    localPlayerIdRef.current = crypto.randomUUID();
    setRoomCode(code);
    setIsHost(true);
    subscribe(code);
  }, [subscribe]);

  const joinRoom = useCallback((code: string) => {
    const normalized = code.toUpperCase().trim();
    localPlayerIdRef.current = crypto.randomUUID();
    setRoomCode(normalized);
    setIsHost(false);
    subscribe(normalized);
  }, [subscribe]);

  const leaveRoom = useCallback(() => {
    if (channelRef.current) {
      const supabase = getSupabaseClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setRoomCode(null);
    setIsHost(false);
    setIsConnected(false);
    setRemotePlayers([]);
    setGameStarted(false);
    setGameEndPayload(null);
  }, []);

  const trackState = useCallback((state: MultiplayerPlayerState) => {
    if (channelRef.current) {
      channelRef.current.track(state);
    }
  }, []);

  const broadcastGameStart = useCallback((startingLife: number) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "game-start",
        payload: { startingLife },
      });
      setGameStarted(true);
    }
  }, []);

  const broadcastGameEnd = useCallback((payload: GameEndPayload) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "game-end",
        payload,
      });
    }
  }, []);

  const broadcastGameReset = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "game-reset",
        payload: {},
      });
      setGameStarted(false);
      setGameEndPayload(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        const supabase = getSupabaseClient();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return {
    roomCode,
    isHost,
    isConnected,
    remotePlayers,
    gameStarted,
    gameEndPayload,
    createRoom,
    joinRoom,
    leaveRoom,
    trackState,
    broadcastGameStart,
    broadcastGameEnd,
    broadcastGameReset,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | findstr /i "error"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMultiplayerRoom.ts
git commit -m "feat: add useMultiplayerRoom hook with Presence and Broadcast"
```

---

### Task 3: MultiplayerLobby Component

**Files:**
- Create: `src/components/life/MultiplayerLobby.tsx`

- [ ] **Step 1: Create the lobby component**

```typescript
// src/components/life/MultiplayerLobby.tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { MultiplayerPlayerState } from "@/hooks/useMultiplayerRoom";

interface MultiplayerLobbyProps {
  roomCode: string | null;
  isHost: boolean;
  isConnected: boolean;
  remotePlayers: MultiplayerPlayerState[];
  localPlayer: { name: string; color: string } | null;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onStartGame: () => void;
}

export default function MultiplayerLobby({
  roomCode,
  isHost,
  isConnected,
  remotePlayers,
  localPlayer,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onStartGame,
}: MultiplayerLobbyProps) {
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");

  if (roomCode && isConnected) {
    const allPlayers = [
      ...(localPlayer ? [{ name: localPlayer.name, color: localPlayer.color, isLocal: true }] : []),
      ...remotePlayers.map((p) => ({ name: p.name, color: p.color, isLocal: false })),
    ];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider font-bold">Room Code</p>
            <p className="text-3xl font-black tracking-[0.3em] text-accent">{roomCode}</p>
          </div>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="px-3 py-2 text-xs font-bold text-red-400 border border-red-500/20 rounded-xl active:scale-95 transition-all"
          >
            Leave
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-text-muted uppercase tracking-wider font-bold">
            Players ({allPlayers.length})
          </p>
          {allPlayers.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-bg-card"
            >
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-sm font-semibold text-text-primary flex-1">{p.name}</span>
              {p.isLocal && (
                <span className="text-[10px] font-bold text-accent uppercase">You</span>
              )}
            </div>
          ))}
        </div>

        {isHost && (
          <button
            type="button"
            onClick={onStartGame}
            disabled={remotePlayers.length === 0}
            className="w-full py-4 text-sm font-bold rounded-2xl btn-gradient active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start Game ({allPlayers.length} players)
          </button>
        )}
        {!isHost && (
          <p className="text-center text-sm text-text-muted">Waiting for host to start...</p>
        )}
      </div>
    );
  }

  if (mode === "idle") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => { setMode("create"); onCreateRoom(); }}
          className="w-full py-4 text-sm font-bold rounded-2xl btn-gradient active:scale-[0.98] transition-all"
        >
          Create Room
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className="w-full py-4 text-sm font-bold rounded-2xl border border-accent/30 text-accent active:scale-[0.98] transition-all"
        >
          Join Room
        </button>
      </div>
    );
  }

  if (mode === "join") {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 5))}
            placeholder="ENTER CODE"
            maxLength={5}
            className="flex-1 px-4 py-3 text-center text-lg font-bold tracking-[0.3em] uppercase rounded-xl border border-border bg-bg-card text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setMode("idle"); setJoinCode(""); }}
            className="flex-1 py-3 text-sm font-bold rounded-xl border border-border text-text-secondary active:scale-95 transition-all"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => { if (joinCode.length === 5) onJoinRoom(joinCode); }}
            disabled={joinCode.length !== 5}
            className="flex-1 py-3 text-sm font-bold rounded-xl btn-gradient active:scale-95 transition-all disabled:opacity-40"
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | findstr /i "error"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/life/MultiplayerLobby.tsx
git commit -m "feat: add MultiplayerLobby component with create/join/lobby views"
```

---

### Task 4: OpponentBar Component

**Files:**
- Create: `src/components/life/OpponentBar.tsx`

- [ ] **Step 1: Create the opponent bar component**

```typescript
// src/components/life/OpponentBar.tsx
"use client";

import { cn } from "@/lib/utils/cn";
import type { MultiplayerPlayerState } from "@/hooks/useMultiplayerRoom";

interface OpponentBarProps {
  players: MultiplayerPlayerState[];
  className?: string;
}

export default function OpponentBar({ players, className }: OpponentBarProps) {
  if (players.length === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-0 inset-x-0 z-30 flex items-center gap-2 px-3 py-2 bg-black/90 backdrop-blur-sm border-t border-white/10 overflow-x-auto",
      className
    )}>
      {players.map((p) => (
        <div
          key={p.playerId}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex-shrink-0"
        >
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-xs font-semibold text-white/70 max-w-[60px] truncate">
            {p.name}
          </span>
          <span className="text-sm font-bold text-white tabular-nums">
            {p.life}
          </span>
          {p.poisonCounters > 0 && (
            <span className="text-xs font-bold text-green-400 tabular-nums">
              {p.poisonCounters}☠
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | findstr /i "error"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/life/OpponentBar.tsx
git commit -m "feat: add OpponentBar component for remote player life display"
```

---

### Task 5: Integrate Multiplayer into PlayerSetup

**Files:**
- Modify: `src/components/life/PlayerSetup.tsx`

- [ ] **Step 1: Add multiplayer props and section to PlayerSetup**

Add new props to the `PlayerSetupProps` interface:

```typescript
interface PlayerSetupProps {
  defaultPlayerCount?: number;
  defaultStartingLife?: number;
  onStart: (
    playerCount: number,
    startingLife: number,
    playerNames: string[],
    playerColors: string[],
    options: GameOptions
  ) => void;
  onShowMatchHistory?: () => void;
  playgroupMembers?: PlaygroupMember[];
  // New multiplayer props:
  multiplayerRoom?: {
    roomCode: string | null;
    isHost: boolean;
    isConnected: boolean;
    remotePlayers: import("@/hooks/useMultiplayerRoom").MultiplayerPlayerState[];
    onCreateRoom: () => void;
    onJoinRoom: (code: string) => void;
    onLeaveRoom: () => void;
    onStartGame: () => void;
  };
}
```

Add the import at the top of the file:

```typescript
import MultiplayerLobby from "@/components/life/MultiplayerLobby";
```

Add a multiplayer section in the JSX, below the existing game timer section (after the Turn Timer `</div>` around line 340), before the start button. Insert:

```typescript
{/* Multiplayer */}
{multiplayerRoom && (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold">Multiplayer</span>
      <div className="h-px flex-1 bg-border" />
    </div>
    <MultiplayerLobby
      roomCode={multiplayerRoom.roomCode}
      isHost={multiplayerRoom.isHost}
      isConnected={multiplayerRoom.isConnected}
      remotePlayers={multiplayerRoom.remotePlayers}
      localPlayer={{ name: playerNames[0], color: MTG_PLAYER_COLORS.find(c => c.key === selectedColorKeys[0])?.color ?? "#607D8B" }}
      onCreateRoom={multiplayerRoom.onCreateRoom}
      onJoinRoom={multiplayerRoom.onJoinRoom}
      onLeaveRoom={multiplayerRoom.onLeaveRoom}
      onStartGame={multiplayerRoom.onStartGame}
    />
  </div>
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | findstr /i "error"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/life/PlayerSetup.tsx
git commit -m "feat: integrate MultiplayerLobby into PlayerSetup"
```

---

### Task 6: Integrate Multiplayer into Life Page (Game Mode)

**Files:**
- Modify: `src/app/life/page.tsx`

- [ ] **Step 1: Add multiplayer hook and state management**

Add imports at the top of `src/app/life/page.tsx`:

```typescript
import { useMultiplayerRoom } from "@/hooks/useMultiplayerRoom";
import type { MultiplayerPlayerState, GameEndPayload } from "@/hooks/useMultiplayerRoom";
import OpponentBar from "@/components/life/OpponentBar";
```

Inside `LifePage()`, after the existing hook calls (after `usePlaygroup()`), add:

```typescript
const multiplayer = useMultiplayerRoom();
const [isMultiplayerMode, setIsMultiplayerMode] = useState(false);
```

- [ ] **Step 2: Add Presence tracking effect**

After the existing `useEffect` blocks, add an effect that syncs local player state to Presence whenever it changes:

```typescript
// Sync local player state to multiplayer room
useEffect(() => {
  if (!isMultiplayerMode || !multiplayer.isConnected || players.length === 0) return;
  const localPlayer = players[0];
  multiplayer.trackState({
    playerId: localPlayer.id,
    name: localPlayer.name,
    color: localPlayer.color,
    life: localPlayer.life,
    poisonCounters: localPlayer.poisonCounters,
    energyCounters: localPlayer.energyCounters,
    experienceCounters: localPlayer.experienceCounters,
    isMonarch: localPlayer.isMonarch,
    hasInitiative: localPlayer.hasInitiative,
    dungeonLevel: localPlayer.dungeonLevel,
    commanderDamage: localPlayer.commanderDamage,
  });
}, [isMultiplayerMode, multiplayer.isConnected, players]);
```

- [ ] **Step 3: Wire multiplayer into PlayerSetup rendering**

In the `if (!gameStarted)` block where `<PlayerSetup>` is rendered, pass the multiplayer room props:

```typescript
<PlayerSetup
  defaultStartingLife={settings.defaultStartingLife}
  defaultPlayerCount={settings.defaultPlayerCount}
  onShowMatchHistory={() => setShowMatchHistory(true)}
  playgroupMembers={playgroupMembers}
  multiplayerRoom={{
    roomCode: multiplayer.roomCode,
    isHost: multiplayer.isHost,
    isConnected: multiplayer.isConnected,
    remotePlayers: multiplayer.remotePlayers,
    onCreateRoom: () => { multiplayer.createRoom(); setIsMultiplayerMode(true); },
    onJoinRoom: (code) => { multiplayer.joinRoom(code); setIsMultiplayerMode(true); },
    onLeaveRoom: () => { multiplayer.leaveRoom(); setIsMultiplayerMode(false); },
    onStartGame: () => {
      multiplayer.broadcastGameStart(startingLife || settings.defaultStartingLife);
      // Trigger local game start with 1 player (self only)
    },
  }}
  onStart={(count, life, names, colors, options) => {
    setGameOptions(options);
    setTurnOrder(computeClockwiseOrder(options.layout, isMultiplayerMode ? 1 : count));
    if (options.gameTimer) {
      setGameSecondsLeft(options.gameTimerMinutes * 60);
      if (isMultiplayerMode || count === 1) setGameTimerRunning(true);
    }
    if (options.turnTimer && (isMultiplayerMode || count === 1)) {
      setTurnTimerRunning(true);
    }
    setupGame(isMultiplayerMode ? 1 : count, life, isMultiplayerMode ? [names[0]] : names, isMultiplayerMode ? [colors[0]] : colors);
  }}
/>
```

- [ ] **Step 4: Add multiplayer game-start listener for non-host players**

Add an effect to listen for the game-start broadcast:

```typescript
// Non-host: start game when host broadcasts game-start
useEffect(() => {
  if (!isMultiplayerMode || multiplayer.isHost) return;
  if (multiplayer.gameStarted && !gameStarted) {
    setupGame(1, startingLife || settings.defaultStartingLife, [], []);
  }
}, [multiplayer.gameStarted, isMultiplayerMode, multiplayer.isHost, gameStarted]);
```

- [ ] **Step 5: Render OpponentBar when in multiplayer game mode**

Inside the game-started rendering section (after `renderPlayers()`), add the opponent bar conditionally:

```typescript
{isMultiplayerMode && (
  <OpponentBar players={multiplayer.remotePlayers} />
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | findstr /i "error"`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/app/life/page.tsx
git commit -m "feat: integrate multiplayer mode into life counter page"
```

---

### Task 7: Game History Integration (End Game Broadcast)

**Files:**
- Modify: `src/app/life/page.tsx`

- [ ] **Step 1: Modify the EndGameModal save handler for multiplayer broadcast**

In the existing `onSave` handler of `<EndGameModal>`, after the match is saved locally, add the broadcast:

```typescript
// After the existing saveMatch() and addGameLogEntry() calls:
if (isMultiplayerMode && multiplayer.isHost) {
  multiplayer.broadcastGameEnd({
    players: payload.players.map((p) => ({
      name: p.playerName,
      finalLife: p.finalLife,
      isWinner: p.isWinner,
      color: p.color,
    })),
    startingLife: payload.startingLife,
    playerCount: payload.playerCount,
    format: payload.format ?? "casual",
    durationSecs: payload.durationSecs,
    notes: payload.notes,
    endedAt: payload.endedAt,
  });
}
```

- [ ] **Step 2: Add effect to handle received game-end payload (non-host)**

Add an effect that saves match history when a game-end broadcast is received:

```typescript
// Non-host: save match when game-end broadcast received
useEffect(() => {
  if (!multiplayer.gameEndPayload || multiplayer.isHost) return;
  const payload = multiplayer.gameEndPayload;

  const localPlayerName = players[0]?.name ?? "Player";
  const matchPlayer = payload.players.find((p) => p.name === localPlayerName);
  const isWinner = matchPlayer?.isWinner ?? false;
  const hasDraw = !payload.players.some((p) => p.isWinner);
  const result: "win" | "loss" | "draw" = hasDraw ? "draw" : isWinner ? "win" : "loss";
  const opponents = payload.players
    .filter((p) => p.name !== localPlayerName)
    .map((p) => p.name)
    .join(", ");

  const matchPayload = {
    startedAt: gameStartedAt ? new Date(gameStartedAt).toISOString() : new Date().toISOString(),
    endedAt: payload.endedAt,
    durationSecs: payload.durationSecs,
    startingLife: payload.startingLife,
    playerCount: payload.playerCount,
    format: payload.format,
    notes: payload.notes,
    players: payload.players.map((p, i) => ({
      playerName: p.name,
      color: p.color,
      startingLife: payload.startingLife,
      finalLife: p.finalLife,
      poisonTotal: 0,
      commanderDmg: 0,
      isWinner: p.isWinner,
      playerOrder: i,
    })),
  };

  saveMatch(matchPayload);
  addGameLogEntry({
    date: payload.endedAt,
    deckName: localPlayerName,
    result,
    format: payload.format,
    playerCount: payload.playerCount,
    notes: payload.notes,
    opponentNames: opponents || undefined,
  });

  // Clean up and exit game
  exitFullscreen();
  newGame();
  multiplayer.leaveRoom();
  setIsMultiplayerMode(false);
}, [multiplayer.gameEndPayload]);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | findstr /i "error"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/life/page.tsx
git commit -m "feat: add multiplayer game-end broadcast and match history saving"
```

---

### Task 8: Manual Integration Test

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Test room creation flow**

1. Open `http://localhost:3000/life` in browser
2. Enter player name, pick color
3. Tap "Create Room" in multiplayer section
4. Verify 5-char room code appears
5. Verify you appear in the lobby player list

- [ ] **Step 3: Test room joining (second browser tab/device)**

1. Open a second browser tab to `http://localhost:3000/life`
2. Enter a different player name/color
3. Tap "Join Room", enter the code from step 2
4. Verify both players appear in both lobbies

- [ ] **Step 4: Test game start and sync**

1. In the host tab, tap "Start Game"
2. Verify both tabs enter game mode
3. Change life in one tab — verify the opponent bar in the other tab updates within ~200ms

- [ ] **Step 5: Test game end and history save**

1. In the host tab, open menu → End & Save
2. Select a winner, confirm
3. Verify both tabs exit game mode
4. Check game history/match records saved on both tabs

- [ ] **Step 6: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix: address issues found during multiplayer integration testing"
```

---

### Task 9: Final Cleanup and Push

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Remove puppeteer from node_modules (installed earlier for PDF)**

Run: `npm uninstall puppeteer`

- [ ] **Step 3: Push to main**

```bash
git push origin main
```
