"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { useLifeCounter } from "@/hooks/useLifeCounter";
import { useSettings } from "@/hooks/useSettings";
import PlayerSetup from "@/components/life/PlayerSetup";
import type { GameOptions } from "@/components/life/PlayerSetup";
import { LAYOUTS } from "@/components/life/PlayerSetup";
import PlayerPanel from "@/components/life/PlayerPanel";
import GameHistory from "@/components/life/GameHistory";
import Modal from "@/components/ui/Modal";

export default function LifePage() {
  const {
    players,
    events,
    gameStarted,
    playerCount,
    setupGame,
    adjustLife,
    adjustPoison,
    adjustCommanderDamage,
    resetGame,
    newGame,
  } = useLifeCounter();

  const { settings, mounted } = useSettings();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
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

  // Game timer (counts down)
  const [gameSecondsLeft, setGameSecondsLeft] = useState(0);
  const [gameTimerRunning, setGameTimerRunning] = useState(false);
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Turn timer (counts up per turn)
  const [turnSeconds, setTurnSeconds] = useState(0);
  const [turnNumber, setTurnNumber] = useState(1);
  const [turnTimerRunning, setTurnTimerRunning] = useState(false);
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [turnTimerVisible, setTurnTimerVisible] = useState(true);
  const turnHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Total elapsed time (counts up)
  const [totalElapsed, setTotalElapsed] = useState(0);

  const supportsNativeFullscreen =
    typeof document !== "undefined" &&
    "requestFullscreen" in document.documentElement;

  useEffect(() => {
    if (!supportsNativeFullscreen) return;
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [supportsNativeFullscreen]);

  // Enter fullscreen when game starts
  useEffect(() => {
    if (gameStarted) {
      if (supportsNativeFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (screen.orientation as any)?.lock?.("landscape")?.catch?.(() => {});
    }
  }, [gameStarted, supportsNativeFullscreen]);

  // Show "choose starting player" when game first starts
  useEffect(() => {
    if (gameStarted && players.length > 1 && playerCount > 1) {
      setChoosingStarter(true);
      setStartingPlayer(null);
    }
  }, [gameStarted, players.length]);

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
    if (!isFullscreen) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (screen.orientation as any)?.lock?.("landscape")?.catch?.(() => {});
    } else {
      screen.orientation?.unlock?.();
    }
  }, [supportsNativeFullscreen, isFullscreen]);

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

  // Turn timer tick
  useEffect(() => {
    if (turnTimerRunning) {
      turnTimerRef.current = setInterval(() => {
        setTurnSeconds((s) => s + 1);
      }, 1000);
    }
    return () => { if (turnTimerRef.current) clearInterval(turnTimerRef.current); };
  }, [turnTimerRunning]);

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
    setTurnNumber((n) => n + 1);
    setTurnSeconds(0);
    setTurnTimerRunning(true);
  }, []);

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
          if (gameOptions.gameTimer) { setGameTimerRunning(true); }
          if (gameOptions.turnTimer) { setTurnTimerRunning(true); }
        }, 2000);
      }
    };
    cycle();
  }, [randomizing, players, gameOptions]);

  if (!gameStarted) {
    if (!mounted) return null;
    return (
      <PlayerSetup
        defaultStartingLife={settings.defaultStartingLife}
        defaultPlayerCount={settings.defaultPlayerCount}
        onStart={(count, life, names, colors, options) => {
          setGameOptions(options);
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
    );
  }

  const panel = (index: number) => {
    const p = players[index];
    const opponents = players.filter((_, i) => i !== index);
    return (
      <PlayerPanel
        player={p}
        onLifeChange={(d) => { adjustLife(p.id, d); hideTurnTimerBriefly(); }}
        onCommanderDamage={(d, sourceId) => adjustCommanderDamage(p.id, d, sourceId)}
        onPoisonChange={(d) => adjustPoison(p.id, d)}
        totalTime={gameOptions.turnTimer ? totalElapsed : undefined}
        className={cn(
          "w-full h-full",
          highlightedPlayer === p.id && "border-[6px] border-[#FF6600]",
          !highlightedPlayer && startingPlayer === p.id && "ring-2 ring-accent ring-inset"
        )}
        showPoisonCounters={gameOptions.poisonCounters || settings.showPoisonCounters}
        perCommanderTracking={settings.perCommanderTracking}
        opponents={opponents}
        disabled={choosingStarter}
      />
    );
  };

  const renderPlayers = () => {
    const layouts = LAYOUTS[playerCount];
    if (!layouts) return null;
    const layout = layouts.find((l) => l.id === gameOptions.layout) ?? layouts[0];
    return (
      <div className="relative flex-1">
        {layout.panels.map((p, i) => {
          if (i >= players.length) return null;
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                width: `${p.w * 100}%`,
                height: `${p.h * 100}%`,
                padding: "2px",
              }}
            >
              {panel(i)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-black",
        isFullscreen && !supportsNativeFullscreen
          ? "fixed inset-0 z-[100]"
          : "h-screen",
        !isFullscreen && "pb-16"
      )}
    >
      <div className="flex-1 flex flex-col p-1 relative">
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setChoosingStarter(false);
                    if (gameOptions.gameTimer) setGameTimerRunning(true);
                    if (gameOptions.turnTimer) setTurnTimerRunning(true);
                  }}
                  className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-black/70 backdrop-blur-sm text-white/80 text-sm font-medium active:bg-black/90 z-10"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Skip
                </button>
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

        {/* ── Center menu + turn timer ── */}
        {!choosingStarter && (
          <div className={cn(
            "absolute z-20 flex items-center gap-2",
            playerCount === 1
              ? "top-4 left-4"
              : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          )}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="w-11 h-11 rounded-full bg-accent flex items-center justify-center shadow-lg hover:bg-accent-dark active:scale-90 transition-all flex-shrink-0"
            >
              <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Turn timer popup */}
            {gameOptions.turnTimer && turnTimerVisible && !showMenu && (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-accent">
                  Turn {turnNumber}
                </span>
                <div className="flex items-center gap-0 rounded-lg border-2 border-accent bg-black/90 overflow-hidden">
                  <div className="px-3 py-1.5 min-w-[64px] text-center">
                    <span className="text-lg font-bold tabular-nums text-white" style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}>
                      {Math.floor(turnSeconds / 60)}:{String(turnSeconds % 60).padStart(2, "0")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTurnTimerRunning((r) => !r)}
                    className="w-9 h-9 flex items-center justify-center bg-accent hover:bg-accent-dark active:scale-90 transition-all"
                  >
                    {turnTimerRunning ? (
                      <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleEndTurn}
                  className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-accent text-black text-[10px] font-black uppercase tracking-wide active:scale-95 transition-transform"
                >
                  End Turn
                </button>
                {!turnTimerRunning && (
                  <span className="text-[8px] font-bold uppercase tracking-widest text-accent/80">Paused</span>
                )}
              </div>
            )}

            {/* Game countdown timer (next to turn timer) */}
            {gameOptions.gameTimer && turnTimerVisible && !showMenu && (
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums",
                gameSecondsLeft <= 300 ? "bg-red-900/70 text-red-400 border border-red-500/50" : "bg-black/70 text-white/80 border border-white/20"
              )}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {Math.floor(gameSecondsLeft / 3600)}:{String(Math.floor((gameSecondsLeft % 3600) / 60)).padStart(2, "0")}:{String(gameSecondsLeft % 60).padStart(2, "0")}
              </div>
            )}

            {showMenu && (
              <div className="absolute top-13 left-1/2 -translate-x-1/2 bg-bg-secondary border border-border rounded-xl shadow-xl p-2 flex flex-col gap-1 min-w-[160px] z-30">
                <button
                  type="button"
                  onClick={() => { setShowHistory(true); setShowMenu(false); }}
                  className="text-left px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  History
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="text-left px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                  {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                </button>
                <div className="border-t border-border my-1" />
                <button
                  type="button"
                  onClick={() => {
                    resetGame();
                    setShowMenu(false);
                    if (gameOptions.gameTimer) {
                      setGameSecondsLeft(gameOptions.gameTimerMinutes * 60);
                      setGameTimerRunning(true);
                    }
                    setTurnSeconds(0);
                    setTurnNumber(1);
                    setTotalElapsed(0);
                  }}
                  className="text-left px-3 py-2.5 text-sm text-restricted hover:bg-bg-hover rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  Reset Game
                </button>
                <button
                  type="button"
                  onClick={() => {
                    newGame();
                    setShowMenu(false);
                    setGameTimerRunning(false);
                    setTurnTimerRunning(false);
                    setGameSecondsLeft(0);
                    setTurnSeconds(0);
                    setTurnNumber(1);
                    setTotalElapsed(0);
                  }}
                  className="text-left px-3 py-2.5 text-sm text-banned hover:bg-bg-hover rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  New Game
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={showHistory} onClose={() => setShowHistory(false)} title="Game History">
        <GameHistory events={events} players={players} />
      </Modal>
    </div>
  );
}
