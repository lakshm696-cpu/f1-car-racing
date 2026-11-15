import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { HudTelemetry, TyreCompound } from '../types/racing';

interface TyreTemperatureOverlayProps {
  hud: HudTelemetry;
  compound: TyreCompound;
}

interface TyreTempSample {
  time: number;
  flSurface: number;
  flCarcass: number;
  frSurface: number;
  frCarcass: number;
  rlSurface: number;
  rlCarcass: number;
  rrSurface: number;
  rrCarcass: number;
}

export interface CompoundTempWindow {
  surfMin: number;
  surfMax: number;
  coreMin: number;
  coreMax: number;
}

export interface TyreTempColorMeta {
  state: 'cold' | 'warming' | 'optimal' | 'warm' | 'overheating';
  label: string;
  shortLabel: string;
  hex: string;
  bgTint: string;
  borderHex: string;
  textClass: string;
  badgeClass: string;
}

export function getTyreCompoundTempWindow(compound: TyreCompound): CompoundTempWindow {
  switch (compound) {
    case 'soft':
      return { surfMin: 85, surfMax: 104, coreMin: 88, coreMax: 106 };
    case 'medium':
      return { surfMin: 90, surfMax: 110, coreMin: 93, coreMax: 112 };
    case 'hard':
      return { surfMin: 96, surfMax: 116, coreMin: 98, coreMax: 118 };
    case 'wet':
      return { surfMin: 58, surfMax: 84, coreMin: 60, coreMax: 86 };
  }
}

export function getTyreTempColorMeta(
  tempC: number,
  compound: TyreCompound,
  zone: 'surface' | 'core' = 'surface'
): TyreTempColorMeta {
  const win = getTyreCompoundTempWindow(compound);
  const min = zone === 'surface' ? win.surfMin : win.coreMin;
  const max = zone === 'surface' ? win.surfMax : win.coreMax;

  if (tempC < min - 5) {
    return {
      state: 'cold',
      label: 'UNDER-HEATING',
      shortLabel: 'COLD',
      hex: '#38BDF8',
      bgTint: 'rgba(56, 189, 248, 0.22)',
      borderHex: 'rgba(56, 189, 248, 0.65)',
      textClass: 'text-sky-300',
      badgeClass: 'text-sky-300 bg-sky-500/20 border-sky-400/50',
    };
  }
  if (tempC < min) {
    return {
      state: 'warming',
      label: 'WARMING UP',
      shortLabel: 'COOL',
      hex: '#22D3EE',
      bgTint: 'rgba(34, 211, 238, 0.20)',
      borderHex: 'rgba(34, 211, 238, 0.60)',
      textClass: 'text-cyan-300',
      badgeClass: 'text-cyan-300 bg-cyan-500/20 border-cyan-400/50',
    };
  }
  if (tempC <= max) {
    return {
      state: 'optimal',
      label: 'OPTIMAL WINDOW',
      shortLabel: 'OPT',
      hex: '#10B981',
      bgTint: 'rgba(16, 185, 129, 0.25)',
      borderHex: 'rgba(16, 185, 129, 0.72)',
      textClass: 'text-emerald-300',
      badgeClass: 'text-emerald-300 bg-emerald-500/20 border-emerald-400/50',
    };
  }
  if (tempC <= max + 6) {
    return {
      state: 'warm',
      label: 'THERMAL WARN',
      shortLabel: 'WARM',
      hex: '#FACC15',
      bgTint: 'rgba(250, 204, 21, 0.24)',
      borderHex: 'rgba(250, 204, 21, 0.70)',
      textClass: 'text-amber-300',
      badgeClass: 'text-amber-300 bg-amber-500/20 border-amber-400/50',
    };
  }
  return {
    state: 'overheating',
    label: 'OVERHEATING',
    shortLabel: 'HOT',
    hex: '#EF4444',
    bgTint: 'rgba(239, 68, 68, 0.28)',
    borderHex: 'rgba(239, 68, 68, 0.78)',
    textClass: 'text-red-400',
    badgeClass: 'text-red-300 bg-red-500/20 border-red-400/55',
  };
}

