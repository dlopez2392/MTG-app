# Mystic Portal Hero Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static hero banner on the MTG Houdini home page with an animated Mystic Portal featuring Canvas 2D particles, a pulsing gradient vortex, and subtle parallax response.

**Architecture:** Single new component `MysticPortalHero` containing two custom hooks (`usePortalParticles` for the canvas particle engine, `useParallax` for mouse/gyroscope offset). Three rendering layers: CSS gradient (portal glow) → canvas (particles) → title text. Zero dependencies — pure Canvas 2D API.

**Tech Stack:** React 19, TypeScript, Canvas 2D API, DeviceOrientation API, CSS keyframes

**Spec:** `docs/superpowers/specs/2026-05-05-hero-banner-redesign-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/home/MysticPortalHero.tsx` | Create | `useParallax` hook, `usePortalParticles` hook, `MysticPortalHero` component |
| `src/app/globals.css` | Modify | Add `@keyframes portal-pulse` |
| `src/app/page.tsx` | Modify | Replace hero `<div>` with `<MysticPortalHero />` |

---

### Task 1: Add portal-pulse keyframe to globals.css

**Files:**
- Modify: `src/app/globals.css` (after the `.glow-radial-accent` block, around line 252)

- [ ] **Step 1: Add the keyframe and utility class**

Insert after the `.glow-radial-accent` block (line 252):

```css
/* Mystic Portal pulsing core glow */
@keyframes portal-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.8; }
}

.portal-glow {
  background: radial-gradient(
    ellipse 80% 60% at 50% 40%,
    #7C5CFC 0%,
    #4C1D95 40%,
    #1a0b2e 70%,
    #0B0E14 100%
  );
  animation: portal-pulse 4s ease-in-out infinite;
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd C:\Users\danlo\mtg-app && npx tsc --noEmit`
Expected: No new errors (CSS doesn't affect TS, but confirms nothing else broke)

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add portal-pulse keyframe for mystic portal hero"
```

---

### Task 2: Create useParallax hook

**Files:**
- Create: `src/components/home/MysticPortalHero.tsx`

This task creates the file with the `useParallax` hook only. Subsequent tasks add the particle hook and component to the same file.

- [ ] **Step 1: Create the component file with useParallax hook**

Create `src/components/home/MysticPortalHero.tsx`:

```tsx
"use client";

import { useEffect, useRef, useCallback } from "react";

// ── Parallax hook ──────────────────────────────────────────────────────────────

interface ParallaxOffset {
  x: number;
  y: number;
}

function useParallax(containerRef: React.RefObject<HTMLElement | null>) {
  const offset = useRef<ParallaxOffset>({ x: 0, y: 0 });
  const target = useRef<ParallaxOffset>({ x: 0, y: 0 });

  const lerp = useCallback((current: number, goal: number, factor: number) => {
    return current + (goal - current) * factor;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isMobile = "ontouchstart" in window;
    const maxShift = isMobile ? 10 : 15;

    const handleMouse = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      target.current = {
        x: ((e.clientX - cx) / (rect.width / 2)) * maxShift,
        y: ((e.clientY - cy) / (rect.height / 2)) * maxShift,
      };
    };

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0; // left-right tilt (-90..90)
      const beta = e.beta ?? 0;   // front-back tilt (-180..180)
      target.current = {
        x: (gamma / 45) * maxShift,
        y: ((beta - 45) / 45) * maxShift,
      };
    };

    if (isMobile) {
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        "requestPermission" in DeviceOrientationEvent
      ) {
        // iOS 13+ requires permission — request on first touch
        const requestOnce = () => {
          (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> })
            .requestPermission()
            .then((perm) => {
              if (perm === "granted") {
                window.addEventListener("deviceorientation", handleOrientation);
              }
            })
            .catch(() => {});
          container.removeEventListener("touchstart", requestOnce);
        };
        container.addEventListener("touchstart", requestOnce, { once: true });
      } else {
        window.addEventListener("deviceorientation", handleOrientation);
      }
    } else {
      container.addEventListener("mousemove", handleMouse);
    }

    let raf: number;
    const tick = () => {
      offset.current = {
        x: lerp(offset.current.x, target.current.x, 0.08),
        y: lerp(offset.current.y, target.current.y, 0.08),
      };
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [containerRef, lerp]);

  return offset;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd C:\Users\danlo\mtg-app && npx tsc --noEmit`
Expected: PASS (hook is exported but unused — no errors expected since it's not imported yet)

- [ ] **Step 3: Commit**

```bash
git add src/components/home/MysticPortalHero.tsx
git commit -m "feat: add useParallax hook for mystic portal hero"
```

---

### Task 3: Add usePortalParticles hook

**Files:**
- Modify: `src/components/home/MysticPortalHero.tsx`

- [ ] **Step 1: Add particle types and color config after the useParallax hook**

Insert after the `useParallax` function closing brace:

```tsx
// ── Particle system ────────────────────────────────────────────────────────────

