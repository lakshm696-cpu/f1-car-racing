import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudLightning,
  CloudRain,
  Moon,
  Sun,
  Sunset,
} from 'lucide-react';
import { SurfaceHazardType, WeatherMode } from '../types/racing';

export interface TrackLogSample {
  id: number;
  elapsedSec: number;
  lap: number;
  surfaceGripPct: number;
  trackWetnessPct: number;
  sectorGripPct: [number, number, number];
  weather: WeatherMode;
  hazard: SurfaceHazardType | null;
}

export interface WeatherChangeEvent {
  id: number;
  elapsedSec: number;
  lap: number;
  fromWeather: WeatherMode;
  toWeather: WeatherMode;
  gripAtChange: number;
}

interface TrackLogProps {
  surfaceGripPct: number;
  trackWetnessPct: number;
  sectorGripPct: [number, number, number];
  liveWeather: WeatherMode;
  nextWeather: WeatherMode | null;
  activeSurfaceHazard: SurfaceHazardType | null;
  lap: number;
  totalLaps: number;
  compactByDefault?: boolean;
}

const WEATHER_SHORT: Record<WeatherMode, string> = {
  day: 'Clear',
  sunset: 'Sunset',
  cloudy: 'Overcast',
  rain: 'Rain',
  heavy_rain: 'Storm',
  night: 'Night',
};

const WEATHER_COLOR: Record<WeatherMode, string> = {
  day: '#FACC15',
  sunset: '#F97316',
  cloudy: '#94A3B8',
  rain: '#38BDF8',
  heavy_rain: '#818CF8',
  night: '#60A5FA',
};

const WeatherMiniIcon: React.FC<{ mode: WeatherMode; className?: string }> = ({ mode, className }) => {
  if (mode === 'heavy_rain') return <CloudLightning className={className} />;
  if (mode === 'rain') return <CloudRain className={className} />;
  if (mode === 'cloudy') return <Cloud className={className} />;
  if (mode === 'sunset') return <Sunset className={className} />;
  if (mode === 'night') return <Moon className={className} />;
  return <Sun className={className} />;
};

const MAX_SAMPLES = 48;

function createInitialSeedSamples(
  grip: number,
  wetness: number,
  sectors: [number, number, number],
  weather: WeatherMode
): TrackLogSample[] {
  const seeds: TrackLogSample[] = [];
  const startWeather: WeatherMode =
    weather === 'rain' ? 'cloudy' : weather === 'heavy_rain' ? 'rain' : weather;

  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const sampleWeather = i < 6 ? startWeather : weather;
    const wave = Math.sin(i * 0.7) * 2.2 + Math.cos(i * 0.45) * 1.4;
    const interpGrip = Math.round(
      Math.max(45, Math.min(100, grip + (1 - t) * (sampleWeather !== weather ? 8 : 2) + wave))
    );
    const interpWet = Math.round(
      Math.max(0, Math.min(100, wetness - (1 - t) * (sampleWeather !== weather ? 18 : 4) - wave))
    );
    seeds.push({
      id: i + 1,
      elapsedSec: (i - 15) * 2,
      lap: 1,
      surfaceGripPct: interpGrip,
      trackWetnessPct: interpWet,
      sectorGripPct: [
        Math.max(45, Math.min(100, Math.round(sectors[0] + Math.sin(i * 0.8) * 2))),
        Math.max(45, Math.min(100, Math.round(sectors[1] + Math.cos(i * 0.6) * 2.5))),
        Math.max(45, Math.min(100, Math.round(sectors[2] + Math.sin(i * 0.5) * 2))),
      ],
      weather: sampleWeather,
      hazard: null,
    });
  }
  return seeds;
}

