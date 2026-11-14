import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Activity, Flame, Gauge, TrendingUp, X } from 'lucide-react';
import { HudTelemetry, TyreCompound } from '../types/racing';
import { TyreTemperatureOverlay } from './TyreTemperatureOverlay';

interface TelemetryOverlayProps {
  hud: HudTelemetry;
  isOpen: boolean;
  onClose: () => void;
  compound?: TyreCompound;
}

interface TelemetrySample {
  time: number;
  throttle: number;
  brake: number;
  speed: number;
}

export function TelemetryOverlay({ hud, isOpen, onClose, compound = 'soft' }: TelemetryOverlayProps) {
  const [activeTab, setActiveTab] = useState<'pedals' | 'tyres'>('pedals');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [history, setHistory] = useState<TelemetrySample[]>([]);

  // Collect rolling telemetry samples
  useEffect(() => {
    if (!isOpen || hud.countdownState !== 'racing') return;

    const now = performance.now();
    const throttleVal = hud.rpm > 1000 ? Math.min(100, Math.max(0, (hud.rpm / hud.maxRpm) * 100)) : 0;
    const brakeVal = hud.drsActive ? 0 : hud.speedKmh < 150 && hud.gear <= 3 ? 65 : 0;

    setHistory((prev) => {
      const next = [...prev, { time: now, throttle: throttleVal, brake: brakeVal, speed: hud.speedKmh }];
      if (next.length > 120) {
        return next.slice(next.length - 120);
      }
      return next;
    });
  }, [hud.rpm, hud.speedKmh, hud.gear, hud.drsActive, isOpen, hud.countdownState]);

  // Render D3 Line Chart for Pedals
  useEffect(() => {
    if (!isOpen || activeTab !== 'pedals' || !svgRef.current || history.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 420;
    const height = 180;
    const margin = { top: 15, right: 20, bottom: 25, left: 35 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xMin = history[0]?.time ?? 0;
    const xMax = history[history.length - 1]?.time ?? (xMin + 1);

    const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data([0, 25, 50, 75, 100])
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
      .data([0, 50, 100])
      .enter()
      .append('text')
      .attr('x', -8)
      .attr('y', (d) => yScale(d) + 3)
      .attr('fill', '#94A3B8')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text((d) => `${d}%`);

    const throttleLine = d3
      .line<TelemetrySample>()
      .x((d) => xScale(d.time))
      .y((d) => yScale(d.throttle))
      .curve(d3.curveMonotoneX);

    const brakeLine = d3
      .line<TelemetrySample>()
      .x((d) => xScale(d.time))
      .y((d) => yScale(d.brake))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(history)
      .attr('fill', 'none')
      .attr('stroke', '#10B981')
      .attr('stroke-width', '2.2')
      .attr('d', throttleLine);

    g.append('path')
      .datum(history)
      .attr('fill', 'none')
      .attr('stroke', '#EF4444')
      .attr('stroke-width', '2.2')
      .attr('d', brakeLine);

  }, [history, isOpen, activeTab]);

  if (!isOpen) return null;

  const latest = history[history.length - 1] ?? { throttle: 0, brake: 0, speed: hud.speedKmh };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-hud-banner-pop">
      <div className="pointer-events-auto w-full max-w-lg bg-slate-950/95 backdrop-blur-2xl border border-sky-500/40 rounded-2xl p-5 shadow-2xl text-slate-100 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wider font-display uppercase text-white">
                Live Telemetry & Driving Coach
              </div>
              <div className="text-xs text-slate-400">Real-time D3 line chart analysis of driver inputs</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('pedals')}
            className={`py-2 rounded-lg text-xs font-display font-bold uppercase transition-all cursor-pointer ${
              activeTab === 'pedals' ? 'bg-sky-500 text-slate-950 shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            Pedal Inputs & Speed
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tyres')}
            className={`py-2 rounded-lg text-xs font-display font-bold uppercase transition-all cursor-pointer ${
              activeTab === 'tyres' ? 'bg-sky-500 text-slate-950 shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            Tyre Temperatures
          </button>
        </div>

        {activeTab === 'pedals' ? (
          <>
            {/* Live Input Readouts */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center">
                <span className="text-[10px] font-mono-telemetry text-emerald-400 uppercase font-bold">Throttle</span>
                <span className="font-display font-black text-2xl text-white">{Math.round(latest.throttle)}%</span>
                <div className="w-full bg-black/40 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-75" style={{ width: `${latest.throttle}%` }} />
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center">
                <span className="text-[10px] font-mono-telemetry text-red-400 uppercase font-bold">Brake Pressure</span>
                <span className="font-display font-black text-2xl text-white">{Math.round(latest.brake)}%</span>
                <div className="w-full bg-black/40 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-red-500 h-full transition-all duration-75" style={{ width: `${latest.brake}%` }} />
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center">
                <span className="text-[10px] font-mono-telemetry text-cyan-400 uppercase font-bold">Speed</span>
                <span className="font-display font-black text-2xl text-white">{Math.round(latest.speed)}</span>
                <span className="text-[9px] text-slate-400 font-mono">KPH</span>
              </div>
            </div>

            {/* D3 Line Chart Container */}
            <div className="bg-black/60 border border-white/10 rounded-xl p-3 flex flex-col items-center">
              <div className="w-full flex items-center justify-between text-[11px] font-mono-telemetry text-slate-400 mb-2 px-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Throttle Input
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Brake Pressure
                </span>
              </div>
              <svg ref={svgRef} viewBox="0 0 420 180" className="w-full h-auto overflow-visible" />
            </div>

            {/* Footer Advice */}
            <div className="flex items-center gap-2.5 bg-sky-500/10 border border-sky-400/30 rounded-xl p-3 text-xs text-sky-200">
              <TrendingUp className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                {latest.brake > 50
                  ? 'Trail braking detected. Smooth release into apex.'
                  : latest.throttle > 80
                    ? 'Maximum traction deployment. Excellent corner exit.'
                    : 'Maintain smooth pedal modulation for optimal tyre life.'}
              </span>
            </div>
          </>
        ) : (
          <TyreTemperatureOverlay hud={hud} compound={compound} />
        )}
      </div>
    </div>
  );
}
