import React, { useState } from 'react';
import { Camera, Flag, ListOrdered, RotateCcw, Trophy, Wrench } from 'lucide-react';
import { CareerProgress, PodiumCameraShot, RacerStanding, WeatherMode } from '../types/racing';
import { formatLapTime } from './RacingHUD';
import { ResultsScoreboard } from './ResultsScoreboard';

interface PodiumOverlayProps {
  standings: RacerStanding[];
  trackName: string;
  weather?: WeatherMode;
  totalLaps?: number;
  career: CareerProgress;
  activeShot: PodiumCameraShot;
  onSelectShot: (shot: PodiumCameraShot) => void;
  onContinue: () => void;
  onGarage: () => void;
  onRestart: () => void;
}

const PODIUM_SHOTS: { id: PodiumCameraShot; label: string }[] = [
  { id: 'auto', label: 'Director' },
  { id: 'wide', label: 'Wide' },
  { id: 'winner', label: 'Winner' },
  { id: 'trophy', label: 'Trophy' },
  { id: 'full', label: 'Podium' },
  { id: 'victory', label: 'Orbit' },
];

export const PodiumOverlay: React.FC<PodiumOverlayProps> = ({
  standings,
  trackName,
  weather,
  totalLaps,
  career,
  activeShot,
  onSelectShot,
  onContinue,
  onGarage,
  onRestart,
}) => {
  const [showScoreboard, setShowScoreboard] = useState(false);
  const top3 = standings.slice(0, 3);
  const player = standings.find((s) => s.isPlayer);
  const pos = player?.position ?? 1;

  if (showScoreboard) {
    return (
      <ResultsScoreboard
        standings={standings}
        trackName={trackName}
        weather={weather}
        totalLaps={totalLaps}
        career={career}
        onShowPodium={() => setShowScoreboard(false)}
        onGarage={onGarage}
        onRestart={onRestart}
        onContinue={onContinue}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
      {/* Top Broadcast Banner & Podium Camera Director */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="pointer-events-auto rounded-2xl border border-amber-400/30 bg-[#090B0F]/88 px-4 py-3 flex items-center gap-3.5 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center">
            {pos <= 3 ? <Trophy className="w-5 h-5 text-amber-400" /> : <Flag className="w-5 h-5 text-slate-300" />}
          </div>
          <div>
            <div className="font-display font-bold text-lg sm:text-xl text-white leading-tight">
              {pos === 1 ? 'Grand Prix Victory!' : `P${pos} Finish · Podium Ceremony`}
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-2">
              <span>{trackName}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="tabular-nums">+{player?.pointsAwarded ?? 0} Championship Pts</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="tabular-nums">{career.totalVictories} Career Wins</span>
            </div>
          </div>
        </div>

        {/* Camera Cut Selector */}
        <div className="pointer-events-auto rounded-xl border border-white/15 bg-[#090B0F]/88 p-1.5 flex items-center gap-1 shadow-xl">
          <Camera className="w-3.5 h-3.5 text-amber-400 mx-1.5" />
          {PODIUM_SHOTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectShot(s.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                activeShot === s.id ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Top-3 Podium Strip + Scoreboard & Race Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div className="pointer-events-auto rounded-2xl border border-white/15 bg-[#090B0F]/90 p-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-3xl w-full shadow-2xl">
          {top3.map((r) => {
            const isRival = Boolean(r.isRival || (career.activeRivalId && r.driverId === career.activeRivalId && !r.isPlayer));
            return (
              <div
                key={r.id}
                className={`rounded-xl border p-2.5 flex flex-col gap-1 ${
                  r.isPlayer
                    ? 'border-amber-400/70 bg-amber-400/10'
                    : isRival
                      ? 'border-red-500/60 bg-red-600/10'
                      : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-display font-bold text-amber-400">
                    {r.position === 1 ? '1st · Gold Trophy' : r.position === 2 ? '2nd Place' : '3rd Place'}
                  </span>
                  <span className="font-mono-telemetry text-emerald-400 font-semibold tabular-nums">
                    +{r.pointsAwarded} PTS
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: r.color }} />
                    <span className="font-semibold text-sm text-white truncate">{r.name}</span>
                  </div>
                  {isRival && (
                    <span className="px-1.5 py-0.5 rounded bg-red-600 text-[9px] font-display font-bold text-white leading-none shrink-0">
                      RIVAL
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate">{r.teamName}</span>
                  <span className="font-mono-telemetry text-slate-200 tabular-nums">{formatLapTime(r.raceTimeMs)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons + Scoreboard Toggle */}
        <div className="pointer-events-auto rounded-2xl border border-white/15 bg-[#090B0F]/90 p-3 flex flex-wrap items-center gap-2 shadow-2xl">
          <button
            type="button"
            onClick={() => setShowScoreboard(true)}
            className="px-3.5 py-2.5 rounded-xl border border-amber-400/45 bg-amber-400/12 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Scoreboard</span>
          </button>
          <button
            type="button"
            onClick={onGarage}
            className="px-3.5 py-2.5 rounded-xl border border-white/15 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span>Garage</span>
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="px-3.5 py-2.5 rounded-xl border border-white/15 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Race Again</span>
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-bold text-xs sm:text-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
