# Ban-list Watchdog v2 (Scryfall legality change detection) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead-RSS ban-list detector with change detection over Scryfall card legalities, reusing the existing dashboard-alert + push pipeline.

**Architecture:** A global `card_legality_snapshot` table caches each watched card's Scryfall legalities. `GET /api/banlist/scan` fetches current legalities for the signed-in user's (format-tagged) deck cards, diffs per-format against the snapshot, emits global `banlist_events` on ban/restrict/unban transitions, then cross-refs the last 90 days of events against the user's decks to produce per-user `banlist_notifications` and push. First sighting baselines silently.

**Tech Stack:** Next.js 16 App Router route handlers, Supabase (service role), Scryfall `/cards/collection` batch API, web-push (already wired), TypeScript strict.

## Global Constraints

- No Postgres RLS; every query scoped `.eq("user_id", userId)`; Supabase via `getSupabase()` service role. (App-layer auth, existing pattern.)
- Every API route starts with `const { userId } = await auth();` → 401 if absent.
- `await params`/`await auth()` (Next 16 async APIs).
- Card legality types already exist: `Legality = "legal"|"not_legal"|"restricted"|"banned"` (`src/types/card.ts`); deck `format` uses Scryfall lowercase keys.
- Snapshot TTL = 24h. Event cross-ref window = 90 days. Untagged decks (`format===""`) skipped.
- Scryfall batch: `POST https://api.scryfall.com/cards/collection`, `{identifiers:[{id}]}`, 75/chunk, UA `MTGHoudini/1.0` (pattern from `src/app/api/import-deck/route.ts:114-125`).
- Verify commands: `npx tsc --noEmit`; `npx eslint <files>`; `npx next build`. Pure-logic tests via `npx tsx <tempfile>` (delete after; `tsx --eval` swallows stdout on this machine — use temp files).
- Work on branch `feat/banlist-watchdog`. Do NOT merge (danlo's gate).

---

### Task 1: Migration 011 — `card_legality_snapshot` table

**Files:**
- Create: `supabase/migrations/011_card_legality_snapshot.sql`

**Interfaces:**
- Produces: table `card_legality_snapshot(scryfall_id text pk, card_name text, legalities jsonb, updated_at timestamptz)`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- 011_card_legality_snapshot.sql
-- Global cache of Scryfall card legalities for ban-list change detection.
-- No RLS: app-layer service-role access only (consistent with existing tables).
create table if not exists card_legality_snapshot (
  scryfall_id text primary key,
  card_name   text not null,
  legalities  jsonb not null,
  updated_at  timestamptz not null default now()
);

create index if not exists idx_card_legality_snapshot_updated
  on card_legality_snapshot (updated_at);
```

- [ ] **Step 2: Apply the migration** to Supabase project `jffcyqwhfbegnctpdzpn` (via Supabase MCP `apply_migration`, name `011_card_legality_snapshot`).

- [ ] **Step 3: Verify** `list_tables` (or `select` on the empty table) shows `card_legality_snapshot`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/011_card_legality_snapshot.sql
git commit -m "feat(banlist): migration 011 card_legality_snapshot"
```

---

### Task 2: Pure `legalityDiff` transition function

**Files:**
- Create: `src/lib/banlist/legalityDiff.ts`
- Test: temp `tsx` script (deleted after).

**Interfaces:**
- Produces:
  ```ts
  export type LegalityStatus = "legal" | "not_legal" | "restricted" | "banned";
  export type TransitionStatus = "banned" | "restricted" | "unbanned";
  export function legalityTransition(
    prev: LegalityStatus | undefined,
    curr: LegalityStatus | undefined
  ): TransitionStatus | null;
  ```
  Rules: `null` if `prev===undefined` (silent baseline) or `prev===curr` or neither side ∈ {banned,restricted}. Else: curr `banned`→`"banned"`; curr `restricted`→`"restricted"`; curr `legal`|`not_legal` while prev ∈ {banned,restricted}→`"unbanned"`.

- [ ] **Step 1: Write the failing test** (temp file `scratch_legalityDiff.ts` at repo root)

```ts
import { legalityTransition } from "./src/lib/banlist/legalityDiff";
const cases: [string, ReturnType<typeof legalityTransition>][] = [
  ["baseline", legalityTransition(undefined, "banned")],        // null (silent)
  ["nochange", legalityTransition("legal", "legal")],           // null
  ["rotation", legalityTransition("legal", "not_legal")],       // null
  ["toBanned", legalityTransition("legal", "banned")],          // "banned"
  ["toRestricted", legalityTransition("legal", "restricted")],  // "restricted"
  ["restToBan", legalityTransition("restricted", "banned")],    // "banned"
  ["unbanned", legalityTransition("banned", "legal")],          // "unbanned"
  ["restUnban", legalityTransition("restricted", "legal")],     // "unbanned"
];
const expected = [null,null,null,"banned","restricted","banned","unbanned","unbanned"];
let ok = true;
cases.forEach(([n,got],i)=>{ const e=expected[i]; if(got!==e){ok=false; console.log("FAIL",n,"got",got,"want",e);} else console.log("ok",n);});
console.log(ok?"ALL PASS":"FAILURES");
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx scratch_legalityDiff.ts`
Expected: error (module/function not found).

- [ ] **Step 3: Implement**

```ts
// src/lib/banlist/legalityDiff.ts
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
```

- [ ] **Step 4: Run to verify PASS**

Run: `npx tsx scratch_legalityDiff.ts`
Expected: `ALL PASS`.

- [ ] **Step 5: Delete temp + commit**

```bash
rm scratch_legalityDiff.ts
git add src/lib/banlist/legalityDiff.ts
git commit -m "feat(banlist): pure legality transition detector"
```

---

### Task 3: Legality snapshot fetch/cache helper

**Files:**
- Create: `src/lib/banlist/legalitySnapshot.ts`

**Interfaces:**
- Consumes: `getSupabase()` from `@/lib/supabase/server`; `LegalityStatus` from `./legalityDiff`.
- Produces:
  ```ts
  export interface CardLegalities { [format: string]: LegalityStatus }
  export interface SnapshotRow { scryfall_id: string; card_name: string; legalities: CardLegalities; }
  // Reads snapshot rows for ids; fetches fresh legalities from Scryfall for
  // ids that are missing OR older than TTL; returns { prev, curr } maps keyed
  // by scryfall_id, and the rows to upsert. Does NOT write (caller upserts).
  export async function loadLegalities(scryfallIds: string[]): Promise<{
    prev: Map<string, CardLegalities>;   // snapshot BEFORE this scan (empty if none)
    curr: Map<string, { name: string; legalities: CardLegalities }>; // freshest known
    toUpsert: SnapshotRow[];             // rows whose legalities were (re)fetched
  }>;
  export const SNAPSHOT_TTL_MS: number;  // 24h
  ```

- [ ] **Step 1: Implement**

```ts
// src/lib/banlist/legalitySnapshot.ts
import { getSupabase } from "@/lib/supabase/server";
import type { LegalityStatus } from "./legalityDiff";

export type CardLegalities = Record<string, LegalityStatus>;
export interface SnapshotRow {
  scryfall_id: string;
  card_name: string;
  legalities: CardLegalities;
}
export const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

interface DbRow {
  scryfall_id: string;
  card_name: string;
  legalities: CardLegalities;
  updated_at: string;
}

const SCRYFALL_CHUNK = 75;

async function fetchLegalities(
  ids: string[]
): Promise<Map<string, { name: string; legalities: CardLegalities }>> {
  const out = new Map<string, { name: string; legalities: CardLegalities }>();
  for (let i = 0; i < ids.length; i += SCRYFALL_CHUNK) {
    const chunk = ids.slice(i, i + SCRYFALL_CHUNK);
    try {
      const res = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "MTGHoudini/1.0",
          Accept: "application/json",
        },
        body: JSON.stringify({ identifiers: chunk.map((id) => ({ id })) }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        data?: { id: string; name: string; legalities: CardLegalities }[];
      };
      for (const c of data.data ?? []) {
        out.set(c.id, { name: c.name, legalities: c.legalities });
      }
    } catch {
      // best-effort; leave these ids unfetched (caller keeps prior snapshot)
    }
  }
  return out;
}

/**
 * Load prior snapshot + freshest legalities for the given card ids.
 * Refetches ids that are missing from the snapshot or older than the TTL.
 */
export async function loadLegalities(scryfallIds: string[]): Promise<{
  prev: Map<string, CardLegalities>;
  curr: Map<string, { name: string; legalities: CardLegalities }>;
  toUpsert: SnapshotRow[];
}> {
  const prev = new Map<string, CardLegalities>();
  const curr = new Map<string, { name: string; legalities: CardLegalities }>();
  const toUpsert: SnapshotRow[] = [];
  const ids = [...new Set(scryfallIds.filter(Boolean))];
  if (ids.length === 0) return { prev, curr, toUpsert };

  const sb = getSupabase();
  const { data } = await sb
    .from("card_legality_snapshot")
    .select("scryfall_id, card_name, legalities, updated_at")
    .in("scryfall_id", ids);

  const now = Date.now();
  const stale: string[] = [];
  const rows = (data ?? []) as DbRow[];
  const byId = new Map(rows.map((r) => [r.scryfall_id, r]));
  for (const id of ids) {
    const row = byId.get(id);
    if (row) {
      prev.set(id, row.legalities);
      curr.set(id, { name: row.card_name, legalities: row.legalities });
      if (now - new Date(row.updated_at).getTime() > SNAPSHOT_TTL_MS) stale.push(id);
    } else {
      stale.push(id); // missing → fetch (silent baseline; no prev)
    }
  }

  if (stale.length > 0) {
    const fetched = await fetchLegalities(stale);
    for (const [id, v] of fetched) {
      curr.set(id, v); // overwrite with fresh
      toUpsert.push({ scryfall_id: id, card_name: v.name, legalities: v.legalities });
    }
  }

  return { prev, curr, toUpsert };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/banlist/legalitySnapshot.ts
git commit -m "feat(banlist): Scryfall legality snapshot cache helper"
```

---

### Task 4: Rewrite `/api/banlist/scan` to use legality diffs

**Files:**
- Modify (replace body): `src/app/api/banlist/scan/route.ts`

**Interfaces:**
- Consumes: `loadLegalities` (Task 3), `legalityTransition` (Task 2), `sendPush` (`@/lib/push/send`), `getSupabase`, `auth`.
- Produces: unchanged response shape `{ notifications: NotificationOut[] }` (fields: eventId, cardName, format, status, sourceUrl, sourceTitle, announcedAt, seen, decks[{id,name}]). `BanlistAlert.tsx` unchanged.

- [ ] **Step 1: Replace the route** with:

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push/send";
import { legalityTransition, type TransitionStatus } from "@/lib/banlist/legalityDiff";
import { loadLegalities } from "@/lib/banlist/legalitySnapshot";

export const dynamic = "force-dynamic";

const CROSSREF_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

interface DeckRow { id: string; name: string; format: string | null }
interface DeckCardRow { scryfall_id: string; name: string; deck_id: string }
interface NotificationOut {
  eventId: string; cardName: string; format: string;
  status: TransitionStatus | "review";
  sourceUrl: string; sourceTitle: string; announcedAt: string;
  seen: boolean; decks: { id: string; name: string }[];
}

function normFormat(f: string | null | undefined): string {
  return (f ?? "").trim().toLowerCase();
}
// djb2 → base36, stable across runs.
function hashId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = getSupabase();

  // 1. Load decks + deck cards.
  const [decksRes, cardsRes] = await Promise.all([
    sb.from("decks").select("id, name, format").eq("user_id", userId),
    sb.from("deck_cards").select("scryfall_id, name, deck_id").eq("user_id", userId),
  ]);
  if (decksRes.error || cardsRes.error) {
    return NextResponse.json({ error: "Failed to load decks" }, { status: 500 });
  }
  const decks = (decksRes.data ?? []) as DeckRow[];
  const deckCards = (cardsRes.data ?? []) as DeckCardRow[];
  const deckById = new Map<string, DeckRow>();
  for (const d of decks) deckById.set(d.id, d);

  // 2. Watch set = deck cards whose deck has a recognized (non-empty) format.
  const watch = deckCards.filter((c) => {
    const d = deckById.get(c.deck_id);
    return c.scryfall_id && !!normFormat(d?.format);
  });

  // 3. Load prior + current legalities (refetch stale/missing).
  const ids = watch.map((c) => c.scryfall_id);
  const { prev, curr, toUpsert } = await loadLegalities(ids);

  // 4. Per-format diff → global banlist_events.
  const eventRows: {
    id: string; card_name: string; format: string; status: TransitionStatus;
    announced_at: string; source_url: string; source_title: string;
  }[] = [];
  const nowIso = new Date().toISOString();
  const seenEvent = new Set<string>();
  for (const c of watch) {
    const d = deckById.get(c.deck_id);
    const fmt = normFormat(d?.format);
    const p = prev.get(c.scryfall_id)?.[fmt];
    const q = curr.get(c.scryfall_id)?.legalities?.[fmt];
    const t = legalityTransition(p, q);
    if (!t) continue;
    const name = curr.get(c.scryfall_id)?.name ?? c.name;
    const id = hashId(`${c.scryfall_id}|${fmt}|${t}`);
    if (seenEvent.has(id)) continue;
    seenEvent.add(id);
    eventRows.push({
      id, card_name: name, format: fmt, status: t, announced_at: nowIso,
      source_url: `https://scryfall.com/card/${c.scryfall_id}`,
      source_title: `${name} — ${fmt} legality changed`,
    });
  }
  if (eventRows.length > 0) {
    await sb.from("banlist_events").upsert(eventRows, { onConflict: "id" });
  }

  // 5. Upsert snapshot (also the silent baseline for first sightings).
  if (toUpsert.length > 0) {
    await sb.from("card_legality_snapshot").upsert(
      toUpsert.map((r) => ({ ...r, updated_at: nowIso })),
      { onConflict: "scryfall_id" }
    );
  }

  // 6. Cross-ref recent global events (last 90d) against THIS user's decks.
  const since = new Date(Date.now() - CROSSREF_WINDOW_MS).toISOString();
  const { data: recentEvents } = await sb
    .from("banlist_events")
    .select("id, card_name, format")
    .gte("announced_at", since);
  if (recentEvents && recentEvents.length > 0) {
    // name(lower)+format → deckIds that run it
    const runIndex = new Map<string, Set<string>>();
    for (const c of deckCards) {
      const d = deckById.get(c.deck_id);
      const fmt = normFormat(d?.format);
      if (!fmt) continue;
      const key = `${c.name.toLowerCase()}|${fmt}`;
      let set = runIndex.get(key);
      if (!set) { set = new Set(); runIndex.set(key, set); }
      set.add(c.deck_id);
    }
    const notifRows: { user_id: string; event_id: string; deck_ids: string[] }[] = [];
    for (const ev of recentEvents as { id: string; card_name: string; format: string }[]) {
      const ids2 = runIndex.get(`${ev.card_name.toLowerCase()}|${normFormat(ev.format)}`);
      if (ids2 && ids2.size > 0) {
        notifRows.push({ user_id: userId, event_id: ev.id, deck_ids: [...ids2] });
      }
    }
    if (notifRows.length > 0) {
      await sb.from("banlist_notifications").upsert(notifRows, {
        onConflict: "user_id,event_id", ignoreDuplicates: true,
      });
    }
  }

  // 7. Fire push for not-yet-pushed notifications (best-effort), mark pushed.
  const { data: unpushed } = await sb
    .from("banlist_notifications")
    .select("event_id, deck_ids, banlist_events(card_name, format, status)")
    .eq("user_id", userId)
    .eq("pushed", false);
  if (unpushed && unpushed.length > 0) {
    const pushedIds: string[] = [];
    for (const n of unpushed) {
      const ev = Array.isArray(n.banlist_events) ? n.banlist_events[0] : n.banlist_events;
      if (!ev) continue;
      const deckCount = (n.deck_ids ?? []).length;
      const verb = ev.status === "unbanned" ? "unbanned" : ev.status;
      const title = `${ev.card_name} ${verb}${ev.format ? ` in ${ev.format}` : ""}`;
      const body = `${deckCount} deck${deckCount !== 1 ? "s" : ""} affected`;
      await sendPush(userId, { title, body, url: "/", tag: n.event_id });
      pushedIds.push(n.event_id);
    }
    if (pushedIds.length > 0) {
      await sb.from("banlist_notifications").update({ pushed: true })
        .eq("user_id", userId).in("event_id", pushedIds);
    }
  }

  // 8. Return this user's notifications (joined), newest first.
  const { data: notifs, error: notifErr } = await sb
    .from("banlist_notifications")
    .select("event_id, deck_ids, seen, banlist_events(card_name, format, status, source_url, source_title, announced_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (notifErr) return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });

  const out: NotificationOut[] = [];
  for (const n of notifs ?? []) {
    const ev = Array.isArray(n.banlist_events) ? n.banlist_events[0] : n.banlist_events;
    if (!ev) continue;
    const deckIds: string[] = n.deck_ids ?? [];
    out.push({
      eventId: n.event_id, cardName: ev.card_name, format: ev.format, status: ev.status,
      sourceUrl: ev.source_url, sourceTitle: ev.source_title, announcedAt: ev.announced_at,
      seen: n.seen,
      decks: deckIds.map((id) => deckById.get(id)).filter((d): d is DeckRow => !!d)
        .map((d) => ({ id: d.id, name: d.name })),
    });
  }
  return NextResponse.json({ notifications: out });
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/app/api/banlist/scan/route.ts src/lib/banlist/legalitySnapshot.ts src/lib/banlist/legalityDiff.ts`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/banlist/scan/route.ts
git commit -m "feat(banlist): rewrite scan to Scryfall legality change detection"
```

---

### Task 5: Retire the RSS detector + build

**Files:**
- Delete: `src/lib/banlist/detect.ts`
- Verify: no remaining importers.

- [ ] **Step 1: Confirm no importers remain**

Run: `grep -rn "banlist/detect\|extractBanlistEvents\|isBanlistAnnouncement" src` — expect no hits after the scan rewrite (v1 scan was the only consumer).

- [ ] **Step 2: Delete + full build**

```bash
git rm src/lib/banlist/detect.ts
npx tsc --noEmit && npx next build
```
Expected: build succeeds; no reference errors.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(banlist): remove dead RSS B&R detector"
```

---

### Task 6: Integration verification (real deck, real pipeline)

**Files:** none (verification only). Uses Supabase MCP + browser on the dev server.

- [ ] **Step 1** Start dev server (`npm run dev`; read the bound port).
- [ ] **Step 2** Trigger a scan (load home while signed in, or `fetch("/api/banlist/scan")`). Confirm it 200s and `card_legality_snapshot` populates for the account's format-tagged deck cards (silent baseline — expect 0 notifications).
- [ ] **Step 3** Simulate a ban: pick one `scryfall_id` from a Commander deck, edit its snapshot row so `legalities.commander='legal'` (i.e. a prior "legal" state), then set the card's *current* to differ — simplest: `update card_legality_snapshot set legalities = jsonb_set(legalities,'{commander}','"legal"'), updated_at = now() - interval '2 days' where scryfall_id = '<id>'` (forces a refetch; if the card is genuinely legal in commander, instead pick a card actually banned in commander and set the snapshot to 'legal' so the refetch sees 'banned').
- [ ] **Step 4** Re-scan. Confirm: a `banlist_events` row appears, a `banlist_notifications` row for the user, and (with a push subscription present) `sendPush` fires — reuse the SW-postMessage probe already proven this session.
- [ ] **Step 5** Clean up any test rows created (`banlist_events`/`banlist_notifications` for the simulated card; leave real snapshot rows).
- [ ] **Step 6** No commit (verification only). Record results for the final review.

---

## Self-Review

- **Spec coverage:** migration (T1), pure diff + silent baseline (T2), snapshot cache/TTL/Scryfall batch (T3), scan rewrite incl. per-format diff + event upsert + 90d cross-ref fan-out + push + unchanged response (T4), retire detector (T5), integration verify (T6). Untagged-deck skip in T4 step-1 watch filter. Unbanned handling in T2 + push verb in T4. All spec sections mapped.
- **Placeholder scan:** none — all steps carry real code/SQL/commands.
- **Type consistency:** `legalityTransition`/`TransitionStatus` (T2) consumed in T4; `loadLegalities` return shape (T3) matches T4 destructure (`prev`,`curr`,`toUpsert`); `curr` values are `{name,legalities}` — used as `.name` and `.legalities[fmt]` in T4. Event/notification columns match migration 010 (`card_name, format, status, announced_at, source_url, source_title`; `deck_ids`, `pushed`, `seen`).
