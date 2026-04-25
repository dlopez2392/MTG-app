"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { useLifeCounter } from "@/hooks/useLifeCounter";
import { useSettings } from "@/hooks/useSettings";
import PlayerSetup from "@/components/life/PlayerSetup";
import type { GameOptions } from "@/components/life/PlayerSetup";
import { LAYOUTS, getOutwardRotation } from "@/components/life/PlayerSetup";
import PlayerPanel from "@/components/life/PlayerPanel";
import GameHistory from "@/components/life/GameHistory";
import EndGameModal from "@/components/life/EndGameModal";
import MatchHistory from "@/components/life/MatchHistory";
import Modal from "@/components/ui/Modal";
import { useMatchHistory } from "@/hooks/useMatchHistory";
import { useGameLog } from "@/hooks/useGameLog";
import type { CreateMatchPayload } from "@/types/match";

export default function LifePage() {
  const {
    players,
    events,
    gameStarted,
    gameStartedAt,
    startingLife,
    playerCount,
    setupGame,
    adjustLife,
    adjustPoison,
    adjustCommanderDamage,
    adjustEnergy,
    adjustExperience,
    setMonarch,
    setInitiative,
    adjustDungeon,
    resetGame,
    newGame,
  } = useLifeCounter();

  const { settings, mounted } = useSettings();
  const { matches, loading: matchesLoading, error: matchesError, saveMatch } = useMatchHistory();
  const { addEntry: addGameLogEntry } = useGameLog();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [showEndGame, setShowEndGame] = useState(false);
  const [savingMatch, setSavingMatch] = useState(false);
  const [choosingStarter, setChoosingStarter] = useState(false);
  const [startingPlayer, setStartingPlayer] = useState<string | null>(null);
  const [randomizing, setRandomizing] = useState(false);
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null);

  const [gameOptions, setGameOptions] = useState<GameOptions>({
    poisonCounters: false,
    turnTimer: false,
    gameTimer: false,
    gameTimerMinutes: 90,
    layout: "2-stack",
  });

  const [showEnergy, setShowEnergy] = useState(false);
  const [showExperience, setShowExperience] = useState(false);
  const [showMonarch, setShowMonarch] = useState(false);
  const [showInitiativeToggle, setShowInitiativeToggle] = useState(false);
  const [showDungeon, setShowDungeon] = useState(false);

  // Game timer (counts down)
  const [gameSecondsLeft, setGameSecondsLeft] = useState(0);
  const [gameTimerRunning, setGameTimerRunning] = useState(false);
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Turn timer (counts up per player segment)
  const [turnSeconds, setTurnSeconds] = useState(0);
  const [turnNumber, setTurnNumber] = useState(1);
  const [turnTimerRunning, setTurnTimerRunning] = useState(false);
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [turnTimerVisible, setTurnTimerVisible] = useState(true);
  const turnHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active player tracking — "Next" cycles through players
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);

  // Per-player cumulative turn time
  const [playerTurnTimes, setPlayerTurnTimes] = useState<Record<string, number>>({});

  // Clockwise turn order (array of player indices)
  const [turnOrder, setTurnOrder] = useState<number[]>([]);

  // Total elapsed time (counts up)
  const [totalElapsed, setTotalElapsed] = useState(0);

  // Compute clockwise order from panel center positions
  const computeClockwiseOrder = useCallback((layoutId: string, count: number) => {
    const layouts = LAYOUTS[count];
    if (!layouts) return Array.from({ length: count }, (_, i) => i);
    const layout = layouts.find((l) => l.id === layoutId) ?? layouts[0];
    const centers = layout.panels.slice(0, count).map((p, i) => ({
      i,
      cx: p.x + p.w / 2,
      cy: p.y + p.h / 2,
    }));
    // angle from center (0.5, 0.5), 0 = top, increasing clockwise
    return centers
      .map((c) => ({
        i: c.i,
        angle: Math.atan2(c.cx - 0.5, -(c.cy - 0.5)),
      }))
      .sort((a, b) => a.angle - b.angle)
      .map((c) => c.i);
  }, []);

  // Screen Wake Lock — keep screen on during game
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    if ("wakeLock" in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch {}
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (gameStarted) {
      requestWakeLock();
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible" && gameStarted) {
          requestWakeLock();
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        releaseWakeLock();
      };
    } else {
      releaseWakeLock();
    }
  }, [gameStarted, requestWakeLock, releaseWakeLock]);

  const supportsNativeFullscreen =
    typeof document !== "undefined" &&
    "requestFullscreen" in document.documentElement;

  useEffect(() => {
    if (!supportsNativeFullscreen) return;
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [supportsNativeFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    if (supportsNativeFullscreen) {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
      } else {
        await document.exitFullscreen().catch(() => {});
      }
    } else {
      setIsFullscreen((prev) => !prev);
    }
  }, [supportsNativeFullscreen]);

  // Enter fullscreen when game starts
  useEffect(() => {
    if (gameStarted && supportsNativeFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, [gameStarted, supportsNativeFullscreen]);

  const exitFullscreen = useCallback(() => {
    if (supportsNativeFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [supportsNativeFullscreen]);

  // Show "choose starting player" when game first starts
  useEffect(() => {
    if (gameStarted && players.length > 1 && playerCount > 1) {
      setChoosingStarter(true);
      setStartingPlayer(null);
    }
  }, [gameStarted, players.length]);

  // Game timer tick
  useEffect(() => {
    if (gameTimerRunning && gameSecondsLeft > 0) {
      gameTimerRef.current = setInterval(() => {
        setGameSecondsLeft((s) => {
          if (s <= 1) { setGameTimerRunning(false); return 0; }
          return s - 1;
        });
      }, 1000);
    }
    return () => { if (gameTimerRef.current) clearInterval(gameTimerRef.current); };
  }, [gameTimerRunning, gameSecondsLeft]);

  // Turn timer tick — also accumulates per-player time
  useEffect(() => {
    if (turnTimerRunning) {
      turnTimerRef.current = setInterval(() => {
        setTurnSeconds((s) => s + 1);
        const activeId = players[activePlayerIndex]?.id;
        if (activeId) {
          setPlayerTurnTimes((prev) => ({ ...prev, [activeId]: (prev[activeId] ?? 0) + 1 }));
        }
      }, 1000);
    }
    return () => { if (turnTimerRef.current) clearInterval(turnTimerRef.current); };
  }, [turnTimerRunning, activePlayerIndex, players]);

  // Total elapsed time tick
  useEffect(() => {
    if (!gameOptions.gameTimer || !gameTimerRunning) return;
    const interval = setInterval(() => {
      setTotalElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameOptions.gameTimer, gameTimerRunning]);

  const hideTurnTimerBriefly = useCallback(() => {
    if (!gameOptions.turnTimer) return;
    setTurnTimerVisible(false);
    if (turnHideTimer.current) clearTimeout(turnHideTimer.current);
    turnHideTimer.current = setTimeout(() => setTurnTimerVisible(true), 2000);
  }, [gameOptions.turnTimer]);

  const handleEndTurn = useCallback(() => {
    setTurnSeconds(0);
    const currentPos = turnOrder.indexOf(activePlayerIndex);
    const nextPos = (currentPos + 1) % turnOrder.length;
    if (nextPos === 0) {
      setTurnNumber((n) => n + 1);
    }
    setActivePlayerIndex(turnOrder[nextPos]);
    setTurnTimerRunning(true);
  }, [activePlayerIndex, turnOrder]);

  const handleRandomizeStarter = useCallback(() => {
    if (randomizing) return;
    setRandomizing(true);
    const ids = players.map((p) => p.id);
    const totalCycles = 12 + Math.floor(Math.random() * 6);
    const winnerIndex = Math.floor(Math.random() * ids.length);
    let step = 0;
    let currentIndex = 0;

    const cycle = () => {
      setHighlightedPlayer(ids[currentIndex % ids.length]);
      step++;
      currentIndex++;
      if (step < totalCycles) {
        const delay = 80 + step * 20;
        setTimeout(cycle, delay);
      } else {
        setHighlightedPlayer(ids[winnerIndex]);
        setStartingPlayer(ids[winnerIndex]);
        setTimeout(() => {
          setChoosingStarter(false);
          setRandomizing(false);
          setHighlightedPlayer(null);
          setActivePlayerIndex(winnerIndex);
          // Rotate the clockwise order so the winner starts first
          const pos = turnOrder.indexOf(winnerIndex);
          if (pos > 0) {
            setTurnOrder((prev) => [...prev.slice(pos), ...prev.slice(0, pos)]);
          }
          if (gameOptions.gameTimer) { setGameTimerRunning(true); }
          if (gameOptions.turnTimer) { setTurnTimerRunning(true); }
        }, 2000);
      }
    };
    cycle();
  }, [randomizing, players, gameOptions]);

  const handleManualStarter = useCallback((playerIndex: number) => {
    const id = players[playerIndex]?.id;
    if (!id) return;
    setStartingPlayer(id);
    setHighlightedPlayer(id);
    setTimeout(() => {
      setChoosingStarter(false);
      setHighlightedPlayer(null);
      setActivePlayerIndex(playerIndex);
      const pos = turnOrder.indexOf(playerIndex);
      if (pos > 0) {
        setTurnOrder((prev) => [...prev.slice(pos), ...prev.slice(0, pos)]);
      }
      if (gameOptions.gameTimer) setGameTimerRunning(true);
      if (gameOptions.turnTimer) setTurnTimerRunning(true);
    }, 1500);
  }, [players, turnOrder, gameOptions]);

  if (!gameStarted) {
    if (!mounted) return null;
    return (
      <>
      <PlayerSetup
        defaultStartingLife={settings.defaultStartingLife}
        defaultPlayerCount={settings.defaultPlayerCount}
        onShowMatchHistory={() => setShowMatchHistory(true)}
        onStart={(count, life, names, colors, options) => {
          setGameOptions(options);
          setTurnOrder(computeClockwiseOrder(options.layout, count));
          if (options.gameTimer) {
            setGameSecondsLeft(options.gameTimerMinutes * 60);
            if (count === 1) setGameTimerRunning(true);
          }
          if (options.turnTimer && count === 1) {
            setTurnTimerRunning(true);
          }
          setupGame(count, life, names, colors);
        }}
      />
      <Modal open={showMatchHistory} onClose={() => setShowMatchHistory(false)} title="Match History">
        <MatchHistory matches={matches} loading={matchesLoading} error={matchesError} />
      </Modal>
      </>
    );
  }

  const panel = (index: number, rotation: number = 0) => {
    const p = players[index];
    const opponents = players.filter((_, i) => i !== index);
    const isActive = !choosingStarter && gameOptions.turnTimer && index === activePlayerIndex;
    return (
      <PlayerPanel
        player={p}
        onLifeChange={(d) => { adjustLife(p.id, d); hideTurnTimerBriefly(); }}
        onCommanderDamage={(d, sourceId) => adjustCommanderDamage(p.id, d, sourceId)}
        onPoisonChange={(d) => adjustPoison(p.id, d)}
        onEnergyChange={(d) => adjustEnergy(p.id, d)}
        onExperienceChange={(d) => adjustExperience(p.id, d)}
        onMonarchToggle={() => setMonarch(p.id)}
        onInitiativeToggle={() => setInitiative(p.id)}
        onDungeonChange={(d) => adjustDungeon(p.id, d)}
        showEnergyCounters={showEnergy}
        showExperienceCounters={showExperience}
        showMonarch={showMonarch}
        showInitiative={showInitiativeToggle}
        showDungeon={showDungeon}
        turnTimer={isActive ? {
          turnNumber,
          turnSeconds,
          running: turnTimerRunning,
          onToggle: () => setTurnTimerRunning((r) => !r),
          onNext: handleEndTurn,
        } : undefined}
        rotation={rotation}
        className={cn(
          "w-full h-full",
          highlightedPlayer === p.id && "border-[6px] border-[#FF6600]",
          !highlightedPlayer && isActive && "border-[4px] border-[#FF6600]",
        )}
        showPoisonCounters={gameOptions.poisonCounters || settings.showPoisonCounters}
        perCommanderTracking={settings.perCommanderTracking}
        opponents={opponents}
        disabled={choosingStarter}
        compact={playerCount >= 3}
      />
    );
  };

  const renderPlayers = () => {
    const layouts = LAYOUTS[playerCount];
    if (!layouts) return null;
    const layout = layouts.find((l) => l.id === gameOptions.layout) ?? layouts[0];
    return (
      <div className="absolute inset-0">
        {layout.panels.map((p, i) => {
          if (i >= players.length) return null;
          const rotation = getOutwardRotation(p);
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                width: `${p.w * 100}%`,
                height: `${p.h * 100}%`,
                padding: "1px",
              }}
            >
              {panel(i, rotation)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="bg-black overflow-hidden touch-none fixed inset-0 z-[100]"
    >
      <div className="absolute inset-0">
        {renderPlayers()}

        {/* ── "Choose Starting Player" overlay ── */}
        {choosingStarter && !startingPlayer && (
          <div className="absolute inset-0 z-40 flex items-center justify-center">
            <button
              type="button"
              onClick={handleRandomizeStarter}
              className="absolute inset-0 z-0"
              aria-label="Randomize starting player"
            />
            {!randomizing && (
              <>
                <div className="pointer-events-none bg-white rounded-2xl px-6 py-5 shadow-2xl flex flex-col items-center gap-3 max-w-[200px] z-10">
                  <svg className="w-10 h-10 text-bg-primary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l2.09 6.26L20.18 9l-5 4.27L16.82 20 12 16.77 7.18 20l1.64-6.73L3.82 9l6.09-.74L12 2z" />
                  </svg>
                  <p className="text-sm font-bold text-bg-primary text-center uppercase tracking-wide leading-tight">
                    Tap anywhere to randomize starting player
                  </p>
                </div>
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[90%] max-w-xs flex flex-col items-center gap-2 z-10">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">or choose</span>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {players.map((p, i) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleManualStarter(i); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/70 backdrop-blur-sm text-white text-xs font-semibold active:scale-95 transition-transform"
                        style={{ borderWidth: 2, borderColor: p.color }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Starting player selected feedback ── */}
        {startingPlayer && choosingStarter && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div className="bg-accent/90 rounded-2xl px-6 py-4 shadow-2xl">
              <p className="text-lg font-black text-black text-center">
                {players.find((p) => p.id === startingPlayer)?.name} goes first!
              </p>
            </div>
          </div>
        )}

        {/* ── Center menu button + game countdown timer (horizontal, on dividing line) ── */}
        {!choosingStarter && (
          <div className={cn(
            "absolute z-20 flex items-center gap-2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            playerCount === 1
              ? "top-4 left-4 translate-x-0 translate-y-0"
              : playerCount >= 5
                ? "top-[33.3%]"
                : "top-1/2"
          )}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="w-11 h-11 rounded-full btn-gradient flex items-center justify-center active:scale-90 transition-all shadow-lg flex-shrink-0"
            >
              <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {gameOptions.gameTimer && !showMenu && (
              <div
                className="rounded-full p-[2px] shadow-lg flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, #F4C96B 0%, #ED9A57 40%, #D4602A 100%)",
                }}
              >
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/90 backdrop-blur-sm",
                  gameSecondsLeft <= 300 && "bg-red-950/90"
                )}>
                  <svg className={cn("w-3.5 h-3.5 flex-shrink-0", gameSecondsLeft <= 300 ? "text-red-400" : "text-white/50")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={cn("text-xs font-bold tabular-nums", gameSecondsLeft <= 300 ? "text-red-400" : "text-white/80")} style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}>
                    {Math.floor(gameSecondsLeft / 3600)}:{String(Math.floor((gameSecondsLeft % 3600) / 60)).padStart(2, "0")}:{String(gameSecondsLeft % 60).padStart(2, "0")}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Fullscreen game menu overlay ── */}
      {showMenu && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: "radial-gradient(ellipse at center, rgba(237,154,87,0.08) 0%, rgba(0,0,0,0.95) 70%)" }}>
          <div className="absolute inset-0 backdrop-blur-xl" />
          <div className="relative w-full h-full overflow-y-auto px-5 pt-6 pb-16 flex flex-col" style={{ maxWidth: "420px", margin: "0 auto" }}>

            {/* Header */}
            <div className="flex items-center justify-between mb-5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #F4C96B 0%, #ED9A57 40%, #D4602A 100%)" }}>
                  <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                  </svg>
                </div>
                <h2 className="text-xl font-black tracking-tight" style={{ background: "linear-gradient(135deg, #F4C96B, #ED9A57)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Game Menu
                </h2>
              </div>
              <button type="button" onClick={() => setShowMenu(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all border border-white/10"
                style={{ background: "linear-gradient(135deg, rgba(244,201,107,0.15), rgba(212,96,42,0.15))" }}>
                <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Quick actions */}
            <div className="flex gap-3 mb-5 flex-shrink-0">
              <button type="button" onClick={() => { setShowHistory(true); setShowMenu(false); }}
                className="flex-1 py-4 text-sm font-bold text-white/90 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 border border-white/5"
                style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)" }}>
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History
              </button>
              <button type="button" onClick={() => { toggleFullscreen(); setShowMenu(false); }}
                className="flex-1 py-4 text-sm font-bold text-white/90 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 border border-white/5"
                style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)" }}>
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                {isFullscreen ? "Exit FS" : "Fullscreen"}
              </button>
            </div>

            {/* Counters section */}
            <div className="mb-5 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(237,154,87,0.3), transparent)" }} />
                <span className="text-[10px] text-accent/70 uppercase tracking-[0.2em] font-bold">Counters</span>
                <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(237,154,87,0.3), transparent)" }} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "poison", active: gameOptions.poisonCounters || settings.showPoisonCounters, toggle: () => { const v = !(gameOptions.poisonCounters || settings.showPoisonCounters); setGameOptions((o) => ({ ...o, poisonCounters: v })); }, icon: <path d="M12 2C9.5 2 7 4 7 7c0 2 1 3.5 2 4.5V15h6v-3.5c1-1 2-2.5 2-4.5 0-3-2.5-5-5-5zm-1 13v4h2v-4h-2z"/>, label: "Poison", color: "#4ade80", bg: "rgba(74,222,128,0.12)" },
                  { key: "energy", active: showEnergy, toggle: () => setShowEnergy((v) => !v), icon: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>, label: "Energy", color: "#facc15", bg: "rgba(250,204,21,0.12)" },
                  { key: "experience", active: showExperience, toggle: () => setShowExperience((v) => !v), icon: <path d="M12 2l2.09 6.26L20.18 9l-5 4.27L16.82 20 12 16.77 7.18 20l1.64-6.73L3.82 9l6.09-.74L12 2z"/>, label: "Experience", color: "#c084fc", bg: "rgba(192,132,252,0.12)" },
                  { key: "monarch", active: showMonarch, toggle: () => setShowMonarch((v) => !v), icon: <path d="M2 20h20l-2-8-4 4-4-8-4 8-4-4-2 8zm2-12l2 2 4-8 4 8 4-8 2 2"/>, label: "Monarch", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
                  { key: "initiative", active: showInitiativeToggle, toggle: () => setShowInitiativeToggle((v) => !v), icon: <path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z"/>, label: "Initiative", color: "#93c5fd", bg: "rgba(147,197,253,0.12)" },
                  { key: "dungeon", active: showDungeon, toggle: () => setShowDungeon((v) => !v), icon: <path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm4 2h6v2h-2v2h2v2h-2v2h2v2H9v-2h2v-2H9v-2h2V9H9V7z"/>, label: "Dungeon", color: "#a8a29e", bg: "rgba(168,162,158,0.12)" },
                ].map((c) => (
                  <button key={c.key} type="button" onClick={c.toggle}
                    className="relative py-4 text-[11px] font-bold rounded-2xl transition-all active:scale-95 flex flex-col items-center gap-2 border overflow-hidden"
                    style={{
                      background: c.active ? c.bg : "rgba(255,255,255,0.03)",
                      borderColor: c.active ? `${c.color}40` : "rgba(255,255,255,0.05)",
                      color: c.active ? c.color : "rgba(255,255,255,0.4)",
                    }}>
                    {c.active && <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at center, ${c.color}, transparent 70%)` }} />}
                    <svg className="w-5 h-5 relative" fill="currentColor" viewBox="0 0 24 24">{c.icon}</svg>
                    <span className="relative">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Per-player counters */}
            {(showEnergy || showExperience || showMonarch || showInitiativeToggle || showDungeon) && (
              <div className="mb-5 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(237,154,87,0.3), transparent)" }} />
                  <span className="text-[10px] text-accent/70 uppercase tracking-[0.2em] font-bold">Players</span>
                  <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(237,154,87,0.3), transparent)" }} />
                </div>
                <div className="space-y-2">
                  {players.map((p) => (
                    <div key={p.id} className="rounded-2xl p-3 border border-white/5" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)" }}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 ring-2 ring-white/10" style={{ backgroundColor: p.color }} />
                        <span className="text-sm font-bold text-white/90">{p.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {showEnergy && (
                          <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 border border-yellow-500/20" style={{ background: "rgba(250,204,21,0.06)" }}>
                            <button type="button" onClick={() => adjustEnergy(p.id, -1)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 active:bg-white/15 text-base font-bold">−</button>
                            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                            <span className="text-sm font-bold tabular-nums text-yellow-300 min-w-[20px] text-center">{p.energyCounters}</span>
                            <button type="button" onClick={() => adjustEnergy(p.id, 1)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 active:bg-white/15 text-base font-bold">+</button>
                          </div>
                        )}
                        {showExperience && (
                          <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 border border-purple-500/20" style={{ background: "rgba(192,132,252,0.06)" }}>
                            <button type="button" onClick={() => adjustExperience(p.id, -1)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 active:bg-white/15 text-base font-bold">−</button>
                            <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.09 6.26L20.18 9l-5 4.27L16.82 20 12 16.77 7.18 20l1.64-6.73L3.82 9l6.09-.74L12 2z"/></svg>
                            <span className="text-sm font-bold tabular-nums text-purple-300 min-w-[20px] text-center">{p.experienceCounters}</span>
                            <button type="button" onClick={() => adjustExperience(p.id, 1)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 active:bg-white/15 text-base font-bold">+</button>
                          </div>
                        )}
                        {showMonarch && (
                          <button type="button" onClick={() => setMonarch(p.id)}
                            className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all active:scale-95 border",
                              p.isMonarch ? "border-yellow-500/30 text-yellow-300" : "border-white/5 text-white/40")}
                            style={{ background: p.isMonarch ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.03)" }}>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M2 20h20l-2-8-4 4-4-8-4 8-4-4-2 8zm2-12l2 2 4-8 4 8 4-8 2 2"/></svg>
                            {p.isMonarch ? "Monarch" : "Set Monarch"}
                          </button>
                        )}
                        {showInitiativeToggle && (
                          <button type="button" onClick={() => setInitiative(p.id)}
                            className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all active:scale-95 border",
                              p.hasInitiative ? "border-blue-500/30 text-blue-300" : "border-white/5 text-white/40")}
                            style={{ background: p.hasInitiative ? "rgba(147,197,253,0.12)" : "rgba(255,255,255,0.03)" }}>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z"/></svg>
                            {p.hasInitiative ? "Has Initiative" : "Set Initiative"}
                          </button>
                        )}
                        {showDungeon && (
                          <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 border border-stone-500/20" style={{ background: "rgba(168,162,158,0.06)" }}>
                            <button type="button" onClick={() => adjustDungeon(p.id, -1)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 active:bg-white/15 text-base font-bold">−</button>
                            <svg className="w-5 h-5 text-stone-400" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm4 2h6v2h-2v2h2v2h-2v2h2v2H9v-2h2v-2H9v-2h2V9H9V7z"/></svg>
                            <span className="text-sm font-bold tabular-nums text-stone-300 min-w-[20px] text-center">{p.dungeonLevel}</span>
                            <button type="button" onClick={() => adjustDungeon(p.id, 1)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 active:bg-white/15 text-base font-bold">+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Game actions */}
            <div className="flex-shrink-0 space-y-2 pt-3 mb-2" style={{ borderTop: "1px solid rgba(237,154,87,0.15)" }}>
              <button type="button"
                onClick={() => { setShowEndGame(true); setShowMenu(false); setGameTimerRunning(false); setTurnTimerRunning(false); }}
                className="w-full py-3.5 text-sm font-bold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-black"
                style={{ background: "linear-gradient(135deg, #F4C96B 0%, #ED9A57 40%, #D4602A 100%)" }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 3v2l4 4-2.5 3.5L3 11v2l4 2 1 6h2l1-6 1.5-2L14 19h2l1-6 4-2v-2l-3.5 1.5L15 7l4-4V1l-5 5-2-2-2 2-5-5z" />
                </svg>
                End &amp; Save
              </button>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => {
                    resetGame(); setShowMenu(false);
                    if (gameOptions.gameTimer) { setGameSecondsLeft(gameOptions.gameTimerMinutes * 60); setGameTimerRunning(true); }
                    setTurnSeconds(0); setTurnNumber(1); setTotalElapsed(0); setActivePlayerIndex(0); setPlayerTurnTimes({});
                  }}
                  className="flex-1 py-3 text-sm font-bold text-amber-400/80 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 border border-amber-500/15"
                  style={{ background: "rgba(251,191,36,0.06)" }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  Reset
                </button>
                <button type="button"
                  onClick={() => {
                    exitFullscreen(); newGame(); setShowMenu(false); setGameTimerRunning(false); setTurnTimerRunning(false);
                    setGameSecondsLeft(0); setTurnSeconds(0); setTurnNumber(1); setTotalElapsed(0); setActivePlayerIndex(0); setPlayerTurnTimes({});
                  }}
                  className="flex-1 py-3 text-sm font-bold text-red-400/80 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 border border-red-500/15"
                  style={{ background: "rgba(239,68,68,0.06)" }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  New Game
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal open={showHistory} onClose={() => setShowHistory(false)} title="Game History">
        <GameHistory events={events} players={players} />
      </Modal>

      <EndGameModal
        open={showEndGame}
        onClose={() => {
          setShowEndGame(false);
          if (gameOptions.gameTimer && gameSecondsLeft > 0) setGameTimerRunning(true);
          if (gameOptions.turnTimer) setTurnTimerRunning(true);
        }}
        onSave={async (payload: CreateMatchPayload) => {
          setSavingMatch(true);
          await saveMatch(payload);

          const winner = payload.players.find((p) => p.isWinner);
          const player1 = payload.players[0];
          const isPlayer1Winner = player1?.isWinner;
          const hasDraw = !winner;
          const result = hasDraw ? "draw" as const : isPlayer1Winner ? "win" as const : "loss" as const;
          const format = payload.startingLife === 40 ? "Commander"
            : payload.startingLife === 25 ? "Brawl"
            : payload.startingLife === 30 ? "Two-Headed Giant"
            : "Standard";
          const opponents = payload.players.slice(1).map((p) => p.playerName).join(", ");

          await addGameLogEntry({
            date: payload.endedAt,
            deckName: player1?.playerName ?? "Player 1",
            result,
            format,
            playerCount: payload.playerCount,
            notes: payload.notes,
            opponentNames: opponents || undefined,
          });

          setSavingMatch(false);
          setShowEndGame(false);
          exitFullscreen();
          newGame();
          setGameTimerRunning(false);
          setTurnTimerRunning(false);
          setGameSecondsLeft(0);
          setTurnSeconds(0);
          setTurnNumber(1);
          setTotalElapsed(0);
          setActivePlayerIndex(0);
          setPlayerTurnTimes({});
        }}
        players={players}
        startingLife={startingLife}
        gameStartedAt={gameStartedAt}
        durationSecs={totalElapsed}
        saving={savingMatch}
      />
    </div>
  );
}
