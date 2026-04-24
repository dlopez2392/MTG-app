"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils/cn";
import type { ValueSnapshot } from "@/hooks/useValueHistory";

interface ValueHistoryChartProps {
  history: ValueSnapshot[];
  className?: string;
}

type Range = 7 | 30 | 90;

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Custom tooltip
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-secondary border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-text-muted mb-0.5">{label ? shortDate(label) : ""}</p>
      <p className="font-bold text-accent">${payload[0].value.toFixed(2)}</p>
    </div>
  );
}

export default function ValueHistoryChart({ history, className }: ValueHistoryChartProps) {
  const [range, setRange] = useState<Range>(30);

  const filtered = useMemo(() => {
    if (history.length === 0) return [];
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-range);
  }, [history, range]);

  if (filtered.length < 2) {
    return (
      <div className={cn("glass-card rounded-xl border border-border p-4", className)}>
        <p className="text-section-label text-text-muted mb-1">Value History</p>
        <p className="text-xs text-text-muted italic">
          {filtered.length === 0
            ? "No history yet — come back after visiting your collection a few days in a row."
            : "Not enough data yet — check back tomorrow for a trend line."}
        </p>
      </div>
    );
  }

  const first = filtered[0].value;
  const last  = filtered[filtered.length - 1].value;
  const delta = last - first;
  const pct   = first > 0 ? (delta / first) * 100 : 0;
  const up    = delta >= 0;

  const minVal = Math.min(...filtered.map((s) => s.value));
  const maxVal = Math.max(...filtered.map((s) => s.value));
  const pad    = (maxVal - minVal) * 0.15 || 1;

  // Show fewer x-axis ticks on small ranges
  const tickCount = range === 7 ? filtered.length : 5;

  return (
    <div className={cn("glass-card rounded-xl border border-border p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-section-label text-text-muted">Value History</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl font-bold text-text-primary">${last.toFixed(2)}</span>
            <span className={cn(
              "text-xs font-semibold",
              up ? "text-legal" : "text-banned"
            )}>
              {up ? "▲" : "▼"} ${Math.abs(delta).toFixed(2)} ({Math.abs(pct).toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Range toggle */}
        <div className="flex gap-1">
          {([7, 30, 90] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-2 py-1 rounded text-[10px] font-bold transition-colors",
                range === r
                  ? "bg-accent/20 text-accent"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              {r}D
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filtered} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fontSize: 9, fill: "var(--color-text-muted, #666)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tickCount={tickCount}
            />
            <YAxis
              domain={[minVal - pad, maxVal + pad]}
              hide
            />
            <Tooltip content={<ChartTooltip />} />
            {first > 0 && (
              <ReferenceLine
                y={first}
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="4 4"
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={up ? "#22C55E" : "#EF4444"}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: up ? "#22C55E" : "#EF4444", strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[9px] text-text-muted mt-1 text-right">
        {filtered.length} day{filtered.length !== 1 ? "s" : ""} of data · snapshots taken daily
      </p>
    </div>
  );
}
