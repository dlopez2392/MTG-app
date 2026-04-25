"use client";

interface TypeBreakdownProps {
  typeBreakdown: Record<string, number>;
}

const TYPE_ICONS: Record<string, string> = {
  Creature: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  Instant: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
  Sorcery: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z",
  Enchantment: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z",
  Artifact: "M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V15m0 6.75l-2.25-1.313M12 15l2.25 1.313M12 15l-2.25 1.313",
  Planeswalker: "M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z",
  Land: "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008V7.5z",
  Battle: "M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15",
};

const TYPE_GRADIENTS: Record<string, string> = {
  Creature: "linear-gradient(90deg, #22C55E, #16A34A)",
  Instant: "linear-gradient(90deg, #3B82F6, #2563EB)",
  Sorcery: "linear-gradient(90deg, #A855F7, #7C3AED)",
  Enchantment: "linear-gradient(90deg, #F59E0B, #D97706)",
  Artifact: "linear-gradient(90deg, #6B7280, #4B5563)",
  Planeswalker: "linear-gradient(90deg, #EC4899, #DB2777)",
  Land: "linear-gradient(90deg, #84CC16, #65A30D)",
  Battle: "linear-gradient(90deg, #EF4444, #DC2626)",
};

const TYPE_GLOW: Record<string, string> = {
  Creature: "rgba(34,197,94,0.3)",
  Instant: "rgba(59,130,246,0.3)",
  Sorcery: "rgba(168,85,247,0.3)",
  Enchantment: "rgba(245,158,11,0.3)",
  Artifact: "rgba(107,114,128,0.3)",
  Planeswalker: "rgba(236,72,153,0.3)",
  Land: "rgba(132,204,22,0.3)",
  Battle: "rgba(239,68,68,0.3)",
};

export default function TypeBreakdown({ typeBreakdown }: TypeBreakdownProps) {
  const entries = Object.entries(typeBreakdown).sort(([, a], [, b]) => b - a);

  if (entries.length === 0) {
    return (
      <div className="text-sm text-text-muted text-center py-4">No type data</div>
    );
  }

  const maxCount = Math.max(...entries.map(([, v]) => v));
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="flex flex-col gap-3">
      {entries.map(([type, count]) => {
        const pct = ((count / maxCount) * 100).toFixed(0);
        const totalPct = ((count / total) * 100).toFixed(0);
        const gradient = TYPE_GRADIENTS[type] ?? "linear-gradient(90deg, #6366F1, #4F46E5)";
        const glow = TYPE_GLOW[type] ?? "rgba(99,102,241,0.3)";

        return (
          <div key={type} className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: `${gradient.replace("90deg", "135deg")}`.replace(/,\s*#\w+\)/, ", rgba(255,255,255,0.1))"),
                boxShadow: `0 2px 8px ${glow}`,
              }}
            >
              {TYPE_ICONS[type] && (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={TYPE_ICONS[type]} />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-white/70">{type}</span>
                <span className="text-xs text-white/40">{totalPct}%</span>
              </div>
              <div
                className="h-2.5 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <div
                  className="h-full rounded-full transition-all relative"
                  style={{
                    width: `${pct}%`,
                    background: gradient,
                    boxShadow: `0 0 10px ${glow}`,
                  }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-[1px] rounded-full"
                    style={{ background: "rgba(255,255,255,0.4)" }}
                  />
                </div>
              </div>
            </div>
            <span
              className="text-sm font-bold w-8 text-right flex-shrink-0"
              style={{ color: "rgba(255,255,255,0.8)" }}
            >
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
