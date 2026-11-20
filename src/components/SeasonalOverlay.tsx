import React, { useMemo } from 'react';
import { SeasonThemeId } from '../../shared/bingo';

interface SeasonalOverlayProps {
  seasonTheme: SeasonThemeId;
}

export const SeasonalOverlay: React.FC<SeasonalOverlayProps> = ({ seasonTheme }) => {
  const particles = useMemo(
    () =>
      Array.from({ length: 20 }, (_, idx) => ({
        id: idx,
        leftPct: ((idx * 17 + 7) % 94) + 3,
        delaySec: -((idx * 1.37) % 12),
        durationSec: 7.5 + ((idx * 1.9) % 5.5),
        sizePx: 11 + ((idx * 3) % 10),
        opacity: 0.45 + ((idx * 7) % 45) / 100,
      })),
    []
  );

  if (!seasonTheme || seasonTheme === 'none') return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden motion-reduce:hidden"
    >
      {seasonTheme === 'christmas' &&
        particles.map((p) => (
          <span
            key={p.id}
            className="absolute top-0 text-sky-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.65)] animate-snowfall select-none"
            style={{
              left: `${p.leftPct}%`,
              fontSize: `${p.sizePx}px`,
              opacity: p.opacity,
              animationDelay: `${p.delaySec}s`,
              animationDuration: `${p.durationSec}s`,
            }}
          >
            ❄
          </span>
        ))}

      {seasonTheme === 'enkutatash' &&
        particles.map((p) => (
          <span
            key={p.id}
            className="absolute top-0 animate-flower-float select-none"
            style={{
              left: `${p.leftPct}%`,
              width: `${p.sizePx + 4}px`,
              height: `${p.sizePx + 4}px`,
              opacity: p.opacity,
              animationDelay: `${p.delaySec}s`,
              animationDuration: `${p.durationSec + 1.5}s`,
            }}
          >
            <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow-sm">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <ellipse
                  key={deg}
                  cx="16"
                  cy="6.5"
                  rx="2.6"
                  ry="5.5"
                  fill="#FACC15"
                  transform={`rotate(${deg} 16 16)`}
                />
              ))}
              <circle cx="16" cy="16" r="4" fill="#92400E" />
            </svg>
          </span>
        ))}

      {seasonTheme === 'golden' &&
        particles.map((p) => (
          <span
            key={p.id}
            className="absolute top-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.75)] animate-sparkle-rise select-none"
            style={{
              left: `${p.leftPct}%`,
              fontSize: `${p.sizePx}px`,
              opacity: p.opacity,
              animationDelay: `${p.delaySec}s`,
              animationDuration: `${p.durationSec}s`,
            }}
          >
            ✦
          </span>
        ))}

      {seasonTheme === 'cyber' &&
        particles.map((p) => (
          <span
            key={p.id}
            className={`absolute top-0 animate-sparkle-rise select-none ${
              p.id % 2 === 0 ? 'text-fuchsia-400' : 'text-cyan-300'
            }`}
            style={{
              left: `${p.leftPct}%`,
              fontSize: `${p.sizePx - 1}px`,
              opacity: p.opacity * 0.8,
              animationDelay: `${p.delaySec}s`,
              animationDuration: `${p.durationSec}s`,
            }}
          >
            ◆
          </span>
        ))}
    </div>
  );
};
