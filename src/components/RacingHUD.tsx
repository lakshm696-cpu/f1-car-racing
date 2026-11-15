import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Camera,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Eye,
  Flag,
  Gamepad2,
  Moon,
  Pause,
  Sun,
  Sunset,
  Thermometer,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  CameraMode,
  GameScreen,
  HudTelemetry,
  SpeedUnitMode,
  TransmissionMode,
  TyreCompound,
  WeatherMode,
} from '../types/racing';
import { MiniMap } from './MiniMap';
import { PitBoard } from './PitBoard';
import { TrackLog } from './TrackLog';
import {
  TyreTemperatureOverlay,
  getTyreCompoundTempWindow,
  getTyreTempColorMeta,
} from './TyreTemperatureOverlay';
import { VehicleDamageVisualizer } from './VehicleDamageVisualizer';

interface RacingHUDProps {
  hud: HudTelemetry;
  trackName: string;
  transmission: TransmissionMode;
  touchControls: boolean;
  muted: boolean;
  active?: boolean;
  gameScreen?: GameScreen;
  virtualMirror?: boolean;
  haloCenterHud?: boolean;
  driverTags3d?: boolean;
  speedUnits?: SpeedUnitMode;
  raceObjectives?: boolean;
  launchClutchAssist?: boolean;
  onToggleTouchControls: () => void;
  onToggleMute: () => void;
  onCycleCamera: () => void;
  onPause: () => void;
  onTouchInput: (control: 'left' | 'right' | 'throttle' | 'brake' | 'drs', pressed: boolean) => void;
  onManualShift: (dir: 1 | -1) => void;
  onRequestTyreSwitch: (compound: TyreCompound) => void;
}

export function formatLapTime(ms: number | null): string {
  if (ms === null || ms < 0) return '--:--.---';
  const totalMs = Math.floor(ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

const CAMERA_LABELS: Record<CameraMode, string> = {
  chase: 'CHASE',
  tcam: 'T-CAM',
  cockpit: 'COCKPIT',
  low_track: 'LOW TRACK',
  wing_tyre: 'WING',
  tv_wide: 'BROADCAST',
  heli: 'HELI TV',
  trackside: 'TRACKSIDE',
  bumper: 'BUMPER',
  side: 'SIDE POD',
  rear: 'CHASE REAR',
};

const WEATHER_LABELS: Record<WeatherMode, string> = {
  day: 'CLEAR',
  partly_cloudy: 'PT CLOUDY',
  sunset: 'SUNSET',
  cloudy: 'OVERCAST',
  rain: 'RAIN',
  heavy_rain: 'STORM',
  fog: 'FOGGY',
  night: 'NIGHT',
};

const COMPOUND_OPTIONS: { id: TyreCompound; short: string; color: string }[] = [
  { id: 'soft', short: 'S', color: '#EF4444' },
  { id: 'medium', short: 'M', color: '#FACC15' },
  { id: 'hard', short: 'H', color: '#F8FAFC' },
  { id: 'wet', short: 'W', color: '#38BDF8' },
];

const WeatherIcon: React.FC<{ mode: WeatherMode; className?: string }> = ({ mode, className }) => {
  if (mode === 'heavy_rain') return <CloudLightning className={className} />;
  if (mode === 'rain') return <CloudRain className={className} />;
  if (mode === 'fog') return <CloudFog className={className} />;
  if (mode === 'partly_cloudy') return <CloudSun className={className} />;
  if (mode === 'cloudy') return <Cloud className={className} />;
  if (mode === 'sunset') return <Sunset className={className} />;
  if (mode === 'night') return <Moon className={className} />;
  return <Sun className={className} />;
};

const DEFAULT_LEADERBOARD_FALLBACK = [
  { position: 1, code: 'NOR', surname: 'NORRIS', name: 'Lando Norris', teamColor: '#FF8000', gapSeconds: 0, isPlayer: false },
  { position: 2, code: 'JAC', surname: 'JACKSON', name: 'Aiden Jackson', teamColor: '#FACC15', gapSeconds: 0.417, isPlayer: true },
  { position: 3, code: 'VER', surname: 'VERSTAPPEN', name: 'Max Verstappen', teamColor: '#1E41FF', gapSeconds: 1.952, isPlayer: false },
  { position: 4, code: 'RUS', surname: 'RUSSELL', name: 'George Russell', teamColor: '#00D2BE', gapSeconds: 4.371, isPlayer: false },
  { position: 5, code: 'LEC', surname: 'LECLERC', name: 'Charles Leclerc', teamColor: '#DC0000', gapSeconds: 6.306, isPlayer: false },
  { position: 6, code: 'PIA', surname: 'PIASTRI', name: 'Oscar Piastri', teamColor: '#FF8000', gapSeconds: 7.424, isPlayer: false },
  { position: 7, code: 'SAI', surname: 'SAINZ', name: 'Carlos Sainz', teamColor: '#005AFF', gapSeconds: 8.542, isPlayer: false },
  { position: 8, code: 'TSU', surname: 'TSUNODA', name: 'Yuki Tsunoda', teamColor: '#121F45', gapSeconds: 9.188, isPlayer: false },
];

function getDriverCode(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] || name;
  return last.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'DRV';
}

function getDriverSurname(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] || name;
  return last.toUpperCase();
}

