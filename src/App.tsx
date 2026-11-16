/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DriverSelectionOverlay } from './components/DriverSelectionOverlay';
import { GarageOverlay } from './components/GarageOverlay';
import { PauseSettingsModal, SettingsTab } from './components/PauseResultsModal';
import { PodiumOverlay } from './components/PodiumOverlay';
import { EngineerRadio } from './components/EngineerRadio';
import { TelemetryOverlay } from './components/TelemetryOverlay';
import { Activity } from 'lucide-react';
import { RacingHUD } from './components/RacingHUD';
import { PitStrategyModal } from './components/PitStrategyModal';
import { TitleOverlay } from './components/TitleOverlay';
import { CIRCUIT_TRACKS, F1_2026_SPONSORS, FORMULA_DRIVERS, FORMULA_TEAMS, WHEEL_FINISHES } from './data/racingData';
import { buildDefaultPitStrategy, normalizePitStrategyPlan } from './physics/simulationCalculus';
import { RacingEngine } from './three/RacingEngine';
import { getCircuitEnvironmentConfig } from './three/circuitEnvironments';
import {
  CareerProgress,
  CarUpgrades,
  CircuitTrack,
  DEFAULT_HUD_WIDGETS,
  DEFAULT_ONLINE_GAMEPLAY_SETTINGS,
  DriverProfile,
  FormulaTeam,
  GameMode,
  GameScreen,
  GameSettings,
  GraphicsQuality,
  HudTelemetry,
  OnlineGameplaySettings,
  PodiumCameraShot,
  PowerUnitWear,
  PreRacePitStrategy,
  RacerStanding,
  RivalEncounter,
  TextureQuality,
  TimeOfDayMode,
  TyreCompound,
  WeatherMode,
  WheelFinish,
} from './types/racing';

const CAREER_STORAGE_KEY = 'ufr26_career_v1';
const UPGRADES_STORAGE_KEY = 'ufr26_upgrades_v1';
const ONLINE_STORAGE_KEY = 'ufr26_online_v1';

const DEFAULT_CAREER: CareerProgress = {
  credits: 6000,
  championshipPoints: 0,
  totalVictories: 0,
  racesCompleted: 0,
  rivalryScores: {},
  activeRivalId: null,
  resourcePoints: 296,
  techLevel: 929,
  polePositions: 0,
  podiumFinishes: 0,
  claimedAchievements: [],
  developmentFocus: 'balanced',
  staffAllocation: { aero: 45, powertrain: 45, strategy: 45 },
  sponsorId: 'apex_cloud',
  costCapSpentM: 42.5,
  costCapLimitM: 135,
  seasonRound: 1,
  workforceCount: 135,
  puWear: { ice: 94, mguk: 96, battery: 95, gearbox: 94 },
};

const DEFAULT_UPGRADES: CarUpgrades = {
  engineLevel: 1,
  tyreLevel: 1,
  brakeLevel: 1,
  suspensionLevel: 1,
  aeroLevel: 1,
};

function loadSavedCareer(): CareerProgress {
  if (typeof window === 'undefined') return DEFAULT_CAREER;
  try {
    const raw = window.localStorage.getItem(CAREER_STORAGE_KEY);
    if (!raw) return DEFAULT_CAREER;
    const parsed = JSON.parse(raw) as Partial<CareerProgress>;
    return {
      credits: typeof parsed.credits === 'number' ? parsed.credits : DEFAULT_CAREER.credits,
      championshipPoints:
        typeof parsed.championshipPoints === 'number' ? parsed.championshipPoints : 0,
      totalVictories: typeof parsed.totalVictories === 'number' ? parsed.totalVictories : 0,
      racesCompleted: typeof parsed.racesCompleted === 'number' ? parsed.racesCompleted : 0,
      rivalryScores: parsed.rivalryScores ?? {},
      activeRivalId: typeof parsed.activeRivalId === 'string' ? parsed.activeRivalId : null,
      selectedAcademyId: parsed.selectedAcademyId,
      resourcePoints: typeof parsed.resourcePoints === 'number' ? parsed.resourcePoints : 296,
      techLevel: typeof parsed.techLevel === 'number' ? parsed.techLevel : 929,
      polePositions: typeof parsed.polePositions === 'number' ? parsed.polePositions : 0,
      podiumFinishes: typeof parsed.podiumFinishes === 'number' ? parsed.podiumFinishes : 0,
      claimedAchievements: Array.isArray(parsed.claimedAchievements) ? parsed.claimedAchievements : [],
      developmentFocus: parsed.developmentFocus ?? 'balanced',
      staffAllocation: parsed.staffAllocation ?? { aero: 45, powertrain: 45, strategy: 45 },
      sponsorId: typeof parsed.sponsorId === 'string' ? parsed.sponsorId : 'apex_cloud',
      costCapSpentM: typeof parsed.costCapSpentM === 'number' ? parsed.costCapSpentM : 42.5,
      costCapLimitM: typeof parsed.costCapLimitM === 'number' ? parsed.costCapLimitM : 135,
      seasonRound: typeof parsed.seasonRound === 'number' ? parsed.seasonRound : 1,
      workforceCount: typeof parsed.workforceCount === 'number' ? parsed.workforceCount : 135,
      puWear: parsed.puWear ?? { ice: 94, mguk: 96, battery: 95, gearbox: 94 },
    };
  } catch {
    return DEFAULT_CAREER;
  }
}

function loadSavedUpgrades(): CarUpgrades {
  if (typeof window === 'undefined') return DEFAULT_UPGRADES;
  try {
    const raw = window.localStorage.getItem(UPGRADES_STORAGE_KEY);
    if (!raw) return DEFAULT_UPGRADES;
    const parsed = JSON.parse(raw) as Partial<CarUpgrades>;
    return {
      engineLevel: typeof parsed.engineLevel === 'number' ? parsed.engineLevel : 1,
      tyreLevel: typeof parsed.tyreLevel === 'number' ? parsed.tyreLevel : 1,
      brakeLevel: typeof parsed.brakeLevel === 'number' ? parsed.brakeLevel : 1,
      suspensionLevel: typeof parsed.suspensionLevel === 'number' ? parsed.suspensionLevel : 1,
      aeroLevel: typeof parsed.aeroLevel === 'number' ? parsed.aeroLevel : 1,
    };
  } catch {
    return DEFAULT_UPGRADES;
  }
}

