export type GameScreen = 'title' | 'drivers' | 'garage' | 'playing' | 'paused' | 'podium';

export type GameMode = 'quick_race' | 'career' | 'time_trial' | 'championship';

export type WeatherMode = 'day' | 'sunset' | 'cloudy' | 'rain' | 'heavy_rain' | 'night';

export type TransmissionMode = 'auto' | 'manual';

export type CameraMode =
  | 'chase'
  | 'tcam'
  | 'cockpit'
  | 'bumper'
  | 'side'
  | 'rear'
  | 'low_track'
  | 'wing_tyre'
  | 'tv_wide';

export type GarageCameraPreset = 'overview' | 'front' | 'side' | 'cockpit' | 'rear';

export type PodiumCameraShot = 'auto' | 'wide' | 'winner' | 'trophy' | 'full' | 'victory';

export type DifficultyLevel = 'rookie' | 'pro' | 'legend';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export type TyreCompound = 'soft' | 'medium' | 'hard' | 'wet';

export interface DriverStats {
  speed: number;
  cornering: number;
  braking: number;
  overtaking: number;
  consistency: number;
}

export interface DriverProfile {
  id: string;
  name: string;
  code: string;
  nationality: string;
  number: string;
  teamId: string;
  experienceLevel: number;
  championshipWins: number;
  careerVictories: number;
  achievements: string[];
  suitPrimary: string;
  suitSecondary: string;
  helmetColor: string;
  visorColor: string;
  skinTone?: string;
  academyId?: string;
  recognitionPct?: number;
  stats: DriverStats;
}

export interface FormulaTeam {
  id: string;
  name: string;
  chassis: string;
  number: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  helmetColor: string;
  baseTopSpeed: number; // 0-100 rating
  baseAcceleration: number; // 0-100 rating
  baseDownforce: number; // 0-100 rating
  baseBraking: number; // 0-100 rating
}

export interface WheelFinish {
  id: string;
  name: string;
  rimColor: string;
  metalness: number;
  roughness: number;
}

export interface CircuitTrack {
  id: string;
  name: string;
  country: string;
  lengthKm: number;
  corners: number;
  defaultLaps: number;
  trackWidth: number;
  kerbColorA: string;
  kerbColorB: string;
  controlPoints: [number, number, number][];
}

export interface CarUpgrades {
  engineLevel: number; // 1-3
  tyreLevel: number; // 1-3
  brakeLevel: number; // 1-3
  suspensionLevel: number; // 1-3
  aeroLevel: number; // 1-3
}

export interface RivalEncounter {
  driverId: string;
  driverName: string;
  teamName: string;
  closeFinishes: number;
  racesTogether: number;
  playerAheadCount: number;
  rivalAheadCount: number;
}

export interface CareerProgress {
  credits: number;
  championshipPoints: number;
  totalVictories: number;
  racesCompleted: number;
  rivalryScores: Record<string, RivalEncounter>;
  activeRivalId: string | null;
  selectedAcademyId?: string;
  resourcePoints?: number;
  techLevel?: number;
}

export type Ps5GraphicsMode = 'quality' | 'performance' | 'rt_pro';
export type RayTracingQuality = 'off' | 'medium' | 'high' | 'ultra';
export type HdrOutputMode = 'off' | 'scrgb' | 'hdr10';
export type BrakingAssistLevel = 'off' | 'low' | 'medium' | 'high';
export type TractionControlMode = 'off' | 'medium' | 'full';
export type RacingLineMode = 'off' | 'corners' | 'full';
export type CarDamageMode = 'off' | 'reduced' | 'simulation';
export type AdaptiveTriggersLevel = 'off' | 'medium' | 'strong';
export type HapticFeedbackLevel = 'off' | 'subtle' | 'full';
export type SpeedUnitMode = 'kmh' | 'mph';
export type ReflexLowLatencyMode = 'off' | 'on' | 'boost';