export const RacingHUD: React.FC<RacingHUDProps> = ({
  hud,
  trackName,
  transmission,
  touchControls,
  muted,
  active = true,
  gameScreen = 'playing',
  virtualMirror = true,
  haloCenterHud = true,
  driverTags3d = true,
  speedUnits = 'kmh',
  raceObjectives = true,
  launchClutchAssist = true,
  onToggleTouchControls,
  onToggleMute,
  onCycleCamera,
  onPause,
  onTouchInput,
  onManualShift,
  onRequestTyreSwitch,
}) => {
  const [shouldRender, setShouldRender] = useState(active);
  const [isExiting, setIsExiting] = useState(false);
  const [animEpoch, setAnimEpoch] = useState(0);
  const [showMirrorLocal, setShowMirrorLocal] = useState(true);
  const [showTrackLog, setShowTrackLog] = useState(true);
  const [pitWindowTransition, setPitWindowTransition] = useState<'idle' | 'opening' | 'closing'>('idle');
  const prevScreenRef = useRef<GameScreen>(gameScreen);
  const pitWindowOpen = Boolean(hud.pitStrategy?.isWindowOpen);
  const prevPitWindowRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (prevPitWindowRef.current === null) {
      prevPitWindowRef.current = pitWindowOpen;
      return;
    }
    if (prevPitWindowRef.current !== pitWindowOpen) {
      prevPitWindowRef.current = pitWindowOpen;
      setPitWindowTransition(pitWindowOpen ? 'opening' : 'closing');
      const timer = window.setTimeout(() => setPitWindowTransition('idle'), 850);
      return () => window.clearTimeout(timer);
    }
  }, [pitWindowOpen]);

  useEffect(() => {
    if (active) {
      setShouldRender(true);
      setIsExiting(false);
    } else if (shouldRender) {
      setIsExiting(true);
      const timer = window.setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
      }, 380);
      return () => window.clearTimeout(timer);
    }
  }, [active, shouldRender]);

  useEffect(() => {
    const prev = prevScreenRef.current;
    if (prev !== gameScreen) {
      if ((prev === 'title' && gameScreen === 'playing') || (prev === 'playing' && gameScreen === 'title')) {
        setAnimEpoch((n) => n + 1);
      }
      prevScreenRef.current = gameScreen;
    }
  }, [gameScreen]);

  const [showTyreThermalOverlay, setShowTyreThermalOverlay] = useState(false);

  const rpmRatio = Math.min(1, Math.max(0, hud.rpm / hud.maxRpm));
  const gearLabel = hud.gear === -1 ? 'R' : hud.gear === 0 ? 'N' : String(hud.gear);
  const displayedSpeed =
    speedUnits === 'mph' ? Math.round(hud.speedKmh * 0.621371) : Math.round(hud.speedKmh);
  const speedUnitLabel = speedUnits === 'mph' ? 'MPH' : 'KPH';

  // SVG RPM & Battery arcs
  const arcRadius = 38;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const sweepLength = arcCircumference * (240 / 360);
  const filledRpmLength = sweepLength * rpmRatio;
  const filledBattLength = sweepLength * Math.min(1, Math.max(0, hud.ersCharge / 100));

  const activeLights =
    hud.countdownState === 'lights_1'
      ? 1
      : hud.countdownState === 'lights_2'
        ? 2
        : hud.countdownState === 'lights_3'
          ? 3
          : hud.countdownState === 'lights_4'
            ? 4
            : hud.countdownState === 'lights_5'
              ? 5
              : 0;

  // Build visible leaderboard rows (top 6 + player context, matching F1 25 tower)
  const leaderboardRows = React.useMemo(() => {
    if (!hud.standings || hud.standings.length === 0) {
      return DEFAULT_LEADERBOARD_FALLBACK.slice(0, 6);
    }
    const topRows = hud.standings.slice(0, 6).map((s) => ({
      position: s.position,
      code: getDriverCode(s.name),
      surname: getDriverSurname(s.name),
      name: s.name,
      teamColor: s.color,
      gapSeconds: s.gapSeconds,
      isPlayer: s.isPlayer,
    }));
    const hasPlayer = topRows.some((r) => r.isPlayer);
    if (!hasPlayer) {
      const playerEntry = hud.standings.find((s) => s.isPlayer);
      if (playerEntry && topRows.length >= 6) {
        topRows[5] = {
          position: playerEntry.position,
          code: getDriverCode(playerEntry.name),
          surname: getDriverSurname(playerEntry.name),
          name: playerEntry.name,
          teamColor: playerEntry.color,
          gapSeconds: playerEntry.gapSeconds,
          isPlayer: true,
        };
      }
    }
    return topRows;
  }, [hud.standings]);

  // Identify rival immediately ahead and cars behind for F1 25 Objective Card, 3D Driver Tag, and Virtual Rear Mirror
  const { carAhead, carsBehind } = React.useMemo(() => {
    if (!hud.standings || hud.standings.length === 0) {
      return {
        carAhead: { position: 1, surname: 'NORRIS', code: 'NOR', color: '#FF8000', gap: 0.417 },
        carsBehind: [
          { position: 3, code: 'VER', color: '#1E41FF', gap: 1.15 },
          { position: 4, code: 'RUS', color: '#00D2BE', gap: 2.45 },
        ],
      };
    }
    const playerIdx = hud.standings.findIndex((s) => s.isPlayer);
    const aheadEntry = playerIdx > 0 ? hud.standings[playerIdx - 1] : null;
    const behindEntries =
      playerIdx >= 0
        ? hud.standings.slice(playerIdx + 1, playerIdx + 3).map((b) => ({
            position: b.position,
            code: getDriverCode(b.name),
            color: b.color,
            gap: Math.max(0.18, Math.abs(b.gapSeconds - (hud.standings[playerIdx]?.gapSeconds ?? 0))),
          }))
        : [];

    return {
      carAhead: aheadEntry
        ? {
            position: aheadEntry.position,
            surname: getDriverSurname(aheadEntry.name),
            code: getDriverCode(aheadEntry.name),
            color: aheadEntry.color,
            gap: hud.gapAheadSeconds ?? Math.max(0.15, Math.abs((hud.standings[playerIdx]?.gapSeconds ?? 0) - aheadEntry.gapSeconds)),
          }
        : null,
      carsBehind: behindEntries,
    };
  }, [hud.standings, hud.gapAheadSeconds]);

  // 4-wheel tire status values (FL, FR, RL, RR)
  const baseWear = Math.max(0, Math.min(100, hud.tyreWearPct));
  const flWear = Math.max(0, Math.min(100, Math.round(baseWear - 1)));
  const frWear = Math.max(0, Math.min(100, Math.round(baseWear - 2)));
  const rlWear = Math.max(0, Math.min(100, Math.round(baseWear)));
  const rrWear = Math.max(0, Math.min(100, Math.round(baseWear - 1)));

  const baseTempC =
    hud.liveWeather === 'rain' || hud.liveWeather === 'heavy_rain'
      ? 68 + Math.round((hud.speedKmh / 330) * 18)
      : 92 + Math.round((hud.speedKmh / 330) * 22);

  const tyreColorForWear = (wear: number) => {
    if (wear > 65) return '#10B981';
    if (wear > 35) return '#F59E0B';
    return '#EF4444';
  };

  const activeCompoundMeta =
    COMPOUND_OPTIONS.find((c) => c.id === hud.tyreCompound) ?? COMPOUND_OPTIONS[1];

  const displayedLapMs = hud.currentLapMs > 0 ? hud.currentLapMs : 69442;
  const displayedBestMs = hud.bestLapMs !== null ? hud.bestLapMs : 68948;

  if (!shouldRender) return null;

  const isPausedState = gameScreen === 'paused';
  const isWet = hud.liveWeather === 'rain' || hud.liveWeather === 'heavy_rain';
  const lapsRemaining = Math.max(1, hud.totalLaps - hud.lap + 1);
  const targetLap = Math.min(hud.totalLaps, hud.lap + 2);

  const gLat = hud.gForceLat ?? 0;
  const gLong = hud.gForceLong ?? 0;
  const gTotal = hud.gForceTotal ?? 0;

  const gForceTilt = gLat * -0.65;
  const gForceTranslateX = gLat * 1.1;
  const gForceTranslateY = gLong * -1.4;
  const gForceScale = 1.0 + Math.min(0.018, Math.abs(gLong) * 0.0035 + (gTotal > 3.5 ? 0.005 : 0));

  return (
    <div
      key={animEpoch}
      className={`fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 transition-transform duration-75 ease-out ${
        isPausedState ? 'opacity-45 scale-[0.985] blur-[1.5px]' : 'opacity-100 blur-0'
      }`}
      style={{
        transform: `perspective(1200px) rotate(${gForceTilt}deg) translate(${gForceTranslateX}px, ${gForceTranslateY}px) scale(${gForceScale})`,
        boxShadow: gTotal > 3.2 ? 'inset 0 0 60px rgba(239, 68, 68, 0.22)' : 'none',
      }}
    >
      <PitBoard
        visible={hud.pitBoardActive}
        position={hud.position}
        totalRacers={hud.totalRacers}
        gapAheadSeconds={hud.gapAheadSeconds}
        lap={hud.lap}
        totalLaps={hud.totalLaps}
      />

      {/* Circuit DRS Zone Entry / Exit Notification & Live Activation Telemetry */}
      {hud.countdownState === 'racing' && (hud.drsState?.notification || hud.drsState?.inZone || hud.drsState?.approachingMeters !== null) && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1.5">
          {/* Entry / Exit Transition Notification Banner */}
          {hud.drsState?.notification && (
            <div
              key={`drs-notif-${hud.drsState.notificationSeq}`}
              role="status"
              aria-live="polite"
              className={`rounded-xl border px-3.5 py-1 flex items-center gap-2 shadow-xl ${
                hud.drsState.notification === 'entered'
                  ? 'drs-zone-enter-anim border-emerald-400/90 bg-emerald-950/95 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.55)]'
                  : 'drs-zone-exit-anim border-amber-400/75 bg-slate-950/92 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.35)]'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  hud.drsState.notification === 'entered'
                    ? 'bg-emerald-400 shadow-[0_0_10px_#34D399]'
                    : 'bg-amber-400 shadow-[0_0_8px_#FBBF24]'
                }`}
              />
              <span className="font-display font-black text-[11px] tracking-wider uppercase">
                {hud.drsState.notification === 'entered'
                  ? `DRS ZONE ${hud.drsState.notificationZoneNumber ?? ''} ENTERED`
                  : `DRS ZONE ${hud.drsState.notificationZoneNumber ?? ''} EXITED · FLAP CLOSED`}
              </span>
              {hud.drsState.notificationZoneName && (
                <span className="font-mono-telemetry text-[10px] text-white/80 uppercase hidden sm:inline">
                  · {hud.drsState.notificationZoneName}
                </span>
              )}
            </div>
          )}

          {/* Active DRS Zone Live Status & Real-World Distance Countdown */}
          {hud.drsState?.inZone ? (
            <div
              className={`rounded-xl border-2 px-4 py-1.5 flex flex-col items-center gap-1 min-w-[238px] transition-colors ${
                hud.drsState.disabledByWeather
                  ? 'border-sky-400/75 bg-slate-950/92 shadow-[0_0_18px_rgba(56,189,248,0.35)]'
                  : !hud.drsState.gapQualified
                    ? 'border-slate-500/70 bg-slate-950/90'
                    : hud.drsActive
                      ? 'border-emerald-400 bg-emerald-950/95 shadow-[0_0_26px_rgba(16,185,129,0.85)]'
                      : 'border-emerald-400/80 bg-emerald-950/90 shadow-[0_0_18px_rgba(16,185,129,0.45)]'
              }`}
            >
              <div className="flex items-center gap-2.5 w-full justify-center">
                <div
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    hud.drsState.disabledByWeather
                      ? 'bg-sky-400'
                      : !hud.drsState.gapQualified
                        ? 'bg-slate-400'
                        : hud.drsActive
                          ? 'bg-emerald-300 shadow-[0_0_12px_#34D399] animate-pulse'
                          : 'bg-emerald-400 animate-pulse'
                  }`}
                />
                <div className="flex flex-col items-center leading-tight">
                  <span
                    className={`font-display font-black text-xs tracking-wider ${
                      hud.drsState.disabledByWeather
                        ? 'text-sky-300'
                        : !hud.drsState.gapQualified
                          ? 'text-slate-300'
                          : 'text-emerald-300'
                    }`}
                  >
                    {hud.drsState.disabledByWeather
                      ? `DRS Z${hud.drsState.zoneNumber} DISABLED • WET TRACK`
                      : !hud.drsState.gapQualified
                        ? `DRS Z${hud.drsState.zoneNumber} LOCKED • GAP > 1.0s`
                        : hud.drsActive
                          ? `DRS ACTIVE • Z${hud.drsState.zoneNumber}/${hud.drsState.totalZones} FLAP OPEN`
                          : `DRS AVAILABLE • Z${hud.drsState.zoneNumber}/${hud.drsState.totalZones}`}
                  </span>
                  <span className="font-mono-telemetry text-[10px] text-emerald-100/90 tabular-nums">
                    {hud.drsState.zoneName} · {hud.drsState.remainingMeters ?? 0}m REMAINING
                  </span>
                </div>
              </div>
              {hud.drsState.zoneLengthMeters && hud.drsState.remainingMeters !== null && (
                <div className="w-full h-1 rounded-full bg-black/50 overflow-hidden border border-white/10">
                  <div
                    className={`h-full transition-all duration-100 ${
                      hud.drsState.disabledByWeather
                        ? 'bg-sky-400'
                        : hud.drsActive
                          ? 'bg-emerald-300'
                          : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, (hud.drsState.remainingMeters / hud.drsState.zoneLengthMeters) * 100)
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            hud.drsState?.approachingMeters !== null &&
            !hud.drsState.notification && (
              <div className="rounded-lg border border-emerald-400/50 bg-slate-950/90 px-3 py-1 flex items-center gap-2 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400/80" />
                <span className="font-mono-telemetry text-[10px] font-bold text-emerald-300 tabular-nums tracking-wide">
                  DRS Z{hud.drsState.approachingZoneNumber} ({hud.drsState.approachingZoneName}) IN{' '}
                  {hud.drsState.approachingMeters}m
                </span>
              </div>
            )
          )}
        </div>
      )}

      {/* Floating 3D-Style On-Track Driver Tag Ahead (F1 25 Broadcast Style) */}
      {driverTags3d && carAhead && carAhead.gap < 4.5 && hud.countdownState === 'racing' && (
        <div className="fixed left-1/2 top-[31%] -translate-x-1/2 z-10 pointer-events-none flex flex-col items-center animate-hud-enter-tc">
          {/* Purple Objective Diamond Icon */}
          <div className="w-5 h-5 rounded-full bg-purple-950/90 border border-fuchsia-400/80 flex items-center justify-center mb-1 shadow-lg">
            <div className="w-2 h-2 rotate-45 bg-fuchsia-400" />
          </div>
          {/* Driver Tag Pill */}
          <div
            className="rounded border border-white/25 px-2.5 py-0.5 flex items-center gap-1.5 shadow-xl"
            style={{ backgroundColor: 'rgba(11, 15, 25, 0.92)' }}
          >
            <span className="font-mono-telemetry text-[11px] font-bold text-white tabular-nums">
              {carAhead.position}
            </span>
            <span
              className="w-1 h-3 rounded-full"
              style={{ backgroundColor: carAhead.color }}
            />
            <span className="font-display font-bold text-[11px] tracking-wider text-white">
              {carAhead.surname}
            </span>
            <span className="font-mono-telemetry text-[10px] text-fuchsia-300 tabular-nums ml-0.5">
              -{carAhead.gap.toFixed(3)}s
            </span>
          </div>
        </div>
      )}

      {/* TOP BAR: Top-Left (F1 RACE Tower + Objective Callout) · Top-Center (Virtual Mirror + Lights + Flags) · Top-Right (S1/S2/S3 & Lap Timer Box) */}
      <div className="flex items-start justify-between gap-3">
        {/* TOP-LEFT: Authentic EA Sports F1 25 'F1 RACE' Broadcast Tower + Dynamic Race Objective Callout */}
        <div
          className={`flex flex-col gap-2 min-w-[232px] sm:min-w-[258px] ${
            isExiting ? 'animate-hud-exit-tl' : 'animate-hud-enter-tl'
          }`}
        >
          <div
            className="rounded-lg overflow-hidden border border-white/15 shadow-2xl"
            style={{ backgroundColor: 'rgba(11, 15, 23, 0.92)' }}
          >
            {/* F1 RACE Header */}
            <div
              className="px-3 py-2 flex items-center justify-between border-b border-white/10"
              style={{
                background: 'linear-gradient(180deg, rgba(22, 28, 40, 0.98) 0%, rgba(12, 16, 24, 0.98) 100%)',
              }}
            >
              <div className="flex items-center gap-2">
                <svg width="34" height="14" viewBox="0 0 44 18" fill="none" aria-hidden="true">
                  <path d="M2 15L12 3H38L33 8H16L9 15H2Z" fill="#FFFFFF" />
                  <path d="M12 16L19 9H36L32 14H18L15 16H12Z" fill="#EF4444" />
                </svg>
                <span className="font-display font-black text-sm sm:text-base tracking-widest text-white italic">
                  RACE
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <WeatherIcon
                  mode={hud.liveWeather}
                  className={`w-3.5 h-3.5 ${isWet ? 'text-cyan-400' : 'text-amber-400'}`}
                />
                <span className="text-[9px] font-mono-telemetry font-bold text-slate-300">
                  {WEATHER_LABELS[hud.liveWeather]}
                  {hud.liveTimeOfDay ? ` · ${hud.liveTimeOfDay.replace('_', ' ').toUpperCase()}` : ''}
                </span>
              </div>
            </div>

            {/* LAP X / Y Sub-Bar */}
            <div className="bg-black/45 px-3 py-1 flex items-center justify-between border-b border-white/10 text-[11px] font-mono-telemetry">
              <span className="text-slate-300 font-bold tracking-wider">
                LAP <span className="text-white text-xs">{hud.lap}</span> / {hud.totalLaps}
              </span>
              <span className="text-[10px] text-fuchsia-300 font-semibold">F1® 25 OSD</span>
            </div>

            {/* Standings Rows with Signature F1 25 Electric Magenta Player Highlight Bar */}
            <div className="flex flex-col divide-y divide-white/[0.06]">
              {leaderboardRows.map((row, idx) => {
                const gapLabel =
                  row.isPlayer
                    ? '---.---'
                    : idx === 0 || row.position === 1
                      ? `-${(carAhead?.gap ?? 0.417).toFixed(3)}`
                      : `+${Math.max(0.112, row.gapSeconds).toFixed(3)}`;

                const rowCompound = isWet
                  ? { short: 'W', color: '#38BDF8' }
                  : row.position === 5
                    ? { short: 'S', color: '#EF4444' }
                    : { short: 'M', color: '#FACC15' };

                return (
                  <div
                    key={`${row.code}-${row.position}`}
                    className={`flex items-center justify-between gap-2 px-2.5 py-1 text-[11px] transition-colors ${
                      row.isPlayer ? 'text-white font-bold shadow-md' : 'text-slate-200'
                    }`}
                    style={
                      row.isPlayer
                        ? {
                            background:
                              'linear-gradient(90deg, rgba(217, 70, 239, 0.96) 0%, rgba(168, 85, 247, 0.95) 85%, rgba(236, 72, 153, 0.95) 100%)',
                          }
                        : { backgroundColor: 'rgba(13, 18, 28, 0.86)' }
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-4 text-right font-mono-telemetry text-[11px] font-bold tabular-nums text-white">
                        {row.position}
                      </span>
                      <span
                        className="w-1 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: row.isPlayer ? '#FFFFFF' : row.teamColor }}
                      />
                      <span className="font-display font-bold tracking-wider text-[11px] text-white truncate">
                        {row.surname}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Tyre Compound Circle */}
                      <span
                        className="w-4 h-4 rounded-full border text-[9px] font-display font-bold flex items-center justify-center shrink-0"
                        style={{
                          borderColor: rowCompound.color,
                          color: rowCompound.color,
                          backgroundColor: 'rgba(8, 10, 15, 0.78)',
                        }}
                      >
                        {rowCompound.short}
                      </span>
                      <span className="font-mono-telemetry text-[11px] text-white tabular-nums w-14 text-right">
                        {gapLabel}
                      </span>
                      {/* Purple Objective / Fastest Lap Icon on Top 2 rows */}
                      {row.isPlayer ? (
                        <span className="w-4 h-4 rounded bg-fuchsia-700/80 border border-white/40 flex items-center justify-center text-[9px]">
                          ⏱
                        </span>
                      ) : idx === 0 && carAhead ? (
                        <span className="w-4 h-4 rounded bg-purple-900/90 border border-fuchsia-400/60 flex items-center justify-center">
                          <span className="w-1.5 h-1.5 rotate-45 bg-fuchsia-300" />
                        </span>
                      ) : (
                        <span className="w-4" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* F1 25 Dynamic Race Objective / Scenario Callout Card (from Screenshot 5) */}
          {raceObjectives && (
            <div className="rounded-lg overflow-hidden border border-fuchsia-500/45 shadow-xl max-w-[248px]">
              <div
                className="px-2.5 py-1.5 flex items-center gap-2 text-white text-[11px] font-display font-bold tracking-wide"
                style={{
                  background: 'linear-gradient(90deg, rgba(147, 51, 234, 0.95) 0%, rgba(88, 28, 135, 0.92) 100%)',
                }}
              >
                <span className="w-3.5 h-3.5 rounded-full border border-fuchsia-200 flex items-center justify-center shrink-0">
                  <span className="w-1.5 h-1.5 rotate-45 bg-white" />
                </span>
                <span className="truncate">
                  {carAhead
                    ? `Overtake ${carAhead.surname.charAt(0) + carAhead.surname.slice(1).toLowerCase()} before lap ${targetLap}`
                    : `Hold P1 Lead for ${lapsRemaining} Laps`}
                </span>
              </div>
              <div
                className="px-3 py-1.5 flex flex-col gap-0.5 text-[11px] font-mono-telemetry text-slate-200"
                style={{ backgroundColor: 'rgba(14, 18, 26, 0.86)' }}
              >
                <div>
                  <span className="font-bold text-white">
                    {carAhead ? `-${carAhead.gap.toFixed(3)}` : '+1.240'}
                  </span>{' '}
                  <span className="text-slate-300">
                    Gap to {carAhead ? carAhead.surname : 'PURSUER'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-white">{lapsRemaining}</span>{' '}
                  <span className="text-slate-300">
                    {lapsRemaining === 1 ? 'Lap remaining' : 'Laps remaining'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TOP-CENTER: F1 25 Virtual Rear-View Mirror + 5-Pod Start Gantry Lights + Flags */}
        <div
          className={`flex flex-col items-center gap-2 ${
            isExiting ? 'animate-hud-exit-tc' : 'animate-hud-enter-tc [animation-delay:45ms]'
          }`}
        >
          {/* F1 25 Top-Center Virtual Rear-View Mirror (from Screenshot 8) */}
          {virtualMirror && showMirrorLocal && (
            <div
              className="relative w-64 sm:w-80 h-14 sm:h-16 rounded-b-xl rounded-t-md border-2 border-slate-700/90 overflow-hidden shadow-2xl"
              style={{
                background: isWet
                  ? 'linear-gradient(180deg, #475569 0%, #64748B 44%, #1E293B 46%, #0F172A 100%)'
                  : hud.liveWeather === 'night'
                    ? 'linear-gradient(180deg, #090D16 0%, #111827 44%, #1E293B 46%, #0F172A 100%)'
                    : 'linear-gradient(180deg, #38BDF8 0%, #93C5FD 44%, #334155 46%, #1E293B 100%)',
              }}
            >
              {/* Rear Track Perspective Lines & Kerbs */}
              <svg viewBox="0 0 320 64" className="w-full h-full">
                {/* Distant Tree/Grandstand Treeline */}
                <path
                  d="M0 28 L45 20 L95 25 L160 22 L225 25 L275 19 L320 28 L320 30 L0 30 Z"
                  fill={hud.liveWeather === 'night' ? '#0F172A' : '#1E293B'}
                  opacity="0.85"
                />
                {/* Rear Asphalt Road Trapezoid */}
                <polygon points="110,29 210,29 310,64 10,64" fill="#1E2430" />
                {/* Left & Right Red/White Kerbs */}
                <polygon points="104,29 112,29 24,64 4,64" fill="#EF4444" />
                <polygon points="208,29 216,29 316,64 296,64" fill="#EF4444" />
                <line x1="160" y1="29" x2="160" y2="64" stroke="rgba(255,255,255,0.22)" strokeDasharray="4 4" />

                {/* Dynamic Rival Cars Pursuing Behind */}
                {carsBehind.map((car, idx) => {
                  const scale = Math.max(0.45, Math.min(1.15, 1.25 - car.gap * 0.25));
                  const cx = idx === 0 ? 142 + Math.sin(hud.currentLapMs * 0.002) * 14 : 186 - Math.cos(hud.currentLapMs * 0.002) * 12;
                  const cy = idx === 0 ? 47 : 41;
                  return (
                    <g key={car.code} transform={`translate(${cx}, ${cy}) scale(${scale})`}>
                      {/* Rear Wing & Tyres */}
                      <rect x="-14" y="-6" width="28" height="3" rx="1" fill="#090B0F" />
                      <rect x="-16" y="-2" width="6" height="8" rx="1.5" fill="#090B0F" />
                      <rect x="10" y="-2" width="6" height="8" rx="1.5" fill="#090B0F" />
                      {/* Car Nose & Halo */}
                      <polygon points="-9,5 9,5 5,-4 -5,-4" fill={car.color} />
                      {/* Glowing Red Rain / ERS Light */}
                      <circle cx="0" cy="2" r="2" fill="#EF4444" />
                    </g>
                  );
                })}
              </svg>

              {/* Carbon Mirror Bezel Label & Gap Behind */}
              <div className="absolute inset-x-0 top-0 px-2 py-0.5 flex items-center justify-between text-[8px] font-mono-telemetry text-white/80 bg-black/35">
                <span>REAR VIEW MIRROR</span>
                {carsBehind[0] && (
                  <span className="text-amber-300 font-bold">
                    {carsBehind[0].code} +{carsBehind[0].gap.toFixed(2)}s
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 5-Pod Red Start Lights Gantry (from Screenshot 8) */}
          {hud.countdownState !== 'racing' && hud.countdownState !== 'go' && (
            <div
              className="rounded-xl border border-white/20 px-4 py-2 flex items-center gap-3 shadow-2xl animate-hud-banner-pop"
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.95)' }}
            >
              {[1, 2, 3, 4, 5].map((idx) => {
                const lit = idx <= activeLights;
                return (
                  <div key={idx} className="flex flex-col items-center gap-1 bg-black/60 px-1.5 py-1 rounded border border-white/10">
                    <div className="w-3 h-3 rounded-full bg-neutral-900 border border-white/10" />
                    <div
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-white/15 transition-all"
                      style={{
                        backgroundColor: lit ? '#EF4444' : '#261214',
                        boxShadow: lit ? '0 0 18px rgba(239, 68, 68, 0.95)' : 'none',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* F1 25 Launch Clutch & Optimal RPM Prompt during Countdown (from Screenshot 8) */}
          {launchClutchAssist && hud.countdownState !== 'racing' && hud.countdownState !== 'go' && (
            <div
              className="rounded-lg border border-fuchsia-500/50 px-3.5 py-2 flex items-center gap-3 shadow-xl animate-hud-banner-pop"
              style={{ backgroundColor: 'rgba(13, 16, 24, 0.92)' }}
            >
              <span className="px-2 py-0.5 rounded bg-fuchsia-600 text-white font-display font-bold text-[10px]">
                SPACE / X
              </span>
              <div className="flex flex-col text-[10px]">
                <span className="font-display font-bold text-white tracking-wide uppercase">
                  Engage Clutch · Hold Optimal RPM
                </span>
                <span className="text-slate-300">
                  Release clutch when all 5 gantry lights go out for maximum traction
                </span>
              </div>
            </div>
          )}

          {hud.wrongWay && (
            <div
              className="rounded-lg border border-red-500/70 px-4 py-1.5 text-xs font-display font-bold tracking-widest text-red-400 animate-hud-banner-pop"
              style={{ backgroundColor: 'rgba(40, 10, 14, 0.9)' }}
            >
              WRONG WAY — TURN AROUND
            </div>
          )}

          {hud.trackFlag.flag !== 'none' && !hud.wrongWay && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl border px-3.5 py-1.5 flex items-center gap-2.5 shadow-lg animate-hud-banner-pop ${
                hud.trackFlag.flag === 'yellow'
                  ? 'border-yellow-400/80 text-yellow-300'
                  : hud.trackFlag.flag === 'surface'
                    ? 'border-orange-400/85 text-amber-200'
                    : 'border-sky-400/80 text-sky-300'
              }`}
              style={{
                backgroundColor:
                  hud.trackFlag.flag === 'yellow'
                    ? 'rgba(38, 28, 6, 0.92)'
                    : hud.trackFlag.flag === 'surface'
                      ? 'rgba(42, 18, 8, 0.94)'
                      : 'rgba(8, 24, 42, 0.92)',
              }}
            >
              <Flag className="w-4 h-4 fill-current shrink-0" />
              <div className="flex items-center gap-2 text-xs font-display font-bold uppercase">
                <span>
                  {hud.trackFlag.flag === 'yellow'
                    ? 'YELLOW FLAG'
                    : hud.trackFlag.flag === 'surface'
                      ? 'SURFACE HAZARD'
                      : 'BLUE FLAG'}
                </span>
                <span className="text-[10px] font-sans text-slate-200">{hud.trackFlag.reason}</span>
              </div>
            </div>
          )}

          {hud.bannerMessage && !hud.wrongWay && (
            <div
              key={hud.bannerMessage}
              className="rounded-lg border border-amber-400/40 px-4 py-1 text-xs font-display font-semibold tracking-wider text-amber-300 animate-hud-banner-pop"
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
            >
              {hud.bannerMessage}
            </div>
          )}
        </div>

        {/* TOP-RIGHT: Authentic F1 25 S1/S2/S3 Sector Bar + Position + Current/Best Lap Box + Track Log + Utility Buttons */}
        <div
          className={`flex items-start gap-2 ${
            isExiting ? 'animate-hud-exit-tr' : 'animate-hud-enter-tr [animation-delay:60ms]'
          }`}
        >
          <div className="flex flex-col items-end gap-2">
            {/* F1 25 Top-Right Timing & Sector Box (from Screenshots 5 & 6) */}
            <div
              className="rounded-lg overflow-hidden border border-white/15 min-w-[210px] sm:min-w-[234px] shadow-2xl"
              style={{ backgroundColor: 'rgba(11, 15, 23, 0.92)' }}
            >
              {/* Top S1 | S2 | S3 Bar */}
              <div className="grid grid-cols-3 border-b border-white/15 bg-black/50 text-[10px] font-mono-telemetry font-bold">
                {[1, 2, 3].map((secNum) => {
                  const sGrip = hud.sectorGripPct[secNum - 1] ?? 100;
                  const isCompleted = hud.currentSector > secNum;
                  const isActive = hud.currentSector === secNum;
                  return (
                    <div
                      key={secNum}
                      className={`px-2 py-0.5 flex items-center justify-between border-r last:border-r-0 border-white/10 ${
                        isCompleted
                          ? 'bg-emerald-500/85 text-slate-950'
                          : isActive
                            ? 'bg-emerald-500/30 text-emerald-300'
                            : 'text-slate-400'
                      }`}
                    >
                      <span>S{secNum}</span>
                      <span className="text-[9px]">{sGrip}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Middle Row: POS / TOTAL + Current Lap Time */}
              <div
                className="px-3 py-1.5 flex items-baseline justify-between gap-4 border-b border-blue-500/40"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(14, 22, 42, 0.95) 0%, rgba(20, 40, 92, 0.85) 100%)',
                }}
              >
                <div className="font-display font-bold text-sm sm:text-base text-white tabular-nums">
                  {hud.position}
                  <span className="text-xs text-slate-400 font-normal">/{hud.totalRacers}</span>
                </div>
                <div className="font-mono-telemetry font-bold text-base sm:text-lg text-white tabular-nums tracking-tight">
                  {formatLapTime(displayedLapMs)}
                </div>
              </div>

              {/* Bottom Row: BEST Lap + Delta */}
              <div className="px-3 py-1 flex items-center justify-between text-xs font-mono-telemetry bg-black/55 border-b border-white/10">
                <span className="font-display font-bold text-[11px] text-slate-300 tracking-wider">
                  BEST
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 text-[10px] font-bold tabular-nums">
                    {hud.deltaMs !== null
                      ? `${hud.deltaMs <= 0 ? '' : '+'}${(hud.deltaMs / 1000).toFixed(3)}s`
                      : '-0.214s'}
                  </span>
                  <span className="text-white font-bold tabular-nums">
                    {formatLapTime(displayedBestMs)}
                  </span>
                </div>
              </div>

              {/* Asphalt Track Temp & Active Sector Grip Telemetry Strip */}
              <div className="px-3 py-1 flex items-center justify-between text-[9px] font-mono-telemetry tabular-nums bg-black/75 text-slate-300">
                <span>
                  TRK TEMP:{' '}
                  <strong className="text-amber-300">{hud.trackTemperature ?? 34}°C</strong>
                </span>
                <span>
                  S{hud.currentSector} GRIP:{' '}
                  <strong className="text-emerald-300">
                    {hud.sectorGripPct[hud.currentSector - 1] ?? hud.surfaceGripPct}%
                  </strong>
                </span>
              </div>
            </div>

            {/* Real-Time Track Log: Dynamic Grip Fluctuations & Weather Changes Line Chart */}
            {showTrackLog && (
              <TrackLog
                surfaceGripPct={hud.surfaceGripPct}
                trackWetnessPct={hud.trackWetnessPct}
                sectorGripPct={hud.sectorGripPct}
                liveWeather={hud.liveWeather}
                nextWeather={hud.nextWeather}
                activeSurfaceHazard={hud.activeSurfaceHazard}
                lap={hud.lap}
                totalLaps={hud.totalLaps}
              />
            )}
          </div>

          {/* Interactive Utility Buttons */}
          <div className="pointer-events-auto flex flex-col gap-1">
            <button
              type="button"
              onClick={onPause}
              title="Pause / PS5 F1 25 Settings (Esc)"
              className="w-9 h-8 rounded-lg border border-white/15 flex items-center justify-center text-slate-200 hover:text-white hover:border-white/35 transition-colors cursor-pointer"
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onCycleCamera}
              title={`Cycle Camera (C) — ${CAMERA_LABELS[hud.cameraMode]}`}
              className="w-9 h-8 rounded-lg border border-white/15 flex flex-col items-center justify-center text-slate-200 hover:text-white hover:border-white/35 transition-colors cursor-pointer"
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
            >
              <Camera className="w-3 h-3" />
              <span className="text-[6px] font-bold tracking-tight">
                {CAMERA_LABELS[hud.cameraMode]}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowTrackLog((v) => !v)}
              title="Toggle Track Log Grip & Weather Chart"
              className={`w-9 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                showTrackLog
                  ? 'border-emerald-400/60 text-emerald-300'
                  : 'border-white/15 text-slate-400 hover:text-white'
              }`}
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowMirrorLocal((m) => !m)}
              title="Toggle Virtual Rear-View Mirror"
              className={`w-9 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                virtualMirror && showMirrorLocal
                  ? 'border-fuchsia-400/60 text-fuchsia-300'
                  : 'border-white/15 text-slate-400 hover:text-white'
              }`}
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              title={muted ? 'Unmute Audio' : 'Mute Audio'}
              className="w-9 h-8 rounded-lg border border-white/15 flex items-center justify-center text-slate-200 hover:text-white hover:border-white/35 transition-colors cursor-pointer"
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
            >
              {muted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={onToggleTouchControls}
              title="Toggle Touch Controls"
              className={`w-9 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                touchControls
                  ? 'border-amber-400/70 text-amber-300'
                  : 'border-white/15 text-slate-300 hover:text-white'
              }`}
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR: Left Mini-Map & Controls · Center F1 25 Halo Dual-Dial Telemetry Cluster · Right 4-Wheel Tire Status & Pit Controls */}
      <div className="flex items-end justify-between gap-3">
        {/* BOTTOM-LEFT: Mini-Track Map + Touch Steering */}
        <div
          className={`flex items-end gap-2.5 ${
            isExiting ? 'animate-hud-exit-bl' : 'animate-hud-enter-bl [animation-delay:90ms]'
          }`}
        >
          <div className="hidden sm:flex flex-col gap-2">
            {/* Hardcore Pro Race Strategy, Stint Plan & Fuel Calculus Card */}
            <div
              className={`pit-card-transition flex flex-col gap-1.5 p-2.5 rounded-xl border shadow-2xl min-w-[232px] max-w-[264px] text-white ${
                pitWindowOpen
                  ? 'border-emerald-400/60 bg-slate-950/94 shadow-[0_0_22px_rgba(16,185,129,0.22)]'
                  : pitWindowTransition === 'closing'
                    ? 'border-amber-400/50 bg-slate-950/92'
                    : 'border-white/15 bg-slate-950/92'
              } ${
                pitWindowTransition === 'opening'
                  ? 'pit-window-open-anim'
                  : pitWindowTransition === 'closing'
                    ? 'pit-window-close-anim'
                    : ''
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-1">
                <div className="flex items-center gap-1.5">
                  {/* Live Pit Strategy Glowing Status Beacon */}
                  <span className="relative flex h-2 w-2 items-center justify-center" aria-hidden="true">
                    {pitWindowOpen && (
                      <span className="pit-beacon-halo absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    )}
                    <span
                      className={`relative inline-flex h-2 w-2 rounded-full transition-colors duration-500 ${
                        pitWindowOpen
                          ? 'bg-emerald-400 shadow-[0_0_10px_#34D399]'
                          : pitWindowTransition === 'closing'
                            ? 'bg-amber-400 shadow-[0_0_8px_#FBBF24]'
                            : 'bg-slate-500'
                      }`}
                    />
                  </span>
                  <span
                    className={`text-[10px] font-display font-black tracking-wider transition-colors duration-300 ${
                      pitWindowOpen ? 'text-emerald-300' : 'text-amber-400'
                    }`}
                  >
                    PIT STRATEGY
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border font-display font-bold text-[8px] transition-all duration-400 ${
                      pitWindowOpen
                        ? 'pit-window-glow-pulse bg-emerald-500/20 border-emerald-400/60 text-emerald-200 opacity-100 scale-100'
                        : pitWindowTransition === 'closing'
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 opacity-100 scale-95'
                          : 'bg-white/5 border-white/10 text-slate-400 opacity-85 scale-95'
                    }`}
                  >
                    {pitWindowOpen
                      ? 'WINDOW OPEN'
                      : pitWindowTransition === 'closing'
                        ? 'WINDOW CLOSED'
                        : 'STANDBY'}
                  </span>
                </div>
                <span className="text-[9px] font-mono-telemetry text-slate-400 tabular-nums">
                  L{hud.lap}/{hud.totalLaps} · W:L{hud.pitStrategy?.pitWindowStartLap ?? 1}-L{hud.pitStrategy?.pitWindowEndLap ?? 2}
                </span>
              </div>

              {/* Live Stint & Pit Stop Plan Timeline */}
              {(() => {
                const totalL = Math.max(1, hud.totalLaps);
                const stops = [...(hud.pitStrategy?.plannedStops ?? [])].sort(
                  (a, b) => a.pitLap - b.pitLap
                );
                const startCmp = hud.pitStrategy?.startingCompound ?? hud.tyreCompound;
                const stints: Array<{
                  key: string;
                  startLap: number;
                  endLap: number;
                  compound: typeof hud.tyreCompound;
                  completed: boolean;
                }> = [];
                let curStart = 1;
                let curCmp = startCmp;
                for (const st of stops) {
                  stints.push({
                    key: `st_${st.id}`,
                    startLap: curStart,
                    endLap: st.pitLap,
                    compound: curCmp,
                    completed: st.completed,
                  });
                  curStart = st.pitLap + 1;
                  curCmp = st.compound;
                }
                if (curStart <= totalL) {
                  stints.push({
                    key: 'st_final',
                    startLap: curStart,
                    endLap: totalL,
                    compound: curCmp,
                    completed: false,
                  });
                }
                const cmpColor = (c: typeof hud.tyreCompound) =>
                  c === 'soft'
                    ? '#EF4444'
                    : c === 'medium'
                      ? '#FACC15'
                      : c === 'hard'
                        ? '#F8FAFC'
                        : '#38BDF8';
                const lapMarkerPct = Math.min(100, Math.max(2, ((hud.lap - 0.5) / totalL) * 100));

                return (
                  <div className="flex flex-col gap-1">
                    <div className="relative flex items-center gap-0.5 h-3.5 rounded bg-black/50 p-0.5 border border-white/10">
                      {stints.map((s) => {
                        const span = Math.max(1, s.endLap - s.startLap + 1);
                        const wPct = (span / totalL) * 100;
                        const darkText = s.compound === 'hard' || s.compound === 'medium';
                        return (
                          <div
                            key={s.key}
                            style={{
                              width: `${wPct}%`,
                              backgroundColor: cmpColor(s.compound),
                              color: darkText ? '#090B0F' : '#FFFFFF',
                              opacity: s.completed ? 0.5 : 0.92,
                            }}
                            className="h-full rounded-[2px] flex items-center justify-center text-[7px] font-display font-black leading-none overflow-hidden"
                          >
                            {s.compound.slice(0, 1).toUpperCase()}
                            {span > 1 ? ` L${s.startLap}-${s.endLap}` : ''}
                          </div>
                        );
                      })}
                      {/* Live Current Lap Progress Pin */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_#ffffff]"
                        style={{ left: `${lapMarkerPct}%` }}
                        title={`Current Lap ${hud.lap}`}
                      />
                    </div>

                    {/* Next Scheduled Stop Row */}
                    {hud.pitStrategy?.nextPlannedStop ? (
                      <div
                        className={`px-1.5 py-0.5 rounded border flex items-center justify-between text-[8px] font-mono-telemetry ${
                          hud.lap >= hud.pitStrategy.nextPlannedStop.pitLap
                            ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 font-bold'
                            : 'bg-white/[0.04] border-white/10 text-slate-200'
                        }`}
                      >
                        <span>
                          {hud.lap >= hud.pitStrategy.nextPlannedStop.pitLap
                            ? 'BOX NOW'
                            : `NEXT PIT: L${hud.pitStrategy.nextPlannedStop.pitLap}`}
                        </span>
                        <span>
                          {hud.pitStrategy.nextPlannedStop.compound.toUpperCase()} ·{' '}
                          {hud.pitStrategy.nextPlannedStop.fuelLoadPct}% FUEL
                        </span>
                      </div>
                    ) : stops.length > 0 ? (
                      <div className="flex items-center justify-between text-[8px] font-mono-telemetry text-emerald-300">
                        <span>ALL PLANNED STOPS DONE</span>
                        <span>TO FINISH</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[8px] font-mono-telemetry text-slate-300">
                        <span>PLAN: 0-STOP SPRINT</span>
                        <span>START {startCmp.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Live Fuel Load & Range Bar */}
              <div className="flex flex-col gap-0.5 pt-0.5">
                <div className="flex items-center justify-between text-[8px] font-mono-telemetry tabular-nums">
                  <span className="text-slate-400">FUEL LOAD</span>
                  <span
                    className={`font-bold ${
                      hud.fuelPct < 20
                        ? 'text-red-400'
                        : hud.fuelPct < 40
                          ? 'text-amber-300'
                          : 'text-cyan-300'
                    }`}
                  >
                    {hud.fuelPct}% · ~{hud.pitStrategy?.estimatedFuelLapsRemaining ?? Math.max(0.5, Number((hud.fuelPct / 16).toFixed(1)))} LAPS
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      hud.fuelPct < 20 ? 'bg-red-500' : hud.fuelPct < 40 ? 'bg-amber-400' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, hud.fuelPct))}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] pt-0.5">
                <span className="text-slate-400 font-sans">TARGET TYRE:</span>
                <span className="font-display font-bold text-white flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{
                      backgroundColor:
                        hud.pitStrategy?.recommendedCompound === 'soft'
                          ? '#EF4444'
                          : hud.pitStrategy?.recommendedCompound === 'medium'
                            ? '#FACC15'
                            : hud.pitStrategy?.recommendedCompound === 'hard'
                              ? '#FFFFFF'
                              : '#38BDF8',
                    }}
                  />
                  {hud.pitStrategy?.recommendedCompound?.toUpperCase() ?? 'MEDIUM'}
                </span>
              </div>

              {hud.pitStrategy?.undercutViable && (
                <div className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-between text-[8px] text-emerald-300 font-mono-telemetry font-bold">
                  <span>UNDERCUT VIABLE:</span>
                  <span>-{hud.pitStrategy.undercutDeltaSec}s GAIN</span>
                </div>
              )}

              <div className="flex items-center justify-between text-[8px] font-mono-telemetry text-slate-300 pt-0.5">
                <span>PIT LOSS: ~{hud.pitStrategy?.estimatedPitLossSec ?? 20.5}s</span>
                <span>EXIT: P{hud.pitStrategy?.predictedExitPosition ?? 4}</span>
              </div>

              <div className="flex items-center justify-between text-[8px] font-mono-telemetry border-t border-white/10 pt-1">
                <span className="text-slate-400">TYRE STAGE:</span>
                <span
                  className={`font-bold uppercase ${
                    hud.pitStrategy?.tyreDegradationStage === 'cliff'
                      ? 'text-red-400'
                      : hud.pitStrategy?.tyreDegradationStage === 'degrading'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                  }`}
                >
                  {hud.pitStrategy?.tyreDegradationStage ?? 'OPTIMAL'}
                </span>
              </div>
            </div>

            <MiniMap
              trackName={trackName}
              miniMapPath={hud.miniMapPath}
              miniMapStart={hud.miniMapStart}
              blips={hud.miniMapBlips}
              hazards={hud.miniMapHazards}
              drsZones={hud.miniMapDrsZones}
              trackFlag={hud.trackFlag}
              currentSector={hud.currentSector}
              sectorGripPct={hud.sectorGripPct}
              miniMapSectorPaths={hud.miniMapSectorPaths}
              miniMapRacingLinePaths={hud.miniMapRacingLinePaths}
            />
          </div>

          {touchControls && (
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onPointerDown={() => onTouchInput('left', true)}
                onPointerUp={() => onTouchInput('left', false)}
                onPointerLeave={() => onTouchInput('left', false)}
                onPointerCancel={() => onTouchInput('left', false)}
                className="w-14 h-14 rounded-xl border border-white/20 flex items-center justify-center font-display font-bold text-lg text-white active:bg-amber-500/30 cursor-pointer"
                style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
              >
                ◀
              </button>
              <button
                type="button"
                onPointerDown={() => onTouchInput('right', true)}
                onPointerUp={() => onTouchInput('right', false)}
                onPointerLeave={() => onTouchInput('right', false)}
                onPointerCancel={() => onTouchInput('right', false)}
                className="w-14 h-14 rounded-xl border border-white/20 flex items-center justify-center font-display font-bold text-lg text-white active:bg-amber-500/30 cursor-pointer"
                style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
              >
                ▶
              </button>
            </div>
          )}
        </div>

        {/* BOTTOM-CENTER: Authentic F1 25 Halo / Steering-Wheel Dual-Dial Telemetry Cluster (from Screenshots 5 & 6) */}
        {haloCenterHud && (
          <div
            className={`flex flex-col items-center ${
              isExiting ? 'animate-hud-exit-br' : 'animate-hud-enter-br [animation-delay:100ms]'
            }`}
          >
            <div
              className="rounded-3xl border border-white/20 px-3.5 py-2 flex items-center gap-3 shadow-2xl"
              style={{
                background:
                  'radial-gradient(circle at 50% 0%, rgba(28, 34, 48, 0.95) 0%, rgba(8, 10, 15, 0.96) 100%)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
              }}
            >
              {/* LEFT DIAL: BATT % with Glowing Yellow/Lime Ring */}
              <div className="relative w-20 h-20 sm:w-22 sm:h-22 flex items-center justify-center">
                <svg viewBox="0 0 96 96" className="w-full h-full">
                  <circle
                    cx="48"
                    cy="48"
                    r={arcRadius}
                    fill="rgba(10, 14, 20, 0.9)"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r={arcRadius}
                    fill="none"
                    stroke={hud.ersCharge < 20 ? '#FACC15' : '#84CC16'}
                    strokeWidth="6"
                    strokeDasharray={`${filledBattLength} ${arcCircumference}`}
                    strokeLinecap="round"
                    transform="rotate(150 48 48)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span className="text-[9px] font-mono-telemetry font-bold text-slate-300 tracking-wider">
                    BATT
                  </span>
                  <span className="font-display font-black text-lg sm:text-xl text-white tabular-nums mt-0.5">
                    {Math.round(hud.ersCharge)}%
                  </span>
                </div>
              </div>

              {/* CENTER MODULE: 15-LED RPM Array + Giant Gear Number + HARVESTING / OVERTAKE ERS MODE + [SPACE] OVERTAKE */}
              <div className="flex flex-col items-center justify-between min-w-[118px] sm:min-w-[136px]">
                {/* 15-LED F1 Shift Light Strip */}
                <div className="flex items-center gap-0.5 mb-1">
                  {Array.from({ length: 15 }).map((_, i) => {
                    const threshold = (i + 1) / 15;
                    const lit = rpmRatio >= threshold * 0.95;
                    const color = i < 5 ? '#22C55E' : i < 10 ? '#EF4444' : '#A855F7';
                    return (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: lit ? color : 'rgba(255,255,255,0.14)',
                          boxShadow: lit ? `0 0 6px ${color}` : 'none',
                        }}
                      />
                    );
                  })}
                </div>

                {/* Central Gear Readout */}
                <div className="font-display font-black text-4xl sm:text-5xl text-white leading-none tabular-nums tracking-tight">
                  {gearLabel}
                </div>

                {/* HARVESTING / OVERTAKE ERS MODE Status Text */}
                <div
                  className={`mt-1 text-[9px] font-mono-telemetry font-bold tracking-widest uppercase ${
                    hud.drsActive ? 'text-lime-400' : 'text-slate-300'
                  }`}
                >
                  {hud.drsActive ? 'OVERTAKE ERS MODE' : 'HARVESTING'}
                </div>

                {/* [L1 / SPACE] DRS / OVERTAKE Pill */}
                <div
                  className={`mt-1 px-2 py-0.5 rounded border flex items-center gap-1.5 transition-colors ${
                    hud.drsActive
                      ? 'bg-emerald-950/90 border-emerald-400/80'
                      : hud.drsAvailable
                        ? 'bg-emerald-950/60 border-emerald-400/50'
                        : 'bg-black/80 border-white/25'
                  }`}
                >
                  <span
                    className={`px-1 py-0.2 rounded font-display font-black text-[8px] ${
                      hud.drsActive ? 'bg-emerald-400 text-slate-950' : 'bg-white text-slate-950'
                    }`}
                  >
                    L1 / SPACE
                  </span>
                  <span
                    className={`font-display font-bold text-[9px] tracking-wider ${
                      hud.drsActive
                        ? 'text-emerald-300'
                        : hud.drsAvailable
                          ? 'text-emerald-200'
                          : 'text-white'
                    }`}
                  >
                    {hud.drsActive ? 'DRS + ERS ON' : hud.drsAvailable ? 'DRS READY' : 'OVERTAKE'}
                  </span>
                </div>
              </div>

              {/* RIGHT DIAL: Speed (KPH/MPH) + RPM Readout */}
              <div className="relative w-20 h-20 sm:w-22 sm:h-22 flex items-center justify-center">
                <svg viewBox="0 0 96 96" className="w-full h-full">
                  <circle
                    cx="48"
                    cy="48"
                    r={arcRadius}
                    fill="rgba(10, 14, 20, 0.9)"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r={arcRadius}
                    fill="none"
                    stroke={rpmRatio > 0.88 ? '#EF4444' : '#22C55E'}
                    strokeWidth="6"
                    strokeDasharray={`${filledRpmLength} ${arcCircumference}`}
                    strokeLinecap="round"
                    transform="rotate(150 48 48)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span className="text-[8px] font-mono-telemetry font-bold text-slate-400">
                    {speedUnitLabel}
                  </span>
                  <span className="font-display font-black text-xl sm:text-2xl text-white tabular-nums">
                    {displayedSpeed}
                  </span>
                  <span className="text-[7px] font-mono-telemetry text-slate-400 mt-0.5">RPM</span>
                  <span className="text-[9px] font-mono-telemetry font-bold text-slate-200 tabular-nums">
                    {hud.rpm}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM-RIGHT: 4-Wheel Tire Status, Pit Compound Selector, Damage & Touch Pedals */}
        <div
          className={`flex items-end gap-2.5 ${
            isExiting ? 'animate-hud-exit-br' : 'animate-hud-enter-br [animation-delay:110ms]'
          }`}
        >
          {touchControls && (
            <div className="pointer-events-auto flex items-end gap-1.5">
              {transmission === 'manual' && (
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => onManualShift(1)}
                    className="w-10 h-8 rounded-lg border border-white/20 text-xs font-display font-bold text-white cursor-pointer"
                    style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
                  >
                    +G
                  </button>
                  <button
                    type="button"
                    onClick={() => onManualShift(-1)}
                    className="w-10 h-8 rounded-lg border border-white/20 text-xs font-display font-bold text-white cursor-pointer"
                    style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
                  >
                    -G
                  </button>
                </div>
              )}
              <button
                type="button"
                onPointerDown={() => onTouchInput('drs', true)}
                onPointerUp={() => onTouchInput('drs', false)}
                onPointerLeave={() => onTouchInput('drs', false)}
                onPointerCancel={() => onTouchInput('drs', false)}
                className={`w-12 h-12 rounded-xl border text-[10px] font-display font-bold cursor-pointer ${
                  hud.drsActive ? 'border-cyan-400 text-cyan-300' : 'border-white/20 text-slate-300'
                }`}
                style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
              >
                ERS/DRS
              </button>
              <button
                type="button"
                onPointerDown={() => onTouchInput('brake', true)}
                onPointerUp={() => onTouchInput('brake', false)}
                onPointerLeave={() => onTouchInput('brake', false)}
                onPointerCancel={() => onTouchInput('brake', false)}
                className="w-14 h-14 rounded-xl border border-red-500/45 text-[10px] font-display font-bold text-red-300 cursor-pointer"
                style={{ backgroundColor: 'rgba(28, 12, 16, 0.88)' }}
              >
                BRAKE
              </button>
              <button
                type="button"
                onPointerDown={() => onTouchInput('throttle', true)}
                onPointerUp={() => onTouchInput('throttle', false)}
                onPointerLeave={() => onTouchInput('throttle', false)}
                onPointerCancel={() => onTouchInput('throttle', false)}
                className="w-14 h-16 rounded-xl border border-emerald-500/45 text-[10px] font-display font-bold text-emerald-300 cursor-pointer"
                style={{ backgroundColor: 'rgba(10, 26, 20, 0.88)' }}
              >
                GAS
              </button>
            </div>
          )}

          {/* Compact Tire Status + Pit Compound + MFD Panel */}
          <div
            className={`pit-card-transition rounded-2xl border px-3 py-2.5 flex items-center gap-3 shadow-2xl ${
              pitWindowOpen
                ? 'border-emerald-400/55 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : hud.queuedCompound
                  ? 'border-amber-400/55 shadow-[0_0_16px_rgba(245,158,11,0.18)]'
                  : 'border-white/15'
            } ${
              pitWindowTransition === 'opening'
                ? 'pit-window-open-anim'
                : pitWindowTransition === 'closing'
                  ? 'pit-window-close-anim'
                  : ''
            }`}
            style={{
              background:
                'linear-gradient(180deg, rgba(14, 18, 25, 0.92) 0%, rgba(8, 10, 14, 0.95) 100%)',
            }}
          >
            {/* 4-Wheel Tire Core & Surface Temperature + Wear Visualization (FL / FR / RL / RR) */}
            <div className="flex flex-col gap-1.5 relative">
            {(() => {
              const compoundWin = getTyreCompoundTempWindow(hud.tyreCompound);
              const cpSurf = hud.tyreContactPatch?.wheelSurfaceTempC;
              const cpCore = hud.tyreContactPatch?.wheelCoreTempC;
              const wheels = [
                {
                  label: 'FL',
                  wear: flWear,
                  surfTemp: cpSurf?.[0] ?? baseTempC + 1,
                  coreTemp: cpCore?.[0] ?? baseTempC + 4,
                  slip: hud.tyreContactPatch?.wheelMicroSlipPct?.[0] ?? 6,
                },
                {
                  label: 'FR',
                  wear: frWear,
                  surfTemp: cpSurf?.[1] ?? baseTempC + 2,
                  coreTemp: cpCore?.[1] ?? baseTempC + 5,
                  slip: hud.tyreContactPatch?.wheelMicroSlipPct?.[1] ?? 6,
                },
                {
                  label: 'RL',
                  wear: rlWear,
                  surfTemp: cpSurf?.[2] ?? baseTempC + 4,
                  coreTemp: cpCore?.[2] ?? baseTempC + 7,
                  slip: hud.tyreContactPatch?.wheelMicroSlipPct?.[2] ?? 7,
                },
                {
                  label: 'RR',
                  wear: rrWear,
                  surfTemp: cpSurf?.[3] ?? baseTempC + 3,
                  coreTemp: cpCore?.[3] ?? baseTempC + 6,
                  slip: hud.tyreContactPatch?.wheelMicroSlipPct?.[3] ?? 7,
                },
              ];

              return (
                <>
                  {showTyreThermalOverlay && (
                    <div
                      className="pointer-events-auto absolute bottom-full right-0 mb-2.5 w-[380px] sm:w-[430px] rounded-2xl border border-sky-400/45 p-3 shadow-2xl z-30"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(10, 14, 22, 0.97) 0%, rgba(6, 9, 15, 0.98) 100%)',
                      }}
                    >
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                        <div className="flex items-center gap-1.5">
                          <Thermometer className="w-3.5 h-3.5 text-sky-400" />
                          <span className="font-display font-black text-[10px] tracking-wider uppercase text-white">
                            4-Corner Tyre Core & Surface Thermal Telemetry
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowTyreThermalOverlay(false)}
                          className="w-5 h-5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                          title="Close Thermal Telemetry"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <TyreTemperatureOverlay hud={hud} compound={hud.tyreCompound} />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-semibold tracking-wider text-slate-300">
                        TYRES ({activeCompoundMeta.short})
                      </span>
                      <span
                        className="text-[7px] font-mono-telemetry px-1 py-0.2 rounded border border-emerald-400/35 bg-emerald-500/12 text-emerald-300 tabular-nums"
                        title={`Optimal surface operating window: ${compoundWin.surfMin}–${compoundWin.surfMax}°C | Core: ${compoundWin.coreMin}–${compoundWin.coreMax}°C`}
                      >
                        OPT {compoundWin.surfMin}–{compoundWin.surfMax}°C
                      </span>
                    </div>
                    <div className="pointer-events-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowTyreThermalOverlay((v) => !v)}
                        title="Toggle 4-Corner Tyre Core & Surface Thermal Telemetry"
                        className={`h-4 px-1 rounded text-[7px] font-mono-telemetry font-bold border transition-colors cursor-pointer flex items-center gap-0.5 ${
                          showTyreThermalOverlay
                            ? 'border-sky-400 bg-sky-500/25 text-sky-200'
                            : 'border-white/20 bg-black/50 text-slate-300 hover:text-white hover:border-white/40'
                        }`}
                      >
                        <Thermometer className="w-2.5 h-2.5 text-sky-400" />
                        <span>TEMP</span>
                      </button>
                      {COMPOUND_OPTIONS.map((c) => {
                        const isActive = hud.tyreCompound === c.id;
                        const isQueued = hud.queuedCompound === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onRequestTyreSwitch(c.id)}
                            title={`Pit for ${c.id.toUpperCase()} tyres`}
                            className={`w-4 h-4 rounded-full text-[8px] font-display font-bold border transition-colors cursor-pointer flex items-center justify-center ${
                              isQueued
                                ? 'border-amber-400 bg-amber-500/30 text-amber-200'
                                : isActive
                                  ? 'border-white bg-white/20 text-white'
                                  : 'border-white/20 bg-black/40 text-slate-400 hover:text-white'
                            }`}
                            style={{ borderColor: isActive ? c.color : undefined }}
                          >
                            {c.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4-Wheel Dual-Layer Core + Surface Thermal Grid */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                    {wheels.map((t) => {
                      const wearCol = tyreColorForWear(t.wear);
                      const surfMeta = getTyreTempColorMeta(t.surfTemp, hud.tyreCompound, 'surface');
                      const coreMeta = getTyreTempColorMeta(t.coreTemp, hud.tyreCompound, 'core');
                      return (
                        <div
                          key={t.label}
                          className="flex items-center gap-1.5 rounded-lg border px-1.5 py-1 transition-colors"
                          style={{
                            borderColor: surfMeta.borderHex,
                            backgroundColor: 'rgba(9, 13, 20, 0.86)',
                          }}
                          title={`${t.label} Tyre — Surface: ${t.surfTemp}°C (${surfMeta.label}) | Core: ${t.coreTemp}°C (${coreMeta.label}) | Wear: ${t.wear}%`}
                        >
                          {/* Vertical Tread Wear Bar */}
                          <div className="w-1.5 h-7 rounded-xs border border-white/25 flex flex-col justify-end overflow-hidden bg-slate-950 shrink-0">
                            <div
                              className="w-full transition-all"
                              style={{ height: `${t.wear}%`, backgroundColor: wearCol }}
                            />
                          </div>

                          {/* Dual-Zone Tire Thermal Graphic: Outer Surface Shell + Inner Carcass Core */}
                          <div
                            className="w-4 h-7 rounded-[3px] p-[2px] flex items-center justify-center shrink-0 transition-colors"
                            style={{
                              backgroundColor: surfMeta.bgTint,
                              border: `1.5px solid ${surfMeta.hex}`,
                              boxShadow:
                                surfMeta.state === 'overheating'
                                  ? '0 0 8px rgba(239, 68, 68, 0.55)'
                                  : surfMeta.state === 'optimal'
                                    ? '0 0 6px rgba(16, 185, 129, 0.35)'
                                    : 'none',
                            }}
                          >
                            <div
                              className="w-full h-full rounded-[1.5px] flex items-center justify-center transition-colors"
                              style={{
                                backgroundColor: coreMeta.hex,
                                opacity: 0.9,
                              }}
                            >
                              <span className="text-[6px] font-display font-black text-slate-950 leading-none select-none">
                                {t.label}
                              </span>
                            </div>
                          </div>

                          {/* Real-Time Surface (S) & Core (C) Temperature + Wear Readout */}
                          <div className="flex flex-col leading-tight min-w-[54px]">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[8px] font-mono-telemetry font-bold text-white tabular-nums">
                                {t.wear}%
                              </span>
                              <span
                                className="text-[6.5px] font-mono-telemetry font-bold uppercase px-0.5 rounded"
                                style={{
                                  color: surfMeta.hex,
                                  backgroundColor: surfMeta.bgTint,
                                }}
                              >
                                {surfMeta.shortLabel}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[7.5px] font-mono-telemetry tabular-nums">
                              <span className="text-slate-400">S</span>
                              <span className={`font-bold ${surfMeta.textClass}`}>{t.surfTemp}°C</span>
                            </div>
                            <div className="flex items-center justify-between text-[7.5px] font-mono-telemetry tabular-nums">
                              <span className="text-slate-400">C</span>
                              <span className={`font-bold ${coreMeta.textClass}`}>{t.coreTemp}°C</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Operating Window Color Legend Bar */}
                  <div className="flex items-center justify-between px-1 pt-0.5 text-[6.5px] font-mono-telemetry uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                      Cold
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      Opt
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                      Warm
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                      Hot
                    </span>
                  </div>
                </>
              );
            })()}

              {/* Microscopic Contact Patch: Real-Time Micro-Slip & Graining Probability */}
              {(() => {
                const cp = hud.tyreContactPatch;
                const microSlipPct = cp?.microSlipPct ?? 6;
                const grainProbPct = cp?.grainingProbabilityPct ?? 8;
                const patchState = cp?.patchState ?? 'stick';
                const stateBadge =
                  patchState === 'graining_risk'
                    ? { label: 'GRAINING', cls: 'text-amber-300 border-amber-400/50 bg-amber-500/15' }
                    : patchState === 'thermal_blister'
                      ? { label: 'BLISTER', cls: 'text-red-300 border-red-400/50 bg-red-500/15' }
                      : patchState === 'macro_slide'
                        ? { label: 'SLIDING', cls: 'text-red-300 border-red-400/60 bg-red-500/20' }
                        : patchState === 'micro_slip'
                          ? { label: 'MICRO-SLIP', cls: 'text-cyan-300 border-cyan-400/45 bg-cyan-500/15' }
                          : { label: 'ADHESION', cls: 'text-emerald-300 border-emerald-400/45 bg-emerald-500/15' };

                return (
                  <div className="flex flex-col gap-1 pt-1 border-t border-white/10 text-[8px] font-mono-telemetry tabular-nums">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-slate-400 font-bold">CONTACT PATCH</span>
                      <span className={`px-1 py-0.2 rounded border text-[7px] font-display font-bold ${stateBadge.cls}`}>
                        {stateBadge.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-slate-400">MICRO-SLIP</span>
                      <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full ${
                            microSlipPct > 55
                              ? 'bg-red-500'
                              : microSlipPct > 25
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, microSlipPct))}%` }}
                        />
                      </div>
                      <span className="text-white font-bold w-6 text-right">{microSlipPct}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-slate-400">GRAIN PROB</span>
                      <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full ${
                            grainProbPct > 55
                              ? 'bg-red-500'
                              : grainProbPct > 32
                                ? 'bg-amber-400'
                                : 'bg-sky-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, grainProbPct))}%` }}
                        />
                      </div>
                      <span
                        className={`font-bold w-6 text-right ${
                          grainProbPct > 50 ? 'text-amber-300' : 'text-sky-300'
                        }`}
                      >
                        {grainProbPct}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-slate-400">GRAIN SEV</span>
                      <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full ${
                            (cp?.grainingSeverityPct ?? 0) > 45
                              ? 'bg-red-500'
                              : (cp?.grainingSeverityPct ?? 0) > 20
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, cp?.grainingSeverityPct ?? 0))}%` }}
                        />
                      </div>
                      <span
                        className={`font-bold w-6 text-right ${
                          (cp?.grainingSeverityPct ?? 0) > 35 ? 'text-red-400' : 'text-emerald-300'
                        }`}
                      >
                        {cp?.grainingSeverityPct ?? 0}%
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-[8px] font-mono-telemetry tabular-nums">
                <span className="text-slate-400">FUEL</span>
                <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full ${hud.fuelPct < 20 ? 'bg-red-500' : 'bg-cyan-400'}`}
                    style={{ width: `${Math.min(100, Math.max(0, hud.fuelPct))}%` }}
                  />
                </div>
                <span className={hud.fuelPct < 20 ? 'text-red-400 font-bold' : 'text-cyan-300 font-bold'}>
                  {hud.fuelPct}%
                </span>
              </div>
            </div>

            {/* Authentic FIA F1 Live Circular G-Force Telemetry Meter */}
            <div className="hidden md:flex flex-col items-center justify-center p-2 rounded-xl border border-white/15 bg-black/85 shadow-lg min-w-[76px]">
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[8px] font-display font-bold text-slate-300 uppercase tracking-wider">
                  G-FORCE
                </span>
                <span className="text-[9px] font-mono-telemetry font-bold text-amber-400 tabular-nums">
                  {hud.gForceTotal.toFixed(1)}G
                </span>
              </div>
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg viewBox="-30 -30 60 60" className="w-full h-full">
                  <circle cx="0" cy="0" r="6" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="12" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="18" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="24" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="0.9" />
                  <line x1="-24" y1="0" x2="24" y2="0" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
                  <line x1="0" y1="-24" x2="0" y2="24" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
                  <line
                    x1="0"
                    y1="0"
                    x2={Math.max(-23, Math.min(23, hud.gForceLat * 4.8))}
                    y2={Math.max(-23, Math.min(23, -hud.gForceLong * 4.8))}
                    stroke={hud.gForceTotal > 3.5 ? '#EF4444' : '#F59E0B'}
                    strokeWidth="1.5"
                    strokeOpacity="0.75"
                  />
                  <circle
                    cx={Math.max(-23, Math.min(23, hud.gForceLat * 4.8))}
                    cy={Math.max(-23, Math.min(23, -hud.gForceLong * 4.8))}
                    r="2.8"
                    fill={hud.gForceTotal > 3.5 ? '#EF4444' : '#F59E0B'}
                  />
                </svg>
              </div>
              <div className="flex items-center justify-between w-full mt-1 text-[7px] font-mono-telemetry tabular-nums text-slate-400">
                <span>{(hud.gForceLat > 0 ? '+' : '') + hud.gForceLat.toFixed(1)}</span>
                <span>{hud.gForceLong < 0 ? 'B' : 'A'}:{Math.abs(hud.gForceLong).toFixed(1)}</span>
              </div>
            </div>

            {/* Vehicle Damage Mini-Diagram */}
            <div className="hidden lg:block">
              <VehicleDamageVisualizer damagePct={hud.damagePct} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
