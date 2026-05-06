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

    let cancelled = false;

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
              if (perm === "granted" && !cancelled) {
                window.addEventListener("deviceorientation", handleOrientation);
              }
            })
            .catch(() => {});
        };
        container.addEventListener("touchstart", requestOnce, { once: true });

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
          cancelled = true;
          cancelAnimationFrame(raf);
          container.removeEventListener("mousemove", handleMouse);
          container.removeEventListener("touchstart", requestOnce);
          window.removeEventListener("deviceorientation", handleOrientation);
        };
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
      cancelled = true;
      cancelAnimationFrame(raf);
      container.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [containerRef, lerp]);

  return offset;
}

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

    const displayW = () => canvas.width / dpr;
    const displayH = () => canvas.height / dpr;

    const INITIAL_COUNT = 120;
    let particles: Particle[] = [];
    const rebuildParticles = () => {
      const count = particleCount.current === INITIAL_COUNT ? INITIAL_COUNT : particleCount.current;
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push(createParticle(displayW(), displayH()));
      }
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildParticles();
    };
    resize();

    // FPS tracking for adaptive quality
    let lastTime = performance.now();
    let frameCount = 0;

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
      if (frameCount >= 60) {
        const elapsed = now - lastTime;
        const fps = (frameCount / elapsed) * 1000;
        if (fps < 30 && particles.length > 60) {
          particles = particles.slice(0, Math.floor(particles.length * 0.7));
          particleCount.current = particles.length;
        }
        frameCount = 0;
        lastTime = now;
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
