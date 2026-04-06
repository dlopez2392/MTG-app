"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const MTG_PIE_COLORS: Record<string, string> = {
  W: "#F8F6D8",
  U: "#0E68AB",
  B: "#3D3229",
  R: "#D3202A",
  G: "#00733E",
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
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-text-muted">
        No color data
      </div>
    );
  }

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            dataKey="value"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#E5E7EB",
              fontSize: "12px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-3 mt-1">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name} ({entry.value})
          </div>
        ))}
      </div>
    </div>
  );
}