export const TrackLog: React.FC<TrackLogProps> = ({
  surfaceGripPct,
  trackWetnessPct,
  sectorGripPct,
  liveWeather,
  nextWeather,
  activeSurfaceHazard,
  lap,
  totalLaps,
  compactByDefault = false,
}) => {
  const [samples, setSamples] = useState<TrackLogSample[]>(() =>
    createInitialSeedSamples(surfaceGripPct, trackWetnessPct, sectorGripPct, liveWeather)
  );
  const [weatherEvents, setWeatherEvents] = useState<WeatherChangeEvent[]>([]);
  const [chartView, setChartView] = useState<'overview' | 'sectors'>('overview');
  const [collapsed, setCollapsed] = useState<boolean>(compactByDefault);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const sampleCounterRef = useRef<number>(17);
  const elapsedSecRef = useRef<number>(0);
  const lastWeatherRef = useRef<WeatherMode>(liveWeather);
  const latestTelemetryRef = useRef({
    surfaceGripPct,
    trackWetnessPct,
    sectorGripPct,
    liveWeather,
    activeSurfaceHazard,
    lap,
  });

  useEffect(() => {
    latestTelemetryRef.current = {
      surfaceGripPct,
      trackWetnessPct,
      sectorGripPct,
      liveWeather,
      activeSurfaceHazard,
      lap,
    };
  }, [surfaceGripPct, trackWetnessPct, sectorGripPct, liveWeather, activeSurfaceHazard, lap]);

  // Immediately log a sample when liveWeather or activeSurfaceHazard changes
  useEffect(() => {
    const prevWeather = lastWeatherRef.current;
    if (prevWeather !== liveWeather) {
      lastWeatherRef.current = liveWeather;
      const nextId = sampleCounterRef.current++;
      setWeatherEvents((prev) => [
        ...prev.slice(-7),
        {
          id: nextId,
          elapsedSec: elapsedSecRef.current,
          lap,
          fromWeather: prevWeather,
          toWeather: liveWeather,
          gripAtChange: surfaceGripPct,
        },
      ]);
      setSamples((prev) => [
        ...prev.slice(-(MAX_SAMPLES - 1)),
        {
          id: nextId,
          elapsedSec: elapsedSecRef.current,
          lap,
          surfaceGripPct,
          trackWetnessPct,
          sectorGripPct: [...sectorGripPct] as [number, number, number],
          weather: liveWeather,
          hazard: activeSurfaceHazard,
        },
      ]);
    }
  }, [liveWeather, activeSurfaceHazard, lap, surfaceGripPct, trackWetnessPct, sectorGripPct]);

  // Periodic real-time telemetry sampling every 1.2s with subtle micro-variation so the live chart breathes continuously
  useEffect(() => {
    const interval = window.setInterval(() => {
      elapsedSecRef.current += 1.2;
      const cur = latestTelemetryRef.current;
      const nextId = sampleCounterRef.current++;
      const jitter = Math.round(Math.sin(nextId * 0.65) * 0.8);
      const clampedGrip = Math.max(40, Math.min(100, cur.surfaceGripPct + jitter));
      const clampedWet = Math.max(0, Math.min(100, cur.trackWetnessPct - jitter));

      setSamples((prev) => [
        ...prev.slice(-(MAX_SAMPLES - 1)),
        {
          id: nextId,
          elapsedSec: Math.round(elapsedSecRef.current),
          lap: cur.lap,
          surfaceGripPct: clampedGrip,
          trackWetnessPct: clampedWet,
          sectorGripPct: [
            Math.max(40, Math.min(100, cur.sectorGripPct[0] + jitter)),
            Math.max(40, Math.min(100, cur.sectorGripPct[1] - jitter)),
            Math.max(40, Math.min(100, cur.sectorGripPct[2] + jitter)),
          ],
          weather: cur.liveWeather,
          hazard: cur.activeSurfaceHazard,
        },
      ]);
    }, 1200);

    return () => window.clearInterval(interval);
  }, []);

  // SVG coordinate geometry (width 300, height 108)
  const svgW = 300;
  const svgH = 108;
  const padL = 24;
  const padR = 8;
  const padT = 14;
  const padB = 18;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const {
    gripPoints,
    gripAreaPath,
    wetnessPoints,
    s1Points,
    s2Points,
    s3Points,
    weatherSegments,
    transitionMarkers,
    minGrip,
    maxGrip,
    gripDelta,
  } = useMemo(() => {
    const count = Math.max(2, samples.length);
    const xForIdx = (idx: number) => padL + (idx / (count - 1)) * plotW;
    // Map 0..100% to plot vertical space
    const yForPct = (pct: number) => padT + ((100 - Math.max(0, Math.min(100, pct))) / 100) * plotH;

    const gPts: string[] = [];
    const wPts: string[] = [];
    const s1Pts: string[] = [];
    const s2Pts: string[] = [];
    const s3Pts: string[] = [];

    let minG = 100;
    let maxG = 0;

    const segments: {
      startIdx: number;
      endIdx: number;
      x1: number;
      x2: number;
      weather: WeatherMode;
    }[] = [];

    const markers: {
      idx: number;
      x: number;
      y: number;
      weather: WeatherMode;
      hazard: SurfaceHazardType | null;
      isWeatherShift: boolean;
    }[] = [];

    samples.forEach((s, idx) => {
      const x = xForIdx(idx);
      const yg = yForPct(s.surfaceGripPct);
      const yw = yForPct(s.trackWetnessPct);
      gPts.push(`${x.toFixed(1)},${yg.toFixed(1)}`);
      wPts.push(`${x.toFixed(1)},${yw.toFixed(1)}`);
      s1Pts.push(`${x.toFixed(1)},${yForPct(s.sectorGripPct[0]).toFixed(1)}`);
      s2Pts.push(`${x.toFixed(1)},${yForPct(s.sectorGripPct[1]).toFixed(1)}`);
      s3Pts.push(`${x.toFixed(1)},${yForPct(s.sectorGripPct[2]).toFixed(1)}`);

      if (s.surfaceGripPct < minG) minG = s.surfaceGripPct;
      if (s.surfaceGripPct > maxG) maxG = s.surfaceGripPct;

      const prevSeg = segments[segments.length - 1];
      if (!prevSeg || prevSeg.weather !== s.weather) {
        if (prevSeg) {
          prevSeg.endIdx = idx;
          prevSeg.x2 = x;
        }
        segments.push({
          startIdx: idx,
          endIdx: idx,
          x1: x,
          x2: x,
          weather: s.weather,
        });
        if (idx > 0) {
          markers.push({
            idx,
            x,
            y: yg,
            weather: s.weather,
            hazard: s.hazard,
            isWeatherShift: true,
          });
        }
      } else {
        prevSeg.endIdx = idx;
        prevSeg.x2 = x;
      }

      if (s.hazard && (idx === 0 || samples[idx - 1]?.hazard !== s.hazard)) {
        markers.push({
          idx,
          x,
          y: yg,
          weather: s.weather,
          hazard: s.hazard,
          isWeatherShift: false,
        });
      }
    });

    const firstX = xForIdx(0).toFixed(1);
    const lastX = xForIdx(count - 1).toFixed(1);
    const baseY = (padT + plotH).toFixed(1);
    const areaPath =
      gPts.length > 1 ? `M ${firstX},${baseY} L ${gPts.join(' L ')} L ${lastX},${baseY} Z` : '';

    const delta =
      samples.length >= 2
        ? samples[samples.length - 1].surfaceGripPct - samples[0].surfaceGripPct
        : 0;

    return {
      gripPoints: gPts.join(' '),
      gripAreaPath: areaPath,
      wetnessPoints: wPts.join(' '),
      s1Points: s1Pts.join(' '),
      s2Points: s2Pts.join(' '),
      s3Points: s3Pts.join(' '),
      weatherSegments: segments,
      transitionMarkers: markers,
      minGrip: minG,
      maxGrip: maxG,
      gripDelta: delta,
    };
  }, [samples, plotW, plotH]);

  const inspectedSample =
    hoverIdx !== null && samples[hoverIdx]
      ? samples[hoverIdx]
      : samples[samples.length - 1];

  const inspectedX =
    samples.length > 1
      ? padL +
        (((hoverIdx !== null ? hoverIdx : samples.length - 1) / (samples.length - 1)) * plotW)
      : padL + plotW;
  const inspectedY =
    padT + ((100 - Math.max(0, Math.min(100, inspectedSample?.surfaceGripPct ?? surfaceGripPct))) / 100) * plotH;

  const gripGlowColor =
    surfaceGripPct < 60
      ? 'rgba(248, 113, 113, 0.92)'
      : surfaceGripPct < 75
        ? 'rgba(251, 191, 36, 0.92)'
        : 'rgba(52, 211, 153, 0.92)';
  const gripTextColorClass =
    surfaceGripPct < 60
      ? 'text-red-400'
      : surfaceGripPct < 75
        ? 'text-amber-300'
        : 'text-emerald-400';

  return (
    <div
      className="pointer-events-auto rounded-xl border border-emerald-400/30 overflow-hidden transition-all duration-200 max-w-[296px] sm:max-w-[320px]"
      style={{
        backgroundColor: 'rgba(9, 13, 21, 0.94)',
        boxShadow:
          '0 16px 36px rgba(0, 0, 0, 0.65), 0 0 22px rgba(16, 185, 129, 0.16), inset 0 1px 0 rgba(167, 243, 208, 0.18)',
      }}
    >
      {/* Header Row: Track Log Title + Live Grip / Weather Summary + Collapse Toggle */}
      <div
        className="px-3 py-1.5 flex items-center justify-between gap-2 border-b border-emerald-400/25"
        style={{
          background:
            'linear-gradient(90deg, rgba(16, 185, 129, 0.18) 0%, rgba(6, 182, 212, 0.08) 55%, rgba(6, 9, 15, 0.85) 100%)',
          boxShadow:
            'inset 0 -1px 0 rgba(52, 211, 153, 0.26), 0 4px 16px rgba(16, 185, 129, 0.10)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Activity
            className="w-3.5 h-3.5 text-emerald-400 shrink-0"
            style={{
              filter:
                'drop-shadow(0 0 5px rgba(52, 211, 153, 0.95)) drop-shadow(0 0 11px rgba(16, 185, 129, 0.55))',
            }}
          />
          <span
            className="font-display font-bold text-xs text-white tracking-wider whitespace-nowrap"
            style={{
              textShadow:
                '0 0 10px rgba(255, 255, 255, 0.45), 0 0 18px rgba(52, 211, 153, 0.35)',
            }}
          >
            TRACK LOG
          </span>
          <span className="text-[11px] text-slate-400" aria-hidden="true">
            ·
          </span>
          <span
            className={`font-mono-telemetry text-[11px] font-bold ${gripTextColorClass} tabular-nums whitespace-nowrap`}
            style={{
              textShadow: `0 0 9px ${gripGlowColor}, 0 0 18px ${gripGlowColor.replace('0.92', '0.45')}`,
            }}
          >
            {surfaceGripPct}% GRIP
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="flex items-center gap-1 text-[10px] font-mono-telemetry text-slate-200 whitespace-nowrap">
            <WeatherMiniIcon
              mode={liveWeather}
              className="w-3 h-3 text-cyan-300"
            />
            <span>{WEATHER_SHORT[liveWeather]}</span>
          </span>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand Track Log Chart' : 'Minimize Track Log Chart'}
            className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div
          className="p-2.5 flex flex-col gap-2"
          style={{
            background:
              'radial-gradient(120% 85% at 50% 0%, rgba(16, 185, 129, 0.08) 0%, rgba(9, 13, 21, 0) 70%)',
            boxShadow: 'inset 0 1px 16px rgba(16, 185, 129, 0.06)',
          }}
        >
          {/* Interactive Mode Switcher + Session Grip Delta */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setChartView('overview')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  chartView === 'overview'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(16,185,129,0.55)]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Grip &amp; Weather
              </button>
              <button
                type="button"
                onClick={() => setChartView('sectors')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  chartView === 'sectors'
                    ? 'bg-cyan-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(34,211,238,0.55)]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                S1 / S2 / S3 Split
              </button>
            </div>

            <div className="text-[10px] font-mono-telemetry text-slate-300 tabular-nums whitespace-nowrap">
              <span>Range {minGrip}–{maxGrip}%</span>
              <span className="mx-1 text-slate-500">·</span>
              <span
                className={gripDelta >= 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}
                style={{
                  textShadow:
                    gripDelta >= 0
                      ? '0 0 8px rgba(52, 211, 153, 0.55)'
                      : '0 0 8px rgba(251, 191, 36, 0.55)',
                }}
              >
                {gripDelta >= 0 ? `+${gripDelta}%` : `${gripDelta}%`}
              </span>
            </div>
          </div>

          {/* Dynamic Multi-Series SVG Line Chart */}
          <div
            className="relative rounded-lg border border-emerald-400/20 bg-black/65 p-1.5"
            style={{
              boxShadow:
                'inset 0 0 18px rgba(16, 185, 129, 0.08), 0 0 14px rgba(6, 182, 212, 0.08)',
            }}
          >
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full h-24 overflow-visible select-none"
              onMouseLeave={() => setHoverIdx(null)}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const relX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * svgW;
                const norm = Math.max(0, Math.min(1, (relX - padL) / plotW));
                const idx = Math.round(norm * (samples.length - 1));
                setHoverIdx(idx);
              }}
            >
              <defs>
                <linearGradient id="trackLogGripArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
                </linearGradient>
                <filter id="trackLogLineGlow" x="-15%" y="-25%" width="130%" height="150%">
                  <feGaussianBlur stdDeviation="2.1" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="trackLogPointGlow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="2.6" result="pointBlur" />
                  <feMerge>
                    <feMergeNode in="pointBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Top Weather Timeline Color Strip */}
              {weatherSegments.map((seg, i) => (
                <g key={`${seg.weather}-${i}`}>
                  <rect
                    x={seg.x1}
                    y={3}
                    width={Math.max(4, seg.x2 - seg.x1)}
                    height={5}
                    rx={1.5}
                    fill={WEATHER_COLOR[seg.weather]}
                    opacity="0.92"
                    filter="url(#trackLogLineGlow)"
                  />
                </g>
              ))}

              {/* Horizontal Grid Lines (100%, 75%, 50%) */}
              {[100, 75, 50].map((pct) => {
                const y = padT + ((100 - pct) / 100) * plotH;
                return (
                  <g key={pct}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={svgW - padR}
                      y2={y}
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray={pct === 75 ? '2 2' : undefined}
                    />
                    <text
                      x={padL - 4}
                      y={y + 3}
                      textAnchor="end"
                      fill="#94A3B8"
                      fontSize="7.5"
                      fontFamily="monospace"
                    >
                      {pct}%
                    </text>
                  </g>
                );
              })}

              {chartView === 'overview' ? (
                <>
                  {/* Shaded Grip Area */}
                  {gripAreaPath && <path d={gripAreaPath} fill="url(#trackLogGripArea)" />}

                  {/* Track Wetness % Dashed Line */}
                  <polyline
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="1.6"
                    strokeDasharray="3 2"
                    points={wetnessPoints}
                    filter="url(#trackLogLineGlow)"
                  />

                  {/* Primary Surface Grip % Line */}
                  <polyline
                    fill="none"
                    stroke="#34D399"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={gripPoints}
                    filter="url(#trackLogLineGlow)"
                  />
                </>
              ) : (
                <>
                  {/* Sector 1, Sector 2, Sector 3 Grip Lines */}
                  <polyline
                    fill="none"
                    stroke="#34D399"
                    strokeWidth="1.9"
                    points={s1Points}
                    filter="url(#trackLogLineGlow)"
                  />
                  <polyline
                    fill="none"
                    stroke="#FBBF24"
                    strokeWidth="1.9"
                    points={s2Points}
                    filter="url(#trackLogLineGlow)"
                  />
                  <polyline
                    fill="none"
                    stroke="#C084FC"
                    strokeWidth="1.9"
                    points={s3Points}
                    filter="url(#trackLogLineGlow)"
                  />
                </>
              )}

              {/* Weather Change & Surface Hazard Vertical Markers */}
              {transitionMarkers.map((m) => (
                <g key={`marker-${m.idx}`}>
                  <line
                    x1={m.x}
                    y1={padT}
                    x2={m.x}
                    y2={padT + plotH}
                    stroke={m.isWeatherShift ? WEATHER_COLOR[m.weather] : '#F97316'}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={m.x}
                    cy={m.y}
                    r="2.9"
                    fill={m.isWeatherShift ? WEATHER_COLOR[m.weather] : '#EF4444'}
                    stroke="#090B0F"
                    strokeWidth="1"
                    filter="url(#trackLogPointGlow)"
                  />
                </g>
              ))}

              {/* Active / Hovered Sample Scrubber Line & Point */}
              <line
                x1={inspectedX}
                y1={padT}
                x2={inspectedX}
                y2={padT + plotH}
                stroke="rgba(167, 243, 208, 0.45)"
                strokeWidth="1"
              />
              <circle
                cx={inspectedX}
                cy={inspectedY}
                r="3.8"
                fill="#34D399"
                stroke="#FFFFFF"
                strokeWidth="1.5"
                filter="url(#trackLogPointGlow)"
              />

              {/* X-Axis Labels */}
              <text
                x={padL}
                y={svgH - 4}
                fill="#64748B"
                fontSize="7.5"
                fontFamily="monospace"
              >
                SESSION START
              </text>
              <text
                x={svgW - padR}
                y={svgH - 4}
                textAnchor="end"
                fill="#94A3B8"
                fontSize="7.5"
                fontFamily="monospace"
              >
                LIVE · LAP {lap}/{totalLaps}
              </text>
            </svg>
          </div>

          {/* Inspected Sample & Weather Forecast Readout Strip */}
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono-telemetry text-slate-300 border-t border-white/10 pt-1.5">
            {chartView === 'overview' ? (
              <div className="flex items-center gap-2 tabular-nums">
                <span className="text-emerald-400 font-bold">
                  Grip {inspectedSample?.surfaceGripPct ?? surfaceGripPct}%
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-sky-300">
                  Wet {inspectedSample?.trackWetnessPct ?? trackWetnessPct}%
                </span>
                {inspectedSample?.hazard && (
                  <>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-amber-300 font-bold uppercase">
                      {inspectedSample.hazard}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 tabular-nums">
                <span className="text-emerald-400 font-bold">
                  S1 {inspectedSample?.sectorGripPct[0] ?? sectorGripPct[0]}%
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-amber-300 font-bold">
                  S2 {inspectedSample?.sectorGripPct[1] ?? sectorGripPct[1]}%
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-purple-300 font-bold">
                  S3 {inspectedSample?.sectorGripPct[2] ?? sectorGripPct[2]}%
                </span>
              </div>
            )}

            <div className="text-right text-slate-300 truncate">
              {nextWeather && nextWeather !== liveWeather ? (
                <span>
                  Forecast: <strong className="text-cyan-300">{WEATHER_SHORT[nextWeather]}</strong>
                </span>
              ) : weatherEvents.length > 0 ? (
                <span>
                  Last: <strong className="text-white">{WEATHER_SHORT[weatherEvents[weatherEvents.length - 1].fromWeather]} → {WEATHER_SHORT[weatherEvents[weatherEvents.length - 1].toWeather]}</strong>
                </span>
              ) : (
                <span>Cond: <strong className="text-white">{WEATHER_SHORT[inspectedSample?.weather ?? liveWeather]}</strong></span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
