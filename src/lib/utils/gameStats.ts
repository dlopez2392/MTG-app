import type { GameEntry } from "@/types/game";

export function computeStreak(entries: GameEntry[]): { current: number; type: "win" | "loss" | "none"; best: number } {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  let current = 0;
  let type: "win" | "loss" | "none" = "none";
  let best = 0;
  let bestRun = 0;

  if (sorted.length > 0) {
    type = sorted[0].result === "draw" ? "none" : sorted[0].result;
    for (const e of sorted) {
      if (e.result === type) current++;
      else break;
    }
  }

  let run = 0;
  for (const e of sorted) {
    if (e.result === "win") {
      run++;
      bestRun = Math.max(bestRun, run);
    } else {
      run = 0;
    }
  }
  best = bestRun;

  return { current, type, best };
}