function loadSavedOnlineGameplay(): OnlineGameplaySettings {
  if (typeof window === 'undefined') return { ...DEFAULT_ONLINE_GAMEPLAY_SETTINGS };
  try {
    const raw = window.localStorage.getItem(ONLINE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ONLINE_GAMEPLAY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<OnlineGameplaySettings>;
    return {
      ...DEFAULT_ONLINE_GAMEPLAY_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_ONLINE_GAMEPLAY_SETTINGS };
  }
}

const INITIAL_HUD: HudTelemetry = {
  speedKmh: 248,
  rpm: 11850,
  maxRpm: 13500,
  gear: 7,
  drsAvailable: false,
  drsActive: false,
  ersCharge: 88,
  fuelPct: 96,
  tyreWearPct: 97,
  tyreCompound: 'wet',
  lap: 1,
  totalLaps: 3,
  position: 1,
  totalRacers: 22,
  currentLapMs: 78426,
  lastLapMs: 78604,
  bestLapMs: 77892,
  deltaMs: -214,
  countdownState: 'racing',
  bannerMessage: null,
  wrongWay: false,
  miniMapPath: 'M 20,20 L 80,20 L 80,80 L 20,80 Z',
  miniMapStart: { x: 20, y: 20 },
  miniMapBlips: [],
  miniMapHazards: [],
  miniMapDrsZones: [],
  drsState: {
    inZone: false,
    zoneNumber: null,
    zoneName: null,
    totalZones: 1,
    zoneLengthMeters: null,
    remainingMeters: null,
    approachingMeters: null,
    approachingZoneName: null,
    approachingZoneNumber: null,
    gapQualified: true,
    disabledByWeather: false,
    notification: null,
    notificationZoneNumber: null,
    notificationZoneName: null,
    notificationSeq: 0,
  },
  standings: [],
  cameraMode: 'chase',
  pitBoardActive: false,
  gapAheadSeconds: null,
  damagePct: 0,
  liveWeather: 'day',
  nextWeather: null,
  dynamicWeather: false,
  liveTimeOfDay: 'afternoon',
  trackWetnessPct: 0,
  trackTemperature: 36,
  surfaceGripPct: 98,
  currentSector: 2,
  sectorGripPct: [82, 74, 79],
  activeSurfaceHazard: null,
  queuedCompound: null,
  pitStopRemainingSec: 0,
  inPitWindow: false,
  trackFlag: { flag: 'none', reason: '', distanceMeters: null },
  gForceLat: 0,
  gForceLong: 0,
  gForceTotal: 0,
  pitStrategy: {
    pitWindowStartLap: 1,
    pitWindowEndLap: 2,
    isWindowOpen: false,
    recommendedCompound: 'medium',
    estimatedPitLossSec: 20.5,
    undercutViable: false,
    undercutDeltaSec: null,
    predictedExitPosition: 4,
    tyreDegradationStage: 'fresh',
    tacticalRadioCall: null,
  },
  tyreContactPatch: {
    trackTemperatureC: 36,
    contactAreaRatio: 0.88,
    adhesionRatio: 0.94,
    microSlipRatio: 0.06,
    microSlipPct: 6,
    grainingProbabilityPct: 9,
    grainingSeverityPct: 0,
    wheelMicroSlipPct: [6, 6, 7, 7],
    wheelSurfaceTempC: [93, 93, 95, 95],
    wheelCoreTempC: [95, 95, 97, 97],
    patchState: 'stick',
    gripPenaltyMultiplier: 1.0,
    wearRateMultiplier: 1.0,
  },
  activeAeroMode: 'z_mode',
  manualOverrideAvailable: false,
  manualOverrideActive: false,
  mgukPowerKw: 0,
  wheelWearPct: [97, 96, 98, 97],
  ersMode: 'balanced',
  brakeBiasPct: 57,
  dualsenseConnected: false,
  dualsenseName: null,
  throttleInputPct: 0,
  brakeInputPct: 0,
};

function detectHardwareProfile(): {
  graphicsQuality: GraphicsQuality;
  resolutionScale: number;
  textureQuality: TextureQuality;
  shadowQuality: 'off' | 'medium' | 'high' | 'ultra' | 'cinematic';
  reflectionQuality: 'off' | 'medium' | 'high' | 'ultra' | 'cinematic';
  rayTracingQuality: 'off' | 'high' | 'ultra' | 'cinematic';
  particleDensity: 'low' | 'medium' | 'high' | 'ultra';
  ps5GraphicsMode: 'performance' | 'rt_pro' | 'cinematic';
} {
  if (typeof window === 'undefined') {
    return {
      graphicsQuality: 'ultra_8k',
      resolutionScale: 2.0,
      textureQuality: 'cinematic',
      shadowQuality: 'cinematic',
      reflectionQuality: 'cinematic',
      rayTracingQuality: 'cinematic',
      particleDensity: 'ultra',
      ps5GraphicsMode: 'cinematic',
    };
  }
  let isSoftware = false;
  let isMobileOrIntegrated = false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const rendererStr = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      isSoftware = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
      isMobileOrIntegrated = /Intel|Mali|Adreno|PowerVR|Apple A\d|Vivante|VideoCore/i.test(rendererStr) && !/Iris|Arc|Xe/i.test(rendererStr);
    }
  } catch {
    // fallback
  }

  const isMobileScreen = window.innerWidth < 768 || ('ontouchstart' in window && navigator.maxTouchPoints > 1 && window.innerWidth < 1024);

  if (isSoftware) {
    return {
      graphicsQuality: 'low',
      resolutionScale: 1.0,
      textureQuality: 'medium',
      shadowQuality: 'off',
      reflectionQuality: 'off',
      rayTracingQuality: 'off',
      particleDensity: 'low',
      ps5GraphicsMode: 'performance',
    };
  }

  if (isMobileScreen || isMobileOrIntegrated) {
    return {
      graphicsQuality: 'high',
      resolutionScale: 1.25,
      textureQuality: 'high',
      shadowQuality: 'high',
      reflectionQuality: 'high',
      rayTracingQuality: 'high',
      particleDensity: 'medium',
      ps5GraphicsMode: 'rt_pro',
    };
  }

  return {
    graphicsQuality: 'ultra_8k',
    resolutionScale: 2.0,
    textureQuality: 'cinematic',
    shadowQuality: 'cinematic',
    reflectionQuality: 'cinematic',
    rayTracingQuality: 'cinematic',
    particleDensity: 'ultra',
    ps5GraphicsMode: 'cinematic',
  };
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RacingEngine | null>(null);

  const [screen, setScreen] = useState<GameScreen>('title');
  const [showTitleSettings, setShowTitleSettings] = useState(false);
  const [titleSettingsTab, setTitleSettingsTab] = useState<SettingsTab>('all');
  const [showPitStrategy, setShowPitStrategy] = useState(false);
  const [egoHudMode, setEgoHudMode] = useState(true);

  const [selectedTrack, setSelectedTrack] = useState<CircuitTrack>(CIRCUIT_TRACKS[0]);
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile>(FORMULA_DRIVERS[0]);
  const [selectedTeam, setSelectedTeam] = useState<FormulaTeam>(FORMULA_TEAMS[0]);
  const [customPrimaryHex, setCustomPrimaryHex] = useState<string>('#10131A');
  const [customNumber, setCustomNumber] = useState<string>('');
  const [selectedWheel, setSelectedWheel] = useState<WheelFinish>(WHEEL_FINISHES[0]);
  const [selectedCompound, setSelectedCompound] = useState<TyreCompound>('medium');
  const [upgrades, setUpgrades] = useState<CarUpgrades>(loadSavedUpgrades);
  const [career, setCareer] = useState<CareerProgress>(loadSavedCareer);
  const [showTelemetryModal, setShowTelemetryModal] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('quick_race');
  const [podiumShot, setPodiumShot] = useState<PodiumCameraShot>('auto');
  const [settings, setSettings] = useState<GameSettings>(() => {
    const initialEnv = getCircuitEnvironmentConfig(CIRCUIT_TRACKS[0]);
    const hw = detectHardwareProfile();
    return {
      transmission: 'auto',
      steeringSensitivity: 1.0,
      difficulty: 'pro',
      touchControls: typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
      mobileControlStyle: 'virtual_joystick',
      mobileButtonLayout: 'standard',
      mobileButtonScale: 'normal',
      mobileButtonSpacing: 'normal',
      mobileButtonOpacity: 0.92,
      mobileSwipeGestures: true,
      mobileSwipeSensitivity: 1.0,
      mobileGyroSensitivity: 1.0,
      mobileSwapPedals: false,
      mobileFloatingJoystick: true,
      mobileShowErsButton: true,
      mobileShowGearStrip: true,
      muted: false,
      cameraMode: 'chase',
      weather: initialEnv.defaultWeather,
      dynamicWeather: false,
      timeOfDay: initialEnv.defaultTimeOfDay,
      dynamicTimeOfDay: false,
      totalLaps: 3,
      graphicsQuality: hw.graphicsQuality,
      resolutionScale: hw.resolutionScale,
      textureQuality: hw.textureQuality,
      shadowQuality: hw.shadowQuality,
      reflectionQuality: hw.reflectionQuality,
      ambientOcclusion: 'ultra',
      antiAliasing: 'high',
      particleDensity: hw.particleDensity,
      motionBlurLevel: 'cinematic',
      targetFps: 60,
      motionBlur: true,
      absAssist: true,
      tcAssist: true,
      ps5GraphicsMode: hw.ps5GraphicsMode,
      rayTracingQuality: hw.rayTracingQuality,
      pssrUpscaling: true,
      hdrMode: 'hdr10',
      steeringAssist: false,
    brakingAssist: 'low',
    tractionControlMode: 'full',
    racingLine: 'corners',
    ersAssist: true,
    drsAssist: true,
    pitAssist: true,
    carDamageMode: 'reduced',
    aiDifficultyRating: 85,
    adaptiveTriggers: 'strong',
    hapticFeedback: 'full',
    tempest3dAudio: true,
    fovOffset: 0,
    cameraShakeScale: 100,
    lookToApex: true,
    virtualMirror: true,
    haloCenterHud: true,
    driverTags3d: true,
    speedUnits: 'kmh',
    raceObjectives: true,
    launchClutchAssist: true,
    reflexLowLatency: 'boost',
    hudColorScheme: 'motorsport_dark',
    hudScaleMode: 'auto',
    hudWidgets: { ...DEFAULT_HUD_WIDGETS },
    graphicsColorCode: 'palette_lut',
    graphicsColorCodeIntensity: 0.42,
    pitStrategyPlan: buildDefaultPitStrategy(3, initialEnv.defaultWeather, 'medium'),
    onlineGameplay: loadSavedOnlineGameplay(),
    };
  });

  const [hud, setHud] = useState<HudTelemetry>(INITIAL_HUD);
  const [finalStandings, setFinalStandings] = useState<RacerStanding[]>([]);

  const handlePauseToggle = useCallback(() => {
    setScreen((prev) => {
      if (prev === 'playing') {
        engineRef.current?.setScreen('paused');
        return 'paused';
      }
      if (prev === 'paused') {
        engineRef.current?.setScreen('playing');
        return 'playing';
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new RacingEngine(mount, {
      onTelemetry: (nextHud) => setHud(nextHud),
      onRaceFinished: (standings) => {
        setFinalStandings(standings);
        setPodiumShot('auto');
        setScreen('podium');

        const playerRes = standings.find((s) => s.isPlayer);
        if (playerRes) {
          const prize = Math.max(500, (7 - playerRes.position) * 750);
          setCareer((prev) => {
            const nextRivalry: Record<string, RivalEncounter> = { ...prev.rivalryScores };
            for (const ai of standings) {
              if (ai.isPlayer || !ai.driverId) continue;
              const posDiff = Math.abs(ai.position - playerRes.position);
              const gapDiff = Math.abs(ai.gapSeconds - playerRes.gapSeconds);
              const isNearFinish = posDiff === 1 || (posDiff <= 2 && gapDiff <= 3.5);
              const existing = nextRivalry[ai.driverId] ?? {
                driverId: ai.driverId,
                driverName: ai.name,
                teamName: ai.teamName,
                closeFinishes: 0,
                racesTogether: 0,
                playerAheadCount: 0,
                rivalAheadCount: 0,
              };
              const nextClose = isNearFinish
                ? existing.closeFinishes + 1
                : posDiff >= 4
                  ? Math.max(0, existing.closeFinishes - 1)
                  : existing.closeFinishes;
              nextRivalry[ai.driverId] = {
                ...existing,
                driverName: ai.name,
                teamName: ai.teamName,
                closeFinishes: nextClose,
                racesTogether: existing.racesTogether + 1,
                playerAheadCount:
                  existing.playerAheadCount + (playerRes.position < ai.position ? 1 : 0),
                rivalAheadCount:
                  existing.rivalAheadCount + (ai.position < playerRes.position ? 1 : 0),
              };
            }

            let topRivalId: string | null = null;
            let topScore = 1; // Minimum 2 close finishes required to spark an active Rivalry
            for (const entry of Object.values(nextRivalry)) {
              if (entry.driverId === playerRes.driverId) continue;
              if (entry.closeFinishes > topScore) {
                topScore = entry.closeFinishes;
                topRivalId = entry.driverId;
              }
            }

            const fastestOverallMs = standings.reduce((best, r) => {
              if (r.bestLapMs && r.bestLapMs < best) return r.bestLapMs;
              return best;
            }, Number.POSITIVE_INFINITY);
            const earnedPoleOrFastest =
              playerRes.position === 1 ||
              (playerRes.bestLapMs !== null && playerRes.bestLapMs <= fastestOverallMs);

            const sponsor =
              F1_2026_SPONSORS.find((s) => s.id === (prev.sponsorId ?? 'apex_cloud')) ??
              F1_2026_SPONSORS[0];
            const sponsorObjectiveMet = playerRes.position <= sponsor.minFinishPos;
            const sponsorPayout =
              sponsor.raceBaseBonusCr + (sponsorObjectiveMet ? sponsor.objectiveBonusCr : 0);
            const currentPu = prev.puWear ?? { ice: 94, mguk: 96, battery: 95, gearbox: 94 };
            const isBalanced = (prev.developmentFocus ?? 'balanced') === 'balanced';
            const wearSave = isBalanced ? 1 : 0;

            const nextCareer: CareerProgress = {
              ...prev,
              credits: prev.credits + prize + sponsorPayout,
              championshipPoints: prev.championshipPoints + playerRes.pointsAwarded,
              totalVictories: prev.totalVictories + (playerRes.position === 1 ? 1 : 0),
              racesCompleted: prev.racesCompleted + 1,
              rivalryScores: nextRivalry,
              activeRivalId: topRivalId,
              selectedAcademyId: prev.selectedAcademyId,
              resourcePoints: Math.min(862, (prev.resourcePoints ?? 296) + 172 + sponsor.rpBonusPerRace),
              techLevel: (prev.techLevel ?? 929) + (playerRes.position <= 3 ? 5 : 2),
              polePositions: (prev.polePositions ?? 0) + (earnedPoleOrFastest ? 1 : 0),
              podiumFinishes: (prev.podiumFinishes ?? 0) + (playerRes.position <= 3 ? 1 : 0),
              claimedAchievements: prev.claimedAchievements ?? [],
              seasonRound: ((prev.seasonRound ?? 1) % 24) + 1,
              costCapSpentM: Number(
                Math.min(
                  prev.costCapLimitM ?? 135,
                  (prev.costCapSpentM ?? 42.5) + 1.2
                ).toFixed(1)
              ),
              puWear: {
                ice: Math.max(35, currentPu.ice - (5 - wearSave)),
                mguk: Math.max(35, currentPu.mguk - (4 - wearSave)),
                battery: Math.max(35, currentPu.battery - (4 - wearSave)),
                gearbox: Math.max(35, currentPu.gearbox - (5 - wearSave)),
              },
            };
            try {
              window.localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(nextCareer));
            } catch {
              // ignore storage quota errors
            }
            return nextCareer;
          });
        }
      },
      onPauseRequested: handlePauseToggle,
      onCameraModeChanged: (cameraMode) => {
        setSettings((prev) => (prev.cameraMode === cameraMode ? prev : { ...prev, cameraMode }));
      },
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [handlePauseToggle]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(career));
    } catch {
      // ignore
    }
  }, [career]);

  useEffect(() => {
    try {
      window.localStorage.setItem(UPGRADES_STORAGE_KEY, JSON.stringify(upgrades));
    } catch {
      // ignore
    }
  }, [upgrades]);

  useEffect(() => {
    engineRef.current?.configureSession({
      track: selectedTrack,
      team: selectedTeam,
      driver: selectedDriver,
      customPrimaryHex,
      customNumber,
      wheelFinish: selectedWheel,
      compound: selectedCompound,
      upgrades,
      teamManagement: {
        developmentFocus: career.developmentFocus ?? 'balanced',
        staffAllocation: career.staffAllocation ?? { aero: 45, powertrain: 45, strategy: 45 },
        puWear: career.puWear ?? { ice: 94, mguk: 96, battery: 95, gearbox: 94 },
      },
      gameMode,
      activeRivalId: career.activeRivalId === selectedDriver.id ? null : career.activeRivalId,
      settings,
    });
  }, [
    selectedTrack,
    selectedTeam,
    selectedDriver,
    customPrimaryHex,
    customNumber,
    selectedWheel,
    selectedCompound,
    upgrades,
    career.developmentFocus,
    career.staffAllocation,
    career.puWear,
    gameMode,
    career.activeRivalId,
    settings,
  ]);

  const startRace = useCallback(() => {
    setShowTitleSettings(false);
    setShowPitStrategy(false);
    setScreen('playing');
    engineRef.current?.startNewRace();
  }, []);

  const openDrivers = useCallback(() => {
    setShowTitleSettings(false);
    setShowPitStrategy(false);
    setScreen('drivers');
    engineRef.current?.setScreen('drivers');
  }, []);

  const openGarage = useCallback(() => {
    setShowTitleSettings(false);
    setShowPitStrategy(false);
    setScreen('garage');
    engineRef.current?.setScreen('garage');
  }, []);

  const exitToTitle = useCallback(() => {
    setShowTitleSettings(false);
    setShowPitStrategy(false);
    setScreen('title');
    engineRef.current?.setScreen('title');
  }, []);

  const updateSettings = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next: GameSettings = {
        ...prev,
        ...patch,
        onlineGameplay: patch.onlineGameplay
          ? { ...(prev.onlineGameplay ?? DEFAULT_ONLINE_GAMEPLAY_SETTINGS), ...patch.onlineGameplay }
          : prev.onlineGameplay,
      };
      if (patch.totalLaps !== undefined && patch.pitStrategyPlan === undefined && prev.pitStrategyPlan) {
        next.pitStrategyPlan = normalizePitStrategyPlan({
          ...prev.pitStrategyPlan,
          totalLaps: patch.totalLaps,
        });
      }
      if (patch.onlineGameplay && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(ONLINE_STORAGE_KEY, JSON.stringify(next.onlineGameplay));
        } catch {
          // ignore storage quota errors
        }
      }
      return next;
    });
  }, []);

  const handleSavePitStrategy = useCallback((plan: PreRacePitStrategy) => {
    const normalized = normalizePitStrategyPlan(plan);
    setSelectedCompound(normalized.startingCompound);
    setSettings((prev) => ({
      ...prev,
      totalLaps: normalized.totalLaps,
      pitStrategyPlan: normalized,
    }));
    setShowPitStrategy(false);
  }, []);

  const handleSaveAndStartStrategy = useCallback((plan: PreRacePitStrategy) => {
    const normalized = normalizePitStrategyPlan(plan);
    setSelectedCompound(normalized.startingCompound);
    setSettings((prev) => ({
      ...prev,
      totalLaps: normalized.totalLaps,
      pitStrategyPlan: normalized,
    }));
    engineRef.current?.configureSession({
      compound: normalized.startingCompound,
      settings: {
        totalLaps: normalized.totalLaps,
        pitStrategyPlan: normalized,
      },
    });
    setShowPitStrategy(false);
    setShowTitleSettings(false);
    setScreen('playing');
    engineRef.current?.startNewRace();
  }, []);

  const handleSelectTrack = useCallback((track: CircuitTrack) => {
    setSelectedTrack(track);
    const envCfg = getCircuitEnvironmentConfig(track);
    const nextCmp: TyreCompound =
      envCfg.defaultWeather === 'rain' ||
      envCfg.defaultWeather === 'heavy_rain' ||
      envCfg.defaultWeather === 'snow' ||
      envCfg.defaultWeather === 'blizzard'
        ? 'wet'
        : 'medium';
    setSettings((prev) => ({
      ...prev,
      weather: envCfg.defaultWeather,
      timeOfDay: envCfg.defaultTimeOfDay,
      pitStrategyPlan: prev.pitStrategyPlan
        ? normalizePitStrategyPlan({
            ...prev.pitStrategyPlan,
            startingCompound: nextCmp,
          })
        : buildDefaultPitStrategy(prev.totalLaps, envCfg.defaultWeather, nextCmp),
    }));
    setSelectedCompound(nextCmp);
  }, []);

  const handleSelectWeather = useCallback(
    (weather: WeatherMode) => {
      setSettings((prev) => {
        const defaultTod = getCircuitEnvironmentConfig(selectedTrack).defaultTimeOfDay;
        const fallbackDayTod: TimeOfDayMode =
          defaultTod === 'night' || defaultTod === 'sunset' ? 'afternoon' : defaultTod;
        return {
          ...prev,
          weather,
          timeOfDay:
            weather === 'night'
              ? 'night'
              : weather === 'sunset'
                ? 'sunset'
                : prev.timeOfDay === 'night' || prev.timeOfDay === 'sunset'
                  ? fallbackDayTod
                  : prev.timeOfDay,
        };
      });
    },
    [selectedTrack]
  );

  const handleSelectTimeOfDay = useCallback((timeOfDay: TimeOfDayMode) => {
    setSettings((prev) => ({
      ...prev,
      timeOfDay,
      weather:
        timeOfDay === 'night' || timeOfDay === 'sunset'
          ? prev.weather === 'rain' ||
            prev.weather === 'heavy_rain' ||
            prev.weather === 'snow' ||
            prev.weather === 'blizzard' ||
            prev.weather === 'cloudy' ||
            prev.weather === 'fog' ||
            prev.weather === 'partly_cloudy'
            ? prev.weather
            : 'day'
          : prev.weather === 'night' || prev.weather === 'sunset'
            ? 'day'
            : prev.weather,
    }));
  }, []);

  const handleSelectDriver = useCallback((driver: DriverProfile) => {
    setSelectedDriver(driver);
    setCustomNumber('');
    const matchedTeam = FORMULA_TEAMS.find((t) => t.id === driver.teamId);
    if (matchedTeam) {
      setSelectedTeam(matchedTeam);
      setCustomPrimaryHex('');
    }
    engineRef.current?.triggerDriverSelectAnim();
  }, []);

  const handleSelectTeam = useCallback((team: FormulaTeam) => {
    setSelectedTeam(team);
    setCustomPrimaryHex('');
  }, []);

  const handlePurchaseUpgrade = useCallback(
    (key: keyof CarUpgrades, level: number, cost: number) => {
      if (career.credits < cost) return;
      setCareer((prev) => ({ ...prev, credits: prev.credits - cost }));
      setUpgrades((prev) => ({ ...prev, [key]: level }));
    },
    [career.credits]
  );

  const handleClaimAchievement = useCallback(
    (achievementId: string, creditBonus: number, techBonus: number) => {
      setCareer((prev) => {
        const claimed = prev.claimedAchievements ?? [];
        if (claimed.includes(achievementId)) return prev;
        return {
          ...prev,
          credits: prev.credits + creditBonus,
          techLevel: (prev.techLevel ?? 929 + Math.floor(prev.championshipPoints * 0.5)) + techBonus,
          claimedAchievements: [...claimed, achievementId],
        };
      });
    },
    []
  );

  const handleUpdateCareerTeam = useCallback((patch: Partial<CareerProgress>) => {
    setCareer((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleOverhaulPuComponent = useCallback((component: keyof PowerUnitWear, costCr: number) => {
    setCareer((prev) => {
      if (prev.credits < costCr) return prev;
      const limit = prev.costCapLimitM ?? 135;
      const spent = prev.costCapSpentM ?? 42.5;
      if (spent + 1.8 > limit) return prev;
      const pu = prev.puWear ?? { ice: 94, mguk: 96, battery: 95, gearbox: 94 };
      return {
        ...prev,
        credits: prev.credits - costCr,
        costCapSpentM: Number((spent + 1.8).toFixed(1)),
        puWear: { ...pu, [component]: 100 },
      };
    });
  }, []);

  const handleEarnResourcePoints = useCallback((delta: number) => {
    setCareer((prev) => ({
      ...prev,
      resourcePoints: Math.min(862, Math.max(0, (prev.resourcePoints ?? 296) + delta)),
    }));
  }, []);

  const handleInvestEngineering = useCallback(
    (rpCost: number, staffGain: number, costCapM: number) => {
      setCareer((prev) => {
        const currentRp = prev.resourcePoints ?? 296;
        const limit = prev.costCapLimitM ?? 135;
        const spent = prev.costCapSpentM ?? 42.5;
        if (currentRp < rpCost || spent + costCapM > limit) return prev;
        const currentStaff = prev.workforceCount ?? 135;
        const nextWorkforce = Math.min(347, currentStaff + staffGain);
        const alloc = prev.staffAllocation ?? { aero: 45, powertrain: 45, strategy: 45 };
        const added = nextWorkforce - currentStaff;
        const perDept = Math.floor(added / 3);
        const rem = added - perDept * 3;
        return {
          ...prev,
          resourcePoints: currentRp - rpCost,
          workforceCount: nextWorkforce,
          techLevel: (prev.techLevel ?? 929) + 4,
          costCapSpentM: Number((spent + costCapM).toFixed(1)),
          staffAllocation: {
            aero: alloc.aero + perDept + rem,
            powertrain: alloc.powertrain + perDept,
            strategy: alloc.strategy + perDept,
          },
        };
      });
    },
    []
  );

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#090B0F]">
      {/* Isolated WebGL Viewport Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Title Screen Shell */}
      {screen === 'title' && (
        <TitleOverlay
          selectedTrack={selectedTrack}
          selectedTeam={selectedTeam}
          selectedDriver={selectedDriver}
          career={career}
          upgrades={upgrades}
          gameMode={gameMode}
          weather={settings.weather}
          dynamicWeather={settings.dynamicWeather}
          timeOfDay={settings.timeOfDay ?? 'afternoon'}
          dynamicTimeOfDay={settings.dynamicTimeOfDay ?? false}
          totalLaps={settings.totalLaps}
          pitStrategyPlan={settings.pitStrategyPlan}
          onlineGameplay={settings.onlineGameplay ?? DEFAULT_ONLINE_GAMEPLAY_SETTINGS}
          muted={settings.muted}
          egoHudMode={egoHudMode}
          onToggleEgoHudMode={() => setEgoHudMode((prev) => !prev)}
          onSelectTrack={handleSelectTrack}
          onSelectMode={setGameMode}
          onSelectWeather={handleSelectWeather}
          onToggleDynamicWeather={() =>
            updateSettings({ dynamicWeather: !settings.dynamicWeather })
          }
          onSelectTimeOfDay={handleSelectTimeOfDay}
          onToggleDynamicTimeOfDay={() =>
            updateSettings({ dynamicTimeOfDay: !settings.dynamicTimeOfDay })
          }
          onToggleMute={() => {
            engineRef.current?.unlockAudio();
            updateSettings({ muted: !settings.muted });
          }}
          onEnableAudio={() => {
            engineRef.current?.unlockAudio();
            if (settings.muted) updateSettings({ muted: false });
          }}
          onOpenDrivers={openDrivers}
          onOpenGarage={openGarage}
          onOpenPitStrategy={() => setShowPitStrategy(true)}
          onOpenSettings={() => {
            setTitleSettingsTab('all');
            setShowTitleSettings(true);
          }}
          onOpenOnlineSettings={() => {
            setTitleSettingsTab('online');
            setShowTitleSettings(true);
          }}
          onSelectDevFocus={(focus) => handleUpdateCareerTeam({ developmentFocus: focus })}
          onClaimAchievement={handleClaimAchievement}
          onJumpTitleScene={(sceneNum) => engineRef.current?.jumpToTitleScene(sceneNum)}
          onStartRace={startRace}
        />
      )}

      {/* Title Settings Modal */}
      {screen === 'title' && showTitleSettings && (
        <PauseSettingsModal
          mode="settings"
          initialTab={titleSettingsTab}
          settings={settings}
          onUpdateSettings={updateSettings}
          onResume={() => setShowTitleSettings(false)}
          onRestart={startRace}
          onExitToTitle={() => setShowTitleSettings(false)}
        />
      )}

      {/* Pre-Race Interactive Pit Strategy Planner Modal */}
      {(screen === 'title' || screen === 'garage') && showPitStrategy && (
        <PitStrategyModal
          track={selectedTrack}
          weather={settings.weather}
          initialPlan={
            settings.pitStrategyPlan ??
            buildDefaultPitStrategy(settings.totalLaps, settings.weather, selectedCompound)
          }
          onSave={handleSavePitStrategy}
          onSaveAndStartRace={handleSaveAndStartStrategy}
          onClose={() => setShowPitStrategy(false)}
        />
      )}

      {/* 3D Formula Driver Selection Showroom */}
      {screen === 'drivers' && (
        <DriverSelectionOverlay
          selectedDriver={selectedDriver}
          career={career}
          onSelectDriver={handleSelectDriver}
          onSelectAcademy={(academyId) =>
            setCareer((prev) => ({ ...prev, selectedAcademyId: academyId }))
          }
          onBack={exitToTitle}
          onConfirmAndGarage={openGarage}
          onStartRace={startRace}
        />
      )}

      {/* 3D Team Racing Garage Workshop */}
      {screen === 'garage' && (
        <GarageOverlay
          selectedTeam={selectedTeam}
          customPrimaryHex={customPrimaryHex}
          customNumber={customNumber}
          selectedWheel={selectedWheel}
          selectedCompound={selectedCompound}
          upgrades={upgrades}
          credits={career.credits}
          career={career}
          onSelectTeam={handleSelectTeam}
          onSelectPaint={setCustomPrimaryHex}
          onSelectNumber={setCustomNumber}
          onSelectWheel={setSelectedWheel}
          onSelectCompound={(cmp) => {
            setSelectedCompound(cmp);
            setSettings((prev) => ({
              ...prev,
              pitStrategyPlan: prev.pitStrategyPlan
                ? { ...prev.pitStrategyPlan, startingCompound: cmp }
                : buildDefaultPitStrategy(prev.totalLaps, prev.weather, cmp),
            }));
          }}
          onPurchaseUpgrade={handlePurchaseUpgrade}
          onUpdateCareerTeam={handleUpdateCareerTeam}
          onOverhaulPuComponent={handleOverhaulPuComponent}
          onEarnResourcePoints={handleEarnResourcePoints}
          onInvestEngineering={handleInvestEngineering}
          onCameraPreset={(p) => engineRef.current?.setGarageCameraPreset(p)}
          onZoom={(d) => engineRef.current?.adjustGarageZoom(d)}
          onToggleLights={() => engineRef.current?.toggleGarageLights() ?? true}
          onOpenPitStrategy={() => setShowPitStrategy(true)}
          onBack={exitToTitle}
          onStartRace={startRace}
        />
      )}

      {/* Landscape EGO / F1 25 Racing HUD Overlay with CSS Entrance & Exit State Transitions */}
      <RacingHUD
        active={screen === 'playing' || screen === 'paused' || (screen === 'title' && egoHudMode)}
        gameScreen={screen}
        hud={hud}
        trackName={selectedTrack.name}
        transmission={settings.transmission}
        touchControls={settings.touchControls}
        mobileControlStyle={settings.mobileControlStyle ?? 'virtual_joystick'}
        mobileButtonLayout={settings.mobileButtonLayout ?? 'standard'}
        mobileButtonScale={settings.mobileButtonScale ?? 'normal'}
        mobileButtonSpacing={settings.mobileButtonSpacing ?? 'normal'}
        mobileButtonOpacity={settings.mobileButtonOpacity ?? 0.92}
        mobileSwipeGestures={settings.mobileSwipeGestures ?? true}
        mobileSwipeSensitivity={settings.mobileSwipeSensitivity ?? 1.0}
        mobileGyroSensitivity={settings.mobileGyroSensitivity ?? 1.0}
        mobileSwapPedals={settings.mobileSwapPedals ?? false}
        mobileFloatingJoystick={settings.mobileFloatingJoystick ?? true}
        mobileShowErsButton={settings.mobileShowErsButton ?? true}
        mobileShowGearStrip={settings.mobileShowGearStrip ?? true}
        muted={settings.muted}
        virtualMirror={settings.virtualMirror ?? true}
        haloCenterHud={settings.haloCenterHud ?? true}
        driverTags3d={settings.driverTags3d ?? true}
        speedUnits={settings.speedUnits ?? 'kmh'}
        raceObjectives={settings.raceObjectives ?? true}
        launchClutchAssist={settings.launchClutchAssist ?? true}
        hudColorScheme={settings.hudColorScheme ?? 'motorsport_dark'}
        hudScaleMode={settings.hudScaleMode ?? 'auto'}
        hudWidgets={settings.hudWidgets ?? DEFAULT_HUD_WIDGETS}
        onSelectHudColorScheme={(scheme) => updateSettings({ hudColorScheme: scheme })}
        onSelectHudScaleMode={(mode) => updateSettings({ hudScaleMode: mode })}
        onToggleHudWidget={(widget) =>
          updateSettings({
            hudWidgets: {
              ...(settings.hudWidgets ?? DEFAULT_HUD_WIDGETS),
              [widget]: !((settings.hudWidgets ?? DEFAULT_HUD_WIDGETS)[widget] ?? true),
            },
          })
        }
        onApplyHudWidgetPreset={(preset) =>
          updateSettings({
            hudWidgets:
              preset === 'minimal'
                ? {
                    leaderboard: false,
                    timingTower: true,
                    pitStrategy: false,
                    miniMap: true,
                    weatherOverlay: false,
                    tyrePanel: false,
                    haloCluster: true,
                    gForceRadar: false,
                    damageDiagram: false,
                  }
                : { ...DEFAULT_HUD_WIDGETS },
          })
        }
        onToggleTouchControls={() => updateSettings({ touchControls: !settings.touchControls })}
        onSelectMobileControlStyle={(style) =>
          updateSettings({ mobileControlStyle: style, touchControls: true })
        }
        onSelectMobileButtonLayout={(layout) =>
          updateSettings({ mobileButtonLayout: layout, touchControls: true })
        }
        onSelectMobileButtonScale={(scale) =>
          updateSettings({ mobileButtonScale: scale, touchControls: true })
        }
        onSelectMobileButtonSpacing={(spacing) =>
          updateSettings({ mobileButtonSpacing: spacing, touchControls: true })
        }
        onChangeMobileButtonOpacity={(opacity) =>
          updateSettings({ mobileButtonOpacity: opacity, touchControls: true })
        }
        onToggleMobileSwipeGestures={() =>
          updateSettings({ mobileSwipeGestures: !(settings.mobileSwipeGestures ?? true) })
        }
        onChangeMobileSwipeSensitivity={(sens) =>
          updateSettings({ mobileSwipeSensitivity: sens, touchControls: true })
        }
        onChangeMobileGyroSensitivity={(sens) =>
          updateSettings({ mobileGyroSensitivity: sens, touchControls: true })
        }
        onToggleMobileSwapPedals={() =>
          updateSettings({ mobileSwapPedals: !(settings.mobileSwapPedals ?? false), touchControls: true })
        }
        onToggleMobileFloatingJoystick={() =>
          updateSettings({ mobileFloatingJoystick: !(settings.mobileFloatingJoystick ?? true), touchControls: true })
        }
        onToggleMobileShowErsButton={() =>
          updateSettings({ mobileShowErsButton: !(settings.mobileShowErsButton ?? true), touchControls: true })
        }
        onToggleMobileShowGearStrip={() =>
          updateSettings({ mobileShowGearStrip: !(settings.mobileShowGearStrip ?? true), touchControls: true })
        }
        onApplyMobilePreset={(preset) => {
          if (preset === 'f1_classic') {
            updateSettings({
              touchControls: true,
              mobileControlStyle: 'virtual_joystick',
              mobileButtonLayout: 'standard',
              mobileButtonScale: 'normal',
              mobileButtonSpacing: 'normal',
              mobileButtonOpacity: 0.92,
              mobileFloatingJoystick: true,
              mobileSwapPedals: false,
              mobileShowErsButton: true,
              mobileShowGearStrip: true,
              mobileSwipeGestures: true,
            });
          } else if (preset === 'thumb_pro') {
            updateSettings({
              touchControls: true,
              mobileControlStyle: 'virtual_joystick',
              mobileButtonLayout: 'split_pro',
              mobileButtonScale: 'large',
              mobileButtonSpacing: 'wide',
              mobileButtonOpacity: 0.95,
              mobileFloatingJoystick: true,
              mobileSwapPedals: false,
              mobileShowErsButton: true,
              mobileShowGearStrip: true,
              mobileSwipeGestures: true,
            });
          } else if (preset === 'lefty') {
            updateSettings({
              touchControls: true,
              mobileControlStyle: 'virtual_joystick',
              mobileButtonLayout: 'left_handed',
              mobileButtonScale: 'normal',
              mobileButtonSpacing: 'normal',
              mobileFloatingJoystick: true,
              mobileSwapPedals: true,
              mobileShowErsButton: true,
              mobileShowGearStrip: true,
            });
          } else {
            updateSettings({
              touchControls: true,
              mobileControlStyle: 'tilt_gyro',
              mobileButtonLayout: 'compact_thumb',
              mobileButtonScale: 'compact',
              mobileButtonSpacing: 'compact',
              mobileButtonOpacity: 0.85,
              mobileShowErsButton: false,
              mobileShowGearStrip: false,
              mobileSwipeGestures: true,
            });
          }
        }}
        onToggleMute={() => updateSettings({ muted: !settings.muted })}
        onCycleCamera={() => engineRef.current?.cycleCameraMode()}
        onPause={
          screen === 'title'
            ? () => {
                setTitleSettingsTab('all');
                setShowTitleSettings(true);
              }
            : handlePauseToggle
        }
        onTouchInput={(ctrl, pressed) => engineRef.current?.setTouchInput(ctrl, pressed)}
        onTouchSteerAxis={(axis) => engineRef.current?.setTouchSteerAxis(axis)}
        onTouchPedalAxis={(throttle, brake) => engineRef.current?.setTouchPedalAxis(throttle, brake)}
        onSetMobileAeroMode={(mode) => engineRef.current?.setMobileAeroMode(mode)}
        onTriggerMobileHaptic={(ev, intensity) => engineRef.current?.triggerMobileHaptic(ev, intensity)}
        onManualShift={(dir) => engineRef.current?.manualShift(dir)}
        onRequestTyreSwitch={(compound) => engineRef.current?.requestTyreSwitch(compound)}
        onSetErsMode={(mode) => engineRef.current?.setErsMode(mode)}
        onAdjustBrakeBias={(delta) => engineRef.current?.adjustBrakeBias(delta)}
      />

      {/* Real-Time Pit Wall Engineer Radio & Audio/Text Transmissions */}
      <EngineerRadio
        hud={hud}
        audio={engineRef.current?.getAudio()}
        driverName={selectedDriver.name}
        teamName={selectedTeam.name}
        active={screen === 'playing' || screen === 'paused'}
        hudColorScheme={settings.hudColorScheme ?? 'motorsport_dark'}
        onRequestPitBox={(compound) => engineRef.current?.requestTyreSwitch(compound)}
        onSetErsMode={(mode) => engineRef.current?.setErsMode(mode)}
        onAdjustBrakeBias={(delta) => engineRef.current?.adjustBrakeBias(delta)}
      />

      {/* Real-Time D3 Telemetry & Driving Coach Modal */}
      <TelemetryOverlay
        hud={hud}
        isOpen={showTelemetryModal}
        onClose={() => setShowTelemetryModal(false)}
        trackName={selectedTrack.name}
      />

      {/* Floating Telemetry Coach Button during race */}
      {(screen === 'playing' || screen === 'paused') && (
        <div className="hidden fixed top-20 right-36 z-40 pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowTelemetryModal(true)}
            className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md border border-white/15 hover:border-sky-400 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-lg cursor-pointer font-display uppercase tracking-wider"
            title="Open Telemetry & Driving Coach"
          >
            <Activity className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">Telemetry</span>
          </button>
        </div>
      )}

      {/* Pause Modal */}
      {screen === 'paused' && (
        <PauseSettingsModal
          mode="pause"
          settings={settings}
          onUpdateSettings={updateSettings}
          onResume={handlePauseToggle}
          onRestart={startRace}
          onExitToTitle={exitToTitle}
        />
      )}

      {/* 3D Animated Podium Celebration & Championship Results Overlay */}
      {screen === 'podium' && (
        <PodiumOverlay
          standings={finalStandings}
          trackName={selectedTrack.name}
          weather={settings.weather}
          totalLaps={settings.totalLaps}
          career={career}
          activeShot={podiumShot}
          onSelectShot={(s) => {
            setPodiumShot(s);
            engineRef.current?.setPodiumCameraShot(s);
          }}
          onContinue={exitToTitle}
          onGarage={openGarage}
          onRestart={startRace}
        />
      )}
    </div>
  );
}
