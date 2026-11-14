import React, { useEffect, useState } from 'react';
import {
  Cloud,
  CloudLightning,
  CloudRain,
  Eye,
  Film,
  Globe,
  Moon,
  Play,
  Settings2,
  ShieldCheck,
  Sun,
  Sunset,
  Trophy,
  UserCheck,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from 'lucide-react';
import {
  CIRCUIT_TRACKS,
  F1_INVITATIONALS,
  F1_WORLD_MAP_PINS,
  F1WorldMapPin,
} from '../data/racingData';
import {
  CareerProgress,
  CircuitTrack,
  DriverProfile,
  FormulaTeam,
  GameMode,
  WeatherMode,
} from '../types/racing';

interface TitleOverlayProps {
  selectedTrack: CircuitTrack;
  selectedTeam: FormulaTeam;
  selectedDriver: DriverProfile;
  career: CareerProgress;
  gameMode: GameMode;
  weather: WeatherMode;
  dynamicWeather: boolean;
  totalLaps: number;
  muted: boolean;
  egoHudMode?: boolean;
  onToggleEgoHudMode?: () => void;
  onSelectTrack: (track: CircuitTrack) => void;
  onSelectMode: (mode: GameMode) => void;
  onSelectWeather: (weather: WeatherMode) => void;
  onToggleDynamicWeather: () => void;
  onToggleMute: () => void;
  onEnableAudio: () => void;
  onOpenDrivers: () => void;
  onOpenGarage: () => void;
  onOpenSettings: () => void;
  onJumpTitleScene: (scene: 1 | 2 | 3 | 4 | 5) => void;
  onStartRace: () => void;
}

type F1WorldTab = 'showroom' | 'series' | 'events' | 'invitationals';

const TRAILER_SCENES: {
  id: 1 | 2 | 3 | 4 | 5;
  shortLabel: string;
  title: string;
  subtitle: string;
  timeRange: string;
}[] = [
  {
    id: 1,
    shortLabel: 'Clip 1 · Arrival',
    title: 'CLIP 1/4 · 2026 CHAMPIONSHIP ARRIVAL',
    subtitle: 'All teams & drivers beside their F1 25 / 2026 cars · Drone & helmet close-ups',
    timeRange: '00:00 – 00:08',
  },
  {
    id: 2,
    shortLabel: 'Clip 2 · Wet GP',
    title: 'CLIP 2/4 · WET ELEVATION GRAND PRIX',
    subtitle: 'Sleek black carbon F1 car on rain-soaked steep elevation climb · Heavy rear tire spray',
    timeRange: '00:08 – 00:16',
  },
  {
    id: 3,
    shortLabel: 'Clip 3 · Documentary',
    title: 'CLIP 3/4 · DRIVER & PIT DOCUMENTARY',
    subtitle: 'Hamilton, Leclerc, Verstappen, Norris, Piastri, Jackson & Hayes · 85mm cockpit macro',
    timeRange: '00:16 – 00:24',
  },
  {
    id: 4,
    shortLabel: 'Clip 4 · Finale',
    title: 'CLIP 4/4 · GRAND PRIX FINALE & FIREWORKS',
    subtitle: 'High-speed finish-line sprint, stadium fireworks & epic aerial orchestral climax',
    timeRange: '00:24 – 00:32',
  },
];

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  selectedTrack,
  selectedTeam,
  selectedDriver,
  career,
  gameMode,
  weather,
  dynamicWeather,
  totalLaps,
  muted,
  egoHudMode = true,
  onToggleEgoHudMode,
  onSelectTrack,
  onSelectMode,
  onSelectWeather,
  onToggleDynamicWeather,
  onToggleMute,
  onEnableAudio,
  onOpenDrivers,
  onOpenGarage,
  onOpenSettings,
  onJumpTitleScene,
  onStartRace,
}) => {
  const [cinemaMode, setCinemaMode] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [trailerClock, setTrailerClock] = useState(8.05);
  const [f1WorldTab, setF1WorldTab] = useState<F1WorldTab>('showroom');
  const [selectedPin, setSelectedPin] = useState<F1WorldMapPin>(F1_WORLD_MAP_PINS[0]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setTrailerClock((prev) => (prev + dt) % 32.0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const currentClipIdx = Math.min(3, Math.floor(trailerClock / 8.0));
  const currentClip = TRAILER_SCENES[currentClipIdx];
  const progressPct = (trailerClock / 32.0) * 100;
  const techLevel = career.techLevel ?? 929 + Math.floor(career.championshipPoints * 0.5);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        e.preventDefault();
        setAudioUnlocked(true);
        onToggleMute();
        return;
      }
      if (e.code === 'KeyH') {
        e.preventDefault();
        if (onToggleEgoHudMode) {
          onToggleEgoHudMode();
        } else {
          setCinemaMode((prev) => !prev);
        }
        return;
      }
      if (e.code === 'Digit1') {
        setAudioUnlocked(true);
        setTrailerClock(0.05);
        onJumpTitleScene(1);
        return;
      }
      if (e.code === 'Digit2') {
        setAudioUnlocked(true);
        setTrailerClock(8.05);
        onJumpTitleScene(2);
        return;
      }
      if (e.code === 'Digit3') {
        setAudioUnlocked(true);
        setTrailerClock(16.05);
        onJumpTitleScene(3);
        return;
      }
      if (e.code === 'Digit4') {
        setAudioUnlocked(true);
        setTrailerClock(24.05);
        onJumpTitleScene(4);
        return;
      }
      if (e.code === 'Digit5') {
        setAudioUnlocked(true);
        setTrailerClock(27.25);
        onJumpTitleScene(5);
        return;
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        setAudioUnlocked(true);
        onStartRace();
      }
    };
    const onUnlockEvt = () => setAudioUnlocked(true);
    window.addEventListener('ufr-audio-unlocked', onUnlockEvt);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('ufr-audio-unlocked', onUnlockEvt);
      window.removeEventListener('keydown', onKey);
    };
  }, [onStartRace, onJumpTitleScene, onToggleMute, onToggleEgoHudMode]);

  const handleSceneClick = (scene: 1 | 2 | 3 | 4 | 5) => {
    setAudioUnlocked(true);
    onEnableAudio();
    const starts: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0.05,
      2: 8.05,
      3: 16.05,
      4: 24.05,
      5: 27.25,
    };
    setTrailerClock(starts[scene]);
    onJumpTitleScene(scene);
  };

  const handleAudioClick = () => {
    if (!audioUnlocked && !muted) {
      setAudioUnlocked(true);
      onEnableAudio();
      return;
    }
    setAudioUnlocked(true);
    onToggleMute();
  };

  const handleSelectPinEvent = (pin: F1WorldMapPin) => {
    setSelectedPin(pin);
    const matchedTrack = CIRCUIT_TRACKS.find((t) => t.id === pin.trackId);
    if (matchedTrack) onSelectTrack(matchedTrack);
    onSelectWeather(pin.weather);
  };

  if (egoHudMode) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-20 pointer-events-none flex items-end justify-start p-3 sm:p-5">
        <div
          className="pointer-events-auto rounded-2xl border border-white/15 px-3 py-2 flex flex-wrap items-center gap-2 shadow-2xl max-w-[64vw]"
          style={{ backgroundColor: 'rgba(9, 11, 15, 0.90)' }}
        >
          <button
            type="button"
            onClick={onStartRace}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-bold text-xs sm:text-sm tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-lg"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>DRIVE NOW</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onToggleEgoHudMode) onToggleEgoHudMode();
              setF1WorldTab('events');
            }}
            className="px-2.5 py-1.5 rounded-lg border border-red-500/45 bg-red-600/20 text-xs font-semibold text-red-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5 text-red-400" />
            <span>F1® World Map</span>
          </button>

          <button
            type="button"
            onClick={onOpenDrivers}
            className="px-2.5 py-1.5 rounded-lg border border-white/15 text-xs font-semibold text-white hover:border-white/35 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Drivers &amp; Academy</span>
          </button>

          <button
            type="button"
            onClick={onOpenGarage}
            className="px-2.5 py-1.5 rounded-lg border border-white/15 text-xs font-semibold text-white hover:border-white/35 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span>Garage &amp; R&amp;D</span>
          </button>

          <div className="hidden md:flex items-center gap-1 bg-white/5 px-1.5 py-1 rounded-lg">
            {TRAILER_SCENES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSceneClick(s.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  currentClip.id === s.id
                    ? 'bg-fuchsia-500 text-white font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {s.id === 2 ? 'Wet GP' : `C${s.id}`}
              </button>
            ))}
          </div>

          {onToggleEgoHudMode && (
            <button
              type="button"
              onClick={onToggleEgoHudMode}
              title="Switch between In-Game Broadcast HUD and Full F1 25 Menu (H)"
              className="px-2.5 py-1.5 rounded-lg border border-cyan-400/50 bg-cyan-500/15 text-xs font-semibold text-cyan-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>F1® 25 Menu (H)</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (cinemaMode) {
    return (
      <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
        <div
          className="pointer-events-auto self-start rounded-xl border border-white/15 px-3.5 py-2 flex flex-col gap-0.5 max-w-xl"
          style={{ backgroundColor: 'rgba(9, 11, 15, 0.78)' }}
        >
          <div className="flex items-center gap-2 text-[11px] font-mono-telemetry font-bold text-orange-400">
            <span>{currentClip.title}</span>
            <span className="text-slate-400">·</span>
            <span className="text-white tabular-nums">
              00:{Math.floor(trailerClock).toString().padStart(2, '0')} / 00:32
            </span>
          </div>
          <div className="text-xs text-slate-200 truncate">{currentClip.subtitle}</div>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div
            className="pointer-events-auto rounded-xl border border-white/15 px-2.5 py-1.5 flex flex-col gap-1.5"
            style={{ backgroundColor: 'rgba(9, 11, 15, 0.82)' }}
          >
            <div className="flex items-center gap-1">
              <Film className="w-3.5 h-3.5 text-orange-400 mr-1" />
              {TRAILER_SCENES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSceneClick(s.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    currentClip.id === s.id
                      ? 'bg-orange-500 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {s.shortLabel}
                </button>
              ))}
            </div>
            <div className="w-full h-1 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-100"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleAudioClick}
              className="px-3 py-2 rounded-xl border border-white/15 text-xs font-semibold text-white hover:border-white/35 flex items-center gap-1.5 transition-colors cursor-pointer"
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.82)' }}
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{muted ? 'Muted' : audioUnlocked ? 'Sound On' : 'Play Sound'}</span>
            </button>
            <button
              type="button"
              onClick={() => setCinemaMode(false)}
              className="px-3 py-2 rounded-xl border border-white/15 text-xs font-semibold text-white hover:border-white/35 flex items-center gap-1.5 transition-colors cursor-pointer"
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.82)' }}
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Show Menu (H)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
      {/* TOP BAR: F1 25 Navigation Tabs + Top-Right F1 World Player Status Bar (Tier 50 · Tech Level 929 · Safety Rating A) */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* F1 25 Top Navigation Strip (from Screenshot 1, 9, 10) */}
          <div
            className="pointer-events-auto rounded-xl border border-white/15 p-1 flex flex-wrap items-center gap-1 shadow-2xl"
            style={{ backgroundColor: 'rgba(12, 14, 19, 0.92)' }}
          >
            {(
              [
                { id: 'showroom', label: '3D SHOWROOM' },
                { id: 'series', label: 'SERIES' },
                { id: 'events', label: 'SOLO & MULTIPLAYER EVENTS' },
                { id: 'invitationals', label: 'INVITATIONALS' },
              ] as { id: F1WorldTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setF1WorldTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-display font-bold text-xs tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                  f1WorldTab === tab.id
                    ? 'bg-[#EF4444] text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <div className="w-px h-5 bg-white/15 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={onOpenDrivers}
              className="px-3 py-1.5 rounded-lg font-display font-bold text-xs tracking-wider text-cyan-300 hover:text-white hover:bg-white/5 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>DRIVERS &amp; ACADEMY</span>
            </button>
            <button
              type="button"
              onClick={onOpenGarage}
              className="px-3 py-1.5 rounded-lg font-display font-bold text-xs tracking-wider text-amber-300 hover:text-white hover:bg-white/5 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>ENGINEERING &amp; R&amp;D</span>
            </button>
          </div>

          {/* F1 World Top-Right Status Bar (from Screenshot 1) + Audio / Settings */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <div
              className="hidden xl:flex items-center gap-3 rounded-xl border border-red-500/35 px-3.5 py-1.5 text-xs shadow-xl"
              style={{
                background: 'linear-gradient(90deg, rgba(28, 12, 16, 0.92) 0%, rgba(12, 15, 22, 0.94) 100%)',
              }}
            >
              <span className="text-slate-300 font-medium">No Boost</span>
              <div className="w-px h-4 bg-white/15" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Tier</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-300 text-slate-950 font-mono-telemetry font-bold text-[11px]">
                  50
                </span>
              </div>
              <div className="w-px h-4 bg-white/15" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-300">Tech Level</span>
                <span className="px-1.5 py-0.5 rounded border border-white/30 bg-black/50 font-mono-telemetry font-bold text-white">
                  {techLevel}
                </span>
              </div>
              <div className="w-px h-4 bg-white/15" />
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-display font-bold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>A</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAudioClick}
              className="px-3 py-2 rounded-xl border border-white/15 text-xs font-semibold text-white hover:border-white/35 flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className={`w-4 h-4 ${audioUnlocked ? 'text-emerald-400' : 'text-amber-400'}`} />
              )}
              <span className="hidden sm:inline">{muted ? 'Muted' : 'Audio'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAudioUnlocked(true);
                onEnableAudio();
                if (onToggleEgoHudMode) onToggleEgoHudMode();
              }}
              className="px-3 py-2 rounded-xl border border-cyan-400/45 text-xs font-semibold text-cyan-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
            >
              <Eye className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">OSD (H)</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="px-3 py-2 rounded-xl border border-white/15 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">PS5™ Settings</span>
            </button>
          </div>
        </div>

        {/* Title Lockup & Active Driver/Team Strip (when in Showroom Mode) */}
        {f1WorldTab === 'showroom' && (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <div className="flex items-center gap-3 mb-1.5">
                <svg width="42" height="20" viewBox="0 0 44 24" fill="none" aria-hidden="true">
                  <path d="M2 18L14 6H42L36 12H18L10 18H2Z" fill="#EF4444" />
                  <path d="M12 20L20 13H40L35 18H19L15 20H12Z" fill="#F8FAFC" />
                </svg>
                <span className="text-xs font-semibold tracking-widest text-amber-400 uppercase">
                  EA SPORTS™ F1® 25 &amp; 2026 CHAMPIONSHIP · {career.championshipPoints} PTS · {career.credits.toLocaleString()} CR
                </span>
              </div>
              <h1
                className="font-display font-bold text-3xl sm:text-5xl tracking-tight text-white leading-[1.05]"
                style={{ textShadow: '0 4px 24px rgba(0,0,0,0.6)' }}
              >
                Ultimate Formula Racing
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                {selectedDriver.name} (#{selectedDriver.number}) · {selectedTeam.name} · {selectedTrack.name} ({selectedTrack.lengthKm} km)
              </p>
            </div>

            {/* 4-Clip 32s Combined Trailer Selector */}
            <div
              className="pointer-events-auto rounded-xl border border-white/12 px-2 py-1.5 flex items-center gap-1"
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.84)' }}
            >
              <Film className="w-3.5 h-3.5 text-orange-400 mx-1 shrink-0" />
              {TRAILER_SCENES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSceneClick(s.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    currentClip.id === s.id
                      ? 'bg-orange-500 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {s.shortLabel}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CENTER OVERLAY: F1 World Crimson Global Map (Series & Solo/Multiplayer Events) OR Invitationals Modal */}
      {f1WorldTab !== 'showroom' && (
        <div
          className="pointer-events-auto my-auto w-full max-w-[1360px] mx-auto rounded-2xl border border-red-500/35 overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12 min-h-[420px]"
          style={{
            background:
              'radial-gradient(circle at 65% 45%, rgba(65, 12, 18, 0.94) 0%, rgba(10, 14, 18, 0.96) 75%)',
          }}
        >
          {/* Left Panel: F1 World Series / Event Details Card (matches Screenshot 1 & 9) */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-white/15 p-5 flex flex-col justify-between bg-[#12161F]/95">
            {f1WorldTab === 'invitationals' ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-red-400 tracking-wider uppercase">
                      F1® World
                    </div>
                    <h2 className="font-display font-black text-2xl text-white tracking-wide">
                      INVITATIONALS
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setF1WorldTab('showroom')}
                    className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Invitationals are special multiplayer &amp; solo collaborative events featuring Konnersport Butler Global, APXGP, and Floodlit Street Showdowns.
                </p>
                <div className="flex flex-col gap-2.5 mt-1">
                  {F1_INVITATIONALS.map((inv) => (
                    <div
                      key={inv.id}
                      className="rounded-xl border border-white/15 bg-black/45 p-3 flex flex-col gap-1.5 hover:border-red-500/60 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-sm text-white">
                          {inv.title}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-red-600/25 border border-red-500/40 text-[10px] font-mono-telemetry font-bold text-red-300">
                          Tech {inv.techRequired}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">{inv.location}</div>
                      <div className="text-[11px] text-slate-300">{inv.description}</div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-white/10 mt-1">
                        <span className="text-[10px] font-mono-telemetry text-amber-300 font-semibold">
                          {inv.rewardText}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectWeather(inv.weather);
                            onStartRace();
                          }}
                          className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-display font-bold text-[11px] cursor-pointer"
                        >
                          Launch Event
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-300">F1® World</div>
                      <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase">
                        {f1WorldTab === 'series' ? 'CHOOSE SERIES' : selectedPin.eventTitle}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setF1WorldTab('showroom')}
                      className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                      title="Back to 3D Showroom"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Active Circuit & Weather Banner */}
                  <div className="rounded-xl border border-red-500/40 bg-gradient-to-br from-red-950/60 to-slate-950/90 p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-red-600 text-white font-display font-bold text-[10px] tracking-wider uppercase">
                        {selectedPin.label}
                      </span>
                      <span className="font-mono-telemetry text-xs text-amber-300 font-bold">
                        Rec. Tech {selectedPin.recommendedTech}
                      </span>
                    </div>
                    <div className="font-display font-bold text-base text-white">
                      {selectedPin.eventTitle}
                    </div>
                    <div className="text-xs text-slate-300 leading-relaxed">
                      {selectedPin.eventSubtitle}
                    </div>

                    {/* Data Pills (Tyre Wear Data · Setup Data) from Screenshot 9 */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-[11px]">
                      {selectedPin.rewards.slice(0, 2).map((rw) => (
                        <div
                          key={rw}
                          className="rounded-lg bg-black/45 border border-white/10 px-2.5 py-1.5 flex items-center gap-1.5 text-slate-200 font-semibold"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="truncate">{rw}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Event Objective Box (from Screenshot 9) */}
                  <div className="rounded-xl border border-white/15 bg-black/40 p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Event Objective
                      </div>
                      <div className="font-display font-bold text-sm text-white mt-0.5">
                        {selectedPin.objectiveText}
                      </div>
                    </div>
                    <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={onStartRace}
                    className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Enter Event · {selectedPin.label}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Right Panel: Stylized Crimson F1 World Map with Interactive Circuit Pins (from Screenshot 1 & 9) */}
          <div className="lg:col-span-8 relative min-h-[360px] flex items-center justify-center overflow-hidden p-4">
            {/* Stylized Crimson Continents SVG Map */}
            <svg
              viewBox="0 0 1000 520"
              className="w-full h-full max-h-[420px] select-none"
              aria-label="F1 World Global Event Map"
            >
              <defs>
                <linearGradient id="f1CrimsonContinent" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#991B1B" stopOpacity="0.88" />
                  <stop offset="50%" stopColor="#DC2626" stopOpacity="0.78" />
                  <stop offset="100%" stopColor="#7F1D1D" stopOpacity="0.85" />
                </linearGradient>
              </defs>
              {/* Subtle Grid Lines */}
              <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
                <line x1="0" y1="130" x2="1000" y2="130" />
                <line x1="0" y1="260" x2="1000" y2="260" />
                <line x1="0" y1="390" x2="1000" y2="390" />
                <line x1="250" y1="0" x2="250" y2="520" />
                <line x1="500" y1="0" x2="500" y2="520" />
                <line x1="750" y1="0" x2="750" y2="520" />
              </g>
              {/* North America */}
              <path
                d="M110,75 L245,55 L335,105 L315,195 L265,245 L215,265 L175,215 L125,155 Z"
                fill="url(#f1CrimsonContinent)"
              />
              {/* South America */}
              <path
                d="M275,285 L355,305 L385,375 L335,475 L295,465 L270,365 Z"
                fill="url(#f1CrimsonContinent)"
              />
              {/* Europe */}
              <path
                d="M445,95 L565,75 L605,155 L545,205 L460,195 L440,145 Z"
                fill="url(#f1CrimsonContinent)"
              />
              {/* Africa */}
              <path
                d="M455,220 L575,220 L625,305 L575,435 L510,430 L470,325 Z"
                fill="url(#f1CrimsonContinent)"
              />
              {/* Asia & Middle East */}
              <path
                d="M585,85 L865,65 L935,175 L865,295 L755,310 L655,255 L595,195 Z"
                fill="url(#f1CrimsonContinent)"
              />
              {/* Australia */}
              <path
                d="M790,365 L905,365 L920,445 L825,460 L780,415 Z"
                fill="url(#f1CrimsonContinent)"
              />
            </svg>

            {/* Interactive Circuit Pins */}
            {F1_WORLD_MAP_PINS.map((pin) => {
              const active = selectedPin.id === pin.id;
              return (
                <button
                  key={pin.id}
                  type="button"
                  onClick={() => handleSelectPinEvent(pin)}
                  style={{ left: `${pin.xPct}%`, top: `${pin.yPct}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer flex flex-col items-center"
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 transition-transform ${
                      active
                        ? 'scale-125 bg-white border-red-500 shadow-[0_0_16px_#EF4444]'
                        : 'bg-red-600 border-white/90 group-hover:scale-110'
                    }`}
                  />
                  <span
                    className={`mt-1 px-2 py-0.5 rounded text-[10px] font-display font-bold tracking-wider whitespace-nowrap transition-all ${
                      active
                        ? 'bg-red-600 text-white shadow-lg'
                        : 'bg-black/75 text-slate-200 border border-white/15'
                    }`}
                  >
                    {pin.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* BOTTOM BAR: Landscape Configuration Strip + Start CTA */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div
          className="pointer-events-auto rounded-2xl border border-white/12 p-3 sm:p-4 flex flex-wrap items-center gap-4"
          style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
        >
          {/* Mode Tabs */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wider text-slate-400">MODE</span>
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
              {(
                [
                  { id: 'quick_race', label: 'Race' },
                  { id: 'career', label: 'Career' },
                  { id: 'championship', label: 'Championship' },
                  { id: 'time_trial', label: 'Time Trial' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMode(m.id)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    gameMode === m.id ? 'bg-red-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden sm:block w-px h-9 bg-white/10" />

          {/* Circuit Selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wider text-slate-400">CIRCUIT</span>
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
              {CIRCUIT_TRACKS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTrack(t)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedTrack.id === t.id ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t.country}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden sm:block w-px h-9 bg-white/10" />

          {/* Weather Selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wider text-slate-400">CONDITIONS</span>
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg flex-wrap">
              <button
                type="button"
                onClick={() => onSelectWeather('day')}
                className={`px-2 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  weather === 'day' ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Sun</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectWeather('sunset')}
                className={`px-2 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  weather === 'sunset' ? 'bg-orange-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sunset className="w-3.5 h-3.5" />
                <span>Sunset</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectWeather('cloudy')}
                className={`px-2 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  weather === 'cloudy' ? 'bg-slate-200 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Cloudy</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectWeather('rain')}
                className={`px-2 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  weather === 'rain' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                <CloudRain className="w-3.5 h-3.5" />
                <span>Rain</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectWeather('heavy_rain')}
                className={`px-2 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  weather === 'heavy_rain' ? 'bg-indigo-400 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                <CloudLightning className="w-3.5 h-3.5" />
                <span>Storm</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectWeather('night')}
                className={`px-2 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  weather === 'night' ? 'bg-sky-400 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Night</span>
              </button>
              <button
                type="button"
                onClick={onToggleDynamicWeather}
                className={`px-2 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap border ${
                  dynamicWeather || totalLaps >= 5
                    ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-300'
                    : 'border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <span>Dynamic</span>
              </button>
            </div>
          </div>
        </div>

        {/* Start CTA & Control Hint */}
        <div className="flex flex-col items-start lg:items-end gap-2">
          <button
            type="button"
            onClick={onStartRace}
            className="pointer-events-auto px-7 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-bold text-base sm:text-lg tracking-wide flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xl"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Start Race</span>
          </button>
          <p className="text-xs text-slate-300" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
            WASD / Arrows Drive · Space Overtake ERS/DRS · 1-5 Scenes · H OSD
          </p>
        </div>
      </div>
    </div>
  );
};
