# QR Room Join (Phase 3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The multiplayer life-counter host sees a QR code next to the room code; friends scan it with their phone camera and land in the room — no typing.

**Architecture:** One tiny zero-dependency QR encoder (`uqr`, ~4KB, MIT — the spec explicitly budgeted "a QR SVG lib") wrapped in a reusable `QrCode` component; the QR renders in `MultiplayerLobby`'s connected view encoding `{origin}/life?room={CODE}`; the life page reads `?room=` client-side on mount and auto-joins via the existing `useMultiplayerRoom().joinRoom(code)`.

**Tech Stack:** Next.js 16, React 19, `uqr` (`renderSVG`), existing Supabase Realtime multiplayer stack (untouched).

## Global Constraints

- **ONE new dependency sanctioned by the spec: `uqr`** (`npm install uqr`) — zero transitive deps; verify that stays true in the lockfile diff. Nothing else added.
- Room codes: 5 chars, alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`; `joinRoom` normalizes case/whitespace (`src/hooks/useMultiplayerRoom.ts:121-122`).
- QR must be scannable on the dark theme: render on a white rounded tile with padding (quiet zone) — a dark-on-dark QR won't scan.
- The auto-join reads `window.location.search` in a mount effect (NOT `useSearchParams` — avoids the Suspense-boundary requirement). Guard with a ref so it fires once; validate the param against `/^[A-HJ-NP-Z2-9]{5}$/i` before joining. If the repo's `react-hooks/set-state-in-effect` lint flags the `joinRoom` call, defer it with `setTimeout(..., 0)` inside the effect and note it in the report — do not suppress the rule.
- No test framework (do not add one). Verification = tsc/eslint/build + live browser checks where stated.
- Work on branch `feat/qr-room-join`; do NOT push; commit per task with the given message + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `uqr` dependency + QrCode component

**Files:**
- Modify: `package.json` / `package-lock.json` (via `npm install uqr`)
- Create: `src/components/ui/QrCode.tsx`

**Interfaces:**
- Produces: `export default function QrCode({ value, size = 160, className }: { value: string; size?: number; className?: string })` — renders the QR as inline SVG on a white rounded tile.

- [ ] **Step 1: Install**

Run: `npm install uqr` from `C:\Users\danlo\MTG-app`. Then check the lockfile diff: `git diff package-lock.json | grep -c '"resolved"'` should show exactly 1 new resolved package (uqr has zero deps). If more appear, STOP and report BLOCKED.

- [ ] **Step 2: Create `src/components/ui/QrCode.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import { renderSVG } from "uqr";
import { cn } from "@/lib/utils/cn";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

