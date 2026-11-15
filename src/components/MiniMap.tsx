import React, { useState } from 'react';
import { AlertTriangle, Flame, Radio } from 'lucide-react';
import { MiniMapBlip, MiniMapDrsZone, TrackHazardBlip } from '../types/racing';

interface MiniMapProps {
  trackName: string;
  miniMapPath: string;
  miniMapSectorPaths?: [string, string, string];
  miniMapRacingLinePaths?: [string, string, string];
  miniMapStart: { x: number; y: number };
  blips: MiniMapBlip[];
  hazards?: TrackHazardBlip[];
  drsZones?: MiniMapDrsZone[];
  trackFlag?: { flag: string; reason: string; distanceMeters: number | null };
  currentSector?: number;
  sectorGripPct?: [number, number, number];
}

function getGripHeatmapColors(gripPct: number): {
  bandColor: string;
  lineColor: string;
  labelColor: string;
  stateLabel: string;
} {
  if (gripPct >= 88) {
    return {
      bandColor: '#10B981',
      lineColor: '#34D399',
      labelColor: 'text-emerald-300',
      stateLabel: 'HIGH',
    };
  }
  if (gripPct >= 72) {
    return {
      bandColor: '#F59E0B',
      lineColor: '#FACC15',
      labelColor: 'text-amber-300',
      stateLabel: 'MED',
    };
  }
  return {
    bandColor: '#EF4444',
    lineColor: '#FB923C',
    labelColor: 'text-red-400',
    stateLabel: 'LOW',
  };
}

