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
export type MobileControlStyle = 'virtual_joystick' | 'thumb_slider' | 'dual_pedals' | 'tilt_gyro';
export type MobileButtonLayout = 'standard' | 'left_handed' | 'compact_thumb' | 'split_pro';
export type MobileButtonScale = 'compact' | 'normal' | 'large';
export type MobileButtonSpacing = 'compact' | 'normal' | 'wide';

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
  | 'melbourne'
  | 'madrid'
  | 'shanghai'
  | 'interlagos';

export type ActiveAeroMode = 'x_mode' | 'z_mode';
export type ErsDeploymentMode = 'harvest' | 'balanced' | 'overtake';
export type DevelopmentFocus = 'balanced' | 'mguk_hybrid' | 'active_aero' | 'tyre_thermal';
export type AiStrategyArchetype = 'undercut_1stop' | 'aggressive_2stop' | 'overcut_long' | 'wet_gamble';

export interface PowerUnitWear {
  ice: number; // 0..100 (100 = fresh)
  mguk: number; // 0..100
  battery: number; // 0..100
  gearbox: number; // 0..100
}

export interface StaffAllocation {
  aero: number; // headcount assigned to Active Aero / Chassis
  powertrain: number; // headcount assigned to 350kW MGU-K / ICE
  strategy: number; // headcount assigned to Pit Crew / Tyre Ops
}

export interface TeamManagementConfig {
  developmentFocus: DevelopmentFocus;
  staffAllocation: StaffAllocation;
  puWear: PowerUnitWear;
}

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
  // F1 2026 Career & Team Management State
  developmentFocus?: DevelopmentFocus;
  staffAllocation?: StaffAllocation;
  sponsorId?: string;
  costCapSpentM?: number;
  costCapLimitM?: number;
  seasonRound?: number;
  workforceCount?: number;
  puWear?: PowerUnitWear;
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
export type HudColorScheme = 'motorsport_dark' | 'sunlight_contrast' | 'night_amber' | 'telemetry_cyan';
export type HudScaleMode = 'auto' | 'compact' | 'standard' | 'large';
export type HudWidgetKey =
  | 'leaderboard'
  | 'timingTower'
  | 'pitStrategy'
  | 'miniMap'
  | 'weatherOverlay'
  | 'tyrePanel'
  | 'haloCluster'
  | 'gForceRadar'
  | 'damageDiagram';
export type HudWidgetVisibility = Record<HudWidgetKey, boolean>;

export const DEFAULT_HUD_WIDGETS: HudWidgetVisibility = {
  leaderboard: true,
  timingTower: true,
  pitStrategy: true,
  miniMap: true,
  weatherOverlay: true,
  tyrePanel: true,
  haloCluster: true,
  gForceRadar: true,
  damageDiagram: true,
};

export type OnlineMatchmakingPriority = 'balanced' | 'low_ping' | 'skill_matched' | 'fast_fill';
export type OnlineSkillBand = 'strict' | 'standard' | 'open';
export type OnlineSafetyFilter = 'any' | 'b_plus' | 'a_only' | 's_license';
export type OnlineServerRegion =
  | 'auto'
  | 'na_east'
  | 'na_west'
  | 'eu_west'
  | 'eu_central'
  | 'asia_east'
  | 'oceania'
  | 'south_america';
export type OnlineInputMatchmaking = 'any' | 'controller_only' | 'wheel_only';
export type OnlineVoiceChatMode = 'lobby' | 'party_only' | 'muted';
export type OnlineCarPerformanceMode = 'equal' | 'realistic';
export type OnlineCornerCuttingMode = 'relaxed' | 'regular' | 'strict';
export type OnlineCollisionMode = 'full' | 'lap1_ghost' | 'ghost_all';
export type OnlineGridOrderMode = 'qualifying' | 'reverse_grid' | 'random';
export type OnlineAssistCapPreset = 'full_assists' | 'limited_pro' | 'esports_no_assists' | 'custom';
export type OnlineTransmissionRule = 'any' | 'manual_only';

export interface OnlineGameplaySettings {
  // Matchmaking Optimization
  matchmakingPriority: OnlineMatchmakingPriority;
  skillBand: OnlineSkillBand;
  safetyFilter: OnlineSafetyFilter;
  maxPingMs: number; // 40..180 ms
  // Cross-Platform Play
  crossPlayEnabled: boolean;
  inputMatchmaking: OnlineInputMatchmaking;
  voiceChat: OnlineVoiceChatMode;
  // Server Region Preferences
  serverRegion: OnlineServerRegion;
  allowRegionFailover: boolean;
  // Online Race Rules
  applyOnlineRulesToSession: boolean;
  carPerformance: OnlineCarPerformanceMode;
  cornerCutting: OnlineCornerCuttingMode;
  collisionMode: OnlineCollisionMode;
  ghostLappedCars: boolean;
  gridOrder: OnlineGridOrderMode;
  parcFermeLock: boolean;
  // Online Assist Options (Lobby Restrictions)
  assistCapPreset: OnlineAssistCapPreset;
  allowBrakingAssist: boolean;
  allowSteeringAssist: boolean;
  allowAbsAssist: boolean;
  maxTractionControl: TractionControlMode;
  maxRacingLine: RacingLineMode;
  transmissionRule: OnlineTransmissionRule;
  allowPitErsAssist: boolean;
}

