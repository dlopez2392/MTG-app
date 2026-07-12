# Phase 3c — Ban-list Watchdog — Implementation Plan

**Date:** 2026-07-11
**Branch:** `feat/banlist-watchdog` (base = current `main` @ 79986d8)
**Spec:** `docs/superpowers/specs/2026-07-08-design-modernization-roadmap-design.md` §3c
**Scope decision (danlo, 2026-07-11):** FULL — detection + dashboard alert + PWA push. Conservative B&R heuristic (never emit a false "X is banned"; when card extraction is uncertain, degrade to "B&R update — review your {format} decks").

---

## Global constraints (bind every task)

- TypeScript strict; `npx tsc --noEmit` and `npm run lint` (bare `eslint`) green per task.
- Next.js 16 App Router: `params` is a Promise (`await params`); read `node_modules/next/dist/docs/` before novel APIs.
- API routes: `const { userId } = await auth()` from `@clerk/nextjs/server`; scope every query `.eq("user_id", userId)`; Supabase via `getSupabase()` (service role, app-layer RLS).
- snake_case in DB, camelCase to frontend.
- Migrations are MANUAL: SQL pasted into Supabase Dashboard → SQL Editor. Any migration is a **danlo-gated step** — implementer writes the `.sql` file; danlo runs it; note it in progress before dependent code is verified live.
- Dev server: `npm run dev` = **port 3000** (CLAUDE.md's "3001" is stale). Stale SW serves cached shell on localhost — unregister via DevTools if pages look stale.
- Pure logic verified via temp `npx tsx` FILE, deleted before commit (never committed).

## NEW DEPENDENCY DECISION (must confirm before Task 4)

Sending Web Push requires VAPID-signed encrypted payloads. The realistic path is the **`web-push`** npm package (MIT, free, ~standard). This is a *new dependency* — it is NOT a paid service, so it fits "near-free / no new paid services," but it does add a dep. **Alternative:** hand-roll VAPID signing with Node `crypto` (no dep, ~120 lines, fiddly ECDH/HKDF — higher bug risk). **Plan assumes `web-push` is approved.** If danlo vetoes any new dep, Task 4 swaps to the hand-rolled signer (larger, riskier). Flag resolved before Task 4 starts.

---

## Data model (Task 0 migration — `supabase/migrations/010_push_subscriptions.sql`)

```sql
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id);

create table if not exists banlist_events (
  id            text primary key,          -- stable hash of (announcement url + card + format)
  card_name     text not null,
  format        text not null,
  status        text not null,             -- 'banned' | 'restricted' | 'unbanned' | 'review'
  announced_at  timestamptz not null,
  source_url    text not null,
  source_title  text not null,
  created_at    timestamptz not null default now()
);

create table if not exists banlist_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  event_id    text not null references banlist_events(id),
  deck_ids    text[] not null default '{}',
  seen        boolean not null default false,
  pushed      boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, event_id)
);
create index if not exists banlist_notif_user_idx on banlist_notifications(user_id);
```
(RLS: follow existing app-layer pattern — no Postgres RLS policies needed; service role only, always `.eq("user_id", userId)`.)

---

## Task 1 — B&R detector (pure logic) `src/lib/banlist/detect.ts`

**Exports:**
- `interface BanlistEvent { id; cardName; format; status: "banned"|"restricted"|"unbanned"|"review"; announcedAt; sourceUrl; sourceTitle }`
- `function isBanlistAnnouncement(item: NewsItem): boolean` — title gate: matches `/banned|restricted|b&r|b & r/i` AND `/announcement|update|list/i`, feedKey === "wizards" only (authoritative source).
- `function extractBanlistEvents(item: NewsItem, knownCards: Set<string>): BanlistEvent[]` — CONSERVATIVE:
  - Parse `item.description` (already stripped to 200 chars) + title for `<card> is (banned|restricted|no longer ...)` near a format keyword (Standard/Pioneer/Modern/Legacy/Vintage/Pauper/Commander/Alchemy/Brawl/Historic/Timeless).
  - A card is only emitted if it exact-matches (case-insensitive) a name in `knownCards` (the caller passes deck-card names — we only care about cards a user actually runs; avoids Scryfall dependency and false positives).
  - If the item IS a B&R announcement but NO known card matched, emit ONE `status:"review"` event per format mentioned: `{cardName:"", format, status:"review"}` → renders as "B&R update — review your {format} decks".
  - `id` = stable hash `${sourceUrl}|${cardName}|${format}` (djb2 or simple string hash, deterministic).
- No network, no Scryfall. Pure over (NewsItem, Set<string>).

**Verify (temp tsx):** feed synthetic WotC items ("Lightning Bolt is banned in Modern", multi-format post, non-B&R news, empty-match post) → assert correct events, review-fallback fires, non-announcements yield [].

## Task 2 — Watchdog scan endpoint `src/app/api/banlist/scan/route.ts` (GET)

- `auth()` → userId (401 if none).
- Fetch user decks + deck_cards (reuse existing deck query pattern / hook-equivalent server query). Build `knownCards` Set of lowercased card names, and a name→deckIds map (respect deck `format` when the event has a concrete format; `review` events match decks of that format only).
- Fetch WotC feed via existing `/api/news` internals — reuse `FEEDS.find(f=>f.key==="wizards")` + `parseRSS` directly (do NOT re-implement RSS).
- `items.filter(isBanlistAnnouncement).flatMap(i => extractBanlistEvents(i, knownCards))`.
- Upsert events into `banlist_events`; for each event that matches ≥1 deck, upsert `banlist_notifications` (user_id, event_id, deck_ids) with `on conflict (user_id,event_id) do nothing`.
- Return `{ notifications: [{ event, deckIds, seen }] }` (camelCase), newest first.
- `revalidate` / caching: this is per-user; keep dynamic. Cheap (one WotC fetch, cached 30min by the news layer's revalidate).

## Task 3 — Dashboard alert `src/components/home/BanlistAlert.tsx` + wire into `DashboardStrip`

- Client component; guard `isSignedIn` (guests have no server decks → render nothing). Fetch `/api/banlist/scan` on mount (same effect pattern as the sets fetch already in DashboardStrip).
- If any unseen notification: render an alert card ABOVE the stat chips: `banned`/`restricted` → `border-banned/40`, text like "**Lightning Bolt** banned in Modern — 2 decks affected"; `review` → neutral accent, "B&R update — review your Modern decks". Links to affected deck(s) and `source_url`.
- Dismiss (X) → POST `/api/banlist/seen` marking `seen=true` (Task 3b tiny route). After dismiss, if the browser supports push and permission not yet decided → surface the push opt-in (Task 5) IN CONTEXT (per spec: never on load).
- Empty/none → render nothing (component returns null; keeps `hasAnything` behavior intact).

## Task 4 — Push infra (VAPID + subscribe) 

- **4a env:** generate VAPID keypair (`npx web-push generate-vapid-keys`), add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto) to `.env.local` + Vercel. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` for the client. **danlo-gated** (secrets).
- **4b SW push handler** — append to `public/sw.js`: `push` event → `showNotification(title, {body, icon:'/icons/icon-192.png', data:{url}})`; `notificationclick` → focus/open `data.url`. Bump `CACHE_NAME` v0.5.1 → **v0.5.2** (SW change must cache-bust or clients keep old SW — this is the exact gremlin from goldfish).
- **4c subscribe route** `src/app/api/push/subscribe/route.ts` (POST): auth → upsert `push_subscriptions` (endpoint unique). DELETE to unsubscribe.
- **4d client helper** `src/lib/push/subscribe.ts`: `askAndSubscribe()` — `Notification.requestPermission()`, `registration.pushManager.subscribe({userVisibleOnly:true, applicationServerKey})`, POST to subscribe route. iOS caveat: only works in an installed PWA + user gesture; degrade gracefully (feature-detect `'PushManager' in window`).

## Task 5 — In-context opt-in + send-on-scan

- **5a opt-in UI:** small "Get notified about bans" button inside the dismissed-alert flow (Task 3) — calls `askAndSubscribe()`. Never shown on load; only after a user has seen an alert. Respects prior denial.
- **5b send:** `src/lib/push/send.ts` `sendPush(userId, payload)` using `web-push` + VAPID env; look up user's subscriptions, send, delete rows on 404/410 (expired). In the scan endpoint (Task 2), for any NEW notification where `pushed=false` AND user has subscriptions, send push and set `pushed=true`. (Best-effort; wrap in try/catch, never fail the scan response.)
- Note: no cron in scope — scan runs when the dashboard loads (per-user, cheap). A scheduled Vercel Cron for proactive push while app is closed = explicit follow-up (needs cron config + a way to enumerate users; deferred).

## Task 6 — Final: tsc + lint + build + branch review + on-device QA

- `npx tsc --noEmit`, `npm run lint`, `npx next build` all green.
- Whole-branch review (opus) before merge.
- danlo on-device QA: dashboard alert appears for a seeded ban matching a real deck; dismiss; opt-in; (installed PWA) receives a test push. Stale-SW check first.
- Merge gate: danlo explicit go-ahead (no autonomous merge).

---

## Verification stack (per task)
`npx tsc --noEmit` · `npx eslint <files>` · `npx next build` (final) · `npx tsx temp-*.ts` for pure logic (delete before commit) · phone-width visual · SW-unregister before browser check.

## Open follow-ups (out of this phase, logged for final review)
- Vercel Cron for push while app closed (proactive, not load-triggered).
- Scryfall cross-ref for cards the user doesn't run yet (currently only matches owned cards — by design, conservative).
- `deck.format` is optional free-text; format matching is best-effort (missing-format decks match on card name alone).
