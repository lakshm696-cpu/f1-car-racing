export type GameScreen = 'title' | 'drivers' | 'garage' | 'playing' | 'paused' | 'podium';

export type GameMode = 'quick_race' | 'career' | 'time_trial' | 'championship';

export type WeatherMode =
  | 'day'
  | 'partly_cloudy'
  | 'sunset'
  | 'cloudy'
  | 'rain'
  | 'heavy_rain'
  | 'snow'
  | 'blizzard'
  | 'fog'
  | 'night';

export type TimeOfDayMode =
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'golden_hour'
  | 'sunset'
  | 'night';

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
  | 'tv_wide'
  | 'heli'
  | 'trackside';

export type GarageCameraPreset = 'overview' | 'front' | 'side' | 'cockpit' | 'rear';

export type PodiumCameraShot = 'auto' | 'wide' | 'winner' | 'trophy' | 'full' | 'victory';

export type DifficultyLevel = 'rookie' | 'pro' | 'legend';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra' | 'extreme' | 'cinematic' | 'ultra_8k';

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

export type CircuitBiome =
  | 'monza'
  | 'singapore'
  | 'alpine'
  | 'monaco'
  | 'silverstone'
  | 'spa'
  | 'suzuka'
  | 'las_vegas'
  | 'abu_dhabi'
  | 'bahrain'
  | 'qatar'
  | 'melbourne';

export interface DrsZoneConfig {
  id: string;
  zoneNumber: number;
  name: string;
  realLengthMeters: number;
  detectionT: number;
  startT: number;
  endT: number;
}

export type DrsZoneNotificationType = 'entered' | 'exited' | null;

export interface DrsStateTelemetry {
  inZone: boolean;
  zoneNumber: number | null;
  zoneName: string | null;
  totalZones: number;
  zoneLengthMeters: number | null;
  remainingMeters: number | null;
  approachingMeters: number | null;
  approachingZoneName: string | null;
  approachingZoneNumber: number | null;
  gapQualified: boolean;
  disabledByWeather: boolean;
  notification: DrsZoneNotificationType;
  notificationZoneNumber: number | null;
  notificationZoneName: string | null;
  notificationSeq: number;
}

export interface MiniMapDrsZone {
  id: string;
  zoneNumber: number;
  path: string;
  active: boolean;
}

export interface CircuitTrack {
  id: string;
  name: string;
  country: string;
  shortCountry?: string;
  biome?: CircuitBiome;
  lengthKm: number;
  corners: number;
  defaultLaps: number;
  trackWidth: number;
  kerbColorA: string;
  kerbColorB: string;
  drsZones?: DrsZoneConfig[];
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
  polePositions?: number;
  podiumFinishes?: number;
  claimedAchievements?: string[];
}

export type Ps5GraphicsMode = 'quality' | 'performance' | 'rt_pro' | 'cinematic';
export type RayTracingQuality = 'off' | 'medium' | 'high' | 'ultra' | 'cinematic';
export type HdrOutputMode = 'off' | 'scrgb' | 'hdr10';
export type BrakingAssistLevel = 'off' | 'low' | 'medium' | 'high';
export type TractionControlMode = 'off' | 'medium' | 'full';
export type RacingLineMode = 'off' | 'corners' | 'full';
export type CarDamageMode = 'off' | 'reduced' | 'simulation';
export type AdaptiveTriggersLevel = 'off' | 'medium' | 'strong';
export type HapticFeedbackLevel = 'off' | 'subtle' | 'full';
export type SpeedUnitMode = 'kmh' | 'mph';
export type ReflexLowLatencyMode = 'off' | 'on' | 'boost';

export type TextureQuality = 'medium' | 'high' | 'ultra' | 'cinematic';
export type ShadowQuality = 'off' | 'medium' | 'high' | 'ultra' | 'cinematic';
export type ReflectionQuality = 'off' | 'medium' | 'high' | 'ultra' | 'cinematic';
export type AmbientOcclusionQuality = 'off' | 'low' | 'medium' | 'high' | 'ultra';
export type ParticleDensityQuality = 'low' | 'medium' | 'high' | 'ultra';
export type AntiAliasingMode = 'off' | 'fxaa' | 'smaa' | 'high';
export type MotionBlurQuality = 'off' | 'low' | 'medium' | 'high' | 'cinematic';
export type GraphicsColorCodeMode = 'standard' | 'palette_lut' | 'twilight_neon' | 'carbon_cinema';

