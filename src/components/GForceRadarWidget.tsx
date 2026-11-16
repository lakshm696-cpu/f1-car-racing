import React, { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';

interface GForceRadarWidgetProps {
  gForceLat: number; // lateral acceleration
  gForceLong: number; // longitudinal acceleration
  gForceTotal: number; // total G magnitude
}

export const GForceRadarWidget: React.FC<GForceRadarWidgetProps> = ({
  gForceLat,
  gForceLong,
  gForceTotal,
}) => {
  const [sessionPeakG, setSessionPeakG] = useState<number>(4.0);

  // Dynamically track session peak G-force for adaptive scaling
  useEffect(() => {
    if (gForceTotal > sessionPeakG) {
      setSessionPeakG(gForceTotal);
    }
  }, [gForceTotal, sessionPeakG]);

  // Calculate dynamic max scale with headroom (min 4.0G, expands cleanly in 0.5G increments)
  const targetMax = Math.max(4.0, sessionPeakG * 1.2);
  const maxG = Math.ceil(targetMax * 2) / 2;

  const center = 50;
  const radius = 38;

  const x = center + (gForceLat / maxG) * radius;
  const y = center - (gForceLong / maxG) * radius;

  const distFromCenter = Math.sqrt((x - center) ** 2 + (y - center) ** 2);
  let dotX = x;
  let dotY = y;
  if (distFromCenter > radius) {
    const angle = Math.atan2(y - center, x - center);
    dotX = center + Math.cos(angle) * radius;
    dotY = center + Math.sin(angle) * radius;
  }

  // Generate adaptive rings based on dynamic maxG
  const ringCount = maxG <= 4 ? 4 : maxG <= 5 ? 5 : 6;
  const ringStep = maxG / ringCount;
  const ringValues = Array.from({ length: ringCount }, (_, i) => Number(((i + 1) * ringStep).toFixed(1)));

  return (
    <div
      className="rounded-xl border border-white/12 p-2.5 flex flex-col gap-1.5 shadow-2xl backdrop-blur-md"
      style={{ backgroundColor: 'rgba(9, 11, 15, 0.92)' }}
    >
      <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider text-slate-300">
        <div className="flex items-center gap-1.5 uppercase">
          <Gauge className="w-3 h-3 text-cyan-400" />
          <span>G-RADAR</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-slate-400 font-mono-telemetry">
            PEAK: <strong className="text-amber-400">{sessionPeakG.toFixed(2)}G</strong>
          </span>
          <span className="font-mono-telemetry font-bold text-cyan-300 tabular-nums">
            {gForceTotal.toFixed(2)}G
          </span>
        </div>
      </div>

      <div className="relative flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-28 h-28 overflow-visible">
          <defs>
            <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0F172A" stopOpacity="0.8" />
            </radialGradient>
            <filter id="g-dot-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx={center} cy={center} r={radius} fill="url(#radar-glow)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />

          {ringValues.map((gVal, idx) => {
            const r = (gVal / maxG) * radius;
            return (
              <circle
                key={`g-ring-${idx}`}
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke="rgba(148, 163, 184, 0.18)"
                strokeWidth="0.75"
                strokeDasharray={idx % 2 === 1 ? '2 2' : undefined}
              />
            );
          })}

          <line x1={center} y1={center - radius} x2={center} y2={center + radius} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1={center - radius} y1={center} x2={center + radius} y2={center} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

          <text x={center} y={center - radius + 7} fill="#94A3B8" fontSize="5.5" fontFamily="monospace" textAnchor="middle">BRAKE</text>
          <text x={center} y={center + radius - 2} fill="#94A3B8" fontSize="5.5" fontFamily="monospace" textAnchor="middle">ACCEL</text>
          <text x={center - radius + 3} y={center + 2} fill="#94A3B8" fontSize="5.5" fontFamily="monospace" textAnchor="start">L</text>
          <text x={center + radius - 3} y={center + 2} fill="#94A3B8" fontSize="5.5" fontFamily="monospace" textAnchor="end">R</text>

          <g filter="url(#g-dot-glow)">
            <circle cx={dotX} cy={dotY} r="4.5" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1.2" />
            <circle cx={dotX} cy={dotY} r="7.5" fill="none" stroke="#38BDF8" strokeWidth="0.75" className="animate-ping" style={{ transformOrigin: `${dotX}px ${dotY}px` }} />
          </g>
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-1 text-[9px] font-mono-telemetry tabular-nums text-center pt-1 border-t border-white/10">
        <div className="bg-black/40 rounded p-1">
          <span className="text-slate-400">LAT:</span>{' '}
          <strong className={gForceLat >= 0 ? 'text-cyan-300' : 'text-fuchsia-300'}>
            {gForceLat >= 0 ? `+${gForceLat.toFixed(2)}` : gForceLat.toFixed(2)}G
          </strong>
        </div>
        <div className="bg-black/40 rounded p-1">
          <span className="text-slate-400">LONG:</span>{' '}
          <strong className={gForceLong >= 0 ? 'text-emerald-300' : 'text-amber-300'}>
            {gForceLong >= 0 ? `+${gForceLong.toFixed(2)}` : gForceLong.toFixed(2)}G
          </strong>
        </div>
      </div>
    </div>
  );
};
