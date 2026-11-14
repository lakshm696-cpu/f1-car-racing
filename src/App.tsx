/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DriverSelectionOverlay } from './components/DriverSelectionOverlay';
import { GarageOverlay } from './components/GarageOverlay';
import { PauseSettingsModal } from './components/PauseResultsModal';
import { PodiumOverlay } from './components/PodiumOverlay';
import { EngineerRadio } from './components/EngineerRadio';
import { TelemetryOverlay } from './components/TelemetryOverlay';
import { Activity } from 'lucide-react';
import { RacingHUD } from './components/RacingHUD';
import { TitleOverlay } from './components/TitleOverlay';
import { CIRCUIT_TRACKS, FORMULA_DRIVERS, FORMULA_TEAMS, WHEEL_FINISHES } from './data/racingData';
import { RacingEngine } from './three/RacingEngine';
import {
  CareerProgress,
  CarUpgrades,
  CircuitTrack,
  DriverProfile,
  FormulaTeam,
  GameMode,
  GameScreen,
  GameSettings,
  HudTelemetry,
  PodiumCameraShot,
  RacerStanding,
  RivalEncounter,
  TyreCompound,
  WeatherMode,
  WheelFinish,
} from './types/racing';

const CAREER_STORAGE_KEY = 'ufr26_career_v1';

