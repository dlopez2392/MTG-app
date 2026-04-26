"use client";

interface HeroBannerProps {
  title: string;
  subtitle?: string;
  accent?: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  onBack?: () => void;
}

export default function HeroBanner({ title, subtitle, accent, icon, children, onBack }: HeroBannerProps) {
  const accentColor = accent ?? "var(--color-accent)";
  return (
    <div className="relative" style={{ minHeight: children ? 180 : 130 }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-hero-from/60 via-transparent to-hero-to/60" />

        <div
          className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl opacity-20"
          style={{ background: accentColor }}
        />
      </div>

      <div className="relative z-20 px-4 pt-8 pb-5 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white btn-gradient active:scale-90 transition-all cursor-pointer flex-shrink-0"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${accentColor} 10%, transparent)`, color: accentColor, boxShadow: `0 0 20px color-mix(in srgb, ${accentColor} 19%, transparent)` }}
          >
            {icon}
          </div>
          <div>
            <h1 className="font-display text-2xl font-black text-text-primary leading-tight tracking-wide uppercase">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
