import React, { useEffect, useRef, useState } from 'react';
import { Radio, Volume2, X } from 'lucide-react';
import { RacingAudio } from '../audio/RacingAudio';
import { HudTelemetry } from '../types/racing';

interface EngineerRadioProps {
  hud: HudTelemetry;
  audio?: RacingAudio;
  driverName?: string;
  teamName?: string;
}

interface RadioMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  category: 'strategy' | 'gap' | 'tyres' | 'weather' | 'general';
}

export function EngineerRadio({
  hud,
  audio,
  driverName = 'Driver',
  teamName = 'Scuderia',
}: EngineerRadioProps) {
  const [activeMessage, setActiveMessage] = useState<RadioMessage | null>(null);
  const [messageHistory, setMessageHistory] = useState<RadioMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const lastTriggeredEvent = useRef<string>('');
  const hideTimerRef = useRef<number | null>(null);

  const triggerRadioCall = (text: string, category: RadioMessage['category']) => {
    const eventKey = `${category}-${text}`;
    if (lastTriggeredEvent.current === eventKey) return;
    lastTriggeredEvent.current = eventKey;

    const newMsg: RadioMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'GP (Race Engineer)',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      category,
    };

    setActiveMessage(newMsg);
    setMessageHistory((prev) => [newMsg, ...prev].slice(0, 15));

    // Play authentic F1 radio handshake beep
    try {
      audio?.playRadioBeep();
    } catch {
      // ignore audio error
    }

    // Optional Web Speech API TTS
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
    }, 6200);
  };

  // Monitor telemetry to trigger contextual engineer messages
  useEffect(() => {
    if (hud.countdownState !== 'racing') return;

    // Lap change triggers
    if (hud.lap === 1 && hud.currentLapMs < 4000) {
      triggerRadioCall(`Lights out and away we go! Clean start, ${driverName}. Let's settle into rhythm.`, 'general');
    } else if (hud.lap === hud.totalLaps) {
      triggerRadioCall(`Final lap, ${driverName}! Bring it home, everything you've got!`, 'strategy');
    }

    // Position updates
    if (hud.position === 1) {
      if (Math.random() < 0.25) {
        triggerRadioCall(`You're leading the race, P1. Great pace, maintain tyre temperatures.`, 'gap');
      }
    } else if (hud.position > 1 && hud.gapAheadSeconds !== null && hud.gapAheadSeconds < 1.5) {
      triggerRadioCall(`DRS enabled this lap. Gap ahead is ${hud.gapAheadSeconds.toFixed(1)} seconds. Close in!`, 'gap');
    }

    // Tyre condition warnings
    if (hud.tyreWearPct < 40 && hud.tyreWearPct > 35) {
      triggerRadioCall(`Tyre wear at 60%. Surface degradation increasing, watch traction on exit.`, 'tyres');
    } else if (hud.tyreWearPct <= 20) {
      triggerRadioCall(`Tyres are dropping off significantly, wear critical. Box this lap for fresh compound!`, 'tyres');
    }

    // Weather / Track flags
    if (hud.liveWeather === 'rain' && hud.trackWetnessPct > 60) {
      triggerRadioCall(`Rain intensity increasing. Wet track conditions, adapt brake bias forward.`, 'weather');
    }

    if (hud.trackFlag.flag === 'yellow') {
      triggerRadioCall(`Yellow flag in Sector ${hud.currentSector}. Slow down, hazard ahead.`, 'general');
    }
  }, [hud.lap, hud.position, hud.tyreWearPct, hud.liveWeather, hud.trackFlag.flag]);

  return (
    <>
      {/* Live Radio Pop-Up Toast */}
      {activeMessage && (
        <div className="absolute top-20 left-6 z-50 w-80 md:w-96 bg-slate-950/90 backdrop-blur-md border border-sky-500/40 rounded-xl p-3.5 shadow-2xl animate-hud-enter-tl text-slate-100">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 animate-pulse">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold tracking-wider text-sky-400 font-display uppercase">
                  TEAM RADIO • {activeMessage.sender}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">{activeMessage.timestamp}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-end gap-0.5 h-3">
                <div className="w-0.5 h-full bg-sky-400 animate-bounce rounded-full" />
                <div className="w-0.5 h-2/3 bg-sky-400 animate-bounce rounded-full [animation-delay:150ms]" />
                <div className="w-0.5 h-4/5 bg-sky-400 animate-bounce rounded-full [animation-delay:300ms]" />
              </div>
              <button
                type="button"
                onClick={() => setActiveMessage(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-xs md:text-sm font-medium text-slate-200 leading-relaxed">
            "{activeMessage.text}"
          </p>
        </div>
      )}

      {/* Floating Radio History Toggle Button */}
      <div className="absolute top-20 right-6 z-40">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-white/10 hover:border-sky-400/50 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-lg cursor-pointer"
          title="Team Radio Log"
        >
          <Volume2 className="w-4 h-4 text-sky-400" />
          <span className="hidden sm:inline font-display uppercase tracking-wider">Radio Log</span>
        </button>

        {showHistory && (
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-slate-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl z-50 text-slate-100 divide-y divide-white/10">
            <div className="flex items-center justify-between pb-3 mb-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold tracking-wider font-display uppercase text-white">
                  Pit Wall Radio Transmissions
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {messageHistory.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">No radio transmissions yet.</div>
            ) : (
              messageHistory.map((msg) => (
                <div key={msg.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                    <span className="text-sky-400 font-bold">{msg.sender}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-200 italic">"{msg.text}"</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
