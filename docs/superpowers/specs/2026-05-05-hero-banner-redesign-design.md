# Hero Banner Redesign — Mystic Portal

## Overview

Redesign the MTG Houdini home page hero banner with a 3D mystic portal effect using Canvas 2D particles, replacing the current static gradient + text layout. The portal features swirling particles in the brand violet/gold palette with subtle parallax response to mouse (desktop) and gyroscope (mobile).

## Design Decisions

| Decision | Choice | Alternatives Considered |
|----------|--------|------------------------|
| Visual direction | Mystic Portal — swirling vortex with mana particles | Dust & Sparks evolution, Floating Card Universe, Mana Constellation |
| Performance strategy | Full experience everywhere with smart device detection | Tiered desktop/mobile, CSS-first hybrid |
| User interaction | Subtle parallax response (gyroscope/mouse) | Fully interactive particle tracking, Ambient-only |
| Color palette | Brand Violet + Gold (existing design tokens) | Blue Mana Storm, Golden Rift, Multi-Chromatic |
| Implementation | Canvas 2D particle system — zero dependencies | Three.js WebGL, CSS + Minimal Canvas hybrid |

## Architecture

### Component: `MysticPortalHero`

A client component that replaces the current hero `<div>` in `page.tsx`. Self-contained with no external dependencies.

**Internal structure:**
- `usePortalParticles` hook — canvas setup, particle engine, requestAnimationFrame loop, cleanup
- `useParallax` hook — mouse/gyroscope listeners, lerped offset calculation
- `MysticPortalHero` component — renders canvas + CSS portal gradient + title + subtitle

### Rendering Pipeline

1. CSS radial gradient renders the portal background glow (bottom layer)
2. `<canvas>` element renders particles with additive blending (middle layer)
3. Title text ("MTG Houdini") + subtitle sit in `relative z-10` (top layer)

## Visual Specification

### Portal Background (CSS Layer)

- Radial gradient: `#7C5CFC` center → `#4C1D95` at 40% → `#1a0b2e` at 70% → `#0B0E14` at 100%
- Slow pulsing animation: opacity oscillates between 0.6 and 0.8 over 4 seconds (`portal-pulse` keyframe)
- Elliptical shape, 80% width x 60% height, centered at 50% 40%

### Particle System

**Count:** 80-150 particles (auto-scaled based on device performance)

**Colors (randomly assigned per particle):**

| Color | Hex | Weight |
|-------|-----|--------|
| Gold | `#E4C97A` | 35% |
| Amber | `#ED9A57` | 25% |
| Light Violet | `#A78BFA` | 25% |
| Bright Violet | `#7C5CFC` | 15% |

**Depth Layers:**

| Layer | % of Particles | Radius | Opacity | Speed |
|-------|---------------|--------|---------|-------|
| Far | 40% | 1-2px | 0.2-0.4 | Slow orbit |
| Mid | 35% | 2-4px | 0.4-0.7 | Medium orbit |
| Near | 25% | 4-7px | 0.6-0.9 | Fast orbit |

**Behavior:**
- Particles orbit a central point using polar coordinates with inward spiral drift
- Glow effect via `globalCompositeOperation: 'lighter'` + radial gradient per particle (3x radius)
- Particles that reach center respawn at random edge positions

### Parallax Response

- **Desktop:** `mousemove` listener shifts vortex center by ±15px based on cursor position
- **Mobile:** `DeviceOrientationEvent` (with permission request on iOS) shifts center by ±10px based on tilt
- Smooth interpolation via lerp (linear interpolation) — no jarring jumps

### Title Integration

- "MTG Houdini" title and subtitle remain in `relative z-10` layer above canvas
- Existing `animate-houdini` dust animation plays on load as before
- Portal particles provide ambient backdrop underneath

## File Changes

### New File

- `src/components/home/MysticPortalHero.tsx` (~200-250 lines)
  - Contains `usePortalParticles` hook, `useParallax` hook, and `MysticPortalHero` component

### Modified Files

- `src/app/page.tsx` — import `MysticPortalHero`, replace hero `<div>` (lines 85-97) with `<MysticPortalHero />`
- `src/app/globals.css` — add `@keyframes portal-pulse` for background glow animation

### Unchanged

All existing classes remain: `.animate-houdini`, `.font-mtg`, `.text-mtg-gradient`, `.glow-radial-accent`

### No New Dependencies

Pure vanilla Canvas 2D API.

## Performance Safeguards

- `requestAnimationFrame` with automatic particle count reduction if FPS drops below 30
- Canvas resolution capped at `devicePixelRatio` of 2 (no 3x rendering on flagship phones)
- `will-change: transform` on the canvas element for compositor promotion
- RAF cancelled and event listeners removed on unmount
- `prefers-reduced-motion` media query — disables particles entirely, shows static gradient only
