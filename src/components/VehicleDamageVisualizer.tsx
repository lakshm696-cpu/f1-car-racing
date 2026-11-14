import React from 'react';

interface VehicleDamageVisualizerProps {
  damagePct: number;
}

type PartSeverity = 'ok' | 'warn' | 'critical';

function getPartPalette(severity: PartSeverity, defaultFill: string, defaultStroke: string) {
  if (severity === 'critical') {
    return {
      fill: 'rgba(239, 68, 68, 0.72)',
      stroke: '#EF4444',
      text: 'text-red-400',
    };
  }
  if (severity === 'warn') {
    return {
      fill: 'rgba(245, 158, 11, 0.45)',
      stroke: '#F59E0B',
      text: 'text-amber-400',
    };
  }
  return {
    fill: defaultFill,
    stroke: defaultStroke,
    text: 'text-slate-400',
  };
}

export const VehicleDamageVisualizer: React.FC<VehicleDamageVisualizerProps> = ({ damagePct }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(damagePct)));

  const frontWingSeverity: PartSeverity =
    clamped >= 10 ? 'critical' : clamped >= 3 ? 'warn' : 'ok';
  const tyresSeverity: PartSeverity =
    clamped >= 25 ? 'critical' : clamped >= 12 ? 'warn' : 'ok';
  const sidepodsSeverity: PartSeverity =
    clamped >= 40 ? 'critical' : clamped >= 22 ? 'warn' : 'ok';
  const rearSeverity: PartSeverity =
    clamped >= 65 ? 'critical' : clamped >= 45 ? 'warn' : 'ok';

  const fw = getPartPalette(frontWingSeverity, 'rgba(51, 65, 85, 0.78)', '#94A3B8');
  const tyr = getPartPalette(tyresSeverity, 'rgba(30, 41, 59, 0.92)', '#64748B');
  const pod = getPartPalette(sidepodsSeverity, 'rgba(51, 65, 85, 0.72)', '#94A3B8');
  const rear = getPartPalette(rearSeverity, 'rgba(30, 41, 59, 0.8)', '#64748B');

  return (
    <div
      className="flex flex-col items-center justify-between gap-1 px-2 py-1 rounded-xl border border-white/10 bg-[#0D1118]/90 shrink-0"
      aria-label={`Vehicle damage ${clamped}%`}
    >
      <div className="w-full flex items-center justify-between gap-2 text-[9px] font-semibold tracking-wider">
        <span className="text-slate-400">DAMAGE</span>
        <span
          className={`font-mono-telemetry tabular-nums font-bold ${
            clamped >= 25 ? 'text-red-400' : clamped > 0 ? 'text-amber-400' : 'text-emerald-400'
          }`}
        >
          {clamped}%
        </span>
      </div>

      {/* Top-Down Formula Car Telemetry Diagram */}
      <svg
        viewBox="0 0 80 118"
        className="w-14 h-20 sm:w-16 sm:h-22 overflow-visible"
        role="img"
        aria-label="Top-down Formula car damage diagram"
      >
        <defs>
          <filter id="dmg-red-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Suspension Wishbones */}
        <g stroke="#475569" strokeWidth="1.4" strokeLinecap="round">
          <line x1="20" y1="30" x2="35" y2="30" />
          <line x1="20" y1="34" x2="35" y2="33" />
          <line x1="60" y1="30" x2="45" y2="30" />
          <line x1="60" y1="34" x2="45" y2="33" />
          <line x1="20" y1="88" x2="34" y2="88" />
          <line x1="60" y1="88" x2="46" y2="88" />
        </g>

        {/* Front Wing + Endplates */}
        <g filter={frontWingSeverity === 'critical' ? 'url(#dmg-red-glow)' : undefined}>
          <path
            d="M 11,16 L 34,11 L 40,9 L 46,11 L 69,16 L 69,21 L 47,18 L 40,22 L 33,18 L 11,21 Z"
            fill={fw.fill}
            stroke={fw.stroke}
            strokeWidth="1.3"
            strokeLinejoin="round"
            className="transition-colors duration-200"
          />
          <rect
            x="9"
            y="14"
            width="3"
            height="9"
            rx="1"
            fill={fw.fill}
            stroke={fw.stroke}
            strokeWidth="1"
          />
          <rect
            x="68"
            y="14"
            width="3"
            height="9"
            rx="1"
            fill={fw.fill}
            stroke={fw.stroke}
            strokeWidth="1"
          />
        </g>

        {/* Four Open-Wheel Racing Tyres */}
        <g filter={tyresSeverity === 'critical' ? 'url(#dmg-red-glow)' : undefined}>
          {/* Front Left */}
          <rect
            x="8"
            y="24"
            width="11"
            height="17"
            rx="2.6"
            fill={tyr.fill}
            stroke={tyr.stroke}
            strokeWidth="1.35"
            className="transition-colors duration-200"
          />
          {/* Front Right */}
          <rect
            x="61"
            y="24"
            width="11"
            height="17"
            rx="2.6"
            fill={tyr.fill}
            stroke={tyr.stroke}
            strokeWidth="1.35"
            className="transition-colors duration-200"
          />
          {/* Rear Left */}
          <rect
            x="7"
            y="78"
            width="12.5"
            height="19"
            rx="2.8"
            fill={tyr.fill}
            stroke={tyr.stroke}
            strokeWidth="1.35"
            className="transition-colors duration-200"
          />
          {/* Rear Right */}
          <rect
            x="60.5"
            y="78"
            width="12.5"
            height="19"
            rx="2.8"
            fill={tyr.fill}
            stroke={tyr.stroke}
            strokeWidth="1.35"
            className="transition-colors duration-200"
          />
        </g>

        {/* Left & Right Aerodynamic Sidepods */}
        <g filter={sidepodsSeverity === 'critical' ? 'url(#dmg-red-glow)' : undefined}>
          <path
            d="M 22,46 C 22,42 29,42 33,44 L 33,84 C 28,85 24,80 22,70 Z"
            fill={pod.fill}
            stroke={pod.stroke}
            strokeWidth="1.3"
            strokeLinejoin="round"
            className="transition-colors duration-200"
          />
          <path
            d="M 58,46 C 58,42 51,42 47,44 L 47,84 C 52,85 56,80 58,70 Z"
            fill={pod.fill}
            stroke={pod.stroke}
            strokeWidth="1.3"
            strokeLinejoin="round"
            className="transition-colors duration-200"
          />
        </g>

        {/* Central Monocoque, Nose Cone & Engine Cover */}
        <path
          d="M 37,10 L 43,10 L 46,42 L 46,88 L 43,98 L 37,98 L 34,88 L 34,42 Z"
          fill={rear.fill}
          stroke={rear.stroke}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Cockpit & Halo Safety Frame */}
        <ellipse cx="40" cy="52" rx="4.2" ry="7.2" fill="#090B0F" stroke="#64748B" strokeWidth="0.9" />
        <path
          d="M 36,52 C 36,46 44,46 44,52 M 40,47 L 40,42"
          fill="none"
          stroke="#CBD5E1"
          strokeWidth="1.15"
          strokeLinecap="round"
        />

        {/* Rear Wing Assembly */}
        <g filter={rearSeverity === 'critical' ? 'url(#dmg-red-glow)' : undefined}>
          <rect
            x="22"
            y="102"
            width="36"
            height="8"
            rx="1.5"
            fill={rear.fill}
            stroke={rear.stroke}
            strokeWidth="1.25"
          />
        </g>
      </svg>

      {/* Component Status Legend */}
      <div className="flex items-center gap-1.5 text-[8px] font-mono-telemetry font-bold tracking-tight">
        <span className={fw.text}>FW</span>
        <span className="text-slate-600">·</span>
        <span className={tyr.text}>TYR</span>
        <span className="text-slate-600">·</span>
        <span className={pod.text}>POD</span>
      </div>
    </div>
  );
};
