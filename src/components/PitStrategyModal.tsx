import React, { useMemo, useState } from 'react';
import { Flag, Fuel, Layers, Play, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import {
  buildDefaultPitStrategy,
  normalizePitStrategyPlan,
  simulateStrategyProjection,
} from '../physics/simulationCalculus';
import {
  CircuitTrack,
  PlannedPitStop,
  PreRacePitStrategy,
  TyreCompound,
  WeatherMode,
} from '../types/racing';

interface PitStrategyModalProps {
  track: CircuitTrack;
  weather: WeatherMode;
  initialPlan: PreRacePitStrategy;
  onSave: (plan: PreRacePitStrategy) => void;
  onSaveAndStartRace: (plan: PreRacePitStrategy) => void;
  onClose: () => void;
}

const COMPOUND_META: Record<
  TyreCompound,
  { label: string; short: string; hex: string; gripLabel: string; wearLabel: string }
> = {
  soft: { label: 'Soft (C5)', short: 'S', hex: '#EF4444', gripLabel: 'Peak Grip', wearLabel: 'High Deg' },
  medium: { label: 'Medium (C3)', short: 'M', hex: '#FACC15', gripLabel: 'Balanced', wearLabel: 'Moderate' },
  hard: { label: 'Hard (C1)', short: 'H', hex: '#F8FAFC', gripLabel: 'Durable', wearLabel: 'Low Deg' },
  wet: { label: 'Wet (Inter/W)', short: 'W', hex: '#38BDF8', gripLabel: 'Rain Clear', wearLabel: 'Wet Only' },
};

const QUICK_LAP_COUNTS = [3, 5, 8, 10, 12, 15, 20] as const;

export const PitStrategyModal: React.FC<PitStrategyModalProps> = ({
  track,
  weather,
  initialPlan,
  onSave,
  onSaveAndStartRace,
  onClose,
}) => {
  const [draft, setDraft] = useState<PreRacePitStrategy>(() => normalizePitStrategyPlan(initialPlan));

  const normalized = useMemo(() => normalizePitStrategyPlan(draft), [draft]);
  const projection = useMemo(
    () => simulateStrategyProjection(normalized, weather),
    [normalized, weather]
  );

  const isWet = weather === 'rain' || weather === 'heavy_rain';
  const optimalWindowStart = Math.max(1, Math.floor(normalized.totalLaps * 0.35));
  const optimalWindowEnd = Math.max(
    optimalWindowStart,
    Math.min(normalized.totalLaps - 1, Math.ceil(normalized.totalLaps * 0.65))
  );

  const updateLaps = (nextLaps: number) => {
    const clamped = Math.max(1, Math.min(30, Math.round(nextLaps)));
    setDraft((prev) =>
      normalizePitStrategyPlan({
        ...prev,
        totalLaps: clamped,
      })
    );
  };

  const applyPreset = (preset: 'sprint' | 'one_undercut' | 'one_overcut' | 'two_attack' | 'wet') => {
    const laps = normalized.totalLaps;
    if (preset === 'sprint') {
      setDraft(
        normalizePitStrategyPlan({
          totalLaps: laps,
          startingCompound: isWet ? 'wet' : 'soft',
          startingFuelPct: Math.min(100, Math.max(55, Math.round(laps * 16 + 12))),
          stops: [],
        })
      );
      return;
    }
    if (preset === 'wet') {
      const stopLap = Math.max(1, Math.min(laps - 1, Math.round(laps * 0.5)));
      setDraft(
        normalizePitStrategyPlan({
          totalLaps: laps,
          startingCompound: 'wet',
          startingFuelPct: Math.min(100, Math.max(55, Math.round(stopLap * 16 + 18))),
          stops:
            laps >= 3
              ? [
                  {
                    id: 'stop_1',
                    stopNumber: 1,
                    pitLap: stopLap,
                    compound: 'wet',
                    fuelLoadPct: Math.min(100, Math.max(55, Math.round((laps - stopLap) * 16 + 18))),
                  },
                ]
              : [],
        })
      );
      return;
    }
    if (preset === 'one_undercut') {
      const targetLaps = Math.max(4, laps);
      const stopLap = Math.max(1, Math.min(targetLaps - 1, Math.floor(targetLaps * 0.36)));
      setDraft(
        normalizePitStrategyPlan({
          totalLaps: targetLaps,
          startingCompound: 'soft',
          startingFuelPct: Math.min(100, Math.max(48, Math.round(stopLap * 16 + 14))),
          stops: [
            {
              id: 'stop_1',
              stopNumber: 1,
              pitLap: stopLap,
              compound: 'hard',
              fuelLoadPct: Math.min(100, Math.max(55, Math.round((targetLaps - stopLap) * 16 + 16))),
            },
          ],
        })
      );
      return;
    }
    if (preset === 'one_overcut') {
      const targetLaps = Math.max(4, laps);
      const stopLap = Math.max(1, Math.min(targetLaps - 1, Math.ceil(targetLaps * 0.6)));
      setDraft(
        normalizePitStrategyPlan({
          totalLaps: targetLaps,
          startingCompound: 'medium',
          startingFuelPct: Math.min(100, Math.max(55, Math.round(stopLap * 16 + 15))),
          stops: [
            {
              id: 'stop_1',
              stopNumber: 1,
              pitLap: stopLap,
              compound: 'soft',
              fuelLoadPct: Math.min(100, Math.max(45, Math.round((targetLaps - stopLap) * 16 + 14))),
            },
          ],
        })
      );
      return;
    }
    // two_attack
    const targetLaps = Math.max(6, laps);
    const stop1 = Math.max(1, Math.min(targetLaps - 2, Math.round(targetLaps * 0.33)));
    const stop2 = Math.max(stop1 + 1, Math.min(targetLaps - 1, Math.round(targetLaps * 0.67)));
    setDraft(
      normalizePitStrategyPlan({
        totalLaps: targetLaps,
        startingCompound: 'soft',
        startingFuelPct: Math.min(100, Math.max(50, Math.round(stop1 * 16 + 14))),
        stops: [
          {
            id: 'stop_1',
            stopNumber: 1,
            pitLap: stop1,
            compound: 'medium',
            fuelLoadPct: Math.min(100, Math.max(50, Math.round((stop2 - stop1) * 16 + 15))),
          },
          {
            id: 'stop_2',
            stopNumber: 2,
            pitLap: stop2,
            compound: 'soft',
            fuelLoadPct: Math.min(100, Math.max(45, Math.round((targetLaps - stop2) * 16 + 14))),
          },
        ],
      })
    );
  };

  const addStop = () => {
    if (normalized.totalLaps < 2 || normalized.stops.length >= 3) return;
    const usedLaps = new Set(normalized.stops.map((s) => s.pitLap));
    const preferredLap =
      normalized.stops.length === 0
        ? optimalWindowStart
        : Math.min(normalized.totalLaps - 1, normalized.stops[normalized.stops.length - 1].pitLap + 2);
    let pitLap = Math.max(1, Math.min(normalized.totalLaps - 1, preferredLap));
    while (usedLaps.has(pitLap) && pitLap < normalized.totalLaps - 1) {
      pitLap++;
    }
    while (usedLaps.has(pitLap) && pitLap > 1) {
      pitLap--;
    }
    if (usedLaps.has(pitLap)) return;

    const prevCompound =
      normalized.stops[normalized.stops.length - 1]?.compound ?? normalized.startingCompound;
    const nextCompound: TyreCompound = isWet
      ? 'wet'
      : prevCompound === 'soft'
        ? 'medium'
        : prevCompound === 'medium'
          ? 'hard'
          : 'soft';

    const newStop: PlannedPitStop = {
      id: `stop_${Date.now()}_${normalized.stops.length + 1}`,
      stopNumber: normalized.stops.length + 1,
      pitLap,
      compound: nextCompound,
      fuelLoadPct: 75,
    };

    setDraft(
      normalizePitStrategyPlan({
        ...normalized,
        stops: [...normalized.stops, newStop],
      })
    );
  };

  const updateStop = (id: string, patch: Partial<PlannedPitStop>) => {
    setDraft((prev) =>
      normalizePitStrategyPlan({
        ...prev,
        stops: prev.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      })
    );
  };

  const removeStop = (id: string) => {
    setDraft((prev) =>
      normalizePitStrategyPlan({
        ...prev,
        stops: prev.stops.filter((s) => s.id !== id),
      })
    );
  };

  // Build SVG polyline points for Fuel % and Tyre Wear % across all laps
  const chartW = 560;
  const chartH = 112;
  const padX = 24;
  const padY = 12;
  const plotW = chartW - padX * 2;
  const plotH = chartH - padY * 2;

  const totalPts = Math.max(1, projection.lapPoints.length);
  const fuelPolyline = projection.lapPoints
    .map((pt, idx) => {
      const x = padX + (totalPts === 1 ? plotW : (idx / (totalPts - 1)) * plotW);
      const y = padY + (1 - pt.fuelEndPct / 100) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const wearPolyline = projection.lapPoints
    .map((pt, idx) => {
      const x = padX + (totalPts === 1 ? plotW : (idx / (totalPts - 1)) * plotW);
      const y = padY + (1 - pt.tyreWearEndPct / 100) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5"
      style={{ backgroundColor: 'rgba(6, 8, 12, 0.84)' }}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/15 p-5 sm:p-6 flex flex-col gap-5 text-slate-100 shadow-2xl"
        style={{ backgroundColor: '#0E121A' }}
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3.5">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{track.name}</span>
              <span aria-hidden="true">·</span>
              <span>{track.lengthKm.toFixed(2)} km</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{weather.replace('_', ' ')}</span>
            </div>
            <h2 className="font-display font-bold text-xl sm:text-2xl text-white mt-0.5">
              Pre-Race Pit Strategy Planner
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Pit Strategy Planner"
            className="p-2 rounded-lg border border-white/15 text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Strategy Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <span className="text-xs font-medium text-slate-400">Strategy Templates</span>
          <div className="flex flex-wrap items-center gap-1.5 bg-white/5 p-1 rounded-lg">
            {[
              { id: 'sprint', label: '0-Stop Sprint' },
              { id: 'one_undercut', label: '1-Stop Undercut' },
              { id: 'one_overcut', label: '1-Stop Overcut' },
              { id: 'two_attack', label: '2-Stop Attack' },
              { id: 'wet', label: 'Wet Transition' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id as 'sprint' | 'one_undercut' | 'one_overcut' | 'two_attack' | 'wet')}
                className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 1: Race Distance (Lap Count) + Grid Start Setup */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Lap Count */}
          <div className="lg:col-span-5 rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Flag className="w-4 h-4 text-red-400" />
                <span>Race Distance</span>
              </div>
              <span className="font-mono-telemetry font-bold text-base text-white tabular-nums">
                {normalized.totalLaps} Laps
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-white/5 p-1 rounded-lg">
              {QUICK_LAP_COUNTS.map((laps) => (
                <button
                  key={laps}
                  type="button"
                  onClick={() => updateLaps(laps)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-mono-telemetry font-semibold cursor-pointer transition-colors ${
                    normalized.totalLaps === laps
                      ? 'bg-red-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {laps}L
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs text-slate-400">Custom Laps (1–30)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateLaps(normalized.totalLaps - 1)}
                  className="w-8 h-8 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-bold text-white cursor-pointer"
                >
                  -
                </button>
                <span className="w-10 text-center font-mono-telemetry font-bold text-sm text-white tabular-nums">
                  {normalized.totalLaps}
                </span>
                <button
                  type="button"
                  onClick={() => updateLaps(normalized.totalLaps + 1)}
                  className="w-8 h-8 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-bold text-white cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Starting Tire Compound & Starting Fuel Load */}
          <div className="lg:col-span-7 rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Fuel className="w-4 h-4 text-cyan-400" />
                <span>Grid Start Tires & Fuel Load</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono-telemetry tabular-nums">
                <span>Burn {projection.fuelBurnPerLapPct}%/lap</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    projection.fuelWeightDeltaSecPerLap <= 0 ? 'text-emerald-300' : 'text-amber-300'
                  }
                >
                  Weight {projection.fuelWeightDeltaSecPerLap >= 0 ? '+' : ''}
                  {projection.fuelWeightDeltaSecPerLap.toFixed(2)}s/lap
                </span>
              </div>
            </div>

            {/* Starting Compound Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['soft', 'medium', 'hard', 'wet'] as TyreCompound[]).map((cmp) => {
                const meta = COMPOUND_META[cmp];
                const active = normalized.startingCompound === cmp;
                return (
                  <button
                    key={cmp}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, startingCompound: cmp }))}
                    className={`px-3 py-2 rounded-lg border text-left cursor-pointer transition-all ${
                      active
                        ? 'border-white bg-white/12 text-white'
                        : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{meta.label.split(' ')[0]}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/40"
                        style={{ backgroundColor: meta.hex }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{meta.wearLabel}</div>
                  </button>
                );
              })}
            </div>

            {/* Starting Fuel Slider & Presets */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-300">
                  Starting Fuel Load:{' '}
                  <strong className="font-mono-telemetry text-cyan-300 tabular-nums">
                    {normalized.startingFuelPct}%
                  </strong>
                </span>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                  {([45, 65, 85, 100] as const).map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, startingFuelPct: pct }))}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono-telemetry font-semibold cursor-pointer ${
                        normalized.startingFuelPct === pct
                          ? 'bg-cyan-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="range"
                min={35}
                max={100}
                step={5}
                value={normalized.startingFuelPct}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, startingFuelPct: Number(e.target.value) }))
                }
                aria-label="Starting Fuel Load Percentage"
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Scheduled Pit Stops */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Scheduled Pit Stops ({normalized.stops.length}/3)</span>
              </div>
              <div className="text-xs text-slate-400">
                Recommended window: Laps {optimalWindowStart}–{optimalWindowEnd} · Stops auto-queue on target lap
              </div>
            </div>
            <button
              type="button"
              onClick={addStop}
              disabled={normalized.totalLaps < 2 || normalized.stops.length >= 3}
              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Pit Stop</span>
            </button>
          </div>

          {normalized.stops.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/15 px-4 py-3 text-xs text-slate-400 flex items-center justify-between">
              <span>No pit stops scheduled (0-Stop Sprint strategy).</span>
              <span>
                {normalized.totalLaps < 2
                  ? 'Increase lap count to schedule a pit stop.'
                  : 'Click "Add Pit Stop" to plan a compound change or refuel.'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {normalized.stops.map((stop) => {
                const inOptimalWindow =
                  stop.pitLap >= optimalWindowStart && stop.pitLap <= optimalWindowEnd;
                return (
                  <div
                    key={stop.id}
                    className="rounded-lg border border-white/12 bg-black/30 p-3 grid grid-cols-1 md:grid-cols-12 items-center gap-3"
                  >
                    {/* Stop Index & Lap Stepper */}
                    <div className="md:col-span-4 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white">Pit Stop {stop.stopNumber}</div>
                        <div className="text-[11px] text-slate-400">
                          {inOptimalWindow ? 'Optimal Window' : 'Off-Sequence'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateStop(stop.id, { pitLap: stop.pitLap - 1 })}
                          className="w-7 h-7 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-white cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-2 font-mono-telemetry font-bold text-xs text-amber-300 tabular-nums">
                          Lap {stop.pitLap}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateStop(stop.id, { pitLap: stop.pitLap + 1 })}
                          className="w-7 h-7 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-white cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Tire Compound */}
                    <div className="md:col-span-4 flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                      {(['soft', 'medium', 'hard', 'wet'] as TyreCompound[]).map((cmp) => {
                        const meta = COMPOUND_META[cmp];
                        const active = stop.compound === cmp;
                        return (
                          <button
                            key={cmp}
                            type="button"
                            onClick={() => updateStop(stop.id, { compound: cmp })}
                            className={`flex-1 px-2 py-1 rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                              active ? 'bg-white text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: meta.hex }}
                            />
                            <span>{meta.short}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Refuel Load % & Remove */}
                    <div className="md:col-span-4 flex items-center justify-between gap-2">
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>Refuel To</span>
                          <span className="font-mono-telemetry font-bold text-cyan-300 tabular-nums">
                            {stop.fuelLoadPct}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={35}
                          max={100}
                          step={5}
                          value={stop.fuelLoadPct}
                          onChange={(e) =>
                            updateStop(stop.id, { fuelLoadPct: Number(e.target.value) })
                          }
                          aria-label={`Pit Stop ${stop.stopNumber} Target Fuel Load`}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStop(stop.id)}
                        aria-label={`Remove Pit Stop ${stop.stopNumber}`}
                        className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-red-400 hover:border-red-400/40 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Stint Timeline & Fuel/Wear Projection Visualizer */}
        <div className="rounded-xl border border-white/10 bg-black/35 p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">
              Stint Timeline & Telemetry Projection
            </span>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono-telemetry tabular-nums">
              <span className={projection.runsOutOfFuelLap ? 'text-red-400 font-bold' : 'text-emerald-300'}>
                {projection.runsOutOfFuelLap
                  ? `Fuel Risk: Empty Lap ${projection.runsOutOfFuelLap}`
                  : `Finish Margin: +${projection.fuelMarginLaps} laps`}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-300">
                Min Tyre Health: {projection.minTyreWearPct}%
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-amber-300">
                Est. Pit Loss: {projection.estimatedPitTimeTotalSec}s
              </span>
            </div>
          </div>

          {/* Horizontal Stint Bar */}
          <div className="flex items-center gap-1 h-7 rounded-lg overflow-hidden bg-white/5 p-1">
            {projection.stints.map((stint) => {
              const meta = COMPOUND_META[stint.compound];
              const widthPct = (stint.laps / normalized.totalLaps) * 100;
              return (
                <div
                  key={stint.stintNumber}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: meta.hex,
                    color: stint.compound === 'hard' || stint.compound === 'medium' ? '#090B0F' : '#FFFFFF',
                  }}
                  className="h-full rounded flex items-center justify-center px-1.5 text-[11px] font-display font-bold truncate"
                  title={`Stint ${stint.stintNumber}: Laps ${stint.startLap}–${stint.endLap} (${meta.label})`}
                >
                  {meta.short} · L{stint.startLap}–{stint.endLap}
                </div>
              );
            })}
          </div>

          {/* Dual Fuel + Tyre Wear Curve SVG */}
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-28 rounded-lg bg-[#090B0F] border border-white/10"
            role="img"
            aria-label="Projected fuel load and tyre wear curve across race laps"
          >
            {[25, 50, 75].map((pct) => {
              const y = padY + (1 - pct / 100) * plotH;
              return (
                <g key={pct}>
                  <line
                    x1={padX}
                    y1={y}
                    x2={chartW - padX}
                    y2={y}
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={4}
                    y={y + 3}
                    fill="rgba(148,163,184,0.75)"
                    fontSize="8"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Pit Lap Markers */}
            {normalized.stops.map((stop) => {
              const x =
                padX +
                (totalPts === 1
                  ? plotW
                  : ((stop.pitLap - 1) / Math.max(1, totalPts - 1)) * plotW);
              return (
                <g key={stop.id}>
                  <line
                    x1={x}
                    y1={padY}
                    x2={x}
                    y2={chartH - padY}
                    stroke="#FACC15"
                    strokeWidth="1.2"
                    strokeDasharray="3 2"
                  />
                  <text
                    x={x}
                    y={chartH - 2}
                    textAnchor="middle"
                    fill="#FACC15"
                    fontSize="8"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    PIT L{stop.pitLap}
                  </text>
                </g>
              );
            })}

            <polyline
              fill="none"
              stroke="#38BDF8"
              strokeWidth="2.2"
              strokeLinejoin="round"
              points={fuelPolyline}
            />
            <polyline
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeDasharray="5 2"
              points={wearPolyline}
            />
          </svg>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-sky-400 inline-block" />
                Fuel Load (%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-400 inline-block" />
                Tyre Health (%)
              </span>
            </div>
            <span className="font-mono-telemetry">L1 → L{normalized.totalLaps}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() =>
              setDraft(
                buildDefaultPitStrategy(normalized.totalLaps, weather, normalized.startingCompound)
              )
            }
            className="px-3.5 py-2 rounded-xl border border-white/15 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Optimal</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/15 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(normalized)}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-xs sm:text-sm cursor-pointer"
            >
              Save Strategy
            </button>
            <button
              type="button"
              onClick={() => onSaveAndStartRace(normalized)}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shadow-lg"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Save & Start Race</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
