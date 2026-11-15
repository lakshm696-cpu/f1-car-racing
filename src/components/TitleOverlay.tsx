import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Crown,
  Eye,
  Film,
  Flame,
  Gauge,
  Globe,
  Layers,
  Lock,
  Moon,
  Play,
  Settings2,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Trophy,
  UserCheck,
  Volume2,
  VolumeX,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  CIRCUIT_TRACKS,
  F1_INVITATIONALS,
  F1_WORLD_MAP_PINS,
  F1WorldMapPin,
} from '../data/racingData';
import { getCircuitEnvironmentConfig } from '../three/circuitEnvironments';
import {
  CareerProgress,
  CarUpgrades,
  CircuitTrack,
  DriverProfile,
  FormulaTeam,
  GameMode,
  PreRacePitStrategy,
  TimeOfDayMode,
  WeatherMode,
} from '../types/racing';

interface TitleOverlayProps {
  selectedTrack: CircuitTrack;
  selectedTeam: FormulaTeam;
  selectedDriver: DriverProfile;
  career: CareerProgress;
  upgrades?: CarUpgrades;
  gameMode: GameMode;
  weather: WeatherMode;
  dynamicWeather: boolean;
  timeOfDay?: TimeOfDayMode;
  dynamicTimeOfDay?: boolean;
  totalLaps: number;
  pitStrategyPlan?: PreRacePitStrategy;
  muted: boolean;
  egoHudMode?: boolean;
  onToggleEgoHudMode?: () => void;
  onSelectTrack: (track: CircuitTrack) => void;
  onSelectMode: (mode: GameMode) => void;
  onSelectWeather: (weather: WeatherMode) => void;
  onToggleDynamicWeather: () => void;
  onSelectTimeOfDay?: (tod: TimeOfDayMode) => void;
  onToggleDynamicTimeOfDay?: () => void;
  onToggleMute: () => void;
  onEnableAudio: () => void;
  onOpenDrivers: () => void;
  onOpenGarage: () => void;
  onOpenPitStrategy?: () => void;
  onOpenSettings: () => void;
  onClaimAchievement?: (achievementId: string, creditBonus: number, techBonus: number) => void;
  onJumpTitleScene: (scene: 1 | 2 | 3 | 4 | 5) => void;
  onStartRace: () => void;
}

type F1WorldTab = 'showroom' | 'series' | 'events' | 'invitationals' | 'achievements';
type AchievementFilter = 'all' | 'unlocked' | 'locked' | 'race_craft' | 'engineering' | 'championship';

