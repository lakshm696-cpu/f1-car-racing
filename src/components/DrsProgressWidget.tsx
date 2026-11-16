import React from 'react';
import { Zap, CheckCircle2 } from 'lucide-react';
import { ActiveAeroMode, DrsStateTelemetry } from '../types/racing';

interface DrsProgressWidgetProps {
  drsState: DrsStateTelemetry;
  drsAvailable: boolean;
  drsActive: boolean;
  speedKmh: number;
  activeAeroMode?: ActiveAeroMode;
  manualOverrideAvailable?: boolean;
  manualOverrideActive?: boolean;
  mgukPowerKw?: number;
}

export const DrsProgressWidget: React.FC<DrsProgressWidgetProps> = ({
  drsState,
  drsAvailable,
  drsActive,
  speedKmh,
  activeAeroMode = 'z_mode',
  manualOverrideAvailable = false,
  manualOverrideActive = false,
  mgukPowerKw = 0,
}) => {
  const approaching = drsState.approachingMeters !== null && !drsState.inZone;
  const inZone = drsState.inZone || drsActive || activeAeroMode === 'x_mode';

  if (!approaching && !inZone) {
    return null;
  }

  const meters = approaching ? drsState.approachingMeters! : (drsState.remainingMeters ?? 0);
  const zoneName = approaching ? drsState.approachingZoneName : drsState.zoneName;
  const zoneNum = approaching ? drsState.approachingZoneNumber : drsState.zoneNumber;

  const maxApproachDist = 250;
  const progressRatio = approaching
    ? Math.min(1, Math.max(0, (maxApproachDist - meters) / maxApproachDist))
    : 1.0;
  const progressPct = Math.round(progressRatio * 100);
  const momReady = manualOverrideAvailable || drsState.gapQualified;

  return (
    <div
      className="rounded-xl border border-sky-400/40 p-3 flex flex-col gap-2 shadow-2xl backdrop-blur-xl animate-hud-banner-pop min-w-[280px] sm:min-w-[320px]"
      style={{
        backgroundColor: 'rgba(9, 11, 15, 0.94)',
        boxShadow: '0 8px 32px rgba(0, 200, 255, 0.2)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
              manualOverrideActive
                ? 'bg-fuchsia-500 text-slate-950 shadow-[0_0_12px_rgba(217,70,239,0.85)]'
                : drsActive || activeAeroMode === 'x_mode'
                  ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                  : drsAvailable
                    ? 'bg-sky-500 text-slate-950 shadow-[0_0_10px_rgba(56,189,248,0.6)]'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[11px] font-display font-black tracking-wider text-white uppercase flex items-center gap-1.5">
              <span>
                {manualOverrideActive
                  ? `X-MODE + MOM (${mgukPowerKw}KW)`
                  : drsActive || activeAeroMode === 'x_mode'
                    ? 'X-MODE ACTIVE AERO'
                    : approaching
                      ? `APPROACHING X-MODE ${zoneNum ?? 1}`
                      : `X-MODE ZONE ${zoneNum ?? 1}`}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-sky-300 font-mono-telemetry">
                Z{zoneNum ?? 1}
              </span>
            </div>
            <div className="text-[9px] text-slate-400 font-mono-telemetry truncate max-w-[180px]">
              {zoneName ?? '2026 Straight Aero Zone'}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-mono-telemetry font-black text-amber-300 tabular-nums">
            {meters}m
          </div>
          <div className="text-[8px] text-slate-400 uppercase font-mono-telemetry">
            {approaching ? 'TO ENTRY' : 'REMAINING'}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[8px] font-mono-telemetry text-slate-300">
          <span className="uppercase text-slate-400">
            {approaching ? 'ACTIVE AERO ZONE APPROACH' : 'X-MODE STRAIGHT DEPLOYMENT'}
          </span>
          <span className="font-bold text-cyan-300 tabular-nums">{progressPct}%</span>
        </div>
        <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/15">
          <div
            className={`h-full rounded-full transition-all duration-150 ${
              manualOverrideActive
                ? 'bg-gradient-to-r from-fuchsia-400 to-cyan-300 shadow-[0_0_8px_rgba(217,70,239,0.8)]'
                : drsActive || activeAeroMode === 'x_mode'
                  ? 'bg-gradient-to-r from-emerald-400 to-cyan-300 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                  : drsAvailable
                    ? 'bg-gradient-to-r from-sky-500 to-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                    : 'bg-gradient-to-r from-amber-500 to-amber-300'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* 2026 Eligibility Badges */}
      <div className="grid grid-cols-3 gap-1 pt-1 border-t border-white/10 text-[8px] font-mono-telemetry">
        <div
          className={`rounded p-1 text-center flex items-center justify-center gap-1 ${
            momReady
              ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/35'
              : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
          }`}
        >
          <Zap className="w-2.5 h-2.5" />
          <span>{momReady ? 'MOM 350KW' : 'X-MODE OPEN'}</span>
        </div>
        <div
          className={`rounded p-1 text-center flex items-center justify-center gap-1 ${
            !drsState.disabledByWeather
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}
        >
          <CheckCircle2 className="w-2.5 h-2.5" />
          <span>{!drsState.disabledByWeather ? 'DRY AIR' : 'WET WX'}</span>
        </div>
        <div
          className={`rounded p-1 text-center flex items-center justify-center gap-1 ${
            speedKmh > 120
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}
        >
          <Zap className="w-2.5 h-2.5" />
          <span>{speedKmh > 120 ? '> 120 KMH' : '< 120 KMH'}</span>
        </div>
      </div>
    </div>
  );
};