/** QR code on a white tile (quiet zone included) so it scans against the dark theme. */
export default function QrCode({ value, size = 160, className }: QrCodeProps) {
  const svg = useMemo(() => renderSVG(value, { border: 2 }), [value]);
  return (
    <div
      className={cn("inline-block rounded-xl bg-white p-2", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`QR code: ${value}`}
      // uqr returns a self-contained <svg> string; it renders our own trusted value only.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
```

Note: `renderSVG`'s option shape — check `node_modules/uqr/dist/index.d.ts` for the exact option name for the quiet-zone border (`border` vs `boundingBox` etc.) and adapt; the SVG must scale to its container (uqr outputs `width="100%"`-style viewBox SVGs; if not, add a CSS child selector `[&>svg]:w-full [&>svg]:h-full` to the wrapper).

- [ ] **Step 3: Verify**

`npx tsc --noEmit` → PASS. `npx eslint src/components/ui/QrCode.tsx` → clean.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/ui/QrCode.tsx
git commit -m "feat: QrCode component backed by uqr"
```

---

### Task 2: QR in the multiplayer lobby's connected view

**Files:**
- Modify: `src/components/life/MultiplayerLobby.tsx` (connected view, ~lines 42-60 — the block showing the big room code + copy button)

**Interfaces:**
- Consumes: `QrCode` from Task 1; the component's existing `roomCode` prop.

- [ ] **Step 1: Add the QR under the room code**

Add `import QrCode from "@/components/ui/QrCode";` to the imports. Inside the connected view (the `if (roomCode && isConnected)` branch), directly below the element rendering the big `{roomCode}` (the `text-3xl font-black tracking-[0.3em]` line and its copy-button row), insert:

```tsx
          <div className="flex flex-col items-center gap-1.5 mt-3">
            <QrCode
              value={`${typeof window !== "undefined" ? window.location.origin : "https://mtghoudini.com"}/life?room=${roomCode}`}
              size={150}
            />
            <p className="text-caption">Scan with a phone camera to join</p>
          </div>
```

(Match the surrounding markup's container — center-aligned within the existing card; adjust wrapper classes to sit visually with the code block above it.)

- [ ] **Step 2: Verify**

`npx tsc --noEmit` → PASS. `npx eslint src/components/life/MultiplayerLobby.tsx` → no NEW errors. Live: `npm run dev` (background; a server may already run on 3000), open `http://localhost:PORT/life`, start Multiplayer → Create Room → the connected view shows a scannable white QR tile under the room code. Screenshot-level check is the controller's; you verify no crash and the SVG element exists (curl the page HTML is NOT enough — this is client-rendered; if you cannot drive a browser, verify tsc/eslint/build and state the render check is deferred to controller). Kill any dev server you started.

- [ ] **Step 3: Commit**

```bash
git add src/components/life/MultiplayerLobby.tsx
git commit -m "feat: show QR join code in multiplayer lobby"
```

---

### Task 3: Auto-join from `?room=` URL + final verification

**Files:**
- Modify: `src/app/life/page.tsx` (mount effect near the existing `useMultiplayerRoom()` usage — the page already holds a `multiplayer` object with `joinRoom`)

**Interfaces:**
- Consumes: the page's existing `multiplayer.joinRoom(code: string)` and `multiplayer.roomCode`.

- [ ] **Step 1: Add the auto-join effect**

In `src/app/life/page.tsx`, locate where `useMultiplayerRoom()` is called (the `multiplayer` object). Add nearby:

```tsx
  // Auto-join a room from a scanned QR link: /life?room=ABC12
  const autoJoinAttempted = useRef(false);
  useEffect(() => {
    if (autoJoinAttempted.current) return;
    const param = new URLSearchParams(window.location.search).get("room");
    if (!param || !/^[A-HJ-NP-Z2-9]{5}$/i.test(param.trim())) return;
    if (multiplayer.roomCode) return; // already in a room
    autoJoinAttempted.current = true;
    multiplayer.joinRoom(param);
    // Clean the URL so refreshes don't re-join
    window.history.replaceState(null, "", "/life");
  }, [multiplayer]);
```

(`useRef`/`useEffect` are already imported in this file — verify; add to the existing import if not. If `react-hooks/set-state-in-effect` flags the `joinRoom` call, wrap it and the `replaceState` in `setTimeout(() => { ... }, 0)` and note it in your report.)

**Critical wiring check:** joining sets `multiplayer.roomCode`/`isConnected`, but confirm the setup screen actually SHOWS the multiplayer lobby state in that case — find how `PlayerSetup` decides to render `MultiplayerLobby` (a toggle/section within setup). If the lobby is hidden behind a user toggle, make `PlayerSetup` treat a non-null `multiplayerRoom.roomCode` as that toggle being on (smallest change that makes the scanned-join state visible — e.g., initialize/force the section open when `roomCode` is present). Report exactly what you changed.

- [ ] **Step 2: Verify**

`npx tsc --noEmit` → PASS. `npx eslint src/app/life/page.tsx src/components/life/PlayerSetup.tsx` → no NEW errors. `npm run build` → succeeds.

Live: with the dev server running, open `http://localhost:PORT/life?room=ABC23` — the page should attempt to join room ABC23 (the lobby section becomes visible showing the room code / connecting state; the room won't have a host, which is fine — the join attempt itself is the test) and the URL bar cleans to `/life`. Open `http://localhost:PORT/life?room=bad!` — no join attempt, page renders normally. If you cannot drive a browser, state these are deferred to the controller.

- [ ] **Step 3: Commit**

```bash
git add src/app/life/page.tsx src/components/life/PlayerSetup.tsx
git commit -m "feat: auto-join multiplayer room from QR link"
```

---

## Self-Review Notes

- **Spec 3a coverage:** host QR display ✓ (Task 2, white quiet-zone tile for dark theme); scan-to-join ✓ (Task 3 URL param auto-join, validated against the room-code alphabet, one-shot, URL cleaned). The sanctioned dependency is exactly the spec's budgeted QR lib.
- **Type consistency:** `QrCode` props defined Task 1 = usage Task 2; `joinRoom(code: string)` verified against `useMultiplayerRoom.ts:44,121`.
- **Open wiring risk made explicit:** whether PlayerSetup shows the lobby on programmatic join is a known unknown — Task 3 carries the investigation + smallest-change instruction rather than a guess.
- **YAGNI:** no deep-link handling for the PWA manifest, no share-sheet integration, no host-side "N joined" toast — the existing lobby already shows joiners via Presence.
