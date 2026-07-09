# Experience Foundation (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize MTG Houdini's UX foundation — reduced-motion-safe motion layer, visible loading/fallback states, restructured navigation (Search in bottom nav, grouped More sheet), a desktop sidebar shell, and a contrast/consistency pass.

**Architecture:** Pure CSS + Tailwind v4 utilities in `globals.css` for motion (no new animation library). New `MoreSheet` and `SideNav` client components beside the existing `BottomNav`. Small surgical edits to existing components; no data-layer changes.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (`@theme inline` tokens in `src/app/globals.css`), TypeScript strict.

## Global Constraints

- **No new dependencies.** Everything ships with CSS, React, and existing utilities (`cn()` from `@/lib/utils/cn`).
- **No test framework exists in this repo** (no jest/vitest; `npm run lint` = eslint). Verification per task = `npx tsc --noEmit` (must pass), `npx eslint <changed files>` (no NEW errors — the repo has 2 pre-existing issues in HandSimulator.tsx), and a visual check in the dev server (`npm run dev`, port 3000).
- **Design tokens only:** colors come from `@theme` variables in `src/app/globals.css` (`--color-accent: #ED9A57`, `--color-bg-primary: #0B0E14`, etc.). Never hardcode new hex values in components unless this plan specifies the exact value.
- **Phone-first:** default styles target ~390-430px; desktop changes live behind `lg:` only.
- **Windows dev environment;** commands run in PowerShell or Git Bash. Commit after every task with the message given in the task.
- **AGENTS.md warning applies:** this is Next.js 16 — if unsure about an API, check `node_modules/next/dist/docs/` rather than assuming.
- Do NOT touch the card scanner (`src/components/scan/`, `src/app/scan/`) — it is deliberately out of the UI.
- `suppressHydrationWarning` appears on interactive elements (browser extensions inject attributes); preserve it where present.

---

### Task 1: Motion & accessibility CSS foundation

**Files:**
- Modify: `src/app/globals.css` (append after the scrollbar rules at the end of file, line ~372)

**Interfaces:**
- Produces CSS classes used by later tasks: `.stagger-children`, `.animate-sheet-up`, `.animate-life-pop`, `.animate-scale-in`. Also a global `prefers-reduced-motion` guard.

- [ ] **Step 1: Append the motion utilities and reduced-motion guard to `globals.css`**

```css
/* ── Motion utilities (Phase 1) ────────────────────────────────────────────── */

/* Staggered child entrance — apply to a grid/list container */
.stagger-children > * {
  animation: page-enter 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}
.stagger-children > *:nth-child(1)  { animation-delay: 0ms; }
.stagger-children > *:nth-child(2)  { animation-delay: 30ms; }
.stagger-children > *:nth-child(3)  { animation-delay: 60ms; }
.stagger-children > *:nth-child(4)  { animation-delay: 90ms; }
.stagger-children > *:nth-child(5)  { animation-delay: 120ms; }
.stagger-children > *:nth-child(6)  { animation-delay: 150ms; }
.stagger-children > *:nth-child(7)  { animation-delay: 180ms; }
.stagger-children > *:nth-child(8)  { animation-delay: 210ms; }
.stagger-children > *:nth-child(n+9) { animation-delay: 240ms; }

/* Bottom sheet slide-up */
@keyframes sheet-up {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-sheet-up {
  animation: sheet-up 0.26s cubic-bezier(0.32, 0.72, 0, 1) both;
}

/* Life total change pop */
@keyframes life-pop {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.12); }
  100% { transform: scale(1); }
}
.animate-life-pop {
  animation: life-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Modal / FAB scale-in */
@keyframes scale-in {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
.animate-scale-in {
  animation: scale-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

/* ── Reduced motion: collapse all animation/transition to near-instant ─────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Verify build & visuals**

Run: `npx tsc --noEmit` → PASS (CSS-only change; confirms nothing else broke).
Run dev server, open http://localhost:3000 — page still renders, hero dust animation still plays.
In Chrome DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce" → reload home: hero text appears instantly (no 3.2s dust animation).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: motion utility classes + prefers-reduced-motion guard"
```

