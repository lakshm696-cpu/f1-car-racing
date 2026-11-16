import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CloudRain, Flag, Radio, Wrench, X } from 'lucide-react';
import { RacingAudio } from '../audio/RacingAudio';
import { ErsDeploymentMode, HudColorScheme, HudTelemetry, TyreCompound } from '../types/racing';

type EngineerCueType =
  | 'pit_window'
  | 'crossover'
  | 'track_limits'
  | 'tyre_cliff'
  | 'fuel_low'
  | 'ers_full'
  | 'aero_x'
  | 'aero_z';

interface EngineerRadioProps {
  hud: HudTelemetry;
  audio?: RacingAudio;
  driverName?: string;
  teamName?: string;
  active?: boolean;
  hudColorScheme?: HudColorScheme;
  onRequestPitBox?: (compound: TyreCompound) => void;
  onSetErsMode?: (mode: ErsDeploymentMode) => void;
  onAdjustBrakeBias?: (deltaPct: number) => void;
}

type PromptActionType = 'pit_box' | 'crossover' | 'track_limits' | 'ers_mode';

interface RadioActionButton {
  label: string;
  hotkey?: string;
  variant: 'primary' | 'amber' | 'sky' | 'neutral';
  action:
    | { type: 'pit'; compound: TyreCompound }
    | { type: 'ers'; mode: ErsDeploymentMode }
    | { type: 'bias'; delta: number }
    | { type: 'ack' };
}

interface RadioMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  category: 'strategy' | 'gap' | 'tyres' | 'weather' | 'fuel' | 'ers' | 'limits' | 'general';
  promptType?: PromptActionType;
  suggestedCompound?: TyreCompound | null;
  actions?: RadioActionButton[];
}

