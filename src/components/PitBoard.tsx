import React from 'react';

interface PitBoardProps {
  visible: boolean;
  position: number;
  totalRacers: number;
  gapAheadSeconds: number | null;
  lap: number;
  totalLaps: number;
}

export const PitBoard: React.FC<PitBoardProps> = ({
  visible,
  position,
  totalRacers,
  gapAheadSeconds,
  lap,
  totalLaps,
}) => {
  const isLeader = position <= 1;
  const isSolo = totalRacers <= 1;

  const gapText = isSolo
    ? 'SOLO RUN'
    : isLeader || gapAheadSeconds === null || gapAheadSeconds <= 0.01
      ? 'LEADER'
      : `+${gapAheadSeconds.toFixed(2)}s`;

  return (
    <div
      aria-live="polite"
      className={`fixed left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 pointer-events-none transition-all duration-300 ease-out ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
      }`}
    >
      <div
        className="w-44 sm:w-52 rounded-xl border-2 border-amber-400/75 shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgba(9, 11, 15, 0.94)' }}
      >
        {/* Top Pit-Wall Header Bar */}
        <div className="bg-amber-400 px-3 py-1.5 flex items-center justify-between">
          <span className="font-display font-extrabold text-xs tracking-wider text-slate-950">
            PIT BOARD
          </span>
          <span className="font-display font-bold text-[10px] tracking-widest text-slate-950">
            LAP {lap}/{totalLaps}
          </span>
        </div>

        {/* Final Lap Tag */}
        <div className="px-3 pt-2 pb-1 border-b border-white/10 flex items-center justify-between">
          <span className="text-[10px] font-display font-bold tracking-widest text-amber-300">
            FINAL LAP
          </span>
          <span className="text-[10px] font-mono-telemetry text-slate-400">
            PIT WALL
          </span>
        </div>

        {/* Slotted Pit Board Placards */}
        <div className="p-2.5 flex flex-col gap-2">
          {/* Position Slot */}
          <div
            className="rounded-lg border border-white/10 px-3 py-2 flex items-baseline justify-between"
            style={{ backgroundColor: '#131722' }}
          >
            <span className="text-[10px] font-semibold tracking-wider text-slate-400">
              POS
            </span>
            <div className="font-display font-extrabold tabular-nums leading-none">
              <span className="text-3xl text-yellow-300">P{position}</span>
              <span className="text-xs text-slate-400 ml-1">/ {totalRacers}</span>
            </div>
          </div>

          {/* Gap to Car Ahead Slot */}
          <div
            className="rounded-lg border border-white/10 px-3 py-2 flex items-center justify-between"
            style={{ backgroundColor: '#131722' }}
          >
            <span className="text-[10px] font-semibold tracking-wider text-slate-400">
              AHEAD
            </span>
            <span
              className={`font-mono-telemetry font-bold text-base tabular-nums ${
                isSolo ? 'text-sky-300' : isLeader ? 'text-emerald-400' : 'text-white'
              }`}
            >
              {gapText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
