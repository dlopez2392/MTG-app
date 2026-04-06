"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DeckStats } from "@/types/deck";

const MTG_BAR_COLORS: Record<string, string> = {
  W: "#F8F6D8",
  U: "#0E68AB",
  B: "#3D3229",
  R: "#D3202A",
  G: "#00733E",
};

const COLOR_LABELS: Record<string, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

interface ManaCurveChartProps {
  manaCurve: DeckStats["manaCurve"];
}

export default function ManaCurveChart({ manaCurve }: ManaCurveChartProps) {
  // Build data array for CMC 0-7+
  const data = Array.from({ length: 8 }, (_, cmc) => {
    const bucket = manaCurve[cmc];
    return {
      cmc: cmc === 7 ? "7+" : String(cmc),
      W: bucket?.byColor?.W ?? 0,
      U: bucket?.byColor?.U ?? 0,
      B: bucket?.byColor?.B ?? 0,
      R: bucket?.byColor?.R ?? 0,
      G: bucket?.byColor?.G ?? 0,
      total: bucket?.total ?? 0,
    };
  });

  // Only show color bars that actually have data
  const activeColors = (["W", "U", "B", "R", "G"] as const).filter((c) =>
    data.some((d) => d[c] > 0)
  );

  // If no color data at all, just show totals
  const hasColorData = activeColors.length > 0;

  return (
    <div className="w-full h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis
            dataKey="cmc"
            tick={{ fill: "#6B7280", fontSize: 12 }}
            axisLine={{ stroke: "#374151" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#6B7280", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#E5E7EB",
              fontSize: "12px",
            }}
          />
          {hasColorData ? (
            activeColors.map((color) => (
              <Bar
                key={color}
                dataKey={color}
                name={COLOR_LABELS[color]}
                stackId="stack"
                fill={MTG_BAR_COLORS[color]}
                radius={color === activeColors[activeColors.length - 1] ? [2, 2, 0, 0] : undefined}
              />
            ))
          ) : (
            <Bar dataKey="total" name="Cards" fill="#6366F1" radius={[2, 2, 0, 0]} />
          )}
          {hasColorData && <Legend wrapperStyle={{ fontSize: "11px", color: "#9CA3AF" }} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