export interface GameSettings {
  transmission: TransmissionMode;
  steeringSensitivity: number; // 0.5 - 1.5
  difficulty: DifficultyLevel;
  touchControls: boolean;
  muted: boolean;
  cameraMode: CameraMode;
  weather: WeatherMode;
  dynamicWeather: boolean;
  totalLaps: number;
  graphicsQuality: GraphicsQuality;
  targetFps: 30 | 60 | 120;
  motionBlur: boolean;
  absAssist: boolean;
  tcAssist: boolean;
  // PS5 F1 Game (EA Sports F1 25) Complete Settings Suite
  ps5GraphicsMode?: Ps5GraphicsMode;
  rayTracingQuality?: RayTracingQuality;
  pssrUpscaling?: boolean;
  hdrMode?: HdrOutputMode;
  steeringAssist?: boolean;
  brakingAssist?: BrakingAssistLevel;
  tractionControlMode?: TractionControlMode;
  racingLine?: RacingLineMode;
  ersAssist?: boolean;
  drsAssist?: boolean;
  pitAssist?: boolean;
  carDamageMode?: CarDamageMode;
  aiDifficultyRating?: number; // 0 - 110 official F1 slider
  adaptiveTriggers?: AdaptiveTriggersLevel;
  hapticFeedback?: HapticFeedbackLevel;
  tempest3dAudio?: boolean;
  fovOffset?: number; // -10 to +10 degrees
  cameraShakeScale?: number; // 0 to 100%
  lookToApex?: boolean;
  // F1 25 Broadcast OSD & Telemetry Settings from Screenshots
  virtualMirror?: boolean;
  haloCenterHud?: boolean;
  driverTags3d?: boolean;
  speedUnits?: SpeedUnitMode;
  raceObjectives?: boolean;
  launchClutchAssist?: boolean;
  reflexLowLatency?: ReflexLowLatencyMode;
}

export interface MiniMapBlip {
  id: string;
  code: string;
  x: number; // normalized 0..100 in SVG space
  y: number; // normalized 0..100 in SVG space
  color: string;
  isPlayer: boolean;
  heading: number; // clockwise degrees from SVG up (-Y)
  position: number;
  gapToPlayerSeconds: number;
  isWithinTwoSeconds: boolean;
  isRival?: boolean;
  hasIncident?: boolean;
}

export type SurfaceHazardType = 'oil' | 'debris';

export interface TrackHazardBlip {
  id: string;
  type: SurfaceHazardType;
  sector: 1 | 2 | 3;
  x: number; // normalized 0..100 in SVG space
  y: number; // normalized 0..100 in SVG space
  gripMultiplier: number;
}

export type TrackFlagType = 'none' | 'yellow' | 'blue' | 'surface';

export interface TrackFlagState {
  flag: TrackFlagType;
  reason: string;
  distanceMeters: number | null;
}

export interface RacerStanding {
  id: string;
  driverId: string;
  name: string;
  teamName: string;
  color: string;
  secondaryColor: string;
  helmetColor: string;
  position: number;
  lap: number;
  totalProgress: number;
  lastLapMs: number | null;
  bestLapMs: number | null;
  raceTimeMs: number;
  pointsAwarded: number;
  gapSeconds: number;
  isPlayer: boolean;
  isRival?: boolean;
  finished: boolean;
}

export interface HudTelemetry {
  speedKmh: number;
  rpm: number;
  maxRpm: number;
  gear: number; // -1 = R, 0 = N, 1..8
  drsAvailable: boolean;
  drsActive: boolean;
  ersCharge: number; // 0..100
  fuelPct: number; // 0..100
  tyreWearPct: number; // 0..100 (100 = fresh)
  tyreCompound: TyreCompound;
  lap: number;
  totalLaps: number;
  position: number;
  totalRacers: number;
  currentLapMs: number;
  lastLapMs: number | null;
  bestLapMs: number | null;
  deltaMs: number | null;
  countdownState: 'lights_1' | 'lights_2' | 'lights_3' | 'lights_4' | 'lights_5' | 'go' | 'racing';
  bannerMessage: string | null;
  wrongWay: boolean;
  miniMapPath: string;
  miniMapStart: { x: number; y: number };
  miniMapBlips: MiniMapBlip[];
  miniMapHazards: TrackHazardBlip[];
  standings: RacerStanding[];
  cameraMode: CameraMode;
  pitBoardActive: boolean;
  gapAheadSeconds: number | null;
  damagePct: number;
  liveWeather: WeatherMode;
  nextWeather: WeatherMode | null;
  dynamicWeather: boolean;
  trackWetnessPct: number;
  surfaceGripPct: number;
  currentSector: 1 | 2 | 3;
  sectorGripPct: [number, number, number];
  activeSurfaceHazard: SurfaceHazardType | null;
  queuedCompound: TyreCompound | null;
  pitStopRemainingSec: number;
  inPitWindow: boolean;
  trackFlag: TrackFlagState;
}
