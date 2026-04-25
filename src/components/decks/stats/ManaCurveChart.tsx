"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import type { DeckStats } from "@/types/deck";

const MTG_BAR_COLORS: Record<string, string> = {
  W: "#F8F6D8",
  U: "#0E68AB",
  B: "#3D3229",
  R: "#D3202A",
  G: "#00733E",
};

const MTG_BAR_GLOW: Record<string, string> = {
  W: "rgba(248,246,216,0.4)",
  U: "rgba(14,104,171,0.4)",
  B: "rgba(61,50,41,0.4)",
  R: "rgba(211,32,42,0.4)",
  G: "rgba(0,115,62,0.4)",
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

function Bar3D(props: Record<string, unknown>) {
  const { x, y, width, height, fill } = props as {
    x: number; y: number; width: number; height: number; fill: string;
  };
  if (height <= 0) return null;
  const r = Math.min(4, width / 2);
  return (
    <g>
      <defs>
        <linearGradient id={`bar3d-${x}-${y}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.2)" />
        </linearGradient>
        <filter id={`barGlow-${x}`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Shadow */}
      <rect
        x={x + 2}
        y={y + 2}
        width={width}
        height={height}
        rx={r}
        fill="rgba(0,0,0,0.3)"
      />
      {/* Main bar */}
      <rect x={x} y={y} width={width} height={height} rx={r} fill={fill} />
      {/* 3D highlight overlay */}
      <rect x={x} y={y} width={width} height={height} rx={r} fill={`url(#bar3d-${x}-${y})`} />
      {/* Top shine */}
      <rect
        x={x + 2}
        y={y}
        width={width - 4}
        height={Math.min(3, height)}
        rx={1}
        fill="rgba(255,255,255,0.35)"
      />
    </g>
  );
}

export default function ManaCurveChart({ manaCurve }: ManaCurveChartProps) {
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

  const activeColors = (["W", "U", "B", "R", "G"] as const).filter((c) =>
    data.some((d) => d[c] > 0)
  );

  const hasColorData = activeColors.length > 0;

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="w-full h-56">
      {hasColorData ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }} barCategoryGap="20%">
            <XAxis
              dataKey="cmc"
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(124,92,252,0.08)" }}
              contentStyle={{
                backgroundColor: "rgba(15,15,25,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                color: "#E5E7EB",
                fontSize: "12px",
                backdropFilter: "blur(12px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}
            />
            {activeColors.map((color) => (
              <Bar
                key={color}
                dataKey={color}
                name={COLOR_LABELS[color]}
                stackId="stack"
                fill={MTG_BAR_COLORS[color]}
                shape={<Bar3D />}
              />
            ))}
            <Legend
              wrapperStyle={{ fontSize: "11px", color: "#9CA3AF", paddingTop: "8px" }}
              iconType="circle"
              iconSize={8}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-end justify-center gap-2 h-full pb-6 px-2">
          {data.map((d, i) => {
            const pct = maxTotal > 0 ? (d.total / maxTotal) * 100 : 0;
            return (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-[10px] font-bold text-white/60">{d.total || ""}</span>
                <div className="w-full relative" style={{ height: "140px" }}>
                  <div
                    className="absolute bottom-0 w-full rounded-t-md"
                    style={{
                      height: `${Math.max(pct, d.total > 0 ? 4 : 0)}%`,
                      background: "linear-gradient(180deg, #818CF8 0%, #6366F1 50%, #4F46E5 100%)",
                      boxShadow: d.total > 0 ? "0 0 12px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.3)" : "none",
                    }}
                  >
                    {d.total > 0 && (
                      <div
                        className="absolute top-0 left-1 right-1 h-[2px] rounded-full"
                        style={{ background: "rgba(255,255,255,0.4)" }}
                      />
                    )}
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-white/40">{d.cmc}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