const DEFAULT_CAREER: CareerProgress = {
  credits: 6000,
  championshipPoints: 0,
  totalVictories: 0,
  racesCompleted: 0,
  rivalryScores: {},
  activeRivalId: null,
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
    };
  } catch {
    return DEFAULT_CAREER;
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
  standings: [],
  cameraMode: 'chase',
  pitBoardActive: false,
  gapAheadSeconds: null,
  damagePct: 0,
  liveWeather: 'rain',
  nextWeather: null,
  dynamicWeather: false,
  trackWetnessPct: 78,
  surfaceGripPct: 76,
  currentSector: 2,
  sectorGripPct: [82, 74, 79],
  activeSurfaceHazard: null,
  queuedCompound: null,
  pitStopRemainingSec: 0,
  inPitWindow: false,
  trackFlag: { flag: 'none', reason: '', distanceMeters: null },
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RacingEngine | null>(null);

  const [screen, setScreen] = useState<GameScreen>('title');
  const [showTitleSettings, setShowTitleSettings] = useState(false);
  const [egoHudMode, setEgoHudMode] = useState(true);

  const [selectedTrack, setSelectedTrack] = useState<CircuitTrack>(CIRCUIT_TRACKS[0]);
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile>(FORMULA_DRIVERS[0]);
  const [selectedTeam, setSelectedTeam] = useState<FormulaTeam>(FORMULA_TEAMS[0]);
  const [customPrimaryHex, setCustomPrimaryHex] = useState<string>('#10131A');
  const [customNumber, setCustomNumber] = useState<string>('');
  const [selectedWheel, setSelectedWheel] = useState<WheelFinish>(WHEEL_FINISHES[0]);
  const [selectedCompound, setSelectedCompound] = useState<TyreCompound>('wet');
  const [upgrades, setUpgrades] = useState<CarUpgrades>({
    engineLevel: 1,
    tyreLevel: 1,
    brakeLevel: 1,
    suspensionLevel: 1,
    aeroLevel: 1,
  });
  const [career, setCareer] = useState<CareerProgress>(loadSavedCareer);
  const [showTelemetryModal, setShowTelemetryModal] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('quick_race');
  const [podiumShot, setPodiumShot] = useState<PodiumCameraShot>('auto');
  const [settings, setSettings] = useState<GameSettings>(() => ({
    transmission: 'auto',
    steeringSensitivity: 1.0,
    difficulty: 'pro',
    touchControls: typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
    muted: false,
    cameraMode: 'chase',
    weather: 'rain',
    dynamicWeather: false,
    totalLaps: 3,
    graphicsQuality: 'cinematic',
    targetFps: 60,
    motionBlur: true,
    absAssist: true,
    tcAssist: true,
    ps5GraphicsMode: 'cinematic',
    rayTracingQuality: 'cinematic',
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
  }));

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

            const nextCareer: CareerProgress = {
              credits: prev.credits + prize,
              championshipPoints: prev.championshipPoints + playerRes.pointsAwarded,
              totalVictories: prev.totalVictories + (playerRes.position === 1 ? 1 : 0),
              racesCompleted: prev.racesCompleted + 1,
              rivalryScores: nextRivalry,
              activeRivalId: topRivalId,
              selectedAcademyId: prev.selectedAcademyId,
              resourcePoints: (prev.resourcePoints ?? 296) + 172,
              techLevel: (prev.techLevel ?? 929) + (playerRes.position <= 3 ? 5 : 2),
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
    engineRef.current?.configureSession({
      track: selectedTrack,
      team: selectedTeam,
      driver: selectedDriver,
      customPrimaryHex,
      customNumber,
      wheelFinish: selectedWheel,
      compound: selectedCompound,
      upgrades,
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
    gameMode,
    career.activeRivalId,
    settings,
  ]);

  const startRace = useCallback(() => {
    setShowTitleSettings(false);
    setScreen('playing');
    engineRef.current?.startNewRace();
  }, []);

  const openDrivers = useCallback(() => {
    setShowTitleSettings(false);
    setScreen('drivers');
    engineRef.current?.setScreen('drivers');
  }, []);

  const openGarage = useCallback(() => {
    setShowTitleSettings(false);
    setScreen('garage');
    engineRef.current?.setScreen('garage');
  }, []);

  const exitToTitle = useCallback(() => {
    setShowTitleSettings(false);
    setScreen('title');
    engineRef.current?.setScreen('title');
  }, []);

  const updateSettings = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSelectWeather = useCallback((weather: WeatherMode) => {
    setSettings((prev) => ({ ...prev, weather }));
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
          gameMode={gameMode}
          weather={settings.weather}
          dynamicWeather={settings.dynamicWeather}
          totalLaps={settings.totalLaps}
          muted={settings.muted}
          egoHudMode={egoHudMode}
          onToggleEgoHudMode={() => setEgoHudMode((prev) => !prev)}
          onSelectTrack={setSelectedTrack}
          onSelectMode={setGameMode}
          onSelectWeather={handleSelectWeather}
          onToggleDynamicWeather={() =>
            updateSettings({ dynamicWeather: !settings.dynamicWeather })
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
          onOpenSettings={() => setShowTitleSettings(true)}
          onJumpTitleScene={(sceneNum) => engineRef.current?.jumpToTitleScene(sceneNum)}
          onStartRace={startRace}
        />
      )}

      {/* Title Settings Modal */}
      {screen === 'title' && showTitleSettings && (
        <PauseSettingsModal
          mode="settings"
          settings={settings}
          onUpdateSettings={updateSettings}
          onResume={() => setShowTitleSettings(false)}
          onRestart={startRace}
          onExitToTitle={() => setShowTitleSettings(false)}
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
          onSelectTeam={handleSelectTeam}
          onSelectPaint={setCustomPrimaryHex}
          onSelectNumber={setCustomNumber}
          onSelectWheel={setSelectedWheel}
          onSelectCompound={setSelectedCompound}
          onPurchaseUpgrade={handlePurchaseUpgrade}
          onCameraPreset={(p) => engineRef.current?.setGarageCameraPreset(p)}
          onZoom={(d) => engineRef.current?.adjustGarageZoom(d)}
          onToggleLights={() => engineRef.current?.toggleGarageLights() ?? true}
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
        muted={settings.muted}
        virtualMirror={settings.virtualMirror ?? true}
        haloCenterHud={settings.haloCenterHud ?? true}
        driverTags3d={settings.driverTags3d ?? true}
        speedUnits={settings.speedUnits ?? 'kmh'}
        raceObjectives={settings.raceObjectives ?? true}
        launchClutchAssist={settings.launchClutchAssist ?? true}
        onToggleTouchControls={() => updateSettings({ touchControls: !settings.touchControls })}
        onToggleMute={() => updateSettings({ muted: !settings.muted })}
        onCycleCamera={() => engineRef.current?.cycleCameraMode()}
        onPause={screen === 'title' ? () => setShowTitleSettings(true) : handlePauseToggle}
        onTouchInput={(ctrl, pressed) => engineRef.current?.setTouchInput(ctrl, pressed)}
        onManualShift={(dir) => engineRef.current?.manualShift(dir)}
        onRequestTyreSwitch={(compound) => engineRef.current?.requestTyreSwitch(compound)}
      />

      {/* Real-Time Pit Wall Engineer Radio & Audio/Text Transmissions */}
      <EngineerRadio
        hud={hud}
        audio={engineRef.current?.getAudio()}
        driverName={selectedDriver.name}
        teamName={selectedTeam.name}
      />

      {/* Real-Time D3 Telemetry & Driving Coach Modal */}
      <TelemetryOverlay
        hud={hud}
        isOpen={showTelemetryModal}
        onClose={() => setShowTelemetryModal(false)}
      />

      {/* Floating Telemetry Coach Button during race */}
      {(screen === 'playing' || screen === 'paused') && (
        <div className="fixed top-20 right-36 z-40 pointer-events-auto">
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