export interface GameSettings {
  transmission: TransmissionMode;
  steeringSensitivity: number; // 0.5 - 1.5
  difficulty: DifficultyLevel;
  touchControls: boolean;
  muted: boolean;
  cameraMode: CameraMode;
  weather: WeatherMode;
  dynamicWeather: boolean;
  timeOfDay?: TimeOfDayMode;
  dynamicTimeOfDay?: boolean;
  totalLaps: number;
  graphicsQuality: GraphicsQuality;
  targetFps: 30 | 60 | 120 | 0; // 0 = Uncapped
  motionBlur: boolean;
  absAssist: boolean;
  tcAssist: boolean;
  // Granular AAA Graphics Settings Engine
  resolutionScale?: number; // 0.5, 0.75, 1.0, 1.5, 2.0 (200% for extreme/4k supersampling)
  textureQuality?: TextureQuality;
  shadowQuality?: ShadowQuality;
  reflectionQuality?: ReflectionQuality;
  ambientOcclusion?: AmbientOcclusionQuality;
  particleDensity?: ParticleDensityQuality;
  antiAliasing?: AntiAliasingMode;
  motionBlurLevel?: MotionBlurQuality;
  graphicsColorCode?: GraphicsColorCodeMode;
  graphicsColorCodeIntensity?: number; // 0..1 LUT blend intensity
  pitStrategyPlan?: PreRacePitStrategy;
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

export type TrackFlagType = 'none' | 'yellow' | 'red' | 'blue' | 'checkered' | 'surface' | 'green';

export interface TrackFlagState {
  flag: TrackFlagType;
  reason: string;
  distanceMeters: number | null;
  sector?: 1 | 2 | 3;
  marshalPost?: number;
  subDirective?: string;
  driverCode?: string;
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

export interface PlannedPitStop {
  id: string;
  stopNumber: number;
  pitLap: number;
  compound: TyreCompound;
  fuelLoadPct: number;
}

export interface PreRacePitStrategy {
  totalLaps: number;
  startingCompound: TyreCompound;
  startingFuelPct: number;
  stops: PlannedPitStop[];
}

export interface PlannedStopHudStatus extends PlannedPitStop {
  completed: boolean;
}

export interface PitStrategyData {
  pitWindowStartLap: number;
  pitWindowEndLap: number;
  isWindowOpen: boolean;
  recommendedCompound: TyreCompound;
  estimatedPitLossSec: number;
  undercutViable: boolean;
  undercutDeltaSec: number | null;
  predictedExitPosition: number;
  tyreDegradationStage: 'fresh' | 'optimal' | 'degrading' | 'cliff';
  tacticalRadioCall: string | null;
  startingCompound?: TyreCompound;
  startingFuelPct?: number;
  plannedStops?: PlannedStopHudStatus[];
  nextPlannedStop?: PlannedPitStop | null;
  estimatedFuelLapsRemaining?: number;
}

export type ContactPatchState =
  | 'stick'
  | 'micro_slip'
  | 'graining_risk'
  | 'thermal_blister'
  | 'macro_slide';

export interface TyreContactPatchTelemetry {
  trackTemperatureC: number;
  contactAreaRatio: number; // 0.55..1.15 normalized footprint under aero/mechanical vertical load
  adhesionRatio: number; // 0..1 fraction of contact patch in static bristle adhesion
  microSlipRatio: number; // 0..1 combined microscopic bristle deflection & shear slip
  microSlipPct: number; // 0..100% readout
  grainingProbabilityPct: number; // 0..100% instantaneous graining probability from sectorGripPct & trackTemperature
  grainingSeverityPct: number; // 0..100% accumulated surface graining abrasion
  wheelMicroSlipPct: [number, number, number, number]; // [FL, FR, RL, RR] micro-slip %
  wheelSurfaceTempC: [number, number, number, number]; // [FL, FR, RL, RR] flash surface temperature (°C)
  wheelCoreTempC?: [number, number, number, number]; // [FL, FR, RL, RR] bulk carcass/core temperature (°C)
  patchState: ContactPatchState;
  gripPenaltyMultiplier: number; // 0.82..1.04 physical grip feedback multiplier
  wearRateMultiplier: number; // 0.90..1.85 physical wear feedback multiplier
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
  miniMapSectorPaths?: [string, string, string];
  miniMapRacingLinePaths?: [string, string, string];
  miniMapStart: { x: number; y: number };
  miniMapBlips: MiniMapBlip[];
  miniMapHazards: TrackHazardBlip[];
  miniMapDrsZones?: MiniMapDrsZone[];
  drsState: DrsStateTelemetry;
  standings: RacerStanding[];
  cameraMode: CameraMode;
  pitBoardActive: boolean;
  gapAheadSeconds: number | null;
  damagePct: number;
  liveWeather: WeatherMode;
  nextWeather: WeatherMode | null;
  dynamicWeather: boolean;
  liveTimeOfDay?: TimeOfDayMode;
  trackWetnessPct: number;
  trackTemperature: number; // Asphalt surface temperature in °C
  surfaceGripPct: number;
  currentSector: 1 | 2 | 3;
  sectorGripPct: [number, number, number];
  activeSurfaceHazard: SurfaceHazardType | null;
  queuedCompound: TyreCompound | null;
  pitStopRemainingSec: number;
  inPitWindow: boolean;
  trackFlag: TrackFlagState;
  // Realism Upgrade: Real-time G-force physics, pit strategy, and microscopic tyre contact patch calculus
  gForceLat: number;
  gForceLong: number;
  gForceTotal: number;
  pitStrategy: PitStrategyData;
  tyreContactPatch?: TyreContactPatchTelemetry;
  slipstreamPct?: number; // 0..100% aerodynamic draft tow from car ahead
  dirtyAirPct?: number; // 0..100% turbulent wake downforce loss in corners
}