---

### Task 2: Image error fallback + skeleton consistency

**Files:**
- Modify: `src/components/cards/CardImage.tsx`
- Modify: `src/app/trades/page.tsx:442`, `src/app/packages/page.tsx:196`, `src/components/collection/SetCompletionTab.tsx:110` (replace bare `animate-pulse` boxes with the shared shimmer)
- Modify: `src/app/globals.css` (shimmer contrast bump)

**Interfaces:**
- Consumes: `.skeleton-shimmer` (exists), `Skeleton` component at `src/components/ui/Skeleton.tsx` (exists).
- Produces: `CardImage` renders a styled placeholder on image load *failure* (previously only handled missing URI).

- [ ] **Step 1: Raise shimmer visibility in `globals.css`**

The current shimmer animates `bg-card → bg-hover` (#161B27 → #1E2433) which is nearly invisible. Replace the `.skeleton-shimmer` rule body (globals.css:285-294) with:

```css
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--color-bg-card) 25%,
    color-mix(in srgb, var(--color-bg-hover) 80%, var(--color-accent) 20%) 50%,
    var(--color-bg-card) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}
```

- [ ] **Step 2: Add error state to `CardImage`**

In `src/components/cards/CardImage.tsx`, add an `errored` state and an `onError` handler; render the same placeholder used for missing URIs. Change the component body:

```tsx
export default function CardImage({ card, size = "normal", className }: CardImageProps) {
  const [activeFace, setActiveFace] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const { width, height } = IMAGE_DIMENSIONS[size];
  const imageUri = getImageUri(card, activeFace, size);

  if (!imageUri || errored) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-lg bg-bg-card border border-border text-caption text-text-secondary w-full p-2 text-center",
          className
        )}
        style={{ aspectRatio: ASPECT_RATIOS[size] }}
      >
        <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z" />
        </svg>
        <span className="line-clamp-2">{card.name}</span>
      </div>
    );
  }
  // ... rest unchanged, except add to the <Image>:
```

On the `<Image>` element add:

```tsx
        onError={() => setErrored(true)}
```

(keep the existing `onLoad`). Also reset `errored` when flipping faces — in the Flip button's onClick add `setErrored(false);` alongside `setLoaded(false);`.

- [ ] **Step 3: Unify stray pulse skeletons to shimmer**

- `src/app/trades/page.tsx:442`: `className="h-20 bg-white/5 rounded-2xl animate-pulse"` → `className="h-20 rounded-2xl skeleton-shimmer"`
- `src/app/packages/page.tsx:196`: `className="aspect-[2.5/3.5] rounded bg-bg-secondary animate-pulse"` → `className="aspect-[2.5/3.5] rounded skeleton-shimmer"`
- `src/components/collection/SetCompletionTab.tsx:110`: `className="h-16 rounded-xl bg-bg-card border border-border animate-pulse"` → `className="h-16 rounded-xl border border-border skeleton-shimmer"`

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → PASS. Run: `npx eslint src/components/cards/CardImage.tsx src/app/trades/page.tsx src/app/packages/page.tsx src/components/collection/SetCompletionTab.tsx` → no new errors.
Visual: search "lightning bolt", watch skeletons shimmer with a faint warm tint; DevTools → Network → block `cards.scryfall.io` → reload a result page → named placeholder tiles appear instead of broken images.

- [ ] **Step 5: Commit**

```bash
git add src/components/cards/CardImage.tsx src/app/trades/page.tsx src/app/packages/page.tsx src/components/collection/SetCompletionTab.tsx src/app/globals.css
git commit -m "feat: card image error fallback + unified shimmer skeletons"
```

---

### Task 3: MoreSheet component

**Files:**
- Create: `src/components/layout/MoreSheet.tsx`

**Interfaces:**
- Consumes: `cn()`, Next `Link`, `usePathname`.
- Produces: `export default function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void })` — rendered by `BottomNav` (Task 4). Groups: Collection / Playgroup / Tools / Account.

- [ ] **Step 1: Create `src/components/layout/MoreSheet.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils/cn";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

const GROUPS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "Collection",
    items: [
      { href: "/collection", label: "Collection" },
      { href: "/wishlist", label: "Wishlist" },
      { href: "/trades", label: "Trades" },
    ],
  },
  {
    label: "Playgroup",
    items: [
      { href: "/playgroup", label: "Playgroup" },
      { href: "/games", label: "Game Log" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/ask-harry", label: "Ask Harry" },
      { href: "/brackets", label: "Brackets" },
      { href: "/rules", label: "Rulebook" },
      { href: "/decks/matchup", label: "Matchup Analysis" },
      { href: "/packages", label: "Packages" },
      { href: "/allocation", label: "Card Allocation" },
      { href: "/news", label: "News" },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/settings", label: "Settings" }],
  },
];

export default function MoreSheet({ open, onClose }: MoreSheetProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More tools"
        className="fixed bottom-0 left-0 right-0 z-[61] animate-sheet-up rounded-t-3xl glass border-t border-border/50 max-h-[75vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="text-label text-text-muted mb-2">{group.label}</p>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "glass-panel rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "text-accent border-accent/40"
                          : "text-text-primary hover:border-accent/30"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify compile only** (component not yet mounted)

Run: `npx tsc --noEmit` → PASS. Run: `npx eslint src/components/layout/MoreSheet.tsx` → clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/MoreSheet.tsx
git commit -m "feat: MoreSheet grouped navigation sheet"
```

---

### Task 4: Bottom nav IA — Search tab in, More opens sheet, Ask Harry on Home

**Files:**
- Modify: `src/components/layout/BottomNav.tsx`
- Modify: `src/app/page.tsx` (Ask Harry entry card under the search shortcut)

**Interfaces:**
- Consumes: `MoreSheet` from Task 3 (`{ open, onClose }`).
- Produces: bottom nav = Home / Decks / Search / Life / More(button). `/ask-harry` reachable from Home card + MoreSheet.

- [ ] **Step 1: Rework `BottomNav.tsx`**

Replace the `rightTabs` Ask Harry entry with Search, convert More into a button. Full new file:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import MoreSheet from "@/components/layout/MoreSheet";

const leftTabs = [
  {
    href: "/",
    label: "Home",
    exact: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/decks",
    label: "Decks",
    exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
];

const rightTabs = [
  {
    href: "/search",
    label: "Search",
    exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    href: "/life",
    label: "Life",
    exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
];

const moreIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

function NavTab({
  href,
  label,
  icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      suppressHydrationWarning
      className={cn(
        "relative flex flex-col items-center justify-center w-full h-full gap-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset mx-1 rounded-xl",
        isActive ? "text-black bg-accent-gradient" : "text-accent/50 hover:text-accent/75"
      )}
    >
      <span className={cn("relative transition-transform duration-200 ease-out", isActive ? "scale-110" : "scale-100")}>
        {icon}
      </span>
      <span className={cn("relative text-[11px] tracking-wide transition-all duration-200", isActive ? "font-bold" : "font-medium")}>
        {label}
      </span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Close the sheet on navigation
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  if (isFullscreen) return null;

  function isTabActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/50 lg:hidden">
        <div className="flex items-center justify-around h-16 max-w-2xl mx-auto relative">
          {leftTabs.map((tab) => (
            <NavTab key={tab.href} href={tab.href} label={tab.label} icon={tab.icon} isActive={isTabActive(tab.href, tab.exact)} />
          ))}
          {rightTabs.map((tab) => (
            <NavTab key={tab.href} href={tab.href} label={tab.label} icon={tab.icon} isActive={isTabActive(tab.href, tab.exact)} />
          ))}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            suppressHydrationWarning
            aria-expanded={moreOpen}
            className={cn(
              "relative flex flex-col items-center justify-center w-full h-full gap-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset mx-1 rounded-xl",
              moreOpen ? "text-black bg-accent-gradient" : "text-accent/50 hover:text-accent/75"
            )}
          >
            <span className="relative">{moreIcon}</span>
            <span className="relative text-[11px] tracking-wide font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
```

Note: `lg:hidden` on the `<nav>` prepares for Task 5's sidebar; until Task 5 lands, desktop temporarily has no nav on lg+ — Tasks 4 and 5 must ship in the same session.

- [ ] **Step 2: Add Ask Harry entry card to Home**

In `src/app/page.tsx`, directly after the closing `</div>` of the search-shortcut block (after line 117), insert:

```tsx
      {/* ── Ask Harry shortcut ── */}
      <div className="px-4 pb-2 max-w-2xl mx-auto w-full">
        <Link href="/ask-harry">
          <div className="flex items-center gap-3 glass-card border border-border rounded-2xl px-4 py-3.5 hover:border-accent/40 transition-colors active:scale-[0.98]">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-page-title text-text-primary">ASK HARRY</p>
              <p className="text-caption truncate">AI rules judge — card interactions answered</p>
            </div>
            <svg className="ml-auto w-4 h-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → PASS. Run: `npx eslint src/components/layout/BottomNav.tsx src/app/page.tsx` → clean.
Visual (phone width): bottom nav shows Home/Decks/Search/Life/More; More opens the sheet with all four groups; tapping a link navigates and closes; Escape closes; Ask Harry card on Home navigates.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/BottomNav.tsx src/app/page.tsx
git commit -m "feat: nav IA - Search tab, More sheet, Ask Harry home entry"
```

---

### Task 5: Desktop sidebar shell

**Files:**
- Create: `src/components/layout/SideNav.tsx`
- Modify: `src/app/layout.tsx` (mount SideNav, pad content on lg)
- Modify: `src/components/layout/PageContainer.tsx` (wider on lg)

**Interfaces:**
- Consumes: same route table concept as BottomNav/MoreSheet.
- Produces: `SideNav` — `hidden lg:flex` fixed left rail, 224px wide. Content shifts right via `lg:pl-56` on the layout wrapper.

- [ ] **Step 1: Create `src/components/layout/SideNav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const SECTIONS: { label: string | null; items: { href: string; label: string; exact?: boolean }[] }[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Home", exact: true },
      { href: "/search", label: "Search" },
      { href: "/decks", label: "Decks" },
      { href: "/life", label: "Life Counter" },
    ],
  },
  {
    label: "Collection",
    items: [
      { href: "/collection", label: "Collection" },
      { href: "/wishlist", label: "Wishlist" },
      { href: "/trades", label: "Trades" },
    ],
  },
  {
    label: "Playgroup",
    items: [
      { href: "/playgroup", label: "Playgroup" },
      { href: "/games", label: "Game Log" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/ask-harry", label: "Ask Harry" },
      { href: "/brackets", label: "Brackets" },
      { href: "/rules", label: "Rulebook" },
      { href: "/decks/matchup", label: "Matchup Analysis" },
      { href: "/packages", label: "Packages" },
      { href: "/allocation", label: "Card Allocation" },
      { href: "/news", label: "News" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export default function SideNav() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    // Avoid "/decks" highlighting for "/decks/matchup"
    if (href === "/decks" && pathname.startsWith("/decks/matchup")) return false;
    return pathname.startsWith(href);
  }

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 w-56 flex-col glass border-r border-border/50 overflow-y-auto">
      <Link href="/" className="px-5 pt-6 pb-4">
        <span className="font-mtg text-mtg-gradient text-xl font-bold">MTG Houdini</span>
      </Link>
      <nav className="flex-1 px-3 pb-6">
        {SECTIONS.map((section, i) => (
          <div key={i} className="mb-4">
            {section.label && (
              <p className="text-label text-text-muted px-2 mb-1.5">{section.label}</p>
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent/15 text-accent"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-hover/60"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Mount in `src/app/layout.tsx`**

Add the import:

```tsx
import SideNav from "@/components/layout/SideNav";
```

Change the body content block (currently lines 74-76):

```tsx
          <PageBackground />
          <SideNav />
          <div className="relative z-10 flex-1 flex flex-col lg:pl-56">{children}</div>
          <BottomNav />
```

- [ ] **Step 3: Widen `PageContainer` on desktop**

In `src/components/layout/PageContainer.tsx` change the `main` className from `max-w-2xl` to `max-w-2xl lg:max-w-4xl`:

```tsx
    <main className={cn("flex-1 w-full max-w-2xl mx-auto lg:max-w-4xl animate-page-enter", !noPadding && "px-4 pt-4", "pb-24", className)}>
```

(The existing `sm:grid-cols-3 lg:grid-cols-4` grids in search/decks fill the extra width automatically.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → PASS. Run: `npx eslint src/components/layout/SideNav.tsx src/app/layout.tsx src/components/layout/PageContainer.tsx` → clean.
Visual: at ≥1024px wide — sidebar rail on the left, no bottom bar, content offset and wider; at phone width — no sidebar, bottom nav present. Life counter fullscreen mode: enter a game, sidebar must not overlap panels (life page is full-bleed; if the rail overlaps, add `lg:pl-56` to the life game view container in `src/app/life/page.tsx` — check visually).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/SideNav.tsx src/app/layout.tsx src/components/layout/PageContainer.tsx
git commit -m "feat: desktop sidebar shell with responsive nav swap"
```

---

### Task 6: Life counter polish — setup container + life pop animation

**Files:**
- Modify: `src/components/life/PlayerSetup.tsx` (constrain width; the setup screen currently stretches full-bleed)
- Modify: `src/components/life/PlayerPanel.tsx:325` (life total pop on change)

**Interfaces:**
- Consumes: `.animate-life-pop` from Task 1.

- [ ] **Step 1: Constrain PlayerSetup width**

The outer return container is at `src/components/life/PlayerSetup.tsx:137`. Change:

```tsx
    <div className="flex flex-col min-h-screen overflow-y-auto pb-24">
```

to:

```tsx
    <div className="flex flex-col min-h-screen overflow-y-auto pb-24 max-w-2xl mx-auto w-full">
```

Verify visually that the player-count cards, starting-life buttons, and options list no longer stretch beyond ~672px on desktop, and the 6th player-count card is no longer clipped offscreen. If the player-count row still overflows horizontally at ~672px, its row container is inside the `px-6 space-y-5` block below (grep `Players` label) — change that row to wrap: add `flex-wrap` if it is a flex row.

- [ ] **Step 2: Life total pop animation**

In `src/components/life/PlayerPanel.tsx`, the life total render is the `<span>` at lines 315-326. Add a `key` so React re-mounts the span when life changes (restarting the CSS animation) and the animation class. Change:

```tsx
            <span
              className={cn("tabular-nums leading-none", compact ? "text-[3rem]" : "text-[5rem]")}
```

to:

```tsx
            <span
              key={player.life}
              className={cn("tabular-nums leading-none inline-block animate-life-pop", compact ? "text-[3rem]" : "text-[5rem]")}
```

(the `style` prop and `{player.life}` child stay exactly as they are).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → PASS. Run: `npx eslint src/components/life/PlayerSetup.tsx src/components/life/PlayerPanel.tsx` → clean.
Visual: /life setup is centered and card row fits; start a 2-player game, tap +/- — the number pops on every change; with reduced motion emulated, no pop.

- [ ] **Step 4: Commit**

```bash
git add src/components/life/PlayerSetup.tsx src/components/life/PlayerPanel.tsx
git commit -m "feat: life counter setup container + life total pop animation"
```

---

### Task 7: Contrast & consistency pass

**Files:**
- Modify: `src/app/globals.css` (muted text token)
- Modify: `src/components/layout/TopBar.tsx` (back button restyle)
- Modify: `src/app/page.tsx` (feature card scrim + disciplined accent palette; staggered grid)

**Interfaces:**
- Consumes: `.btn-accent-subtle` (exists in globals.css), `.stagger-children` from Task 1.

- [ ] **Step 1: Bump muted text to WCAG-passing value**

In `src/app/globals.css` `@theme` block: `--color-text-muted: #4E5364;` → `--color-text-muted: #7A8095;` (≈4.6:1 on `#0B0E14`; the old value was ≈2.4:1).

- [ ] **Step 2: Restyle TopBar back button**

In `src/components/layout/TopBar.tsx` replace the back button's className (line ~27). It currently uses the loud orange `btn-gradient`; switch to the subtle accent-tinted style so it stops competing with page titles:

```tsx
            className="mr-2 -ml-1 w-8 h-8 rounded-xl flex items-center justify-center text-accent btn-accent-subtle border border-accent/20 transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
```

(icon stroke stays; `text-white` → `text-accent`.)

- [ ] **Step 3: Home feature grid — scrim, palette, stagger**

In `src/app/page.tsx`:

1. Accent palette discipline — replace the six `accent:` values in `FEATURES`:
   - Brackets: `#EF4444` (keep — red)
   - Rulebook: `#A855F7` → `#3B82F6` (blue)
   - Trading: `#F97316` → `#D4A843` (mtg-gold token value)
   - Wishlist: `#F59E0B` → `#ED9A57` (accent)
   - Playgroup: `#8B5CF6` → `#22C55E` (green)
   - Game Log: `#06B6D4` → `#94A3B8` (colorless slate)
2. Strengthen the text scrim on the cards — line 135: `bg-gradient-to-t from-bg-primary/80 via-bg-primary/40 to-transparent` → `from-bg-primary/95 via-bg-primary/60 to-transparent`, and art opacity on line 133: `opacity-35 group-hover:opacity-45` → `opacity-30 group-hover:opacity-45`.
3. Stagger the grid entrance — line 124: add `stagger-children` to the grid: `className="grid grid-cols-2 gap-3.5 [grid-auto-rows:1fr] stagger-children"`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → PASS. Run: `npx eslint src/app/page.tsx src/components/layout/TopBar.tsx` → clean.
Visual: captions readable across Home/search/settings; back button on /search is subtle; home cards' titles clearly legible over art; cards cascade in on load. Spot-check DevTools contrast checker on a `.text-caption` element → ≥4.5:1.

- [ ] **Step 5: Full-app verification sweep + build + commit**

Run: `npx tsc --noEmit` → PASS. Run: `npm run build` → succeeds.
Dev-server sweep at phone width: Home, /search (+ a result + card detail), /decks, /life (setup + game), /collection, More sheet — no layout breaks, skeletons shimmer, animations respect reduced-motion. At ≥1024px: sidebar present on all pages.

```bash
git add src/app/globals.css src/components/layout/TopBar.tsx src/app/page.tsx
git commit -m "feat: contrast pass - muted text, subtle back button, home grid polish"
```

---

## Self-Review Notes

- **Spec coverage:** 1a → Tasks 2 (fallback, shimmer); 1b → Tasks 1, 6, 7 (motion utilities, life pop, stagger; page-enter already existed); 1c → Tasks 3, 4; 1d → Task 5; 1e → Tasks 6, 7. Card-detail skeleton already exists (`src/app/search/[id]/page.tsx:251-255`) — the fix that makes it *visible* is the shimmer contrast bump in Task 2.
- **Ordering:** Tasks 4 and 5 must land in the same session (Task 4 adds `lg:hidden` to BottomNav; Task 5 adds the desktop replacement).
- **Known pre-existing lint issues** in `HandSimulator.tsx` (set-state-in-effect, unused-expression) are NOT in scope; do not fix or count them as new.