export function TyreTemperatureOverlay({ hud, compound }: TyreTemperatureOverlayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [history, setHistory] = useState<TyreTempSample[]>([]);
  const [selectedTyre, setSelectedTyre] = useState<'FL' | 'FR' | 'RL' | 'RR'>('FL');

  const tempWin = getTyreCompoundTempWindow(compound);
  const optimalRange: [number, number] = [tempWin.surfMin, tempWin.surfMax];

  // Collect rolling tyre temperature samples from live contact patch telemetry
  useEffect(() => {
    if (hud.countdownState !== 'racing') return;

    const now = performance.now();
    const baseTemp = hud.liveWeather === 'rain' || hud.liveWeather === 'heavy_rain' ? 70 : 92;
    const speedFactor = (hud.speedKmh / 330) * 16;
    const slipHeat = Math.abs(hud.speedKmh * 0.05);
    const cpSurfTemps = hud.tyreContactPatch?.wheelSurfaceTempC;
    const cpCoreTemps = hud.tyreContactPatch?.wheelCoreTempC;

    const flSurf = cpSurfTemps ? cpSurfTemps[0] : Math.round(baseTemp + speedFactor + slipHeat);
    const frSurf = cpSurfTemps ? cpSurfTemps[1] : Math.round(baseTemp + speedFactor + slipHeat);
    const rlSurf = cpSurfTemps ? cpSurfTemps[2] : Math.round(baseTemp + speedFactor * 1.1 + slipHeat * 1.2);
    const rrSurf = cpSurfTemps ? cpSurfTemps[3] : Math.round(baseTemp + speedFactor * 1.1 + slipHeat * 1.2);

    const sample: TyreTempSample = {
      time: now,
      flSurface: flSurf,
      flCarcass: cpCoreTemps ? cpCoreTemps[0] : Math.round(flSurf * 0.85 + 16),
      frSurface: frSurf,
      frCarcass: cpCoreTemps ? cpCoreTemps[1] : Math.round(frSurf * 0.85 + 16),
      rlSurface: rlSurf,
      rlCarcass: cpCoreTemps ? cpCoreTemps[2] : Math.round(rlSurf * 0.85 + 17),
      rrSurface: rrSurf,
      rrCarcass: cpCoreTemps ? cpCoreTemps[3] : Math.round(rrSurf * 0.85 + 17),
    };

    setHistory((prev) => {
      const next = [...prev, sample];
      if (next.length > 100) return next.slice(next.length - 100);
      return next;
    });
  }, [
    hud.speedKmh,
    hud.countdownState,
    hud.liveWeather,
    hud.tyreContactPatch?.wheelSurfaceTempC,
    hud.tyreContactPatch?.wheelCoreTempC,
    selectedTyre,
  ]);

  // Render D3 Tyre Temperature Line Chart
  useEffect(() => {
    if (!svgRef.current || history.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 420;
    const height = 150;
    const margin = { top: 15, right: 20, bottom: 25, left: 38 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xMin = history[0]?.time ?? 0;
    const xMax = history[history.length - 1]?.time ?? xMin + 1;

    const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([50, 140]).range([innerHeight, 0]);

    // Optimal Temperature Zone Band
    g.append('rect')
      .attr('x', 0)
      .attr('y', yScale(optimalRange[1]))
      .attr('width', innerWidth)
      .attr('height', Math.max(2, yScale(optimalRange[0]) - yScale(optimalRange[1])))
      .attr('fill', 'rgba(16, 185, 129, 0.14)')
      .attr('stroke', 'rgba(16, 185, 129, 0.35)')
      .attr('stroke-dasharray', '3 3');

    // Grid lines
    g.selectAll('.grid')
      .data([65, 90, 115, 135])
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', 'rgba(255, 255, 255, 0.08)')
      .attr('stroke-dasharray', '2 2');

    // Y-Axis labels
    g.selectAll('.y-label')
      .data([65, 95, 125])
      .enter()
      .append('text')
      .attr('x', -8)
      .attr('y', (d) => yScale(d) + 3)
      .attr('fill', '#94A3B8')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text((d) => `${d}°C`);

    const getSurfaceKey = () =>
      selectedTyre === 'FL'
        ? 'flSurface'
        : selectedTyre === 'FR'
          ? 'frSurface'
          : selectedTyre === 'RL'
            ? 'rlSurface'
            : 'rrSurface';
    const getCarcassKey = () =>
      selectedTyre === 'FL'
        ? 'flCarcass'
        : selectedTyre === 'FR'
          ? 'frCarcass'
          : selectedTyre === 'RL'
            ? 'rlCarcass'
            : 'rrCarcass';

    const surfaceLine = d3
      .line<TyreTempSample>()
      .x((d) => xScale(d.time))
      .y((d) => yScale(d[getSurfaceKey() as keyof TyreTempSample] as number))
      .curve(d3.curveMonotoneX);

    const carcassLine = d3
      .line<TyreTempSample>()
      .x((d) => xScale(d.time))
      .y((d) => yScale(d[getCarcassKey() as keyof TyreTempSample] as number))
      .curve(d3.curveMonotoneX);

    // Surface Temperature Path (Cyan)
    g.append('path')
      .datum(history)
      .attr('fill', 'none')
      .attr('stroke', '#38BDF8')
      .attr('stroke-width', '2.2')
      .attr('d', surfaceLine);

    // Carcass/Core Temperature Path (Amber/Orange)
    g.append('path')
      .datum(history)
      .attr('fill', 'none')
      .attr('stroke', '#F59E0B')
      .attr('stroke-width', '2.2')
      .attr('d', carcassLine);
  }, [history, selectedTyre, optimalRange]);

  const cpSurf = hud.tyreContactPatch?.wheelSurfaceTempC;
  const cpCore = hud.tyreContactPatch?.wheelCoreTempC;
  const latest = history[history.length - 1] ?? {
    flSurface: cpSurf?.[0] ?? 91,
    flCarcass: cpCore?.[0] ?? 95,
    frSurface: cpSurf?.[1] ?? 91,
    frCarcass: cpCore?.[1] ?? 95,
    rlSurface: cpSurf?.[2] ?? 93,
    rlCarcass: cpCore?.[2] ?? 97,
    rrSurface: cpSurf?.[3] ?? 93,
    rrCarcass: cpCore?.[3] ?? 97,
  };

  const wheelData = [
    { id: 'FL' as const, name: 'Front Left', surf: cpSurf?.[0] ?? latest.flSurface, core: cpCore?.[0] ?? latest.flCarcass },
    { id: 'FR' as const, name: 'Front Right', surf: cpSurf?.[1] ?? latest.frSurface, core: cpCore?.[1] ?? latest.frCarcass },
    { id: 'RL' as const, name: 'Rear Left', surf: cpSurf?.[2] ?? latest.rlSurface, core: cpCore?.[2] ?? latest.rlCarcass },
    { id: 'RR' as const, name: 'Rear Right', surf: cpSurf?.[3] ?? latest.rrSurface, core: cpCore?.[3] ?? latest.rrCarcass },
  ];

  const activeWheel = wheelData.find((w) => w.id === selectedTyre) ?? wheelData[0];
  const currentSurf = activeWheel.surf;
  const currentCarc = activeWheel.core;
  const wheelIdx = selectedTyre === 'FL' ? 0 : selectedTyre === 'FR' ? 1 : selectedTyre === 'RL' ? 2 : 3;
  const wheelSlipPct = hud.tyreContactPatch?.wheelMicroSlipPct?.[wheelIdx] ?? hud.tyreContactPatch?.microSlipPct ?? 6;
  const grainProbPct = hud.tyreContactPatch?.grainingProbabilityPct ?? 8;
  const grainSeverityPct = hud.tyreContactPatch?.grainingSeverityPct ?? 0;
  const patchCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render Procedural Contact Patch Graining & Blistering Shader Texture Preview
  useEffect(() => {
    const canvas = patchCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    const grainNorm = Math.max(0, Math.min(1, grainSeverityPct / 100));
    const slipNorm = Math.max(0, Math.min(1, wheelSlipPct / 100));
    const blisterNorm = Math.max(
      0,
      Math.min(1, Math.max((currentSurf - optimalRange[1]) / 24, (grainNorm - 0.32) * 0.85))
    );
    const phase = (performance.now() * 0.0025) % 100;

    const hash2 = (x: number, y: number) => {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };

    for (let py = 0; py < h; py++) {
      const v = py / h;
      const ny = (v - 0.5) * 2.0;
      for (let px = 0; px < w; px++) {
        const u = px / w;
        const nx = (u - 0.5) * 2.0;
        const idx = (py * w + px) * 4;

        // Contact patch rounded footprint mask
        const dx = Math.max(Math.abs(nx) - 0.68, 0);
        const dy = Math.max(Math.abs(ny) - 0.56, 0);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.28) {
          data[idx] = 9;
          data[idx + 1] = 12;
          data[idx + 2] = 18;
          data[idx + 3] = 255;
          continue;
        }

        // Base rubber compound & trailing micro-slip shear zone
        const transitionU = Math.max(0.15, Math.min(0.88, 1.0 - slipNorm * 0.85));
        const inSlipZone = u > transitionU ? Math.min(1, (u - transitionU) / 0.22) : 0;

        // Diagonal rubber graining waves & torn ribbons synced with grainingSeverityPct
        const waveArg = (u * 26 - phase) + v * 18 + Math.sin(v * 9 + u * 12) * 1.4;
        const grainWave = 0.5 + 0.5 * Math.sin(waveArg);
        const cellNoise = hash2(Math.floor(u * 28), Math.floor(v * 16));
        const ribbonTear = Math.max(0, grainWave * 0.72 + cellNoise * 0.28 - 0.35) * grainNorm * 1.45;

        // Cellular blistering pits from overheating & severe graining
        const bx = (u * 9 + phase * 0.15) % 1;
        const by = (v * 5) % 1;
        const cellSeed = hash2(Math.floor(u * 9 + phase * 0.15), Math.floor(v * 5));
        const bDist = Math.hypot(bx - 0.5, by - 0.5);
        const isBlisterCore = cellSeed < blisterNorm * 0.78 && bDist < 0.22 * (0.5 + blisterNorm * 0.5);
        const isBlisterRim =
          !isBlisterCore &&
          cellSeed < blisterNorm * 0.78 &&
          bDist < 0.34 * (0.5 + blisterNorm * 0.5);

        let r = 24 + inSlipZone * 38 + ribbonTear * 88;
        let g = 32 + (1 - inSlipZone) * 24 + ribbonTear * 74;
        let b = 40 + (1 - inSlipZone) * 18 + ribbonTear * 66;

        if (isBlisterRim) {
          r = 165 + blisterNorm * 70;
          g = 78 + blisterNorm * 30;
          b = 36;
        } else if (isBlisterCore) {
          r = 14;
          g = 12;
          b = 15;
        }

        const edgeFade = Math.max(0.25, 1.0 - dist / 0.28);
        data[idx] = Math.min(255, Math.round(r * edgeFade));
        data[idx + 1] = Math.min(255, Math.round(g * edgeFade));
        data[idx + 2] = Math.min(255, Math.round(b * edgeFade));
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [grainSeverityPct, wheelSlipPct, currentSurf, optimalRange]);

  const surfMeta = getTyreTempColorMeta(currentSurf, compound, 'surface');
  const coreMeta = getTyreTempColorMeta(currentCarc, compound, 'core');

  return (
    <div className="flex flex-col gap-3">
      {/* 4-Tire Real-Time Core & Surface Selector Cards */}
      <div className="grid grid-cols-4 gap-2">
        {wheelData.map((w) => {
          const wSurfMeta = getTyreTempColorMeta(w.surf, compound, 'surface');
          const wCoreMeta = getTyreTempColorMeta(w.core, compound, 'core');
          const isSelected = selectedTyre === w.id;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => setSelectedTyre(w.id)}
              className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                isSelected
                  ? 'bg-sky-500/20 border-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.28)]'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-display font-black text-white">{w.id}</span>
                <span
                  className="text-[8px] font-mono-telemetry font-bold px-1 rounded border"
                  style={{
                    color: wSurfMeta.hex,
                    borderColor: wSurfMeta.borderHex,
                    backgroundColor: wSurfMeta.bgTint,
                  }}
                >
                  {wSurfMeta.shortLabel}
                </span>
              </div>
              <div className="flex items-center justify-between text-[9px] font-mono-telemetry tabular-nums">
                <span className="text-slate-400">SURF</span>
                <span className={`font-bold ${wSurfMeta.textClass}`}>{w.surf}°C</span>
              </div>
              <div className="flex items-center justify-between text-[9px] font-mono-telemetry tabular-nums">
                <span className="text-slate-400">CORE</span>
                <span className={`font-bold ${wCoreMeta.textClass}`}>{w.core}°C</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Selected Tire Surface & Core Temperature Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className="border rounded-xl p-2.5 flex flex-col items-center justify-center"
          style={{
            backgroundColor: surfMeta.bgTint,
            borderColor: surfMeta.borderHex,
          }}
        >
          <span className="text-[9px] font-mono-telemetry text-slate-200 uppercase font-bold">
            {selectedTyre} Surface Temp
          </span>
          <span className={`font-display font-black text-2xl tabular-nums ${surfMeta.textClass}`}>
            {currentSurf}°C
          </span>
          <span className="text-[8px] font-mono-telemetry text-slate-300">
            OPT {tempWin.surfMin}–{tempWin.surfMax}°C
          </span>
        </div>
        <div
          className="border rounded-xl p-2.5 flex flex-col items-center justify-center"
          style={{
            backgroundColor: coreMeta.bgTint,
            borderColor: coreMeta.borderHex,
          }}
        >
          <span className="text-[9px] font-mono-telemetry text-slate-200 uppercase font-bold">
            {selectedTyre} Core Temp
          </span>
          <span className={`font-display font-black text-2xl tabular-nums ${coreMeta.textClass}`}>
            {currentCarc}°C
          </span>
          <span className="text-[8px] font-mono-telemetry text-slate-300">
            OPT {tempWin.coreMin}–{tempWin.coreMax}°C
          </span>
        </div>
        <div className={`border rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 ${surfMeta.badgeClass}`}>
          <span className="text-[9px] font-mono-telemetry font-bold uppercase tracking-wider text-center">
            {surfMeta.label}
          </span>
          <span className="text-[8px] font-mono-telemetry text-white/80 tabular-nums">
            ΔCORE {currentSurf - currentCarc >= 0 ? `+${currentSurf - currentCarc}` : currentSurf - currentCarc}°C
          </span>
        </div>
      </div>

      {/* Microscopic Contact Patch Readout Strip */}
      <div className="grid grid-cols-4 gap-2 text-[10px] font-mono-telemetry tabular-nums">
        <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 flex items-center justify-between">
          <span className="text-slate-400">TRK TEMP</span>
          <span className="text-amber-300 font-bold">{hud.trackTemperature ?? 34}°C</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 flex items-center justify-between">
          <span className="text-slate-400">{selectedTyre} SLIP</span>
          <span className="text-cyan-300 font-bold">{wheelSlipPct}%</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 flex items-center justify-between">
          <span className="text-slate-400">GRAIN PROB</span>
          <span className={grainProbPct > 45 ? 'text-amber-400 font-bold' : 'text-emerald-300 font-bold'}>
            {grainProbPct}%
          </span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 flex items-center justify-between">
          <span className="text-slate-400">GRAIN SEV</span>
          <span className={grainSeverityPct > 35 ? 'text-red-400 font-bold' : 'text-sky-300 font-bold'}>
            {grainSeverityPct}%
          </span>
        </div>
      </div>

      {/* Procedural Dynamic Tyre Contact Patch Graining & Blistering Texture Preview */}
      <div className="bg-black/60 border border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5 text-[10px] font-mono-telemetry">
          <span className="text-white font-display font-bold uppercase tracking-wider">
            Contact Patch Shader ({selectedTyre})
          </span>
          <span className="text-slate-400">
            Graining Ribbons: <strong className="text-amber-300 tabular-nums">{grainSeverityPct}%</strong> · Micro-Slip:{' '}
            <strong className="text-cyan-300 tabular-nums">{wheelSlipPct}%</strong>
          </span>
        </div>
        <canvas
          ref={patchCanvasRef}
          width={140}
          height={44}
          className="rounded-lg border border-white/15 shrink-0"
        />
      </div>

      {/* D3 Temperature Graph */}
      <div className="bg-black/60 border border-white/10 rounded-xl p-3 flex flex-col items-center">
        <div className="w-full flex items-center justify-between text-[11px] font-mono-telemetry text-slate-400 mb-2 px-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> Surface Temp (°C)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Core / Carcass Temp (°C)
          </span>
        </div>
        <svg ref={svgRef} viewBox="0 0 420 150" className="w-full h-auto overflow-visible" />
      </div>
    </div>
  );
}
