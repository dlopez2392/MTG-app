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

    const binderMap = new Map<number, { name: string; value: number; count: number }>();

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
      <div className="flex items-center gap-4">
        {/* Donut Chart */}
        <div className="w-24 h-24 flex-shrink-0">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={40}
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
          ) : (
            <div className="w-full h-full rounded-full border-4 border-border flex items-center justify-center">
              <span className="text-text-muted text-xs">Empty</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex-1 grid grid-cols-3 gap-3">
          <div>
            <p className="text-2xl font-bold text-text-primary">{totalCards}</p>
            <p className="text-xs text-text-muted">Total Cards</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-accent">
              ${totalValue.toFixed(2)}
            </p>
            <p className="text-xs text-text-muted">Total Value</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">
              {binders.length}
            </p>
            <p className="text-xs text-text-muted">Binders</p>
          </div>
        </div>
      </div>
    </div>
  );
}
