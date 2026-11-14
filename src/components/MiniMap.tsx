import React from 'react';
import { MiniMapBlip, TrackHazardBlip } from '../types/racing';

interface MiniMapProps {
  trackName: string;
  miniMapPath: string;
  miniMapStart: { x: number; y: number };
  blips: MiniMapBlip[];
  hazards?: TrackHazardBlip[];
}

export const MiniMap: React.FC<MiniMapProps> = ({
  trackName,
  miniMapPath,
  miniMapStart,
  blips,
  hazards = [],
}) => {
  const opponents = blips.filter((b) => !b.isPlayer);
  const player = blips.find((b) => b.isPlayer);

  const closeOpponents = opponents
    .filter((b) => b.isWithinTwoSeconds)
    .sort((a, b) => Math.abs(a.gapToPlayerSeconds) - Math.abs(b.gapToPlayerSeconds));

  const nearestClose = closeOpponents[0] ?? null;

  return (
    <div className="rounded-xl border border-white/12 bg-[#090B0F]/85 px-2.5 py-2 flex flex-col gap-1.5 shadow-lg">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold tracking-wider">
        <span className="truncate max-w-[92px] text-slate-300 uppercase">
          {trackName}
        </span>
        {nearestClose ? (
          <span
            className={`font-mono-telemetry px-1.5 py-0.5 rounded text-[9px] font-bold leading-none ${
              nearestClose.gapToPlayerSeconds < 0
                ? 'bg-red-500/20 text-red-300 border border-red-400/40'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
            }`}
          >
            {closeOpponents.length} &le;2s · {nearestClose.gapToPlayerSeconds >= 0 ? '+' : ''}
            {nearestClose.gapToPlayerSeconds.toFixed(1)}s
          </span>
        ) : hazards.length > 0 ? (
          <span className="font-mono-telemetry px-1.5 py-0.5 rounded text-[9px] font-bold leading-none bg-amber-500/20 text-amber-300 border border-amber-400/40">
            {hazards.length} HAZARD{hazards.length > 1 ? 'S' : ''}
          </span>
        ) : (
          <span className="font-mono-telemetry text-slate-400">TRACK MAP</span>
        )}
      </div>

      {/* Dynamic SVG Circuit Map */}
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={`Live circuit mini-map for ${trackName}`}
        className="w-32 h-24 sm:w-36 sm:h-28 overflow-visible"
      >
        <defs>
          <filter id="minimap-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
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
          strokeWidth="7.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Track Asphalt Surface */}
        <path
          d={miniMapPath}
          fill="none"
          stroke="rgba(255, 255, 255, 0.24)"
          strokeWidth="4.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Racing Centerline */}
        <path
          d={miniMapPath}
          fill="none"
          stroke="#94A3B8"
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Surface Hazard Zones (Oil Spills & Carbon Debris) */}
        {hazards.map((hz) => {
          const isOil = hz.type === 'oil';
          const hzColor = isOil ? '#A855F7' : '#F97316';
          return (
            <g key={hz.id} transform={`translate(${hz.x}, ${hz.y})`}>
              <circle
                r="4.8"
                fill={hzColor}
                fillOpacity="0.28"
                stroke={hzColor}
                strokeWidth="0.9"
                strokeDasharray="1.8 1.2"
              />
              {isOil ? (
                <circle r="2.5" fill="#C084FC" stroke="#090B0F" strokeWidth="0.7" />
              ) : (
                <polygon
                  points="0,-2.9 2.7,2.2 -2.7,2.2"
                  fill="#FB923C"
                  stroke="#090B0F"
                  strokeWidth="0.65"
                />
              )}
            </g>
          );
        })}

        {/* Start / Finish Gate Marker */}
        <g transform={`translate(${miniMapStart.x}, ${miniMapStart.y})`}>
          <rect
            x="-2.4"
            y="-2.4"
            width="4.8"
            height="4.8"
            rx="1"
            fill="#F8FAFC"
            stroke="#090B0F"
            strokeWidth="0.9"
          />
        </g>

        {/* Opponent Markers (Standard first, <2s Proximity Pulsing on top) */}
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
                      r="3.8"
                      fill="none"
                      stroke={pulseColor}
                      strokeWidth="1.35"
                      className="minimap-pulse-ring"
                    />
                    <circle
                      r="3.8"
                      fill="none"
                      stroke={pulseColor}
                      strokeWidth="1.1"
                      className="minimap-pulse-ring-delayed"
                    />
                    <circle
                      r="5.2"
                      fill={pulseColor}
                      fillOpacity={opp.hasIncident ? '0.32' : '0.22'}
                    />
                  </>
                )}

                {opp.isRival && (
                  <polygon
                    points="0,-5.4 5.4,0 0,5.4 -5.4,0"
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth="1.2"
                  />
                )}

                <circle
                  r={showPulse ? 3.5 : 2.9}
                  fill={opp.hasIncident ? '#FACC15' : opp.color}
                  stroke={opp.isRival ? '#EF4444' : showPulse ? '#FFFFFF' : '#090B0F'}
                  strokeWidth={showPulse || opp.isRival ? 1.25 : 0.9}
                />
              </g>
            );
          })}

        {/* Player Real-Time Position & Heading Marker */}
        {player && (
          <g transform={`translate(${player.x}, ${player.y})`}>
            {/* Telemetry Beacon Halo */}
            <circle
              r="5.6"
              fill="#F59E0B"
              className="minimap-player-halo"
            />
            <circle
              r="7.5"
              fill="none"
              stroke="rgba(245, 158, 11, 0.35)"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />

            {/* Directional Player Arrow */}
            <g transform={`rotate(${player.heading})`} filter="url(#minimap-glow)">
              <polygon
                points="0,-5.4 4.1,4.1 0,2.1 -4.1,4.1"
                fill="#F59E0B"
                stroke="#FFFFFF"
                strokeWidth="1.15"
                strokeLinejoin="round"
              />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};
