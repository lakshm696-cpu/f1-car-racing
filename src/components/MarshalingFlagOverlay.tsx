import React, { useEffect, useRef, useState } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Flag, Radio, ShieldAlert } from 'lucide-react';
import { TrackFlagState, TrackFlagType } from '../types/racing';

interface MarshalingFlagOverlayProps {
  trackFlag: TrackFlagState;
  currentSector: 1 | 2 | 3;
  lap: number;
  totalLaps: number;
  wrongWay?: boolean;
}

type ManualFlagOverride = 'auto' | 'yellow' | 'red' | 'blue' | 'checkered';

interface FlagVisualConfig {
  code: string;
  title: string;
  badgeText: string;
  primaryHex: string;
  secondaryHex: string;
  borderClass: string;
  glowShadow: string;
  bgGradient: string;
  headerBg: string;
  textAccentClass: string;
  directiveFallback: string;
}

const FLAG_CONFIGS: Record<Exclude<TrackFlagType, 'none'>, FlagVisualConfig> = {
  yellow: {
    code: 'FIA-YLW',
    title: 'YELLOW FLAG',
    badgeText: 'SECTOR CAUTION',
    primaryHex: '#FACC15',
    secondaryHex: '#CA8A04',
    borderClass: 'border-yellow-400/90',
    glowShadow: '0 0 32px rgba(250, 204, 21, 0.42), inset 0 0 18px rgba(250, 204, 21, 0.16)',
    bgGradient: 'linear-gradient(135deg, rgba(36, 26, 4, 0.95) 0%, rgba(18, 14, 5, 0.96) 65%, rgba(42, 30, 6, 0.94) 100%)',
    headerBg: 'rgba(250, 204, 21, 0.18)',
    textAccentClass: 'text-yellow-300',
    directiveFallback: 'NO OVERTAKING IN MARSHAL ZONE · DRS AUTOMATICALLY DISABLED',
  },
  red: {
    code: 'FIA-RED',
    title: 'RED FLAG',
    badgeText: 'SEVERE INCIDENT',
    primaryHex: '#EF4444',
    secondaryHex: '#991B1B',
    borderClass: 'border-red-500/95',
    glowShadow: '0 0 40px rgba(239, 68, 68, 0.58), inset 0 0 24px rgba(239, 68, 68, 0.24)',
    bgGradient: 'linear-gradient(135deg, rgba(48, 8, 12, 0.96) 0%, rgba(20, 6, 9, 0.97) 60%, rgba(56, 10, 14, 0.95) 100%)',
    headerBg: 'rgba(239, 68, 68, 0.24)',
    textAccentClass: 'text-red-300',
    directiveFallback: 'SESSION NEUTRALIZED · MAXIMUM CAUTION · PREPARE FOR PIT LANE',
  },
  blue: {
    code: 'FIA-BLU',
    title: 'BLUE FLAG',
    badgeText: 'YIELD CORRIDOR',
    primaryHex: '#38BDF8',
    secondaryHex: '#0284C7',
    borderClass: 'border-sky-400/90',
    glowShadow: '0 0 32px rgba(56, 189, 248, 0.44), inset 0 0 18px rgba(56, 189, 248, 0.18)',
    bgGradient: 'linear-gradient(135deg, rgba(6, 24, 46, 0.95) 0%, rgba(8, 15, 28, 0.96) 65%, rgba(8, 32, 58, 0.94) 100%)',
    headerBg: 'rgba(56, 189, 248, 0.18)',
    textAccentClass: 'text-sky-300',
    directiveFallback: 'FASTER CAR APPROACHING · HOLD PREDICTABLE LINE & ALLOW PASS',
  },
  checkered: {
    code: 'FIA-CHK',
    title: 'CHECKERED FLAG',
    badgeText: 'RACE FINISH',
    primaryHex: '#F8FAFC',
    secondaryHex: '#F59E0B',
    borderClass: 'border-white/90',
    glowShadow: '0 0 36px rgba(248, 250, 252, 0.42), 0 0 18px rgba(245, 158, 11, 0.32)',
    bgGradient: 'linear-gradient(135deg, rgba(15, 18, 26, 0.96) 0%, rgba(9, 11, 16, 0.98) 60%, rgba(28, 23, 12, 0.95) 100%)',
    headerBg: 'rgba(248, 250, 252, 0.14)',
    textAccentClass: 'text-amber-300',
    directiveFallback: 'FINAL CLASSIFICATION ACTIVE · COMPLETE LAP TO FINISH LINE',
  },
  surface: {
    code: 'FIA-SRF',
    title: 'SURFACE HAZARD',
    badgeText: 'LOW ADHESION',
    primaryHex: '#FB923C',
    secondaryHex: '#EF4444',
    borderClass: 'border-orange-400/90',
    glowShadow: '0 0 30px rgba(251, 146, 60, 0.42), inset 0 0 16px rgba(239, 68, 68, 0.18)',
    bgGradient: 'linear-gradient(135deg, rgba(44, 16, 6, 0.95) 0%, rgba(20, 10, 6, 0.96) 65%, rgba(48, 14, 8, 0.94) 100%)',
    headerBg: 'rgba(251, 146, 60, 0.2)',
    textAccentClass: 'text-orange-300',
    directiveFallback: 'DEBRIS / OIL ON RACING LINE · MODULATE BRAKE & THROTTLE',
  },
  green: {
    code: 'FIA-GRN',
    title: 'GREEN FLAG',
    badgeText: 'TRACK CLEAR',
    primaryHex: '#10B981',
    secondaryHex: '#059669',
    borderClass: 'border-emerald-400/90',
    glowShadow: '0 0 28px rgba(16, 185, 129, 0.42), inset 0 0 16px rgba(16, 185, 129, 0.16)',
    bgGradient: 'linear-gradient(135deg, rgba(5, 34, 24, 0.95) 0%, rgba(7, 18, 14, 0.96) 65%, rgba(6, 40, 28, 0.94) 100%)',
    headerBg: 'rgba(16, 185, 129, 0.18)',
    textAccentClass: 'text-emerald-300',
    directiveFallback: 'ALL MARSHAL SECTORS CLEAR · RACING PACE & DRS ENABLED',
  },
};

