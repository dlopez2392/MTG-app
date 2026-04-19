"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils/cn";
import type { Binder, CollectionCard } from "@/types/collection";

interface CollectionSummaryProps {
  binders: Binder[];
  allCards: CollectionCard[];
  className?: string;
}

const CHART_COLORS = [
  "#F59E0B",
  "#3B82F6",
  "#22C55E",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
];

export default function CollectionSummary({
  binders,
  allCards,
  className,
}: CollectionSummaryProps) {
  const { totalCards, totalValue, chartData } = useMemo(() => {
    let cards = 0;
    let value = 0;

    const binderMap = new Map<string, { name: string; value: number; count: number }>();

    for (const binder of binders) {
      if (binder.id !== undefined) {
        binderMap.set(binder.id, { name: binder.name, value: 0, count: 0 });
      }
    }

    for (const card of allCards) {
      cards += card.quantity;
      const price = parseFloat(card.priceUsd ?? "0") * card.quantity;
      value += price;

      const entry = binderMap.get(card.binderId);
      if (entry) {
        entry.value += price;
        entry.count += card.quantity;
      }
    }

    const data = Array.from(binderMap.values())
      .filter((b) => b.count > 0)
      .map((b) => ({
        name: b.name,
        value: Math.round(b.value * 100) / 100,
      }));

    return { totalCards: cards, totalValue: value, chartData: data };
  }, [binders, allCards]);

  return (
    <div
      className={cn(
        "bg-bg-card rounded-xl p-4 border border-border",
        className
      )}
    >
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-bg-primary/50 rounded-lg p-2.5 text-center">
          <p className="text-lg sm:text-2xl font-bold text-text-primary tabular-nums">{totalCards}</p>
          <p className="text-[10px] sm:text-xs text-text-muted">Cards</p>
        </div>
        <div className="bg-bg-primary/50 rounded-lg p-2.5 text-center">
          <p className="text-lg sm:text-2xl font-bold text-accent tabular-nums truncate">
            ${totalValue.toFixed(2)}
          </p>
          <p className="text-[10px] sm:text-xs text-text-muted">Value</p>
        </div>
        <div className="bg-bg-primary/50 rounded-lg p-2.5 text-center">
          <p className="text-lg sm:text-2xl font-bold text-text-primary tabular-nums">{binders.length}</p>
          <p className="text-[10px] sm:text-xs text-text-muted">Binders</p>
        </div>
      </div>

      {/* Donut Chart */}
      {chartData.length > 0 && (
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={48}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#2a2a2a",
                  border: "1px solid #3a3a3a",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "12px",
                }}
                formatter={(value) => [`$${Number(value).toFixed(2)}`, "Value"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
