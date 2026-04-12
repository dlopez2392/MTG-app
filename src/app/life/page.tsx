"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils/cn";
import { useLifeCounter } from "@/hooks/useLifeCounter";
import { loadSettings, useSettings } from "@/hooks/useSettings";
import PlayerSetup from "@/components/life/PlayerSetup";
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

  const { settings } = useSettings();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  if (!gameStarted) {
    const saved = loadSettings();
    return (
      <PlayerSetup
        defaultStartingLife={saved.defaultStartingLife}
        defaultPlayerCount={saved.defaultPlayerCount}
        onStart={(count, life, names, colors) =>
          setupGame(count, life, names, colors)
        }
      />
    );
  }

  const panel = (index: number, rotated = false) => {
    const p = players[index];
    const opponents = players.filter((_, i) => i !== index);
    return (
      <PlayerPanel
        player={p}
        onLifeChange={(d) => adjustLife(p.id, d)}
        onCommanderDamage={(d, sourceId) => adjustCommanderDamage(p.id, d, sourceId)}
        onPoisonChange={(d) => adjustPoison(p.id, d)}
        isRotated={rotated}
        className="flex-1"
        showPoisonCounters={settings.showPoisonCounters}
        perCommanderTracking={settings.perCommanderTracking}
        opponents={opponents}
      />
    );
  };

  const renderPlayers = () => {
    switch (playerCount) {
      case 1:
        return <div className="flex flex-col flex-1 gap-1">{panel(0)}</div>;
      case 2:
        return (
          <div className="flex flex-col flex-1 gap-1">
            {panel(0, true)}
            {panel(1)}
          </div>
        );
      case 3:
        return (
          <div className="flex flex-col flex-1 gap-1">
            {panel(0, true)}
            <div className="flex flex-1 gap-1">
              {panel(1)}
              {panel(2)}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="flex flex-col flex-1 gap-1">
            <div className="flex flex-1 gap-1">
              {panel(0, true)}
              {panel(1, true)}
            </div>
            <div className="flex flex-1 gap-1">
              {panel(2)}
              {panel(3)}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-bg-primary",
        !isFullscreen && "pb-16"
      )}
    >
      <div className="flex-1 flex flex-col p-1 relative">
        {renderPlayers()}

        {/* Menu button — center for 2+ players (sits on divider), corner for 1 player */}
        <div className={cn(
          "absolute z-20",
          playerCount === 1
            ? "top-4 left-4"
            : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        )}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 rounded-full bg-bg-secondary/90 border border-border flex items-center justify-center shadow-lg hover:bg-bg-hover transition-colors"
          >
            <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          </button>

          {showMenu && (
            <div className="absolute top-12 left-0 bg-bg-secondary border border-border rounded-xl shadow-xl p-2 flex flex-col gap-1 min-w-[140px] z-30">
              <button
                onClick={() => { setShowHistory(true); setShowMenu(false); }}
                className="text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
              >
                History
              </button>
              <button
                onClick={toggleFullscreen}
                className="text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
              >
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { resetGame(); setShowMenu(false); }}
                className="text-left px-3 py-2 text-sm text-restricted hover:bg-bg-hover rounded-lg transition-colors"
              >
                Reset Game
              </button>
              <button
                onClick={() => { newGame(); setShowMenu(false); }}
                className="text-left px-3 py-2 text-sm text-banned hover:bg-bg-hover rounded-lg transition-colors"
              >
                New Game
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal open={showHistory} onClose={() => setShowHistory(false)} title="Game History">
        <GameHistory events={events} players={players} />
      </Modal>
    </div>
  );
}