function renderAnimatedFlagMatrix(flag: Exclude<TrackFlagType, 'none'>) {
  if (flag === 'checkered') {
    return (
      <div className="relative w-14 h-11 rounded border border-white/40 overflow-hidden shadow-inner bg-slate-950 shrink-0">
        <div className="grid grid-cols-6 grid-rows-4 w-full h-full">
          {Array.from({ length: 24 }).map((_, idx) => {
            const row = Math.floor(idx / 6);
            const col = idx % 6;
            const isWhite = (row + col) % 2 === 0;
            return (
              <div
                key={idx}
                className={`transition-opacity duration-200 ${
                  isWhite ? 'bg-white' : 'bg-slate-950'
                } animate-pulse`}
                style={{
                  animationDelay: `${(col * 55 + row * 35) % 300}ms`,
                  animationDuration: '950ms',
                }}
              />
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-0 border border-amber-400/50" />
      </div>
    );
  }

  if (flag === 'surface') {
    return (
      <div className="relative w-14 h-11 rounded border border-orange-400/70 overflow-hidden shadow-inner bg-slate-950 shrink-0 flex">
        {[0, 1, 2, 3, 4, 5].map((stripe) => (
          <div
            key={stripe}
            className={`flex-1 h-full ${
              stripe % 2 === 0 ? 'bg-yellow-400' : 'bg-red-600'
            } animate-pulse`}
            style={{ animationDelay: `${stripe * 60}ms`, animationDuration: '700ms' }}
          />
        ))}
      </div>
    );
  }

  const matrixColor =
    flag === 'yellow'
      ? '#FACC15'
      : flag === 'red'
        ? '#EF4444'
        : flag === 'blue'
          ? '#38BDF8'
          : '#10B981';

  const secondaryColor =
    flag === 'yellow'
      ? '#FEF08A'
      : flag === 'red'
        ? '#FCA5A5'
        : flag === 'blue'
          ? '#BAE6FD'
          : '#A7F3D0';

  return (
    <div
      className="relative w-14 h-11 rounded border overflow-hidden shrink-0 flex flex-col justify-between p-1 bg-slate-950"
      style={{
        borderColor: matrixColor,
        boxShadow: `0 0 16px ${matrixColor}66, inset 0 0 10px ${matrixColor}44`,
      }}
    >
      {/* FIA DigiFlag LED Dot-Matrix Grid */}
      <div className="grid grid-cols-7 grid-rows-5 gap-[2px] w-full h-full">
        {Array.from({ length: 35 }).map((_, idx) => {
          const row = Math.floor(idx / 7);
          const col = idx % 7;
          const isDiagonalHighlight =
            flag === 'blue'
              ? col === row + 1 || col === row + 2
              : flag === 'red'
                ? row === 0 || row === 4 || col === 0 || col === 6 || (row === 2 && col >= 2 && col <= 4)
                : (row + col) % 2 === 0;
          return (
            <span
              key={idx}
              className="rounded-[1px] animate-pulse"
              style={{
                backgroundColor: isDiagonalHighlight ? secondaryColor : matrixColor,
                opacity: isDiagonalHighlight ? 1 : 0.72,
                animationDelay: `${(col * 45 + row * 30) % 280}ms`,
                animationDuration: flag === 'red' ? '460ms' : '780ms',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export const MarshalingFlagOverlay: React.FC<MarshalingFlagOverlayProps> = ({
  trackFlag,
  currentSector,
  lap,
  totalLaps,
  wrongWay = false,
}) => {
  const [manualOverride, setManualOverride] = useState<ManualFlagOverride>('auto');
  const [showControlStrip, setShowControlStrip] = useState(false);
  const [greenClearActive, setGreenClearActive] = useState(false);
  const [greenClearSector, setGreenClearSector] = useState<1 | 2 | 3>(currentSector);
  const prevLiveFlagRef = useRef<TrackFlagType>('none');

  // Trigger a brief 2.4-second FIA Green Flag ("TRACK CLEAR") when transitioning from a caution/hazard flag back to none
  useEffect(() => {
    const prev = prevLiveFlagRef.current;
    const curr = trackFlag.flag;
    prevLiveFlagRef.current = curr;

    if (
      (prev === 'yellow' || prev === 'red' || prev === 'surface') &&
      curr === 'none' &&
      manualOverride === 'auto'
    ) {
      setGreenClearSector(currentSector);
      setGreenClearActive(true);
      const timer = window.setTimeout(() => {
        setGreenClearActive(false);
      }, 2400);
      return () => window.clearTimeout(timer);
    }
    if (curr !== 'none') {
      setGreenClearActive(false);
    }
  }, [trackFlag.flag, currentSector, manualOverride]);

  if (wrongWay) return null;

  const effectiveState: TrackFlagState = (() => {
    if (manualOverride !== 'auto') {
      const simulatedPost = Math.max(1, Math.min(18, currentSector * 5));
      if (manualOverride === 'yellow') {
        return {
          flag: 'yellow',
          reason: `INCIDENT AHEAD IN SECTOR ${currentSector} — SINGLE CAR SPUN OFF-LINE`,
          distanceMeters: 118,
          sector: currentSector,
          marshalPost: simulatedPost,
          subDirective: 'NO OVERTAKING IN MARSHAL SECTOR · DRS AUTOMATICALLY DISABLED',
          driverCode: 'VER',
        };
      }
      if (manualOverride === 'red') {
        return {
          flag: 'red',
          reason: `TRACK BLOCKED IN SECTOR ${currentSector} — MULTI-CAR BARRIER IMPACT`,
          distanceMeters: 84,
          sector: currentSector,
          marshalPost: simulatedPost,
          subDirective: 'RED FLAG CONDITION · REDUCE SPEED IMMEDIATELY & RETURN TO PIT LANE',
          driverCode: 'LEC',
        };
      }
      if (manualOverride === 'blue') {
        return {
          flag: 'blue',
          reason: 'FASTER LAPPING CAR APPROACHING RAPIDLY BEHIND',
          distanceMeters: 24,
          sector: currentSector,
          marshalPost: simulatedPost,
          subDirective: 'CHECK MIRRORS · HOLD PREDICTABLE RACING LINE & ALLOW CLEAN PASS',
          driverCode: 'NOR',
        };
      }
      return {
        flag: 'checkered',
        reason: `LAP ${lap}/${totalLaps} FINISH LINE — CHECKERED FLAG WAVING`,
        distanceMeters: 45,
        sector: 3,
        marshalPost: 18,
        subDirective: 'FINISH LINE MARSHAL POST · CLASSIFICATION LOCKED AT LINE',
      };
    }

    if (trackFlag.flag !== 'none') {
      return trackFlag;
    }

    if (greenClearActive) {
      return {
        flag: 'green',
        reason: `SECTOR ${greenClearSector} CLEAR — RESUME FULL RACING PACE`,
        distanceMeters: null,
        sector: greenClearSector,
        marshalPost: Math.max(1, Math.min(18, greenClearSector * 5 + 1)),
        subDirective: 'ALL MARSHAL POSTS GREEN · OVERTAKING & DRS RE-ENABLED',
      };
    }

    return { flag: 'none', reason: '', distanceMeters: null };
  })();

  const activeFlag = effectiveState.flag;
  const config = activeFlag !== 'none' ? FLAG_CONFIGS[activeFlag] : null;
  const sectorNum = effectiveState.sector ?? currentSector;
  const marshalPostNum = effectiveState.marshalPost ?? Math.max(1, Math.min(18, sectorNum * 5));
  const proximityPct =
    effectiveState.distanceMeters !== null
      ? Math.max(8, Math.min(100, Math.round((1 - Math.min(220, effectiveState.distanceMeters) / 220) * 100)))
      : 100;

  return (
    <div className="flex flex-col items-center gap-1.5 pointer-events-auto select-none">
      {/* Subtle Screen-Edge Emergency Strobe Vignette during Red Flag */}
      {activeFlag === 'red' && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-0 animate-pulse"
          style={{
            boxShadow: 'inset 0 0 90px rgba(239, 68, 68, 0.34)',
            animationDuration: '650ms',
          }}
        />
      )}

      {/* Main Prominent FIA Digital Marshaling Flag Banner */}
      {config && activeFlag !== 'none' && (
        <div
          role="status"
          aria-live="polite"
          className={`relative z-10 rounded-lg border-2 ${config.borderClass} px-3 py-2 min-w-[310px] sm:min-w-[410px] max-w-[520px] overflow-hidden animate-hud-banner-pop transition-all duration-200`}
          style={{
            background: config.bgGradient,
            boxShadow: config.glowShadow,
          }}
        >
          {/* Top Strobe Accent Strip */}
          <div
            className="absolute top-0 left-0 right-0 h-[3px] animate-pulse"
            style={{
              background:
                activeFlag === 'checkered'
                  ? 'repeating-linear-gradient(90deg, #FFFFFF 0px, #FFFFFF 12px, #090B0F 12px, #090B0F 24px)'
                  : `linear-gradient(90deg, transparent 0%, ${config.primaryHex} 30%, #FFFFFF 50%, ${config.primaryHex} 70%, transparent 100%)`,
              animationDuration: activeFlag === 'red' ? '450ms' : '900ms',
            }}
          />

          {/* Top Metadata Strip: FIA Race Control Code · Sector · Marshal Post · Distance */}
          <div
            className="flex items-center justify-between gap-2 px-2 py-0.5 rounded mb-1.5 border border-white/10 text-[9px] font-mono-telemetry font-bold tracking-wider uppercase"
            style={{ backgroundColor: config.headerBg }}
          >
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-white">
                <Radio className="w-2.5 h-2.5 animate-pulse" style={{ color: config.primaryHex }} />
                FIA RACE CONTROL
              </span>
              <span className="text-white/35">|</span>
              <span className={config.textAccentClass}>{config.code}</span>
              <span className="px-1.5 py-0.2 rounded bg-black/50 text-white border border-white/15">
                SECTOR {sectorNum}
              </span>
              <span className="hidden sm:inline px-1.5 py-0.2 rounded bg-black/40 text-slate-300 border border-white/10">
                POST MP-{String(marshalPostNum).padStart(2, '0')}
              </span>
            </div>

            <div className="flex items-center gap-1.5 tabular-nums">
              {effectiveState.driverCode && (
                <span className="px-1.5 py-0.2 rounded bg-white/15 text-white font-bold">
                  #{effectiveState.driverCode}
                </span>
              )}
              {effectiveState.distanceMeters !== null ? (
                <span className="px-1.5 py-0.2 rounded bg-black/65 text-white border border-white/20">
                  {effectiveState.distanceMeters}M {activeFlag === 'blue' ? 'BEHIND' : 'AHEAD'}
                </span>
              ) : (
                <span className={`px-1.5 py-0.2 rounded bg-black/60 ${config.textAccentClass}`}>
                  {config.badgeText}
                </span>
              )}
            </div>
          </div>

          {/* Center Row: Animated LED Flag Matrix + Flag Title & Incident Reason */}
          <div className="flex items-center gap-3">
            {renderAnimatedFlagMatrix(activeFlag)}

            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {activeFlag === 'red' ? (
                    <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 animate-bounce" />
                  ) : activeFlag === 'yellow' || activeFlag === 'surface' ? (
                    <AlertTriangle className="w-4 h-4 text-yellow-300 shrink-0 animate-pulse" />
                  ) : activeFlag === 'green' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  ) : (
                    <Flag className={`w-4 h-4 ${config.textAccentClass} fill-current shrink-0`} />
                  )}
                  <span className="font-display font-bold text-sm sm:text-base tracking-wider text-white uppercase">
                    {config.title}
                  </span>
                </div>

                <span
                  className={`text-[9px] font-mono-telemetry font-bold px-1.5 py-0.5 rounded border border-white/15 uppercase tracking-widest ${config.textAccentClass} bg-black/45`}
                >
                  {manualOverride !== 'auto' ? 'SIM OVERRIDE' : config.badgeText}
                </span>
              </div>

              <div className="text-[11px] sm:text-xs font-display font-semibold text-white tracking-wide truncate mt-0.5">
                {effectiveState.reason}
              </div>

              <div className="text-[9px] font-mono-telemetry text-slate-300 tracking-tight truncate mt-0.5">
                {effectiveState.subDirective ?? config.directiveFallback}
              </div>
            </div>
          </div>

          {/* Bottom Proximity / Marshal Telemetry Progress Bar */}
          <div className="mt-1.5 pt-1 border-t border-white/10 flex items-center gap-2">
            <span className="text-[8px] font-mono-telemetry font-bold uppercase tracking-wider text-slate-300 shrink-0">
              {activeFlag === 'blue'
                ? 'CLOSING PROXIMITY'
                : activeFlag === 'checkered'
                  ? 'RUN TO LINE'
                  : 'HAZARD PROXIMITY'}
            </span>
            <div className="flex-1 h-1.5 rounded-sm bg-black/60 overflow-hidden border border-white/10">
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${proximityPct}%`,
                  backgroundColor: config.primaryHex,
                  boxShadow: `0 0 8px ${config.primaryHex}`,
                }}
              />
            </div>
            <span className="text-[8px] font-mono-telemetry font-bold tabular-nums text-white shrink-0">
              {effectiveState.distanceMeters !== null ? `${effectiveState.distanceMeters}m` : 'ACTIVE'}
            </span>
          </div>
        </div>
      )}

      {/* Compact FIA Marshal Signal Control Strip (Allows instant testing of Yellow / Red / Blue / Checkered or Auto Live Incidents) */}
      <div className="flex items-center gap-1 bg-slate-950/88 border border-white/15 rounded px-1.5 py-0.5 shadow-lg">
        <button
          type="button"
          onClick={() => setShowControlStrip((prev) => !prev)}
          title="Toggle FIA Marshal Flag Test Controls"
          className="flex items-center gap-1 text-[8px] font-mono-telemetry font-bold uppercase tracking-wider text-slate-300 hover:text-white cursor-pointer px-1 py-0.5"
        >
          <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />
          <span>FIA FLAGS</span>
          <span
            className={`px-1 rounded text-[7px] ${
              manualOverride === 'auto'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                : 'bg-amber-500/25 text-amber-300 border border-amber-400/40'
            }`}
          >
            {manualOverride.toUpperCase()}
          </span>
        </button>

        {(showControlStrip || manualOverride !== 'auto') && (
          <div className="flex items-center gap-1 pl-1 border-l border-white/15">
            {(
              [
                { id: 'auto', label: 'AUTO', activeClass: 'bg-emerald-500 text-slate-950 border-emerald-300' },
                { id: 'yellow', label: 'YLW', activeClass: 'bg-yellow-400 text-slate-950 border-yellow-200' },
                { id: 'red', label: 'RED', activeClass: 'bg-red-500 text-white border-red-300' },
                { id: 'blue', label: 'BLU', activeClass: 'bg-sky-400 text-slate-950 border-sky-200' },
                { id: 'checkered', label: 'CHK', activeClass: 'bg-white text-slate-950 border-amber-300' },
              ] as const
            ).map((btn) => {
              const isSelected = manualOverride === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setManualOverride(btn.id)}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-mono-telemetry font-bold uppercase border transition-colors cursor-pointer ${
                    isSelected
                      ? btn.activeClass
                      : 'bg-black/50 text-slate-300 border-white/10 hover:text-white hover:border-white/30'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