export const MiniMap: React.FC<MiniMapProps> = ({
  trackName,
  miniMapPath,
  miniMapSectorPaths,
  miniMapRacingLinePaths,
  miniMapStart,
  blips,
  hazards = [],
  drsZones = [],
  trackFlag,
  currentSector = 1,
  sectorGripPct = [96, 93, 95],
}) => {
  const [showRadarList, setShowRadarList] = useState(false);
  const [showGripHeatmap, setShowGripHeatmap] = useState(true);

  const opponents = blips.filter((b) => !b.isPlayer);
  const player = blips.find((b) => b.isPlayer);

  const closeOpponents = opponents
    .filter((b) => b.isWithinTwoSeconds)
    .sort((a, b) => Math.abs(a.gapToPlayerSeconds) - Math.abs(b.gapToPlayerSeconds));

  const nearestClose = closeOpponents[0] ?? null;
  const isYellowFlag = trackFlag?.flag === 'yellow';

  return (
    <div
      className="relative rounded-xl border border-white/12 px-2.5 py-2 flex flex-col gap-1.5 shadow-2xl"
      style={{ backgroundColor: 'rgba(9, 11, 15, 0.92)' }}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold tracking-wider">
        <button
          type="button"
          onClick={() => setShowRadarList(!showRadarList)}
          className="flex items-center gap-1.5 truncate max-w-[92px] text-slate-300 hover:text-white uppercase transition-colors cursor-pointer text-left whitespace-nowrap shrink-0"
          title="Toggle Proximity Radar List"
        >
          <Radio className="w-3 h-3 text-sky-400 shrink-0" />
          <span className="truncate">{trackName}</span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowGripHeatmap(!showGripHeatmap)}
            title="Toggle Surface Grip Heatmap & Racing Line Overlay"
            className={`pointer-events-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono-telemetry font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
              showGripHeatmap
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            <Flame className="w-2.5 h-2.5" />
            <span>GRIP</span>
          </button>

          {isYellowFlag ? (
            <span className="font-mono-telemetry px-1.5 py-0.5 rounded text-[9px] font-bold leading-none bg-amber-500/25 text-amber-300 border border-amber-400/50 flex items-center gap-1 whitespace-nowrap shrink-0">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              YELLOW S{currentSector}
            </span>
          ) : nearestClose ? (
            <span
              className={`font-mono-telemetry tabular-nums px-1.5 py-0.5 rounded text-[9px] font-bold leading-none whitespace-nowrap shrink-0 ${
                nearestClose.gapToPlayerSeconds < 0
                  ? 'bg-red-500/20 text-red-300 border border-red-400/40'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
              }`}
            >
              {closeOpponents.length} &le;2s · {nearestClose.gapToPlayerSeconds >= 0 ? '+' : ''}
              {nearestClose.gapToPlayerSeconds.toFixed(1)}s
            </span>
          ) : hazards.length > 0 ? (
            <span className="font-mono-telemetry tabular-nums px-1.5 py-0.5 rounded text-[9px] font-bold leading-none bg-amber-500/20 text-amber-300 border border-amber-400/40 whitespace-nowrap shrink-0">
              {hazards.length} HAZ
            </span>
          ) : null}
        </div>
      </div>

      {/* Dynamic SVG Circuit Map with Sector Grip Heatmap, High-Grip Racing Lines & Relative AI Blips */}
      <div className="relative">
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label={`Live dynamic circuit mini-map and surface grip heatmap for ${trackName}`}
          className="w-36 h-28 sm:w-40 sm:h-32 overflow-visible cursor-pointer"
          onClick={() => setShowRadarList(!showRadarList)}
        >
          <defs>
            <filter id="minimap-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="grip-heatmap-glow" x="-45%" y="-45%" width="190%" height="190%">
              <feGaussianBlur stdDeviation="1.9" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="yellow-flag-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feComponentTransfer in="blur" result="glow">
                <feFuncA type="linear" slope="1.8" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Subtle Telemetry Crosshair Grid */}
          <g stroke="rgba(148, 163, 184, 0.08)" strokeWidth="0.5">
            <line x1="0" y1="25" x2="100" y2="25" />
            <line x1="0" y1="50" x2="100" y2="50" />
            <line x1="0" y1="75" x2="100" y2="75" />
            <line x1="25" y1="0" x2="25" y2="100" />
            <line x1="50" y1="0" x2="50" y2="100" />
            <line x1="75" y1="0" x2="75" y2="100" />
          </g>

          {/* Outer Track Casing */}
          <path
            d={miniMapPath}
            fill="none"
            stroke="rgba(15, 23, 42, 0.95)"
            strokeWidth="7.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Track Asphalt Surface */}
          <path
            d={miniMapPath}
            fill="none"
            stroke="rgba(255, 255, 255, 0.22)"
            strokeWidth="4.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Surface Grip Heatmap & High-Grip Racing Line Overlay (Per-Sector S1 / S2 / S3) */}
          {showGripHeatmap ? (
            <g>
              {[0, 1, 2].map((secIdx) => {
                const gripVal = sectorGripPct[secIdx] ?? 95;
                const colors = getGripHeatmapColors(gripVal);
                const isActiveSec = currentSector === secIdx + 1;
                const secPath = miniMapSectorPaths?.[secIdx];
                const linePath = miniMapRacingLinePaths?.[secIdx];

                if (secPath) {
                  return (
                    <g key={`grip-sec-${secIdx}`}>
                      {/* Sector Surface Grip Thermal Band */}
                      <path
                        d={secPath}
                        fill="none"
                        stroke={colors.bandColor}
                        strokeOpacity={isActiveSec ? 0.58 : 0.38}
                        strokeWidth={isActiveSec ? 5.6 : 4.6}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        filter="url(#grip-heatmap-glow)"
                      />
                      {/* Rubbered-In High-Grip Racing Line Trajectory */}
                      <path
                        d={linePath || secPath}
                        fill="none"
                        stroke={colors.lineColor}
                        strokeOpacity={isActiveSec ? 0.98 : 0.84}
                        strokeWidth={isActiveSec ? 2.1 : 1.65}
                        strokeDasharray={gripVal >= 88 ? undefined : '3.5 1.8'}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </g>
                  );
                }

                // Fallback segmented path when miniMapSectorPaths is not yet populated
                return (
                  <g key={`grip-fallback-${secIdx}`}>
                    <path
                      d={miniMapPath}
                      pathLength={300}
                      strokeDasharray="100 200"
                      strokeDashoffset={-secIdx * 100}
                      fill="none"
                      stroke={colors.bandColor}
                      strokeOpacity={isActiveSec ? 0.58 : 0.38}
                      strokeWidth={isActiveSec ? 5.4 : 4.4}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      filter="url(#grip-heatmap-glow)"
                    />
                    <path
                      d={miniMapPath}
                      pathLength={300}
                      strokeDasharray="100 200"
                      strokeDashoffset={-secIdx * 100}
                      fill="none"
                      stroke={colors.lineColor}
                      strokeOpacity={0.92}
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
            </g>
          ) : (
            <path
              d={miniMapPath}
              fill="none"
              stroke="#94A3B8"
              strokeWidth="1.4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Official Circuit DRS Activation Zones */}
          {drsZones.map((dz) => (
            <path
              key={dz.id}
              d={dz.path}
              fill="none"
              stroke={dz.active ? '#34D399' : '#10B981'}
              strokeOpacity={dz.active ? 0.98 : 0.58}
              strokeWidth={dz.active ? 4.2 : 2.6}
              strokeLinejoin="round"
              strokeLinecap="round"
              filter={dz.active ? 'url(#minimap-glow)' : undefined}
            />
          ))}

          {/* Yellow Flag Sector Highlighting (Amber Track Overlay) */}
          {isYellowFlag && (
            <path
              d={miniMapPath}
              fill="none"
              stroke="#FBBF24"
              strokeWidth="3.2"
              strokeDasharray="4 4"
              strokeLinejoin="round"
              strokeLinecap="round"
              filter="url(#yellow-flag-glow)"
            />
          )}

          {/* Surface Hazard Zones (Oil Spills & Carbon Debris) */}
          {hazards.map((hz) => {
            const isOil = hz.type === 'oil';
            const hzColor = isOil ? '#A855F7' : '#F97316';
            return (
              <g key={hz.id} transform={`translate(${hz.x}, ${hz.y})`}>
                <circle
                  r="5.2"
                  fill={hzColor}
                  fillOpacity="0.32"
                  stroke={hzColor}
                  strokeWidth="1.0"
                  strokeDasharray="2 1"
                  className="animate-spin"
                  style={{ animationDuration: '8s' }}
                />
                {isOil ? (
                  <circle r="2.8" fill="#C084FC" stroke="#090B0F" strokeWidth="0.7" />
                ) : (
                  <polygon
                    points="0,-3.1 2.9,2.4 -2.9,2.4"
                    fill="#FB923C"
                    stroke="#090B0F"
                    strokeWidth="0.7"
                  />
                )}
              </g>
            );
          })}

          {/* Start / Finish Gate Marker */}
          <g transform={`translate(${miniMapStart.x}, ${miniMapStart.y})`}>
            <rect
              x="-2.6"
              y="-2.6"
              width="5.2"
              height="5.2"
              rx="1"
              fill="#F8FAFC"
              stroke="#090B0F"
              strokeWidth="0.9"
            />
          </g>

          {/* Opponent Markers with Proximity Pulse & Relative Gap Badges */}
          {opponents
            .slice()
            .sort((a, b) => Number(a.isWithinTwoSeconds) - Number(b.isWithinTwoSeconds))
            .map((opp) => {
              const pulseColor = opp.hasIncident
                ? '#FACC15'
                : opp.gapToPlayerSeconds < 0
                  ? '#EF4444'
                  : '#22D3EE';
              const showPulse = Boolean(opp.hasIncident || opp.isWithinTwoSeconds);
              return (
                <g key={opp.id} transform={`translate(${opp.x}, ${opp.y})`}>
                  {showPulse && (
                    <>
                      <circle
                        r="4.2"
                        fill="none"
                        stroke={pulseColor}
                        strokeWidth="1.4"
                        className="minimap-pulse-ring"
                      />
                      <circle
                        r="5.8"
                        fill={pulseColor}
                        fillOpacity={opp.hasIncident ? '0.35' : '0.24'}
                      />
                    </>
                  )}

                  {opp.isRival && (
                    <polygon
                      points="0,-5.8 5.8,0 0,5.8 -5.8,0"
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="1.3"
                    />
                  )}

                  <circle
                    r={showPulse ? 3.8 : 3.1}
                    fill={opp.hasIncident ? '#FACC15' : opp.color}
                    stroke={opp.isRival ? '#EF4444' : showPulse ? '#FFFFFF' : '#090B0F'}
                    strokeWidth={showPulse || opp.isRival ? 1.3 : 0.9}
                  />

                  {/* Real-time Gap Tag for very close cars (&le; 1.5s) */}
                  {Math.abs(opp.gapToPlayerSeconds) <= 1.5 && (
                    <text
                      x="6"
                      y="2.5"
                      fill="#FFFFFF"
                      fontSize="6.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      stroke="#090B0F"
                      strokeWidth="0.8"
                    >
                      {opp.gapToPlayerSeconds >= 0 ? `+${opp.gapToPlayerSeconds.toFixed(1)}` : opp.gapToPlayerSeconds.toFixed(1)}s
                    </text>
                  )}
                </g>
              );
            })}

          {/* Player Real-Time Position & Heading Marker */}
          {player && (
            <g transform={`translate(${player.x}, ${player.y})`}>
              {/* Telemetry Beacon Halo */}
              <circle
                r="6.0"
                fill="#F59E0B"
                className="minimap-player-halo"
              />
              <circle
                r="8.2"
                fill="none"
                stroke="rgba(245, 158, 11, 0.45)"
                strokeWidth="0.9"
                strokeDasharray="2 2"
              />

              {/* Directional Player Arrow */}
              <g transform={`rotate(${player.heading})`} filter="url(#minimap-glow)">
                <polygon
                  points="0,-5.8 4.4,4.4 0,2.3 -4.4,4.4"
                  fill="#F59E0B"
                  stroke="#FFFFFF"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </g>
            </g>
          )}
        </svg>

        {/* Proximity Radar List Overlay Modal */}
        {showRadarList && (
          <div className="absolute inset-0 z-30 bg-slate-950/96 rounded-xl p-2.5 flex flex-col gap-1.5 overflow-y-auto text-[10px] text-slate-100 shadow-2xl border border-sky-500/40">
            <div className="flex items-center justify-between pb-1 border-b border-white/10 font-display font-bold uppercase text-sky-400">
              <span>Proximity Radar ({closeOpponents.length} Nearby)</span>
              <button
                type="button"
                onClick={() => setShowRadarList(false)}
                className="text-slate-400 hover:text-white cursor-pointer px-1"
              >
                ✕
              </button>
            </div>
            {closeOpponents.length === 0 ? (
              <div className="py-4 text-center text-slate-500">No cars within 2.0 seconds.</div>
            ) : (
              closeOpponents.map((car) => (
                <div key={car.id} className="flex items-center justify-between bg-white/5 px-2 py-1 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: car.color }} />
                    <span className="font-bold text-white">Opponent</span>
                  </div>
                  <span
                    className={`font-mono-telemetry font-bold tabular-nums ${
                      car.gapToPlayerSeconds < 0 ? 'text-red-400' : 'text-cyan-300'
                    }`}
                  >
                    {car.gapToPlayerSeconds >= 0 ? `+${car.gapToPlayerSeconds.toFixed(2)}s` : `${car.gapToPlayerSeconds.toFixed(2)}s`}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Per-Sector Surface Grip Readout & Racing Line Legend */}
      {showGripHeatmap && (
        <div className="mt-1 pt-1 border-t border-white/10 flex items-center justify-between gap-1 text-[8px] font-mono-telemetry tabular-nums">
          {([0, 1, 2] as const).map((idx) => {
            const gripVal = sectorGripPct[idx] ?? 90;
            const palette = getGripHeatmapColors(gripVal);
            const isCurrent = currentSector === idx + 1;
            return (
              <div
                key={`sector-grip-${idx}`}
                className={`flex-1 flex items-center justify-between px-1.5 py-0.5 rounded border ${
                  isCurrent ? 'bg-white/10 border-white/30' : 'bg-black/40 border-white/10'
                }`}
              >
                <span className="text-slate-400 font-bold">S{idx + 1}</span>
                <span className="font-bold" style={{ color: palette.lineColor }}>
                  {gripVal}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