export function EngineerRadio({
  hud,
  audio,
  driverName = 'Driver',
  teamName: _teamName = 'Scuderia',
  active = true,
  hudColorScheme = 'motorsport_dark',
  onRequestPitBox,
  onSetErsMode,
  onAdjustBrakeBias,
}: EngineerRadioProps) {
  const [activeMessage, setActiveMessage] = useState<RadioMessage | null>(null);
  const lastTriggeredEvent = useRef<string>('');
  const hideTimerRef = useRef<number | null>(null);

  const triggerRadioCall = (
    text: string,
    category: RadioMessage['category'],
    options?: {
      suggestedCompound?: TyreCompound | null;
      promptType?: PromptActionType;
      cueType?: EngineerCueType;
      actions?: RadioActionButton[];
    }
  ) => {
    const eventKey = `${category}-${text}`;
    if (lastTriggeredEvent.current === eventKey) return;
    lastTriggeredEvent.current = eventKey;

    const newMsg: RadioMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'GP (Race Engineer)',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      category,
      suggestedCompound: options?.suggestedCompound ?? null,
      promptType: options?.promptType,
      actions: options?.actions,
    };

    setActiveMessage(newMsg);

    try {
      if (options?.cueType) {
        audio?.playEngineerTelemetryCue(options.cueType);
      } else {
        audio?.playRadioBeep();
      }
    } catch {
      // ignore audio error
    }

    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.08;
        utterance.pitch = 0.95;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // Speech synthesis optional
    }

    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setActiveMessage(null);
    }, 7400);
  };

  const executeRadioAction = (btn: RadioActionButton) => {
    if (btn.action.type === 'pit') {
      onRequestPitBox?.(btn.action.compound);
    } else if (btn.action.type === 'ers') {
      onSetErsMode?.(btn.action.mode);
    } else if (btn.action.type === 'bias') {
      onAdjustBrakeBias?.(btn.action.delta);
    }
    try {
      audio?.playUiConfirm();
    } catch {
      // ignore
    }
    setActiveMessage(null);
  };

  // Monitor telemetry to trigger contextual engineer messages
  useEffect(() => {
    if (!active || hud.countdownState !== 'racing') return;

    // Lap change triggers
    if (hud.lap === 1 && hud.currentLapMs < 4000) {
      triggerRadioCall(`Lights out and away we go! Clean start, ${driverName}. Let's settle into rhythm.`, 'general');
    } else if (hud.lap === hud.totalLaps) {
      triggerRadioCall(`Final lap, ${driverName}! Bring it home, everything you've got!`, 'strategy');
    }

    // Position updates & Gaps to rivals
    if (hud.position === 1) {
      if (Math.random() < 0.22) {
        triggerRadioCall(`You're leading the race, P1. Great pace, maintain tyre temperatures.`, 'gap');
      }
    } else if (hud.position > 1 && hud.gapAheadSeconds !== null) {
      if (hud.gapAheadSeconds < 1.2 && hud.drsAvailable) {
        triggerRadioCall(
          `X-Mode active aero armed! Gap ahead is ${hud.gapAheadSeconds.toFixed(1)}s. Hit MOM Override into the braking zone.`,
          'gap',
          { cueType: 'aero_x' }
        );
      } else if (hud.gapAheadSeconds > 5.0 && Math.random() < 0.15) {
        triggerRadioCall(`Gap to car ahead is ${hud.gapAheadSeconds.toFixed(1)}s. Keep pushing, rhythm is strong.`, 'gap');
      }
    }

    // Interactive Compound Crossover Strategy Prompt (Rain / Drying / Heat Crossover)
    if (hud.weatherTyreImpact?.crossoverUrgent) {
      const optCmp = hud.weatherTyreImpact.optimalCompound;
      triggerRadioCall(
        hud.weatherTyreImpact.strategyRecommendation ??
          `Track grip at ${Math.round(hud.weatherTyreImpact.gripMultiplier * 100)}% (${Math.round(hud.trackWetnessPct)}% wet). Switch to ${optCmp.toUpperCase()} tyres now!`,
        'weather',
        {
          suggestedCompound: optCmp,
          promptType: 'crossover',
          cueType: 'crossover',
          actions: [
            {
              label: `CROSSOVER → ${optCmp.toUpperCase()}`,
              hotkey: 'F',
              variant: 'sky',
              action: { type: 'pit', compound: optCmp },
            },
            {
              label: 'HOLD CURRENT',
              variant: 'neutral',
              action: { type: 'ack' },
            },
          ],
        }
      );
    } else if (hud.liveWeather === 'rain' && hud.trackWetnessPct > 55 && hud.tyreCompound !== 'wet') {
      triggerRadioCall(
        `Rain intensity increasing (${Math.round(hud.trackWetnessPct)}% wet). Wet compound crossover open — shift bias rearward or box for WETS.`,
        'weather',
        {
          suggestedCompound: 'wet',
          promptType: 'crossover',
          cueType: 'crossover',
          actions: [
            {
              label: 'BOX FOR WET',
              hotkey: 'F',
              variant: 'sky',
              action: { type: 'pit', compound: 'wet' },
            },
            {
              label: 'BIAS -1%',
              variant: 'amber',
              action: { type: 'bias', delta: -1 },
            },
          ],
        }
      );
    }

    // Hardcore Pit Strategy & Undercut Tactical Radio Callouts
    if (hud.pitStrategy?.tacticalRadioCall) {
      const rec = hud.pitStrategy.recommendedCompound;
      triggerRadioCall(hud.pitStrategy.tacticalRadioCall, 'strategy', {
        suggestedCompound: rec,
        promptType: 'pit_box',
        cueType: 'pit_window',
        actions: [
          {
            label: `BOX NOW (${rec.toUpperCase()})`,
            hotkey: 'F',
            variant: 'primary',
            action: { type: 'pit', compound: rec },
          },
          {
            label: 'EXTEND +1 LAP',
            variant: 'neutral',
            action: { type: 'ack' },
          },
        ],
      });
    } else if (hud.inPitWindow && !hud.queuedCompound && hud.lap < hud.totalLaps) {
      const rec = hud.weatherTyreImpact?.optimalCompound ?? hud.pitStrategy?.recommendedCompound ?? 'medium';
      triggerRadioCall(
        `Pit window is open, ${driverName}. Clean air predicted at P${hud.pitStrategy?.predictedExitPosition ?? hud.position}. Confirm box for ${rec.toUpperCase()}?`,
        'strategy',
        {
          suggestedCompound: rec,
          promptType: 'pit_box',
          cueType: 'pit_window',
          actions: [
            {
              label: `CONFIRM BOX (${rec.toUpperCase()})`,
              hotkey: 'F',
              variant: 'primary',
              action: { type: 'pit', compound: rec },
            },
            {
              label: 'STAY OUT',
              variant: 'neutral',
              action: { type: 'ack' },
            },
          ],
        }
      );
    }

    // Fuel saving advisories
    if (hud.fuelPct <= 22 && hud.fuelPct > 18) {
      triggerRadioCall(`Fuel level getting low (${hud.fuelPct}%). Lift and coast into heavy braking zones to save fuel.`, 'fuel', {
        cueType: 'fuel_low',
      });
    } else if (hud.fuelPct <= 10) {
      triggerRadioCall(`Critical fuel state! Switch ERS to Harvest and lift earlier into braking zones.`, 'fuel', {
        promptType: 'ers_mode',
        cueType: 'fuel_low',
        actions: [
          {
            label: 'SET ERS HARVEST',
            hotkey: 'F',
            variant: 'sky',
            action: { type: 'ers', mode: 'harvest' },
          },
          {
            label: 'COPY',
            variant: 'neutral',
            action: { type: 'ack' },
          },
        ],
      });
    }

    // 2026 MGU-K 350kW Battery, ERS Mode & Manual Override advisories
    if (hud.ersCharge <= 15 && hud.ersMode !== 'harvest') {
      triggerRadioCall(`350kW MGU-K battery low (${Math.round(hud.ersCharge)}%). Switch ERS to Harvest on braking zones.`, 'ers', {
        promptType: 'ers_mode',
        cueType: 'fuel_low',
        actions: [
          {
            label: 'ERS → HARVEST',
            hotkey: 'F',
            variant: 'sky',
            action: { type: 'ers', mode: 'harvest' },
          },
          {
            label: 'KEEP BALANCED',
            variant: 'neutral',
            action: { type: 'ack' },
          },
        ],
      });
    } else if (hud.ersCharge >= 95 && hud.drsAvailable && hud.ersMode !== 'overtake') {
      triggerRadioCall(`Battery 100%! Engage Overtake ERS & X-Mode down this straight.`, 'ers', {
        promptType: 'ers_mode',
        cueType: 'ers_full',
        actions: [
          {
            label: 'ERS → OVERTAKE',
            hotkey: 'F',
            variant: 'amber',
            action: { type: 'ers', mode: 'overtake' },
          },
          {
            label: 'SAVE ENERGY',
            variant: 'neutral',
            action: { type: 'ack' },
          },
        ],
      });
    }

    // 4-Corner Asymmetric Tyre Wear & Contact Patch Coaching
    const corners: [string, number][] = [
      ['Front Left', hud.wheelWearPct?.[0] ?? hud.tyreWearPct],
      ['Front Right', hud.wheelWearPct?.[1] ?? hud.tyreWearPct],
      ['Rear Left', hud.wheelWearPct?.[2] ?? hud.tyreWearPct],
      ['Rear Right', hud.wheelWearPct?.[3] ?? hud.tyreWearPct],
    ];
    let minCorner = corners[0];
    let maxCorner = corners[0];
    for (const c of corners) {
      if (c[1] < minCorner[1]) minCorner = c;
      if (c[1] > maxCorner[1]) maxCorner = c;
    }
    const cornerSpread = maxCorner[1] - minCorner[1];
    const frontAvg = (corners[0][1] + corners[1][1]) * 0.5;
    const rearAvg = (corners[2][1] + corners[3][1]) * 0.5;

    if (hud.pitStrategy?.tyreDegradationStage === 'cliff' || hud.tyreWearPct <= 18) {
      const targetCmp = hud.pitStrategy?.recommendedCompound ?? 'medium';
      triggerRadioCall(
        `Tyres are past the cliff, lap times dropping significantly. Box this lap for ${targetCmp.toUpperCase()}!`,
        'tyres',
        {
          suggestedCompound: targetCmp,
          promptType: 'pit_box',
          cueType: 'tyre_cliff',
          actions: [
            {
              label: `BOX FOR ${targetCmp.toUpperCase()}`,
              hotkey: 'F',
              variant: 'primary',
              action: { type: 'pit', compound: targetCmp },
            },
            {
              label: 'PUSH 1 MORE',
              variant: 'neutral',
              action: { type: 'ack' },
            },
          ],
        }
      );
    } else if (hud.tyreContactPatch && hud.tyreContactPatch.grainingProbabilityPct >= 62) {
      triggerRadioCall(
        `High graining probability (${hud.tyreContactPatch.grainingProbabilityPct}%) in Sector ${hud.currentSector} at ${hud.trackTemperature}°C. Smooth steering inputs.`,
        'tyres',
        { cueType: 'tyre_cliff' }
      );
    } else if (cornerSpread >= 9 && minCorner[1] <= 74) {
      const axleHint =
        rearAvg + 5 < frontAvg
          ? 'Modulate throttle on exit to protect rear traction.'
          : 'Clean brake release into corners to save the loaded front corner.';
      triggerRadioCall(
        `${minCorner[0]} tyre wearing fastest (${Math.round(minCorner[1])}% remaining). ${axleHint}`,
        'tyres'
      );
    } else if (hud.tyreWearPct <= 38 && hud.tyreWearPct > 34) {
      triggerRadioCall(`Tyre wear at 62%. Surface degradation increasing, watch traction on apex exit.`, 'tyres');
    }

    // Interactive FIA Track Limits Warnings & Penalty Prompts
    if ((hud.trackLimitWarnings ?? 0) === 2 && (hud.timePenaltySec ?? 0) === 0) {
      triggerRadioCall(
        `Track limits 2 of 3, ${driverName}. Watch apex exits — shift brake bias -1% for cleaner entry if locking up.`,
        'limits',
        {
          promptType: 'track_limits',
          cueType: 'track_limits',
          actions: [
            {
              label: 'BIAS -1% STABILITY',
              hotkey: 'F',
              variant: 'amber',
              action: { type: 'bias', delta: -1 },
            },
            {
              label: 'COPY · STAY CLEAN',
              variant: 'neutral',
              action: { type: 'ack' },
            },
          ],
        }
      );
    } else if ((hud.trackLimitWarnings ?? 0) === 3 && (hud.timePenaltySec ?? 0) === 0) {
      triggerRadioCall(
        `Black and white flag for track limits, ${driverName}! Next off-track incur +5s time penalty.`,
        'limits',
        {
          promptType: 'track_limits',
          cueType: 'track_limits',
          actions: [
            {
              label: 'ERS HARVEST · CLEAN LAP',
              hotkey: 'F',
              variant: 'amber',
              action: { type: 'ers', mode: 'harvest' },
            },
            {
              label: 'UNDERSTOOD',
              variant: 'neutral',
              action: { type: 'ack' },
            },
          ],
        }
      );
    } else if ((hud.timePenaltySec ?? 0) >= 5) {
      triggerRadioCall(
        `Stewards issued a +${hud.timePenaltySec}s time penalty for track limits. Box for fresh tyres or push to cover the gap.`,
        'limits',
        {
          promptType: 'track_limits',
          cueType: 'track_limits',
          actions: [
            {
              label: 'ERS OVERTAKE PUSH',
              hotkey: 'F',
              variant: 'primary',
              action: { type: 'ers', mode: 'overtake' },
            },
            {
              label: 'ACKNOWLEDGED',
              variant: 'neutral',
              action: { type: 'ack' },
            },
          ],
        }
      );
    }

    if (hud.trackFlag.flag === 'yellow') {
      triggerRadioCall(`Yellow flag in Sector ${hud.currentSector}. Slow down, hazard ahead.`, 'general');
    }
  }, [
    active,
    driverName,
    hud.countdownState,
    hud.lap,
    hud.totalLaps,
    hud.position,
    hud.tyreWearPct,
    hud.tyreCompound,
    hud.wheelWearPct,
    hud.fuelPct,
    hud.ersCharge,
    hud.ersMode,
    hud.liveWeather,
    hud.trackWetnessPct,
    hud.trackTemperature,
    hud.weatherTyreImpact?.crossoverUrgent,
    hud.weatherTyreImpact?.strategyRecommendation,
    hud.weatherTyreImpact?.optimalCompound,
    hud.weatherTyreImpact?.gripMultiplier,
    hud.currentSector,
    hud.tyreContactPatch?.grainingProbabilityPct,
    hud.trackFlag.flag,
    hud.pitStrategy?.tacticalRadioCall,
    hud.pitStrategy?.recommendedCompound,
    hud.pitStrategy?.tyreDegradationStage,
    hud.pitStrategy?.predictedExitPosition,
    hud.inPitWindow,
    hud.queuedCompound,
    hud.gapAheadSeconds,
    hud.drsAvailable,
    hud.trackLimitWarnings,
    hud.timePenaltySec,
  ]);

  // Quick Keyboard Reply [F] for the primary interactive prompt button
  useEffect(() => {
    if (!active || !activeMessage) return;
    const primaryAction =
      activeMessage.actions?.[0] ??
      (activeMessage.suggestedCompound && onRequestPitBox
        ? ({
            label: `BOX CONFIRMED (${activeMessage.suggestedCompound.toUpperCase()})`,
            hotkey: 'F',
            variant: 'primary',
            action: { type: 'pit', compound: activeMessage.suggestedCompound },
          } as RadioActionButton)
        : null);
    if (!primaryAction) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyF') {
        executeRadioAction(primaryAction);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, activeMessage, onRequestPitBox, onSetErsMode, onAdjustBrakeBias, audio]);

  const headerIcon =
    activeMessage?.category === 'weather' ? (
      <CloudRain className="w-4 h-4 text-cyan-300" />
    ) : activeMessage?.category === 'limits' ? (
      <Flag className="w-4 h-4 text-amber-300" />
    ) : activeMessage?.category === 'strategy' || activeMessage?.category === 'tyres' ? (
      <Wrench className="w-4 h-4 text-emerald-300" />
    ) : activeMessage?.category === 'fuel' ? (
      <AlertTriangle className="w-4 h-4 text-amber-300" />
    ) : (
      <Radio className="w-4 h-4 text-sky-400" />
    );

  const actionList: RadioActionButton[] =
    activeMessage?.actions ??
    (activeMessage?.suggestedCompound && onRequestPitBox
      ? [
          {
            label: `BOX CONFIRMED (${activeMessage.suggestedCompound.toUpperCase()})`,
            hotkey: 'F',
            variant: 'primary',
            action: { type: 'pit', compound: activeMessage.suggestedCompound },
          },
          {
            label: 'STAY OUT',
            variant: 'neutral',
            action: { type: 'ack' },
          },
        ]
      : []);

  return (
    <>
      {/* Live Radio Pop-Up Toast */}
      {active && activeMessage && (
        <div
          data-hud-theme={hudColorScheme}
          className="hud-themed-card fixed top-16 sm:top-20 left-3 right-3 sm:left-6 sm:right-auto z-50 sm:w-88 md:w-96 bg-slate-950/92 backdrop-blur-md border border-sky-500/45 rounded-xl p-3 sm:p-3.5 shadow-2xl animate-hud-enter-tl text-slate-100"
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0">
                {headerIcon}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-bold tracking-wider text-sky-400 font-display uppercase truncate">
                  TEAM RADIO • {activeMessage.sender}
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono">{activeMessage.timestamp}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-end gap-0.5 h-3">
                <div className="w-0.5 h-full bg-sky-400 animate-bounce rounded-full" />
                <div className="w-0.5 h-2/3 bg-sky-400 animate-bounce rounded-full [animation-delay:150ms]" />
                <div className="w-0.5 h-4/5 bg-sky-400 animate-bounce rounded-full [animation-delay:300ms]" />
              </div>
              <button
                type="button"
                onClick={() => setActiveMessage(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                aria-label="Dismiss radio transmission"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed">
            "{activeMessage.text}"
          </p>
          {actionList.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
              {actionList.map((btn, idx) => {
                const variantClass =
                  btn.variant === 'primary'
                    ? 'bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-400/65 text-emerald-200'
                    : btn.variant === 'sky'
                      ? 'bg-cyan-500/20 hover:bg-cyan-500/35 border-cyan-400/65 text-cyan-200'
                      : btn.variant === 'amber'
                        ? 'bg-amber-500/20 hover:bg-amber-500/35 border-amber-400/65 text-amber-200'
                        : 'bg-white/5 hover:bg-white/15 border-white/15 text-slate-300';
                return (
                  <button
                    key={`${btn.label}-${idx}`}
                    type="button"
                    onClick={() => executeRadioAction(btn)}
                    className={`${
                      idx === 0 ? 'flex-1' : ''
                    } min-h-[36px] px-2.5 py-1.5 rounded-lg border text-[10px] font-display font-bold tracking-wider uppercase cursor-pointer whitespace-nowrap shrink-0 flex items-center justify-between gap-1.5 transition-colors ${variantClass}`}
                  >
                    <span>{btn.label}</span>
                    {btn.hotkey && (
                      <span className="px-1 rounded bg-black/50 text-[9px] font-mono-telemetry">
                        {btn.hotkey}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