export const DEFAULT_ONLINE_GAMEPLAY_SETTINGS: OnlineGameplaySettings = {
  matchmakingPriority: 'balanced',
  skillBand: 'standard',
  safetyFilter: 'a_only',
  maxPingMs: 90,
  crossPlayEnabled: true,
  inputMatchmaking: 'any',
  voiceChat: 'party_only',
  serverRegion: 'auto',
  allowRegionFailover: true,
  applyOnlineRulesToSession: true,
  carPerformance: 'equal',
  cornerCutting: 'regular',
  collisionMode: 'lap1_ghost',
  ghostLappedCars: true,
  gridOrder: 'qualifying',
  parcFermeLock: true,
  assistCapPreset: 'limited_pro',
  allowBrakingAssist: false,
  allowSteeringAssist: false,
  allowAbsAssist: true,
  maxTractionControl: 'medium',
  maxRacingLine: 'corners',
  transmissionRule: 'any',
  allowPitErsAssist: true,
};

export interface GameSettings {
  transmission: TransmissionMode;
  steeringSensitivity: number; // 0.5 - 1.5
  difficulty: DifficultyLevel;
  touchControls: boolean;
  mobileControlStyle?: MobileControlStyle;
  mobileButtonLayout?: MobileButtonLayout;
  mobileButtonScale?: MobileButtonScale;
  mobileButtonSpacing?: MobileButtonSpacing;
  mobileButtonOpacity?: number; // 0.55 - 1.0
  mobileSwipeGestures?: boolean;
  mobileSwipeSensitivity?: number; // 0.6 - 1.6
  mobileGyroSensitivity?: number; // 0.6 - 1.6
  mobileSwapPedals?: boolean;
  mobileFloatingJoystick?: boolean;
  mobileShowErsButton?: boolean;
  mobileShowGearStrip?: boolean;
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
  // Adaptive HUD Scaling, Lighting Color Schemes & Modular Overlay Widgets
  hudColorScheme?: HudColorScheme;
  hudScaleMode?: HudScaleMode;
  hudWidgets?: HudWidgetVisibility;
  // Online Matchmaking, Cross-Platform, Region, Race Rules & Assist Caps
  onlineGameplay?: OnlineGameplaySettings;
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

export type TrackFlagType = 'none' | 'yellow' | 'red' | 'blue' | 'safety_car' | 'vsc' | 'checkered' | 'surface' | 'green';

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
  tyreCompound?: TyreCompound;
  pitStops?: number;
  isPitting?: boolean;
  timePenaltySec?: number;
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

export type WeatherTyreRegime =
  | 'optimal'
  | 'extreme_heat'
  | 'cold_track'
  | 'wet_crossover'
  | 'drying_crossover';

export interface DynamicWeatherTyreImpact {
  weather: WeatherMode;
  trackTemperatureC: number;
  trackTempTrend: 'heating' | 'cooling' | 'stable';
  trackWetnessPct: number;
  rainIntensity: number; // 0..1
  gripMultiplier: number; // 0.55..1.05 real-time tyre grip modifier
  wearMultiplier: number; // 0.85..2.35 real-time degradation rate modifier
  thermalOffsetC: number; // Net cooling (-) or overheating (+) offset vs baseline tread temp
  optimalCompound: TyreCompound;
  crossoverUrgent: boolean;
  regime: WeatherTyreRegime;
  strategyRecommendation: string | null;
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
  weatherTyreImpact?: DynamicWeatherTyreImpact;
  slipstreamPct?: number; // 0..100% aerodynamic draft tow from car ahead
  dirtyAirPct?: number; // 0..100% turbulent wake downforce loss in corners
  // F1 2026 Active Aero, 350kW MGU-K Override & 4-Wheel Wear Telemetry
  activeAeroMode?: ActiveAeroMode;
  manualOverrideAvailable?: boolean;
  manualOverrideActive?: boolean;
  mgukPowerKw?: number;
  wheelWearPct?: [number, number, number, number]; // [FL, FR, RL, RR]
  // F1 Race Control, Track Limits, Overtake Counter & Grid Launch Gameplay
  trackLimitWarnings?: number;
  timePenaltySec?: number;
  overtakesCount?: number;
  launchFeedback?: string | null;
  // PS5 F1 DualSense Telemetry & Live MFD Strategy Controls
  ersMode?: ErsDeploymentMode;
  brakeBiasPct?: number;
  dualsenseConnected?: boolean;
  dualsenseName?: string | null;
  throttleInputPct?: number;
  brakeInputPct?: number;
}