interface CareerMilestone {
  id: string;
  title: string;
  category: 'race_craft' | 'engineering' | 'championship';
  categoryLabel: string;
  tier: 'PLATINUM' | 'GOLD' | 'SILVER';
  description: string;
  requirementText: string;
  current: number;
  target: number;
  unitLabel: string;
  unlocked: boolean;
  claimed: boolean;
  creditReward: number;
  techReward: number;
  actionType: 'race' | 'garage' | 'drivers';
  actionLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
}

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
  upgrades = {
    engineLevel: 1,
    tyreLevel: 1,
    brakeLevel: 1,
    suspensionLevel: 1,
    aeroLevel: 1,
  },
  gameMode,
  weather,
  dynamicWeather,
  timeOfDay = 'afternoon',
  dynamicTimeOfDay = false,
  totalLaps,
  pitStrategyPlan,
  muted,
  egoHudMode = true,
  onToggleEgoHudMode,
  onSelectTrack,
  onSelectMode,
  onSelectWeather,
  onToggleDynamicWeather,
  onSelectTimeOfDay,
  onToggleDynamicTimeOfDay,
  onToggleMute,
  onEnableAudio,
  onOpenDrivers,
  onOpenGarage,
  onOpenPitStrategy,
  onOpenSettings,
  onClaimAchievement,
  onJumpTitleScene,
  onStartRace,
}) => {
  const [cinemaMode, setCinemaMode] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [trailerClock, setTrailerClock] = useState(8.05);
  const [f1WorldTab, setF1WorldTab] = useState<F1WorldTab>('showroom');
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>('all');
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

  const milestones = useMemo<CareerMilestone[]>(() => {
    const claimedSet = new Set(career.claimedAchievements ?? []);
    const poleCount = Math.max(
      career.polePositions ?? 0,
      career.totalVictories,
      Math.floor(career.championshipPoints / 25)
    );
    const totalUpgradeLevels =
      upgrades.engineLevel +
      upgrades.tyreLevel +
      upgrades.brakeLevel +
      upgrades.suspensionLevel +
      upgrades.aeroLevel;
    const maxRivalCloseFinishes = Object.values(career.rivalryScores ?? {}).reduce(
      (maxVal, r) => Math.max(maxVal, r.closeFinishes),
      0
    );
    const hasActiveRival = Boolean(career.activeRivalId) || maxRivalCloseFinishes >= 2;

    return [
      {
        id: 'first_win',
        title: 'First Win',
        category: 'race_craft',
        categoryLabel: 'Race Craft',
        tier: 'GOLD',
        description:
          'Take the checkered flag in P1 to claim your maiden Formula 1® Grand Prix victory.',
        requirementText: 'Win 1 Grand Prix',
        current: Math.min(1, career.totalVictories),
        target: 1,
        unitLabel: 'Wins',
        unlocked: career.totalVictories >= 1,
        claimed: claimedSet.has('first_win'),
        creditReward: 2500,
        techReward: 5,
        actionType: 'race',
        actionLabel: 'Drive Now',
        Icon: Trophy,
      },
      {
        id: 'pole_position_king',
        title: 'Pole Position King',
        category: 'race_craft',
        categoryLabel: 'Qualifying & Pace',
        tier: 'PLATINUM',
        description:
          'Command the front of the grid with 3 Pole / P1 fastest-lap triumphs or 75+ Championship Points.',
        requirementText: '3 Pole / P1 Fastest-Lap Finishes',
        current: Math.min(3, poleCount),
        target: 3,
        unitLabel: 'Poles / P1s',
        unlocked: poleCount >= 3,
        claimed: claimedSet.has('pole_position_king'),
        creditReward: 5000,
        techReward: 10,
        actionType: 'race',
        actionLabel: 'Set Fastest Pace',
        Icon: Crown,
      },
      {
        id: 'engine_master',
        title: 'Engine Master',
        category: 'engineering',
        categoryLabel: 'Engineering & R&D',
        tier: 'PLATINUM',
        description:
          'Develop the 2026 Hybrid V6 Turbo & MGU-K Power Unit to Stage 3 Maximum Spec in the Garage.',
        requirementText: 'Reach Engine R&D Level 3',
        current: Math.min(3, upgrades.engineLevel),
        target: 3,
        unitLabel: 'Stage',
        unlocked: upgrades.engineLevel >= 3,
        claimed: claimedSet.has('engine_master'),
        creditReward: 4000,
        techReward: 12,
        actionType: 'garage',
        actionLabel: 'Upgrade Power Unit',
        Icon: Zap,
      },
      {
        id: 'centurion_scorer',
        title: 'Centurion Scorer',
        category: 'championship',
        categoryLabel: 'World Championship',
        tier: 'GOLD',
        description:
          'Accumulate 100 FIA Formula 1® World Championship Points across your racing career.',
        requirementText: 'Score 100 Championship Points',
        current: Math.min(100, career.championshipPoints),
        target: 100,
        unitLabel: 'PTS',
        unlocked: career.championshipPoints >= 100,
        claimed: claimedSet.has('centurion_scorer'),
        creditReward: 6000,
        techReward: 15,
        actionType: 'race',
        actionLabel: 'Score Points',
        Icon: Award,
      },
      {
        id: 'podium_regular',
        title: 'Grand Prix Veteran',
        category: 'race_craft',
        categoryLabel: 'Race Craft',
        tier: 'SILVER',
        description:
          'Complete 5 full Grand Prix events across the 2026 international calendar.',
        requirementText: 'Complete 5 Races',
        current: Math.min(5, career.racesCompleted),
        target: 5,
        unitLabel: 'Races',
        unlocked: career.racesCompleted >= 5,
        claimed: claimedSet.has('podium_regular'),
        creditReward: 3500,
        techReward: 8,
        actionType: 'race',
        actionLabel: 'Enter Grand Prix',
        Icon: Gauge,
      },
      {
        id: 'rivalry_dominator',
        title: 'Rivalry Dominator',
        category: 'championship',
        categoryLabel: 'Paddock Rivalry',
        tier: 'GOLD',
        description:
          'Ignite an official on-track rivalry with 2+ wheel-to-wheel finishes within 3.5 seconds.',
        requirementText: '2 Close Wheel-to-Wheel Finishes',
        current: Math.min(2, hasActiveRival ? 2 : maxRivalCloseFinishes),
        target: 2,
        unitLabel: 'Duels',
        unlocked: hasActiveRival,
        claimed: claimedSet.has('rivalry_dominator'),
        creditReward: 4500,
        techReward: 10,
        actionType: 'race',
        actionLabel: 'Battle Rival',
        Icon: Flame,
      },
      {
        id: 'full_factory_spec',
        title: 'Full Factory Spec',
        category: 'engineering',
        categoryLabel: 'Engineering & R&D',
        tier: 'GOLD',
        description:
          'Reach 10+ combined R&D upgrade levels across Engine, Tyres, Brakes, Suspension, and Active Aero.',
        requirementText: '10 Total R&D Upgrade Levels',
        current: Math.min(10, totalUpgradeLevels),
        target: 10,
        unitLabel: 'Levels',
        unlocked: totalUpgradeLevels >= 10,
        claimed: claimedSet.has('full_factory_spec'),
        creditReward: 5500,
        techReward: 14,
        actionType: 'garage',
        actionLabel: 'Open R&D Lab',
        Icon: Wrench,
      },
      {
        id: 'paddock_mogul',
        title: 'Paddock High Roller',
        category: 'championship',
        categoryLabel: 'Career Status',
        tier: 'SILVER',
        description:
          'Build a factory war chest of 12,000+ Credits through prize purses and milestone bonuses.',
        requirementText: 'Accumulate 12,000 Credits',
        current: Math.min(12000, career.credits),
        target: 12000,
        unitLabel: 'CR',
        unlocked: career.credits >= 12000 || techLevel >= 945,
        claimed: claimedSet.has('paddock_mogul'),
        creditReward: 3000,
        techReward: 8,
        actionType: 'drivers',
        actionLabel: 'Driver Academy',
        Icon: Sparkles,
      },
    ];
  }, [career, upgrades, techLevel]);

  const unlockedCount = useMemo(
    () => milestones.filter((m) => m.unlocked).length,
    [milestones]
  );
  const unclaimedCount = useMemo(
    () => milestones.filter((m) => m.unlocked && !m.claimed).length,
    [milestones]
  );
  const filteredMilestones = useMemo(() => {
    return milestones.filter((m) => {
      if (achievementFilter === 'unlocked') return m.unlocked;
      if (achievementFilter === 'locked') return !m.unlocked;
      if (achievementFilter === 'race_craft') return m.category === 'race_craft';
      if (achievementFilter === 'engineering') return m.category === 'engineering';
      if (achievementFilter === 'championship') return m.category === 'championship';
      return true;
    });
  }, [milestones, achievementFilter]);

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

          <button
            type="button"
            onClick={() => {
              if (onToggleEgoHudMode) onToggleEgoHudMode();
              setF1WorldTab('achievements');
            }}
            className="px-2.5 py-1.5 rounded-lg border border-amber-400/50 bg-amber-500/20 text-xs font-semibold text-amber-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Career Achievements</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-mono-telemetry font-bold text-[10px]">
              {unlockedCount}/{milestones.length}
            </span>
          </button>

          {onOpenPitStrategy && (
            <button
              type="button"
              onClick={onOpenPitStrategy}
              className="px-2.5 py-1.5 rounded-lg border border-amber-400/50 bg-amber-500/15 text-xs font-semibold text-amber-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5 text-amber-300" />
              <span>
                Pit Strategy ({totalLaps}L · {pitStrategyPlan?.stops.length ?? 0}-Stop)
              </span>
            </button>
          )}

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
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-b from-black/25 via-transparent to-black/45">
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
                { id: 'achievements', label: 'CAREER ACHIEVEMENTS' },
              ] as { id: F1WorldTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setF1WorldTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-display font-bold text-xs tracking-wider transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  f1WorldTab === tab.id
                    ? 'bg-[#EF4444] text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.id === 'achievements' && <Trophy className="w-3.5 h-3.5 text-amber-300" />}
                <span>{tab.label}</span>
                {tab.id === 'achievements' && (
                  <span
                    className={`px-1.5 py-0.2 rounded font-mono-telemetry font-bold text-[10px] ${
                      f1WorldTab === 'achievements'
                        ? 'bg-white text-red-600'
                        : unclaimedCount > 0
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-white/15 text-slate-200'
                    }`}
                  >
                    {unlockedCount}/{milestones.length}
                  </span>
                )}
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
            {onOpenPitStrategy && (
              <button
                type="button"
                onClick={onOpenPitStrategy}
                className="px-3 py-1.5 rounded-lg font-display font-bold text-xs tracking-wider text-emerald-300 hover:text-white hover:bg-white/5 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>PIT STRATEGY</span>
              </button>
            )}
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
            <div
              className="max-w-xl rounded-2xl border border-white/10 px-4 py-2.5 shadow-xl"
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.72)' }}
            >
              <div className="flex items-center gap-3 mb-1">
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
              <p className="text-xs sm:text-sm text-slate-100 mt-1">
                {selectedDriver.name} (#{selectedDriver.number}) · {selectedTeam.name} · {selectedTrack.name} ({selectedTrack.lengthKm} km)
              </p>
              <p className="text-[11px] font-mono-telemetry text-cyan-300 mt-0.5">
                Environment: {getCircuitEnvironmentConfig(selectedTrack).displayLabel}
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

      {/* CENTER OVERLAY: Career Achievements, F1 World Crimson Global Map, OR Invitationals Modal */}
      {f1WorldTab === 'achievements' && (
        <div
          className="pointer-events-auto my-auto w-full max-w-[1360px] mx-auto rounded-2xl border border-amber-500/35 overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12 min-h-[430px] max-h-[68vh]"
          style={{
            background:
              'radial-gradient(circle at 72% 28%, rgba(78, 42, 10, 0.92) 0%, rgba(11, 14, 21, 0.97) 72%)',
          }}
        >
          {/* Left Panel: Career Legacy Summary, Telemetry & Category Filters */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-white/15 p-5 flex flex-col justify-between bg-[#10141D]/95">
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-amber-400 tracking-widest uppercase flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>FIA Hall of Fame &amp; Milestones</span>
                  </div>
                  <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase">
                    CAREER ACHIEVEMENTS
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

              {/* Overall Completion Progress Card */}
              <div className="rounded-xl border border-amber-400/35 bg-gradient-to-br from-amber-950/45 via-slate-900/90 to-slate-950/95 p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Milestone Completion
                  </span>
                  <span className="font-mono-telemetry font-bold text-sm text-amber-300">
                    {unlockedCount} / {milestones.length} Unlocked (
                    {Math.round((unlockedCount / milestones.length) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${(unlockedCount / milestones.length) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1">
                  <span>
                    Rank:{' '}
                    <strong className="text-white">
                      {unlockedCount >= 7
                        ? 'World Champion Legend'
                        : unlockedCount >= 4
                          ? 'Grand Prix Contender'
                          : unlockedCount >= 1
                            ? 'Paddock Podium Rising'
                            : 'FIA Rookie Challenger'}
                    </strong>
                  </span>
                  {unclaimedCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-semibold text-[10px]">
                      {unclaimedCount} Reward{unclaimedCount > 1 ? 's' : ''} Ready
                    </span>
                  )}
                </div>
              </div>

              {/* Live Career Data Snapshot */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-black/45 border border-white/10 p-2">
                  <div className="text-[10px] text-slate-400 uppercase">Victories</div>
                  <div className="font-mono-telemetry font-bold text-base text-white mt-0.5">
                    {career.totalVictories}
                  </div>
                </div>
                <div className="rounded-lg bg-black/45 border border-white/10 p-2">
                  <div className="text-[10px] text-slate-400 uppercase">Poles / P1s</div>
                  <div className="font-mono-telemetry font-bold text-base text-amber-300 mt-0.5">
                    {Math.max(
                      career.polePositions ?? 0,
                      career.totalVictories,
                      Math.floor(career.championshipPoints / 25)
                    )}
                  </div>
                </div>
                <div className="rounded-lg bg-black/45 border border-white/10 p-2">
                  <div className="text-[10px] text-slate-400 uppercase">Engine R&amp;D</div>
                  <div className="font-mono-telemetry font-bold text-base text-cyan-300 mt-0.5">
                    Lv.{upgrades.engineLevel}/3
                  </div>
                </div>
                <div className="rounded-lg bg-black/45 border border-white/10 p-2">
                  <div className="text-[10px] text-slate-400 uppercase">Champ PTS</div>
                  <div className="font-mono-telemetry font-bold text-sm text-white mt-0.5">
                    {career.championshipPoints}
                  </div>
                </div>
                <div className="rounded-lg bg-black/45 border border-white/10 p-2">
                  <div className="text-[10px] text-slate-400 uppercase">Races</div>
                  <div className="font-mono-telemetry font-bold text-sm text-white mt-0.5">
                    {career.racesCompleted}
                  </div>
                </div>
                <div className="rounded-lg bg-black/45 border border-white/10 p-2">
                  <div className="text-[10px] text-slate-400 uppercase">Credits</div>
                  <div className="font-mono-telemetry font-bold text-sm text-emerald-300 mt-0.5">
                    {career.credits.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Filter Milestones
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'all', label: `All (${milestones.length})` },
                      { id: 'unlocked', label: `Unlocked (${unlockedCount})` },
                      { id: 'locked', label: `In Progress (${milestones.length - unlockedCount})` },
                      { id: 'race_craft', label: 'Race Craft' },
                      { id: 'engineering', label: 'Engineering' },
                      { id: 'championship', label: 'Championship' },
                    ] as { id: AchievementFilter; label: string }[]
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAchievementFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        achievementFilter === f.id
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'bg-white/5 text-slate-300 hover:text-white border border-white/10'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10 mt-3">
              <button
                type="button"
                onClick={onOpenGarage}
                className="py-2.5 px-3 rounded-xl border border-amber-400/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 hover:text-white font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5 text-amber-300" />
                <span>R&amp;D Garage</span>
              </button>
              <button
                type="button"
                onClick={onStartRace}
                className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Drive Now</span>
              </button>
            </div>
          </div>

          {/* Right Panel: Unlockable Career Milestones Grid */}
          <div className="lg:col-span-8 p-4 sm:p-5 overflow-y-auto max-h-[64vh] grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
            {filteredMilestones.map((m) => {
              const pct = Math.min(100, Math.round((m.current / m.target) * 100));
              const IconComp = m.Icon;
              const tierColors =
                m.tier === 'PLATINUM'
                  ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
                  : m.tier === 'GOLD'
                    ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                    : 'border-slate-300/40 bg-slate-400/15 text-slate-200';

              return (
                <div
                  key={m.id}
                  className={`rounded-xl border p-3.5 flex flex-col justify-between gap-2.5 transition-all ${
                    m.unlocked
                      ? 'border-amber-400/60 bg-gradient-to-br from-amber-950/40 via-[#131824]/95 to-[#0D111A]/95 shadow-[0_0_24px_rgba(245,158,11,0.12)]'
                      : 'border-white/12 bg-[#0D111A]/85 hover:border-white/25'
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                            m.unlocked
                              ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                              : 'border-white/15 bg-white/5 text-slate-400'
                          }`}
                        >
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-display font-bold text-sm sm:text-base text-white">
                              {m.title}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded border text-[9px] font-mono-telemetry font-bold uppercase ${tierColors}`}
                            >
                              {m.tier}
                            </span>
                          </div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {m.categoryLabel} · {m.requirementText}
                          </div>
                        </div>
                      </div>

                      {m.unlocked ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-mono-telemetry font-bold flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{m.claimed ? 'CLAIMED' : 'UNLOCKED'}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-400 text-[10px] font-mono-telemetry font-semibold flex items-center gap-1 shrink-0">
                          <Lock className="w-3 h-3" />
                          <span>{pct}%</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{m.description}</p>
                  </div>

                  <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono-telemetry text-slate-300">
                        Progress:{' '}
                        <strong className="text-white">
                          {m.current.toLocaleString()} / {m.target.toLocaleString()} {m.unitLabel}
                        </strong>
                      </span>
                      <span className="font-mono-telemetry text-amber-300 font-semibold">
                        +{m.creditReward.toLocaleString()} CR · +{m.techReward} Tech
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          m.unlocked
                            ? 'bg-gradient-to-r from-amber-400 to-emerald-400'
                            : 'bg-gradient-to-r from-red-500 to-amber-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-end pt-0.5">
                      {m.unlocked && !m.claimed && onClaimAchievement ? (
                        <button
                          type="button"
                          onClick={() =>
                            onClaimAchievement(m.id, m.creditReward, m.techReward)
                          }
                          className="w-full py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors shadow-md"
                        >
                          Claim Bonus (+{m.creditReward.toLocaleString()} CR &amp; +{m.techReward} Tech)
                        </button>
                      ) : m.unlocked && m.claimed ? (
                        <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Milestone Reward Claimed</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (m.actionType === 'garage') onOpenGarage();
                            else if (m.actionType === 'drivers') onOpenDrivers();
                            else onStartRace();
                          }}
                          className="px-3 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 text-xs font-semibold text-slate-200 hover:text-white cursor-pointer transition-colors"
                        >
                          {m.actionLabel} →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {f1WorldTab !== 'showroom' && f1WorldTab !== 'achievements' && (
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
            <span className="text-[10px] font-semibold tracking-wider text-slate-400">CIRCUIT ({CIRCUIT_TRACKS.length})</span>
            <div className="flex flex-wrap items-center gap-1 bg-white/5 p-1 rounded-lg max-w-[540px]">
              {CIRCUIT_TRACKS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTrack(t)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedTrack.id === t.id ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t.shortCountry ?? t.country}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden sm:block w-px h-9 bg-white/10" />

          {/* Weather & Time of Day Selectors */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-wider text-slate-400">CONDITIONS</span>
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg flex-wrap">
                <button
                  type="button"
                  onClick={() => onSelectWeather('day')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    weather === 'day' ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Sun</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectWeather('partly_cloudy')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    weather === 'partly_cloudy' ? 'bg-amber-200 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <CloudSun className="w-3.5 h-3.5" />
                  <span>Pt. Cloudy</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectWeather('cloudy')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    weather === 'cloudy' ? 'bg-slate-200 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Overcast</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectWeather('rain')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    weather === 'rain' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <CloudRain className="w-3.5 h-3.5" />
                  <span>Rain</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectWeather('heavy_rain')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    weather === 'heavy_rain' ? 'bg-indigo-400 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <CloudLightning className="w-3.5 h-3.5" />
                  <span>Storm</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectWeather('fog')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    weather === 'fog' ? 'bg-slate-300 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <CloudFog className="w-3.5 h-3.5" />
                  <span>Foggy</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectWeather('snow')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    weather === 'snow' ? 'bg-sky-200 text-slate-950 shadow-[0_0_10px_rgba(224,242,254,0.4)]' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Snowflake className="w-3.5 h-3.5" />
                  <span>Snow</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectWeather('blizzard')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    weather === 'blizzard' ? 'bg-blue-300 text-slate-950 shadow-[0_0_12px_rgba(147,197,253,0.5)]' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Snowflake className="w-3.5 h-3.5 animate-pulse" />
                  <span>Blizzard</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleDynamicWeather}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap border ${
                    dynamicWeather || totalLaps >= 5
                      ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-300'
                      : 'border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <span>Dynamic</span>
                </button>
              </div>
            </div>

            {onSelectTimeOfDay && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold tracking-wider text-slate-400">TIME OF DAY</span>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg flex-wrap">
                  {(
                    [
                      { id: 'morning', label: 'Morning', Icon: Sunrise, activeCls: 'bg-sky-300 text-slate-950' },
                      { id: 'midday', label: 'Midday', Icon: Sun, activeCls: 'bg-amber-300 text-slate-950' },
                      { id: 'afternoon', label: 'Afternoon', Icon: Clock, activeCls: 'bg-amber-400 text-slate-950' },
                      { id: 'golden_hour', label: 'Golden Hr', Icon: Sunset, activeCls: 'bg-orange-400 text-slate-950' },
                      { id: 'sunset', label: 'Sunset', Icon: Sunset, activeCls: 'bg-orange-500 text-slate-950' },
                      { id: 'night', label: 'Night', Icon: Moon, activeCls: 'bg-indigo-400 text-slate-950' },
                    ] as const
                  ).map(({ id, label, Icon, activeCls }) => {
                    const effectiveTod =
                      weather === 'night' ? 'night' : weather === 'sunset' ? 'sunset' : timeOfDay;
                    const isActive = effectiveTod === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelectTimeOfDay(id)}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                          isActive ? activeCls : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                  {onToggleDynamicTimeOfDay && (
                    <button
                      type="button"
                      onClick={onToggleDynamicTimeOfDay}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap border ${
                        dynamicTimeOfDay
                          ? 'border-amber-400/70 bg-amber-500/20 text-amber-300'
                          : 'border-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      <span>Dynamic Cycle</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Start CTA & Pit Strategy Summary */}
        <div className="flex flex-col items-start lg:items-end gap-2">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            {onOpenPitStrategy && (
              <button
                type="button"
                onClick={onOpenPitStrategy}
                className="px-4 py-3 rounded-xl border border-amber-400/50 bg-[#0E121A]/90 hover:bg-white/10 text-amber-200 hover:text-white font-display font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shadow-lg"
              >
                <Layers className="w-4 h-4 text-amber-400" />
                <span>
                  Pit Strategy · {totalLaps}L ·{' '}
                  {(pitStrategyPlan?.startingCompound ?? 'medium').slice(0, 1).toUpperCase()} ·{' '}
                  {pitStrategyPlan?.stops.length ?? 0}-Stop · {pitStrategyPlan?.startingFuelPct ?? 100}% Fuel
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onStartRace}
              className="px-7 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-bold text-base sm:text-lg tracking-wide flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xl"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Race</span>
            </button>
          </div>
          <p className="text-xs text-slate-300" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
            WASD / Arrows Drive · Space Overtake ERS/DRS · 1-5 Scenes · H OSD
          </p>
        </div>
      </div>
    </div>
  );
};
