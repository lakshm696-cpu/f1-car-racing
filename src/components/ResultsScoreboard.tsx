import React from 'react';
import { Award, Flag, RotateCcw, Trophy, Wrench } from 'lucide-react';
import { CareerProgress, RacerStanding, WeatherMode } from '../types/racing';
import { formatLapTime } from './RacingHUD';

interface ResultsScoreboardProps {
  standings: RacerStanding[];
  trackName: string;
  weather?: WeatherMode;
  totalLaps?: number;
  career: CareerProgress;
  onShowPodium: () => void;
  onGarage: () => void;
  onRestart: () => void;
  onContinue: () => void;
}

const WEATHER_LABELS: Record<WeatherMode, string> = {
  day: 'Dry Sunlight',
  partly_cloudy: 'Partly Cloudy',
  sunset: 'Golden Sunset',
  cloudy: 'Overcast',
  rain: 'Wet Track',
  heavy_rain: 'Heavy Storm',
  fog: 'Misty Fog',
  snow: 'Snow Flurries',
  blizzard: 'Whiteout Blizzard',
  night: 'Night Grand Prix',
};

export const ResultsScoreboard: React.FC<ResultsScoreboardProps> = ({
  standings,
  trackName,
  weather = 'day',
  totalLaps = 3,
  career,
  onShowPodium,
  onGarage,
  onRestart,
  onContinue,
}) => {
  const player = standings.find((s) => s.isPlayer);
  const pos = player?.position ?? 1;
  const prizeCredits = Math.max(500, (7 - pos) * 750);
  const activeRival = career.activeRivalId ? career.rivalryScores[career.activeRivalId] : null;

  let fastestLapMs: number | null = null;
  for (const r of standings) {
    if (r.bestLapMs !== null && (fastestLapMs === null || r.bestLapMs < fastestLapMs)) {
      fastestLapMs = r.bestLapMs;
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6 bg-[#07090E]/82 backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#0C1018] shadow-2xl flex flex-col">
        {/* Top Motorsport Classification Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-[#111622] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-red-600/15 border border-red-500/40 flex items-center justify-center shrink-0">
              {pos <= 3 ? <Trophy className="w-5 h-5 text-amber-400" /> : <Flag className="w-5 h-5 text-red-400" />}
            </div>
            <div>
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white leading-tight">
                {pos === 1 ? 'Grand Prix Victory — Official Classification' : `P${pos} Finish — Official Classification`}
              </h2>
              <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                <span>{trackName}</span>
                <span aria-hidden="true">·</span>
                <span>{totalLaps} Laps</span>
                <span aria-hidden="true">·</span>
                <span>{WEATHER_LABELS[weather]}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5 text-right">
            <div>
              <div className="text-[10px] font-semibold tracking-wider text-slate-400">POINTS</div>
              <div className="font-mono-telemetry text-lg font-bold text-emerald-400 tabular-nums">
                +{player?.pointsAwarded ?? 0} PTS
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <div className="text-[10px] font-semibold tracking-wider text-slate-400">PRIZE PURSE</div>
              <div className="font-mono-telemetry text-lg font-bold text-amber-400 tabular-nums">
                +{prizeCredits.toLocaleString()} CR
              </div>
            </div>
          </div>
        </div>

        {/* Motorsport Timing Tower Scoreboard Table */}
        <div className="p-4 sm:p-5 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-semibold tracking-wider text-slate-400">
                <th className="py-2 px-2.5 w-14">POS</th>
                <th className="py-2 px-2.5">DRIVER</th>
                <th className="py-2 px-2.5 hidden sm:table-cell">CONSTRUCTOR</th>
                <th className="py-2 px-2.5 text-center">LAPS</th>
                <th className="py-2 px-2.5 text-right">BEST LAP</th>
                <th className="py-2 px-2.5 text-right">TIME / GAP</th>
                <th className="py-2 px-2.5 text-right w-16">PTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.07] text-xs sm:text-sm">
              {standings.map((r) => {
                const isFastest = r.bestLapMs !== null && fastestLapMs !== null && r.bestLapMs === fastestLapMs;
                const isRival = Boolean(
                  r.isRival || (career.activeRivalId && r.driverId === career.activeRivalId && !r.isPlayer)
                );
                const posColor =
                  r.position === 1
                    ? 'text-amber-400'
                    : r.position === 2
                      ? 'text-slate-200'
                      : r.position === 3
                        ? 'text-orange-400'
                        : 'text-slate-400';

                return (
                  <tr
                    key={r.id}
                    className={`transition-colors ${
                      r.isPlayer
                        ? 'bg-amber-400/10'
                        : isRival
                          ? 'bg-red-600/12'
                          : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <td className={`py-2.5 px-2.5 font-display font-bold text-base tabular-nums ${posColor}`}>
                      {String(r.position).padStart(2, '0')}
                    </td>
                    <td className="py-2.5 px-2.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-4 rounded-sm shrink-0"
                          style={{ backgroundColor: r.color }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold truncate ${r.isPlayer ? 'text-white' : 'text-slate-100'}`}>
                              {r.name}
                            </span>
                            {r.isPlayer && (
                              <span className="text-[10px] font-mono-telemetry text-amber-400 font-bold">YOU</span>
                            )}
                            {isRival && (
                              <span className="px-1.5 py-0.5 rounded bg-red-600 text-[9px] font-display font-bold text-white leading-none shrink-0">
                                RIVAL
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 sm:hidden truncate">{r.teamName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-300 hidden sm:table-cell">{r.teamName}</td>
                    <td className="py-2.5 px-2.5 text-center font-mono-telemetry text-slate-300 tabular-nums">
                      {r.lap}
                    </td>
                    <td
                      className={`py-2.5 px-2.5 text-right font-mono-telemetry tabular-nums ${
                        isFastest ? 'text-purple-400 font-bold' : 'text-slate-300'
                      }`}
                    >
                      {formatLapTime(r.bestLapMs)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono-telemetry tabular-nums">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {Boolean(r.timePenaltySec && r.timePenaltySec > 0) && (
                          <span className="px-1 py-0.5 rounded bg-red-600/80 text-[9px] font-bold text-white leading-none">
                            +{r.timePenaltySec}s
                          </span>
                        )}
                        {r.position === 1 ? (
                          <span className="text-amber-400 font-semibold">{formatLapTime(r.raceTimeMs)}</span>
                        ) : (
                          <span className="text-slate-300">+{r.gapSeconds.toFixed(2)}s</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono-telemetry font-bold text-emerald-400 tabular-nums">
                      +{r.pointsAwarded}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Career Summary & Actions */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-[#111622] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Season Total:</span>
              <strong className="font-mono-telemetry text-white tabular-nums">{career.championshipPoints} PTS</strong>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>
              Career Wins: <strong className="font-mono-telemetry text-white tabular-nums">{career.totalVictories}</strong>
            </span>
            {activeRival && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-red-400 font-semibold">
                  Rival: {activeRival.driverName} ({activeRival.playerAheadCount}–{activeRival.rivalAheadCount} H2H)
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onShowPodium}
              className="px-3.5 py-2 rounded-lg border border-white/15 text-xs font-semibold text-slate-200 hover:text-white hover:border-white/35 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Podium View
            </button>
            <button
              type="button"
              onClick={onGarage}
              className="px-3.5 py-2 rounded-lg border border-white/15 text-xs font-semibold text-slate-200 hover:text-white hover:border-white/35 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>Garage</span>
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="px-3.5 py-2 rounded-lg border border-white/15 text-xs font-semibold text-slate-200 hover:text-white hover:border-white/35 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Race Again</span>
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-display font-bold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
