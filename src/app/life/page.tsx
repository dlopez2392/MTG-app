"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils/cn";
import { useLifeCounter } from "@/hooks/useLifeCounter";
import PlayerSetup from "@/components/life/PlayerSetup";
import PlayerPanel from "@/components/life/PlayerPanel";
import GameHistory from "@/components/life/GameHistory";
import CommanderDamage from "@/components/life/CommanderDamage";
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
    addCommanderDamage,
    resetGame,
    newGame,
  } = useLifeCounter();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCommander, setShowCommander] = useState(false);

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
    return (
      <PlayerSetup
        onStart={(count, life, names) => setupGame(count, life, names)}
      />
    );
  }

  // Build game layout based on player count
  const renderPlayers = () => {
    switch (playerCount) {
      case 2:
        return (
          <div className="flex flex-col flex-1 gap-1">
            <PlayerPanel
              player={players[0]}
              onLifeChange={(d) => adjustLife(players[0].id, d)}
              onPoisonChange={(d) => adjustPoison(players[0].id, d)}
              isRotated
              className="flex-1"
            />
            <PlayerPanel
              player={players[1]}
              onLifeChange={(d) => adjustLife(players[1].id, d)}
              onPoisonChange={(d) => adjustPoison(players[1].id, d)}
              className="flex-1"
            />
          </div>
        );
      case 3:
        return (
          <div className="flex flex-col flex-1 gap-1">
            <PlayerPanel
              player={players[0]}
              onLifeChange={(d) => adjustLife(players[0].id, d)}
              onPoisonChange={(d) => adjustPoison(players[0].id, d)}
              isRotated
              className="flex-1"
            />
            <div className="flex flex-1 gap-1">
              <PlayerPanel
                player={players[1]}
                onLifeChange={(d) => adjustLife(players[1].id, d)}
                onPoisonChange={(d) => adjustPoison(players[1].id, d)}
                className="flex-1"
              />
              <PlayerPanel
                player={players[2]}
                onLifeChange={(d) => adjustLife(players[2].id, d)}
                onPoisonChange={(d) => adjustPoison(players[2].id, d)}
                className="flex-1"
              />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="flex flex-col flex-1 gap-1">
            <div className="flex flex-1 gap-1">
              <PlayerPanel
                player={players[0]}
                onLifeChange={(d) => adjustLife(players[0].id, d)}
                onPoisonChange={(d) => adjustPoison(players[0].id, d)}
                isRotated
                className="flex-1"
              />
              <PlayerPanel
                player={players[1]}
                onLifeChange={(d) => adjustLife(players[1].id, d)}
                onPoisonChange={(d) => adjustPoison(players[1].id, d)}
                isRotated
                className="flex-1"
              />
            </div>
            <div className="flex flex-1 gap-1">
              <PlayerPanel
                player={players[2]}
                onLifeChange={(d) => adjustLife(players[2].id, d)}
                onPoisonChange={(d) => adjustPoison(players[2].id, d)}
                className="flex-1"
              />
              <PlayerPanel
                player={players[3]}
                onLifeChange={(d) => adjustLife(players[3].id, d)}
                onPoisonChange={(d) => adjustPoison(players[3].id, d)}
                className="flex-1"
              />
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
      {/* Game area */}
      <div className="flex-1 flex flex-col p-1 relative">
        {renderPlayers()}

        {/* Center menu button */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 rounded-full bg-bg-secondary/90 border border-border flex items-center justify-center shadow-lg hover:bg-bg-hover transition-colors"
          >
            <svg
              className="w-5 h-5 text-text-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
              />
            </svg>
          </button>

          {/* Quick menu */}
          {showMenu && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-bg-secondary border border-border rounded-xl shadow-xl p-2 flex flex-col gap-1 min-w-[140px] z-30">
              <button
                onClick={() => {
                  setShowHistory(true);
                  setShowMenu(false);
                }}
                className="text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
              >
                History
              </button>
              <button
                onClick={() => {
                  setShowCommander(true);
                  setShowMenu(false);
                }}
                className="text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
              >
                Commander Damage
              </button>
              <button
                onClick={toggleFullscreen}
                className="text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
              >
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => {
                  resetGame();
                  setShowMenu(false);
                }}
                className="text-left px-3 py-2 text-sm text-restricted hover:bg-bg-hover rounded-lg transition-colors"
              >
                Reset Game
              </button>
              <button
                onClick={() => {
                  newGame();
                  setShowMenu(false);
                }}
                className="text-left px-3 py-2 text-sm text-banned hover:bg-bg-hover rounded-lg transition-colors"
              >
                New Game
              </button>
            </div>
          )}
        </div>
      </div>

      {/* History Modal */}
      <Modal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        title="Game History"
      >
        <GameHistory events={events} players={players} />
      </Modal>

      {/* Commander Damage Modal */}
      <Modal
        open={showCommander}
        onClose={() => setShowCommander(false)}
        title="Commander Damage"
      >
        <div className="space-y-4">
          {players.map((player) => (
            <CommanderDamage
              key={player.id}
              player={player}
              allPlayers={players}
              onAddDamage={addCommanderDamage}
            />
          ))}
        </div>
      </Modal>
    </div>
  );
}
