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
    resetGame,
    newGame,
  } = useLifeCounter();

  const { settings, mounted } = useSettings();
  const { matches, loading: matchesLoading, error: matchesError, saveMatch } = useMatchHistory();
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

  const exitFullscreen = useCallback(() => {
    if (supportsNativeFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);
    screen.orientation?.unlock?.();
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
                padding: "2px",
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
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">or choose</span>
                  <div className="flex items-center gap-2">
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

        {/* ── Center menu + game timer ── */}
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
              className="w-11 h-11 rounded-full btn-gradient flex items-center justify-center active:scale-90 transition-all shadow-lg flex-shrink-0"
            >
              <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Game countdown timer — gradient border pill */}
            {gameOptions.gameTimer && !showMenu && (
              <div
                className="rounded-full p-[2px] shadow-lg flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #F4C96B 0%, #ED9A57 40%, #D4602A 100%)" }}
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

            {showMenu && (
              <div className={cn(
                "absolute bg-bg-secondary border border-border rounded-xl shadow-xl p-2 flex flex-col gap-1 min-w-[160px] z-30",
                playerCount === 1 ? "top-13 left-0" : "top-13 left-1/2 -translate-x-1/2"
              )}>
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
                    setShowEndGame(true);
                    setShowMenu(false);
                    setGameTimerRunning(false);
                    setTurnTimerRunning(false);
                  }}
                  className="text-left px-3 py-2.5 text-sm text-accent hover:bg-bg-hover rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 3v2l4 4-2.5 3.5L3 11v2l4 2 1 6h2l1-6 1.5-2L14 19h2l1-6 4-2v-2l-3.5 1.5L15 7l4-4V1l-5 5-2-2-2 2-5-5z" />
                  </svg>
                  End &amp; Save
                </button>
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
                    setActivePlayerIndex(0);
                    setPlayerTurnTimes({});
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
                    exitFullscreen();
                    newGame();
                    setShowMenu(false);
                    setGameTimerRunning(false);
                    setTurnTimerRunning(false);
                    setGameSecondsLeft(0);
                    setTurnSeconds(0);
                    setTurnNumber(1);
                    setTotalElapsed(0);
                    setActivePlayerIndex(0);
                    setPlayerTurnTimes({});
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
