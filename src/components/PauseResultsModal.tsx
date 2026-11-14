import React, { useState } from 'react';
import { Flag, Home, Play, RotateCcw, Trophy } from 'lucide-react';
import {
  AdaptiveTriggersLevel,
  BrakingAssistLevel,
  CameraMode,
  CarDamageMode,
  DifficultyLevel,
  GameSettings,
  GraphicsQuality,
  HapticFeedbackLevel,
  HdrOutputMode,
  Ps5GraphicsMode,
  RacerStanding,
  RacingLineMode,
  RayTracingQuality,
  TractionControlMode,
  TransmissionMode,
} from '../types/racing';
import { formatLapTime } from './RacingHUD';

interface PauseModalProps {
  mode: 'pause' | 'settings';
  settings: GameSettings;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onResume: () => void;
  onRestart: () => void;
  onExitToTitle: () => void;
}

type SettingsTab = 'all' | 'graphics' | 'assists' | 'camera' | 'dualsense';

export const PauseSettingsModal: React.FC<PauseModalProps> = ({
  mode,
  settings,
  onUpdateSettings,
  onResume,
  onRestart,
  onExitToTitle,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('all');

  const ps5Mode = settings.ps5GraphicsMode ?? 'rt_pro';
  const rtQuality = settings.rayTracingQuality ?? 'ultra';
  const pssrOn = settings.pssrUpscaling !== false;
  const hdrMode = settings.hdrMode ?? 'hdr10';
  const brakingAssist = settings.brakingAssist ?? 'low';
  const tcMode = settings.tractionControlMode ?? (settings.tcAssist ? 'full' : 'off');
  const racingLine = settings.racingLine ?? 'corners';
  const carDamage = settings.carDamageMode ?? 'reduced';
  const aiRating =
    settings.aiDifficultyRating ??
    (settings.difficulty === 'legend' ? 102 : settings.difficulty === 'pro' ? 85 : 55);
  const adaptiveTriggers = settings.adaptiveTriggers ?? 'strong';
  const hapticFeedback = settings.hapticFeedback ?? 'full';
  const tempestAudio = settings.tempest3dAudio !== false;
  const fovOffset = settings.fovOffset ?? 0;
  const cameraShake = settings.cameraShakeScale ?? 100;
  const lookToApex = settings.lookToApex !== false;

  const showGraphics = activeTab === 'all' || activeTab === 'graphics';
  const showAssists = activeTab === 'all' || activeTab === 'assists';
  const showCamera = activeTab === 'all' || activeTab === 'camera';
  const showDualsense = activeTab === 'all' || activeTab === 'dualsense';

  const applyPs5Preset = (preset: 'rt_pro' | 'perf_120' | 'sim_pro' | 'broadcast') => {
    if (preset === 'rt_pro') {
      onUpdateSettings({
        ps5GraphicsMode: 'rt_pro',
        graphicsQuality: 'ultra',
        rayTracingQuality: 'ultra',
        pssrUpscaling: true,
        hdrMode: 'hdr10',
        targetFps: 60,
        motionBlur: true,
      });
    } else if (preset === 'perf_120') {
      onUpdateSettings({
        ps5GraphicsMode: 'performance',
        graphicsQuality: 'high',
        rayTracingQuality: 'medium',
        pssrUpscaling: true,
        hdrMode: 'hdr10',
        targetFps: 120,
        motionBlur: false,
      });
    } else if (preset === 'sim_pro') {
      onUpdateSettings({
        transmission: 'manual',
        steeringAssist: false,
        brakingAssist: 'off',
        absAssist: false,
        tcAssist: false,
        tractionControlMode: 'off',
        racingLine: 'off',
        ersAssist: false,
        drsAssist: false,
        carDamageMode: 'simulation',
        difficulty: 'legend',
        aiDifficultyRating: 105,
      });
    } else if (preset === 'broadcast') {
      onUpdateSettings({
        transmission: 'auto',
        steeringAssist: false,
        brakingAssist: 'low',
        absAssist: true,
        tcAssist: true,
        tractionControlMode: 'full',
        racingLine: 'corners',
        ersAssist: true,
        drsAssist: true,
        carDamageMode: 'reduced',
        difficulty: 'pro',
        aiDifficultyRating: 85,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-3 sm:p-4"
      style={{ backgroundColor: 'rgba(6, 8, 12, 0.82)' }}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/15 p-4 sm:p-6 flex flex-col gap-4"
        style={{ backgroundColor: '#10141C' }}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white">
                {mode === 'pause' ? 'Race Paused · PS5™ F1 Settings' : 'PS5™ F1 25 Game Settings'}
              </h2>
              <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-[10px] font-mono font-bold text-sky-300">
                PS5™ PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Complete PlayStation 5 F1 25 Graphics, Ray Tracing, Simulation Assists, Camera & DualSense™ Suite
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {mode === 'pause' ? 'Esc to Resume' : 'Live Configuration'}
          </span>
        </div>

        {/* Category Filter Tabs + Quick PS5 Presets */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5 bg-white/5 p-1 rounded-xl">
            {(
              [
                ['all', 'All PS5 Settings'],
                ['graphics', 'Graphics & RT'],
                ['assists', 'Assists & Sim'],
                ['camera', 'Camera & FOV'],
                ['dualsense', 'DualSense & 3D Audio'],
              ] as [SettingsTab, string][]
            ).map(([tabId, label]) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveTab(tabId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  activeTab === tabId
                    ? 'bg-red-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              PS5™ Quick Presets:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyPs5Preset('rt_pro')}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-sky-500/20 border border-sky-400/40 text-sky-200 hover:bg-sky-500/30 cursor-pointer"
              >
                PS5 Pro 4K Ray Tracing
              </button>
              <button
                type="button"
                onClick={() => applyPs5Preset('perf_120')}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white/5 border border-white/15 text-slate-200 hover:bg-white/10 cursor-pointer"
              >
                PS5 120Hz Performance
              </button>
              <button
                type="button"
                onClick={() => applyPs5Preset('broadcast')}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30 cursor-pointer"
              >
                Standard F1 Assists
              </button>
              <button
                type="button"
                onClick={() => applyPs5Preset('sim_pro')}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30 cursor-pointer"
              >
                Esports Pro (No Assists)
              </button>
            </div>
          </div>
        </div>

        {/* Settings Controls */}
        <div className="flex flex-col gap-4">
          {showGraphics && (
            <div className="flex flex-col gap-3.5 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <div className="text-xs font-bold uppercase tracking-wider text-sky-400">
                1. PS5™ Graphics & Ray Tracing Settings
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">PS5™ Graphics Mode</div>
                  <div className="text-xs text-slate-400">Quality (4K/60), Performance (120Hz), RT Pro or Cinematic Max</div>
                </div>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                  {(
                    [
                      ['quality', '4K'],
                      ['performance', '120Hz'],
                      ['rt_pro', 'RT Pro'],
                      ['cinematic', 'Cinematic'],
                    ] as [Ps5GraphicsMode, string][]
                  ).map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          ps5GraphicsMode: m,
                          targetFps: m === 'performance' ? 120 : 60,
                          graphicsQuality: m === 'performance' ? 'high' : m === 'cinematic' ? 'cinematic' : 'ultra',
                          rayTracingQuality: m === 'performance' ? 'medium' : m === 'cinematic' ? 'cinematic' : 'ultra',
                        })
                      }
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                        ps5Mode === m ? 'bg-sky-400 text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Graphics Quality Preset</div>
                  <div className="text-xs text-slate-400">Shadows, resolution scale & post-processing</div>
                </div>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                  {(['low', 'medium', 'high', 'ultra', 'cinematic'] as GraphicsQuality[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => onUpdateSettings({ graphicsQuality: q })}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold capitalize cursor-pointer ${
                        settings.graphicsQuality === q ? 'bg-sky-400 text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Ray Tracing Quality</div>
                  <div className="text-xs text-slate-400">22-car reflections, wet asphalt mirrors & RTAO</div>
                </div>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                  {(['off', 'medium', 'high', 'ultra', 'cinematic'] as RayTracingQuality[]).map((rt) => (
                    <button
                      key={rt}
                      type="button"
                      onClick={() => onUpdateSettings({ rayTracingQuality: rt })}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold uppercase cursor-pointer ${
                        rtQuality === rt ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {rt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Frame Rate, PSSR & Motion Blur</div>
                  <div className="text-xs text-slate-400">VRR 120Hz support, PSSR upscaling & shutter blur</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                    {([30, 60, 120] as const).map((fps) => (
                      <button
                        key={fps}
                        type="button"
                        onClick={() => onUpdateSettings({ targetFps: fps })}
                        className={`px-2 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                          settings.targetFps === fps ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {fps}Hz
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ pssrUpscaling: !pssrOn })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      pssrOn
                        ? 'border-sky-400 bg-sky-500/20 text-sky-300'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    PSSR {pssrOn ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ motionBlur: !settings.motionBlur })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      settings.motionBlur
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    Blur {settings.motionBlur ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">HDR Tone Mapping & Peak Brightness</div>
                  <div className="text-xs text-slate-400">High Dynamic Range color space & specular highlights</div>
                </div>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                  {(['off', 'scrgb', 'hdr10'] as HdrOutputMode[]).map((hMode) => (
                    <button
                      key={hMode}
                      type="button"
                      onClick={() => onUpdateSettings({ hdrMode: hMode })}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold uppercase cursor-pointer ${
                        hdrMode === hMode ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {hMode}
                    </button>
                  ))}
                </div>
              </div>

              {/* PS5 F1 Next-Generation AAA Graphics Pipeline Specification Readout */}
              <div className="rounded-xl border border-sky-500/25 bg-white/[0.03] p-3 mt-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                    PS5™ F1 EGO ENGINE · RAY-TRACED PIPELINE
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-emerald-400">
                    {pssrOn ? 'PSSR 4K + RT ACTIVE' : 'NATIVE RENDER ACTIVE'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">Resolution</span>
                    <span className="font-mono font-bold text-white">
                      {settings.graphicsQuality === 'ultra' ? '4K (3840×2160)' : settings.graphicsQuality === 'high' ? '1440p QHD' : '1080p FHD'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">Texture quality</span>
                    <span className="font-mono font-bold text-sky-300 uppercase">{settings.graphicsQuality}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">Shadows</span>
                    <span className="font-mono font-bold text-sky-300 uppercase">
                      {settings.graphicsQuality === 'ultra' ? 'Ultra (RT)' : settings.graphicsQuality}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">Anti-aliasing</span>
                    <span className="font-mono font-bold text-white">
                      {pssrOn ? 'High (PSSR)' : '8x MSAA'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">Reflections</span>
                    <span className="font-mono font-bold text-sky-300 uppercase">
                      {rtQuality === 'ultra' ? 'Ultra (RT)' : rtQuality}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">Lighting</span>
                    <span className="font-mono font-bold text-amber-300 uppercase">{hdrMode}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Ambient occlusion</span>
                    <span className="font-mono font-bold text-white">
                      {rtQuality !== 'off' ? 'High (RTAO)' : 'Off'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Motion blur</span>
                    <span className="font-mono font-bold text-cyan-300">
                      {settings.motionBlur ? 'Cinematic' : 'Off'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Weather effects</span>
                    <span className="font-mono font-bold text-sky-300 uppercase">
                      {settings.graphicsQuality === 'ultra' ? 'Ultra' : 'High'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-1 pt-2 border-t border-white/10">
                    <div>
                      <div className="text-sm font-semibold text-white">NVIDIA Reflex / PS5™ Low Latency Input</div>
                      <div className="text-xs text-slate-400">Sub-frame steering & pedal response pipeline</div>
                    </div>
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                      {(['off', 'on', 'boost'] as const).map((rx) => (
                        <button
                          key={rx}
                          type="button"
                          onClick={() => onUpdateSettings({ reflexLowLatency: rx })}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase cursor-pointer ${
                            (settings.reflexLowLatency ?? 'boost') === rx
                              ? 'bg-emerald-400 text-slate-950'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {rx}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showAssists && (
            <div className="flex flex-col gap-3.5 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                2. PS5™ F1 Driving Assists & Simulation Settings
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Gearbox Transmission & Launch Clutch</div>
                  <div className="text-xs text-slate-400">Automatic or Manual 8-speed paddle shifts + Grid Clutch Prompt</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                    {(['auto', 'manual'] as TransmissionMode[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onUpdateSettings({ transmission: t })}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase cursor-pointer ${
                          settings.transmission === t ? 'bg-red-600 text-white' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ launchClutchAssist: !(settings.launchClutchAssist ?? true) })
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      settings.launchClutchAssist !== false
                        ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    Clutch Prompt {settings.launchClutchAssist !== false ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Braking Assist</div>
                  <div className="text-xs text-slate-400">Automatic braking modulation approaching corners</div>
                </div>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                  {(['off', 'low', 'medium', 'high'] as BrakingAssistLevel[]).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => onUpdateSettings({ brakingAssist: b })}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold uppercase cursor-pointer ${
                        brakingAssist === b ? 'bg-emerald-400 text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Traction Control & Anti-Lock Brakes (ABS)</div>
                  <div className="text-xs text-slate-400">Wheelspin control & brake lockup prevention</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                    {(['off', 'medium', 'full'] as TractionControlMode[]).map((tc) => (
                      <button
                        key={tc}
                        type="button"
                        onClick={() => onUpdateSettings({ tractionControlMode: tc, tcAssist: tc !== 'off' })}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase cursor-pointer ${
                          tcMode === tc ? 'bg-emerald-400 text-slate-950' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        TC: {tc}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ absAssist: !settings.absAssist })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      settings.absAssist
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    ABS {settings.absAssist ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">3D Dynamic Racing Line</div>
                  <div className="text-xs text-slate-400">On-track 3D speed & braking zone ribbon</div>
                </div>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                  {(
                    [
                      ['off', 'Off'],
                      ['corners', 'Corners Only'],
                      ['full', 'Full 3D'],
                    ] as [RacingLineMode, string][]
                  ).map(([rl, label]) => (
                    <button
                      key={rl}
                      type="button"
                      onClick={() => onUpdateSettings({ racingLine: rl })}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                        racingLine === rl ? 'bg-emerald-400 text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Steering, ERS, DRS & Pit Assists</div>
                  <div className="text-xs text-slate-400">Automated hybrid deployment, aero & apex guidance</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ steeringAssist: !settings.steeringAssist })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      settings.steeringAssist
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    Steer Assist {settings.steeringAssist ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        ersAssist: !(settings.ersAssist ?? true),
                        drsAssist: !(settings.drsAssist ?? true),
                      })
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      settings.ersAssist !== false
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    ERS/DRS {settings.ersAssist !== false ? 'AUTO' : 'MANUAL'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ pitAssist: !(settings.pitAssist ?? true) })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      settings.pitAssist !== false
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    Pit Assist {settings.pitAssist !== false ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Car Damage Simulation</div>
                  <div className="text-xs text-slate-400">Impact mechanical & aerodynamic damage severity</div>
                </div>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                  {(['off', 'reduced', 'simulation'] as CarDamageMode[]).map((dmg) => (
                    <button
                      key={dmg}
                      type="button"
                      onClick={() => onUpdateSettings({ carDamageMode: dmg })}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold capitalize cursor-pointer ${
                        carDamage === dmg ? 'bg-red-500 text-white' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {dmg}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">
                    AI Driver Difficulty ({aiRating} / 110)
                  </div>
                  <div className="text-xs text-slate-400">Official F1 0–110 AI pace scale & tier presets</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="range"
                    min="20"
                    max="110"
                    step="1"
                    value={aiRating}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const tier: DifficultyLevel = val >= 95 ? 'legend' : val >= 70 ? 'pro' : 'rookie';
                      onUpdateSettings({ aiDifficultyRating: val, difficulty: tier });
                    }}
                    className="w-28 accent-amber-400 cursor-pointer"
                  />
                  <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                    {(['rookie', 'pro', 'legend'] as DifficultyLevel[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({
                            difficulty: d,
                            aiDifficultyRating: d === 'legend' ? 102 : d === 'pro' ? 85 : 55,
                          })
                        }
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize cursor-pointer ${
                          settings.difficulty === d ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Race Distance & Dynamic Weather</div>
                  <div className="text-xs text-slate-400">Total laps & live track weather transitions</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                    {([3, 5, 8, 10] as const).map((laps) => (
                      <button
                        key={laps}
                        type="button"
                        onClick={() => onUpdateSettings({ totalLaps: laps })}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer tabular-nums ${
                          settings.totalLaps === laps ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {laps}L
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ dynamicWeather: !settings.dynamicWeather })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      settings.dynamicWeather || settings.totalLaps >= 5
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    {settings.dynamicWeather || settings.totalLaps >= 5 ? 'Dynamic ON' : 'Dynamic OFF'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showCamera && (
            <div className="flex flex-col gap-3.5 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                3. PS5™ Camera & F1® 25 Broadcast OSD Customization
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Active Camera View</div>
                  <div className="text-xs text-slate-400">Switch onboard, broadcast or chase angle (Key C)</div>
                </div>
                <div className="flex flex-wrap items-center gap-1 bg-white/5 p-1 rounded-lg">
                  {(
                    [
                      ['chase', 'Chase'],
                      ['tcam', 'TV Pod'],
                      ['cockpit', 'Cockpit'],
                      ['low_track', 'Low Track'],
                      ['wing_tyre', 'Wing Cam'],
                      ['tv_wide', 'TV Broadcast'],
                    ] as [CameraMode, string][]
                  ).map(([cam, label]) => (
                    <button
                      key={cam}
                      type="button"
                      onClick={() => onUpdateSettings({ cameraMode: cam })}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                        settings.cameraMode === cam ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* F1 25 Broadcast OSD & Virtual Rear Mirror Toggles */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">F1® 25 On-Screen Display (OSD) Modules</div>
                  <div className="text-xs text-slate-400">
                    Virtual Rear-View Mirror, Center Halo Dual-Dial HUD, 3D Driver Tags & Objectives
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ virtualMirror: !(settings.virtualMirror ?? true) })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      settings.virtualMirror !== false
                        ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    Virtual Mirror {settings.virtualMirror !== false ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ haloCenterHud: !(settings.haloCenterHud ?? true) })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      settings.haloCenterHud !== false
                        ? 'border-lime-400 bg-lime-500/20 text-lime-200'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    Halo Dual-Dial {settings.haloCenterHud !== false ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ driverTags3d: !(settings.driverTags3d ?? true) })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      settings.driverTags3d !== false
                        ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    3D Tags {settings.driverTags3d !== false ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ raceObjectives: !(settings.raceObjectives ?? true) })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      settings.raceObjectives !== false
                        ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    Objectives {settings.raceObjectives !== false ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Speedometer Units & FOV Offset</div>
                  <div className="text-xs text-slate-400 tabular-nums">
                    {(settings.speedUnits ?? 'kmh').toUpperCase()} readout · {fovOffset > 0 ? `+${fovOffset}°` : `${fovOffset}°`} optical FOV
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                    {(['kmh', 'mph'] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => onUpdateSettings({ speedUnits: u })}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase cursor-pointer ${
                          (settings.speedUnits ?? 'kmh') === u
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="1"
                    value={fovOffset}
                    onChange={(e) => onUpdateSettings({ fovOffset: parseInt(e.target.value, 10) })}
                    className="w-32 accent-amber-400 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Camera Shake & Look to Apex</div>
                  <div className="text-xs text-slate-400 tabular-nums">
                    Shake: {cameraShake}% · Corner apex head-turn
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={cameraShake}
                    onChange={(e) => onUpdateSettings({ cameraShakeScale: parseInt(e.target.value, 10) })}
                    className="w-28 accent-amber-400 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ lookToApex: !lookToApex })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      lookToApex
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    Apex Look {lookToApex ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showDualsense && (
            <div className="flex flex-col gap-3.5 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <div className="text-xs font-bold uppercase tracking-wider text-purple-400">
                4. PS5™ DualSense™ Wireless Controller & Tempest 3D Audio
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Steering Sensitivity</div>
                  <div className="text-xs text-slate-400 tabular-nums">
                    {settings.steeringSensitivity.toFixed(2)}x steering rack response
                  </div>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.5"
                  step="0.05"
                  value={settings.steeringSensitivity}
                  onChange={(e) => onUpdateSettings({ steeringSensitivity: parseFloat(e.target.value) })}
                  className="w-40 accent-red-500 cursor-pointer"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">DualSense™ Adaptive Triggers (L2/R2)</div>
                  <div className="text-xs text-slate-400">Brake pedal pressure & rear tyre traction resistance</div>
                </div>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                  {(['off', 'medium', 'strong'] as AdaptiveTriggersLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => onUpdateSettings({ adaptiveTriggers: lvl })}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold capitalize cursor-pointer ${
                        adaptiveTriggers === lvl ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">DualSense™ Haptic Feedback & 3D Audio</div>
                  <div className="text-xs text-slate-400">Kerb rumble, gearshift thump & Tempest 3D AudioTech</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                    {(['off', 'subtle', 'full'] as HapticFeedbackLevel[]).map((hap) => (
                      <button
                        key={hap}
                        type="button"
                        onClick={() => onUpdateSettings({ hapticFeedback: hap })}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize cursor-pointer ${
                          hapticFeedback === hap ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Haptics: {hap}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ tempest3dAudio: !tempestAudio })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      tempestAudio
                        ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                        : 'border-white/15 bg-white/5 text-slate-300'
                    }`}
                  >
                    3D Audio {tempestAudio ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Landscape Touch Controls</div>
                  <div className="text-xs text-slate-400">On-screen steering & pedals overlay</div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ touchControls: !settings.touchControls })}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                    settings.touchControls
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                      : 'border-white/15 bg-white/5 text-slate-300'
                  }`}
                >
                  {settings.touchControls ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onExitToTitle}
            className="px-4 py-2.5 rounded-xl border border-white/15 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Main Menu</span>
          </button>
          {mode === 'pause' && (
            <button
              type="button"
              onClick={onRestart}
              className="px-4 py-2.5 rounded-xl border border-white/15 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restart</span>
            </button>
          )}
          <button
            type="button"
            onClick={onResume}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-display font-bold flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{mode === 'pause' ? 'Resume Race' : 'Done'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface ResultsModalProps {
  standings: RacerStanding[];
  trackName: string;
  onRestart: () => void;
  onGarage: () => void;
  onExitToTitle: () => void;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  standings,
  trackName,
  onRestart,
  onGarage,
  onExitToTitle,
}) => {
  const player = standings.find((s) => s.isPlayer);
  const pos = player?.position ?? 1;

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(6, 8, 12, 0.82)' }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/15 p-6 flex flex-col gap-5"
        style={{ backgroundColor: '#10141C' }}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center">
              {pos <= 3 ? <Trophy className="w-5 h-5 text-amber-400" /> : <Flag className="w-5 h-5 text-slate-300" />}
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl text-white">
                {pos === 1 ? 'Grand Prix Victory!' : `Finished P${pos}`}
              </h2>
              <p className="text-xs text-slate-400">{trackName} · Official Classification</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold tracking-wider text-slate-400">BEST LAP</div>
            <div className="font-mono-telemetry text-lg font-bold text-emerald-400">
              {formatLapTime(player?.bestLapMs ?? null)}
            </div>
          </div>
        </div>

        {/* Classification Table */}
        <div className="flex flex-col divide-y divide-white/8">
          {standings.map((r) => (
            <div
              key={r.id}
              className={`py-2.5 px-3 flex items-center justify-between text-xs sm:text-sm rounded-lg ${
                r.isPlayer ? 'bg-amber-400/10' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-display font-bold w-6 text-slate-300 tabular-nums">P{r.position}</span>
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: r.color }} />
                <div>
                  <span className={`font-semibold ${r.isPlayer ? 'text-amber-300' : 'text-white'}`}>{r.name}</span>
                  <span className="text-slate-400 text-xs ml-2 hidden sm:inline">{r.teamName}</span>
                </div>
              </div>
              <div className="flex items-center gap-5 font-mono-telemetry text-xs">
                <span className="text-slate-300">{formatLapTime(r.bestLapMs)}</span>
                <span className="w-16 text-right text-slate-400">
                  {r.position === 1 ? 'LEADER' : `+${r.gapSeconds.toFixed(1)}s`}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onExitToTitle}
            className="px-4 py-2.5 rounded-xl border border-white/15 text-xs font-semibold text-slate-200 hover:text-white cursor-pointer"
          >
            Main Menu
          </button>
          <button
            type="button"
            onClick={onGarage}
            className="px-4 py-2.5 rounded-xl border border-white/15 text-xs font-semibold text-slate-200 hover:text-white cursor-pointer"
          >
            3D Garage
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-display font-bold flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Race Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
