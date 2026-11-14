import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Flame, Thermometer } from 'lucide-react';
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

export function TyreTemperatureOverlay({ hud, compound }: TyreTemperatureOverlayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [history, setHistory] = useState<TyreTempSample[]>([]);
  const [selectedTyre, setSelectedTyre] = useState<'FL' | 'FR' | 'RL' | 'RR'>('FL');

  // Optimal temperature window per compound (°C)
  const optimalRange = compound === 'soft' ? [85, 102] : compound === 'medium' ? [90, 108] : compound === 'hard' ? [95, 115] : [75, 95];

  // Collect rolling tyre temperature samples
  useEffect(() => {
    if (hud.countdownState !== 'racing') return;

    const now = performance.now();
    const baseTemp = hud.liveWeather === 'rain' ? 74 : 94;
    const speedFactor = (hud.speedKmh / 330) * 16;
    const slipHeat = Math.abs(hud.speedKmh * 0.05);

    const sample: TyreTempSample = {
      time: now,
      flSurface: Math.round(baseTemp + speedFactor + slipHeat + (selectedTyre === 'FL' ? 4 : 0)),
      flCarcass: Math.round(baseTemp + speedFactor * 0.8 + 8),
      frSurface: Math.round(baseTemp + speedFactor + slipHeat + (selectedTyre === 'FR' ? 4 : 0)),
      frCarcass: Math.round(baseTemp + speedFactor * 0.8 + 8),
      rlSurface: Math.round(baseTemp + speedFactor * 1.1 + slipHeat * 1.2),
      rlCarcass: Math.round(baseTemp + speedFactor * 0.9 + 12),
      rrSurface: Math.round(baseTemp + speedFactor * 1.1 + slipHeat * 1.2),
      rrCarcass: Math.round(baseTemp + speedFactor * 0.9 + 12),
    };

    setHistory((prev) => {
      const next = [...prev, sample];
      if (next.length > 100) return next.slice(next.length - 100);
      return next;
    });
  }, [hud.speedKmh, hud.countdownState, hud.liveWeather, selectedTyre]);

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
    const xMax = history[history.length - 1]?.time ?? (xMin + 1);

    const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([60, 140]).range([innerHeight, 0]);

    // Optimal Temperature Zone Band
    g.append('rect')
      .attr('x', 0)
      .attr('y', yScale(optimalRange[1]))
      .attr('width', innerWidth)
      .attr('height', yScale(optimalRange[0]) - yScale(optimalRange[1]))
      .attr('fill', 'rgba(16, 185, 129, 0.12)')
      .attr('stroke', 'rgba(16, 185, 129, 0.3)')
      .attr('stroke-dasharray', '3 3');

    // Grid lines
    g.selectAll('.grid')
      .data([70, 90, 110, 130])
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
      .data([70, 100, 130])
      .enter()
      .append('text')
      .attr('x', -8)
      .attr('y', (d) => yScale(d) + 3)
      .attr('fill', '#94A3B8')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text((d) => `${d}°C`);

    const getSurfaceKey = () => (selectedTyre === 'FL' ? 'flSurface' : selectedTyre === 'FR' ? 'frSurface' : selectedTyre === 'RL' ? 'rlSurface' : 'rrSurface');
    const getCarcassKey = () => (selectedTyre === 'FL' ? 'flCarcass' : selectedTyre === 'FR' ? 'frCarcass' : selectedTyre === 'RL' ? 'rlCarcass' : 'rrCarcass');

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

    // Carcass Temperature Path (Amber/Orange)
    g.append('path')
      .datum(history)
      .attr('fill', 'none')
      .attr('stroke', '#F59E0B')
      .attr('stroke-width', '2.2')
      .attr('d', carcassLine);

  }, [history, selectedTyre, optimalRange]);

  const latest = history[history.length - 1] ?? {
    flSurface: 90,
    flCarcass: 98,
    frSurface: 90,
    frCarcass: 98,
    rlSurface: 92,
    rlCarcass: 102,
    rrSurface: 92,
    rrCarcass: 102,
  };

  const currentSurf = selectedTyre === 'FL' ? latest.flSurface : selectedTyre === 'FR' ? latest.frSurface : selectedTyre === 'RL' ? latest.rlSurface : latest.rrSurface;
  const currentCarc = selectedTyre === 'FL' ? latest.flCarcass : selectedTyre === 'FR' ? latest.frCarcass : selectedTyre === 'RL' ? latest.rlCarcass : latest.rrCarcass;

  const getStatusText = (temp: number) => {
    if (temp < optimalRange[0]) return { text: 'UNDER-HEATING', color: 'text-cyan-400 bg-cyan-500/20 border-cyan-400/40' };
    if (temp > optimalRange[1]) return { text: 'OVERHEATING', color: 'text-red-400 bg-red-500/20 border-red-400/40' };
    return { text: 'OPTIMAL WINDOW', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-400/40' };
  };

  const status = getStatusText(currentSurf);

  return (
    <div className="flex flex-col gap-3">
      {/* Tyre Selector Tabs */}
      <div className="grid grid-cols-4 gap-2">
        {(['FL', 'FR', 'RL', 'RR'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSelectedTyre(t)}
            className={`py-1.5 rounded-xl border text-xs font-display font-bold uppercase transition-all cursor-pointer ${
              selectedTyre === t
                ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-lg'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            }`}
          >
            {t === 'FL' ? 'Front Left' : t === 'FR' ? 'Front Right' : t === 'RL' ? 'Rear Left' : 'Rear Right'}
          </button>
        ))}
      </div>

      {/* Live Temperature Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center">
          <span className="text-[10px] font-mono-telemetry text-sky-400 uppercase font-bold">Surface Temp</span>
          <span className="font-display font-black text-2xl text-white">{currentSurf}°C</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center">
          <span className="text-[10px] font-mono-telemetry text-amber-400 uppercase font-bold">Carcass Temp</span>
          <span className="font-display font-black text-2xl text-white">{currentCarc}°C</span>
        </div>
        <div className={`border rounded-xl p-3 flex flex-col items-center justify-center ${status.color}`}>
          <span className="text-[9px] font-mono-telemetry font-bold uppercase tracking-wider text-center">
            {status.text}
          </span>
        </div>
      </div>

      {/* D3 Temperature Graph */}
      <div className="bg-black/60 border border-white/10 rounded-xl p-3 flex flex-col items-center">
        <div className="w-full flex items-center justify-between text-[11px] font-mono-telemetry text-slate-400 mb-2 px-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> Surface Temp (°C)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Carcass Temp (°C)
          </span>
        </div>
        <svg ref={svgRef} viewBox="0 0 420 150" className="w-full h-auto overflow-visible" />
      </div>
    </div>
  );
}