const PARTICLE_COLORS = [
  { hex: "#E4C97A", weight: 0.35 },
  { hex: "#ED9A57", weight: 0.25 },
  { hex: "#A78BFA", weight: 0.25 },
  { hex: "#7C5CFC", weight: 0.15 },
];

function pickColor(): string {
  let r = Math.random();
  for (const c of PARTICLE_COLORS) {
    r -= c.weight;
    if (r <= 0) return c.hex;
  }
  return PARTICLE_COLORS[0].hex;
}

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  drift: number;
  size: number;
  opacity: number;
  color: string;
  maxRadius: number;
}

function createParticle(canvasW: number, canvasH: number): Particle {
  const layer = Math.random();
  const maxR = Math.min(canvasW, canvasH) * 0.45;
  let size: number, opacity: number, speed: number;

  if (layer < 0.4) {
    // Far
    size = 1 + Math.random();
    opacity = 0.2 + Math.random() * 0.2;
    speed = 0.001 + Math.random() * 0.001;
  } else if (layer < 0.75) {
    // Mid
    size = 2 + Math.random() * 2;
    opacity = 0.4 + Math.random() * 0.3;
    speed = 0.002 + Math.random() * 0.002;
  } else {
    // Near
    size = 4 + Math.random() * 3;
    opacity = 0.6 + Math.random() * 0.3;
    speed = 0.003 + Math.random() * 0.003;
  }

  return {
    angle: Math.random() * Math.PI * 2,
    radius: maxR * (0.3 + Math.random() * 0.7),
    speed,
    drift: 0.15 + Math.random() * 0.25,
    size,
    opacity,
    color: pickColor(),
    maxRadius: maxR,
  };
}
```

- [ ] **Step 2: Add the usePortalParticles hook**

Insert after `createParticle`:

```tsx
function usePortalParticles(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  parallaxOffset: React.RefObject<ParallaxOffset>
) {
  const particleCount = useRef(120);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const displayW = () => canvas.width / dpr;
    const displayH = () => canvas.height / dpr;

    let particles: Particle[] = [];
    for (let i = 0; i < particleCount.current; i++) {
      particles.push(createParticle(displayW(), displayH()));
    }

    // FPS tracking for adaptive quality
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsCheckInterval = 0;

    let raf: number;
    const draw = (now: number) => {
      const w = displayW();
      const h = displayH();
      const cx = w / 2 + (parallaxOffset.current?.x ?? 0);
      const cy = h * 0.4 + (parallaxOffset.current?.y ?? 0);

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      for (const p of particles) {
        p.angle += p.speed;
        p.radius -= p.drift * 0.1;

        if (p.radius < 5) {
          Object.assign(p, createParticle(w, h));
          p.radius = p.maxRadius * (0.8 + Math.random() * 0.2);
        }

        const x = cx + Math.cos(p.angle) * p.radius;
        const y = cy + Math.sin(p.angle) * p.radius;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, p.size * 3);
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.arc(x, y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // Adaptive quality: check FPS every 60 frames
      frameCount++;
      fpsCheckInterval++;
      if (fpsCheckInterval >= 60) {
        const elapsed = now - lastTime;
        const fps = (frameCount / elapsed) * 1000;
        if (fps < 30 && particles.length > 60) {
          particles = particles.slice(0, Math.floor(particles.length * 0.7));
          particleCount.current = particles.length;
        }
        frameCount = 0;
        lastTime = now;
        fpsCheckInterval = 0;
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef, parallaxOffset]);
}
```

- [ ] **Step 3: Verify the file compiles**

Run: `cd C:\Users\danlo\mtg-app && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/home/MysticPortalHero.tsx
git commit -m "feat: add usePortalParticles hook with adaptive quality"
```

---

### Task 4: Add MysticPortalHero component and export

**Files:**
- Modify: `src/components/home/MysticPortalHero.tsx`

- [ ] **Step 1: Add the component at the bottom of the file**

Append to the end of `MysticPortalHero.tsx`:

```tsx
// ── Component ──────────────────────────────────────────────────────────────────

export default function MysticPortalHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parallaxOffset = useParallax(containerRef);

  usePortalParticles(canvasRef, parallaxOffset);

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* Layer 1: CSS portal glow */}
      <div className="absolute inset-0 portal-glow" />

      {/* Layer 2: Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ willChange: "transform" }}
      />

      {/* Layer 3: Title */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-12 pb-4 text-center max-w-2xl mx-auto w-full">
        <h1 className="animate-houdini font-mtg text-mtg-gradient text-hero mb-1 drop-shadow-lg">
          MTG Houdini
        </h1>
        <p className="text-body text-text-secondary max-w-xs">
          Your ultimate Magic: The Gathering companion
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd C:\Users\danlo\mtg-app && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/home/MysticPortalHero.tsx
git commit -m "feat: add MysticPortalHero component with three-layer rendering"
```

---

### Task 5: Integrate into home page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add import**

At the top of `src/app/page.tsx`, after the existing imports (line 4), add:

```tsx
import MysticPortalHero from "@/components/home/MysticPortalHero";
```

- [ ] **Step 2: Replace the hero section**

Replace the hero block (the `{/* ── Hero ── */}` comment and the `<div>` from line 84 through line 97):

```tsx
      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-hero-from/60 via-transparent to-hero-to/60" />
        <div className="absolute inset-0 glow-radial-accent" />

        <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-12 pb-4 text-center max-w-2xl mx-auto w-full">
          <h1 className="animate-houdini font-mtg text-mtg-gradient text-hero mb-1 drop-shadow-lg">
            MTG Houdini
          </h1>
          <p className="text-body text-text-secondary max-w-xs">
            Your ultimate Magic: The Gathering companion
          </p>
        </div>
      </div>
```

With:

```tsx
      {/* ── Hero ── */}
      <MysticPortalHero />
```

- [ ] **Step 3: Verify the file compiles**

Run: `cd C:\Users\danlo\mtg-app && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Visual test in browser**

Run: `cd C:\Users\danlo\mtg-app && npm run dev`

Open `http://localhost:3001` and verify:
1. Portal gradient pulses behind the title
2. Particles orbit in a vortex pattern with violet/gold colors
3. Moving the mouse shifts the vortex center subtly
4. Title "MTG Houdini" displays with the existing dust animation
5. Scrolling down to features and news still works normally
6. No console errors

- [ ] **Step 5: Test reduced motion**

In browser DevTools → Rendering → check "Emulate CSS prefers-reduced-motion: reduce"
Verify: Canvas particles do not render, static portal gradient still shows.

- [ ] **Step 6: Test mobile viewport**

In browser DevTools → toggle device toolbar (phone viewport).
Verify: Particles still render, layout is correct, no horizontal overflow.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: replace static hero with MysticPortalHero on home page"
```

---

### Task 6: Final type check and deploy

**Files:** None — verification only

- [ ] **Step 1: Full type check**

Run: `cd C:\Users\danlo\mtg-app && npx tsc --noEmit`
Expected: PASS with zero errors

- [ ] **Step 2: Push to main**

```bash
git push origin main
```

Vercel auto-deploys on push to main.

- [ ] **Step 3: Verify production**

After Vercel deployment completes (~2 min), visit `https://mtghoudini.com` and verify the portal renders correctly on the live site.
