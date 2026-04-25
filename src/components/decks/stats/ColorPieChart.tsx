"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const MTG_PIE_COLORS: Record<string, string> = {
  W: "#F8F6D8",
  U: "#0E68AB",
  B: "#5A4A3A",
  R: "#D3202A",
  G: "#00733E",
};

const MTG_PIE_GLOW: Record<string, string> = {
  W: "rgba(248,246,216,0.5)",
  U: "rgba(14,104,171,0.5)",
  B: "rgba(90,74,58,0.5)",
  R: "rgba(211,32,42,0.5)",
  G: "rgba(0,115,62,0.5)",
};

const COLOR_NAMES: Record<string, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

interface ColorPieChartProps {
  colorDistribution: Record<string, number>;
}

export default function ColorPieChart({ colorDistribution }: ColorPieChartProps) {
  const data = Object.entries(colorDistribution)
    .filter(([, value]) => value > 0)
    .map(([color, value]) => ({
      name: COLOR_NAMES[color] ?? color,
      value,
      color: MTG_PIE_COLORS[color] ?? "#6B7280",
      glow: MTG_PIE_GLOW[color] ?? "rgba(107,114,128,0.5)",
      key: color,
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-text-muted">
        No color data
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="w-full">
      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* Shadow ring behind */}
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={72}
              dataKey="value"
              paddingAngle={3}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={`shadow-${index}`} fill="rgba(0,0,0,0.3)" />
              ))}
            </Pie>
            {/* Main ring */}
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={72}
              dataKey="value"
              paddingAngle={3}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            {/* Inner highlight ring */}
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={52}
              dataKey="value"
              paddingAngle={3}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={`highlight-${index}`} fill="rgba(255,255,255,0.12)" />
              ))}
            </Pie>
            <Tooltip
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
          </PieChart>
        </ResponsiveContainer>
        {/* Center total */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-xl font-bold text-white/90">{total}</p>
            <p className="text-[9px] text-white/30 uppercase tracking-widest">pips</p>
          </div>
        </div>
      </div>
      {/* Legend with glow dots */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
        {data.map((entry) => {
          const pct = ((entry.value / total) * 100).toFixed(0);
          return (
            <div key={entry.name} className="flex items-center gap-2 text-xs">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{
                  backgroundColor: entry.color,
                  boxShadow: `0 0 8px ${entry.glow}`,
                }}
              />
              <span className="text-white/60 font-medium">{entry.name}</span>
              <span className="text-white/30">{entry.value} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
