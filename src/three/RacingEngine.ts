import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { RacingAudio, SpatialCarAudioInput } from '../audio/RacingAudio';
import {
  CHAMPIONSHIP_POINTS,
  CIRCUIT_TRACKS,
  FORMULA_DRIVERS,
  FORMULA_TEAMS,
  WHEEL_FINISHES,
} from '../data/racingData';
import {
  CameraMode,
  CarUpgrades,
  CircuitTrack,
  DriverProfile,
  FormulaTeam,
  GameMode,
  GameScreen,
  GameSettings,
  GarageCameraPreset,
  HudTelemetry,
  MiniMapBlip,
  PodiumCameraShot,
  RacerStanding,
  SurfaceHazardType,
  TrackFlagState,
  TrackHazardBlip,
  TyreCompound,
  WeatherMode,
  WheelFinish,
} from '../types/racing';
import { buildFormulaCar, FormulaCarModel } from './carBuilder';
import { buildDriverCharacter, DriverCharacterModel } from './driverBuilder';
import { buildGarageWorkshop, GarageWorkshopModel } from './garageBuilder';
import { buildPitBoard, PitBoardModel } from './pitBoardBuilder';
import { buildPodiumStage, PodiumStageModel } from './podiumBuilder';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { buildCircuitTrack, BuiltTrack } from './trackBuilder';

const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _skidDummy = new THREE.Object3D();
const _weatherCol = new THREE.Color();
const _spatialInputs: SpatialCarAudioInput[] = [
  { relX: 0, relY: 0, relZ: 0, radialVel: 0, rpm: 0, maxRpm: 13500, speedMs: 0, throttle: 0 },
  { relX: 0, relY: 0, relZ: 0, radialVel: 0, rpm: 0, maxRpm: 13500, speedMs: 0, throttle: 0 },
  { relX: 0, relY: 0, relZ: 0, radialVel: 0, rpm: 0, maxRpm: 13500, speedMs: 0, throttle: 0 },
];
const _spatialActiveList: SpatialCarAudioInput[] = [];

interface RacerEntity {
  id: string;
  driverId: string;
  name: string;
  team: FormulaTeam;
  isPlayer: boolean;
  model: FormulaCarModel;
  position: THREE.Vector3;
  yaw: number;
  speed: number;
  lateralVel: number;
  steerAngle: number;
  rpm: number;
  gear: number;
  drsOpen: boolean;
  ersCharge: number;
  fuelPct: number;
  tyreWearPct: number;
  damagePct: number;
  tyreCompound: TyreCompound;
  wheelFinish: WheelFinish;
  shiftFlash: number;
  closestIdx: number;
  lastT: number;
  lap: number;
  totalProgress: number;
  lapStartTimeMs: number;
  lastLapMs: number | null;
  bestLapMs: number | null;
  finished: boolean;
  finishTimeMs: number | null;
  aiTargetLane: number;
  aiBasePace: number;
  aiLaneTimer: number;
  incidentTimer: number;
  incidentCooldown: number;
  spinRate: number;
}

interface SurfaceHazardZone {
  id: string;
  type: SurfaceHazardType;
  sampleIdx: number;
  t: number;
  sector: 1 | 2 | 3;
  position: THREE.Vector3;
  yaw: number;
  lateralOffset: number;
  radius: number;
  gripMultiplier: number;
  ttl: number;
}

export interface EngineCallbacks {
  onTelemetry: (hud: HudTelemetry) => void;
  onRaceFinished: (standings: RacerStanding[]) => void;
  onPauseRequested: () => void;
}

const GEAR_RATIOS = [0, 3.3, 2.45, 1.9, 1.52, 1.24, 1.03, 0.87, 0.74];
const MAX_RPM = 13500;

const SpeedEffectShader = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0 },
    uTime: { value: 0 },
    uHeatDistort: { value: 0 },
    uWetness: { value: 0 },
    uGradeContrast: { value: 0.16 },
    uAoStrength: { value: 0.34 },
    uSharpness: { value: 0.28 },
    uTexelSize: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },
    uSunPos: { value: new THREE.Vector2(0.5, 0.75) },
    uVolumetric: { value: 0 },
    uSunTint: { value: new THREE.Vector3(1.0, 0.78, 0.52) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uTime;
    uniform float uHeatDistort;
    uniform float uWetness;
    uniform float uGradeContrast;
    uniform float uAoStrength;
    uniform float uSharpness;
    uniform vec2 uTexelSize;
    uniform vec2 uSunPos;
    uniform float uVolumetric;
    uniform vec3 uSunTint;
    varying vec2 vUv;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float getLuma(vec3 c) {
      return dot(c, vec3(0.2126, 0.7152, 0.0722));
    }

    void main() {
      vec2 uv = vUv;

      // Exhaust heat shimmer localized around the lower-center exhaust wake
      if (uHeatDistort > 0.005) {
        vec2 exhaustCenter = vec2(0.5, 0.34);
        vec2 dEx = uv - exhaustCenter;
        float heatMask = exp(-dot(dEx * vec2(2.6, 4.2), dEx * vec2(2.6, 4.2)));
        float waveA = sin(uv.y * 85.0 - uTime * 28.0) * cos(uv.x * 52.0 + uTime * 17.0);
        float waveB = cos(uv.y * 130.0 - uTime * 36.0);
        uv += vec2(waveA, waveB * 0.5) * 0.0042 * heatMask * uHeatDistort;
      }

      // Dual-Layer Refractive Camera Lens Water Droplets & Wind-Sheared Rain Streaks
      float dropSpec = 0.0;
      if (uWetness > 0.06) {
        vec2 gridA = vec2(15.0, 9.0);
        vec2 gUvA = uv * gridA;
        vec2 cellA = floor(gUvA);
        vec2 localA = fract(gUvA) - 0.5;
        float rndA = hash21(cellA);
        if (rndA > 0.46) {
          float slideA = fract(uTime * (0.09 + rndA * 0.14) + rndA * 6.28);
          vec2 dropPosA = vec2((rndA - 0.5) * 0.46, 0.40 - slideA * 0.80);
          vec2 dDropA = localA - dropPosA;
          float radA = 0.11 + fract(rndA * 13.7) * 0.085;
          float distA = length(dDropA * vec2(1.0, 0.82));
          if (distA < radA) {
            float lensMaskA = 1.0 - (distA / radA);
            uv -= normalize(dDropA + vec2(0.0001)) * lensMaskA * 0.015 * uWetness;
            dropSpec += smoothstep(0.62, 0.98, lensMaskA) * 0.25 * uWetness;
          }
        }

        // Secondary fine mist beads on outer lens periphery
        vec2 gridB = vec2(28.0, 16.0);
        vec2 gUvB = uv * gridB;
        vec2 cellB = floor(gUvB);
        vec2 localB = fract(gUvB) - 0.5;
        float rndB = hash21(cellB + 19.3);
        if (rndB > 0.62) {
          float slideB = fract(uTime * (0.16 + rndB * 0.18) + rndB * 3.14);
          vec2 dDropB = localB - vec2((rndB - 0.5) * 0.4, 0.35 - slideB * 0.7);
          float distB = length(dDropB);
          if (distB < 0.11) {
            float maskB = 1.0 - (distB / 0.11);
            uv -= normalize(dDropB + vec2(0.0001)) * maskB * 0.008 * uWetness;
            dropSpec += smoothstep(0.7, 0.99, maskB) * 0.16 * uWetness;
          }
        }
      }

      // 12-Tap Cinematic Radial Shutter Motion Blur + Telephoto Chromatic Dispersion
      vec2 dir = uv - 0.5;
      float distSq = dot(dir, dir);
      float blurScale = distSq * 0.030 * uIntensity;
      float chroma = distSq * 0.0065 * uIntensity;

      vec3 col = texture2D(tDiffuse, uv).rgb;
      if (uIntensity > 0.006) {
        vec3 accum = col * 0.18;
        accum += texture2D(tDiffuse, uv - dir * (blurScale * 0.20)).rgb * 0.12;
        accum += texture2D(tDiffuse, uv - dir * (blurScale * 0.40)).rgb * 0.11;
        accum += texture2D(tDiffuse, uv - dir * (blurScale * 0.62)).rgb * 0.10;
        accum += texture2D(tDiffuse, uv - dir * (blurScale * 0.84)).rgb * 0.09;
        accum += texture2D(tDiffuse, uv - dir * (blurScale * 1.06)).rgb * 0.08;
        accum += texture2D(tDiffuse, uv - dir * (blurScale * 1.28)).rgb * 0.075;
        accum += texture2D(tDiffuse, uv - dir * (blurScale * 1.50)).rgb * 0.065;
        accum += texture2D(tDiffuse, uv - dir * (blurScale * 1.72)).rgb * 0.055;
        accum += texture2D(tDiffuse, uv - dir * (blurScale * 1.94)).rgb * 0.045;
        accum += texture2D(tDiffuse, uv - dir * (blurScale * 2.16)).rgb * 0.04;
        accum += texture2D(tDiffuse, uv - dir * (blurScale * 2.40)).rgb * 0.04;
        float r = mix(accum.r, texture2D(tDiffuse, uv - dir * chroma).r, 0.4);
        float b = mix(accum.b, texture2D(tDiffuse, uv + dir * chroma).b, 0.4);
        col = vec3(r, accum.g, b);
      }

      // High-Quality Screen-Space Luma-Cavity Ambient Occlusion (SSAO Contact & Crevice Shading) + 4K Contrast-Adaptive Sharpening
      if (uAoStrength > 0.01 || uSharpness > 0.01) {
        vec3 nUp = texture2D(tDiffuse, uv + vec2(0.0, uTexelSize.y * 1.5)).rgb;
        vec3 nDown = texture2D(tDiffuse, uv - vec2(0.0, uTexelSize.y * 1.5)).rgb;
        vec3 nLeft = texture2D(tDiffuse, uv - vec2(uTexelSize.x * 1.5, 0.0)).rgb;
        vec3 nRight = texture2D(tDiffuse, uv + vec2(uTexelSize.x * 1.5, 0.0)).rgb;
        vec3 ringAvg = (nUp + nDown + nLeft + nRight) * 0.25;

        if (uSharpness > 0.01) {
          vec3 detail = col - ringAvg;
          col += clamp(detail * uSharpness, -0.14, 0.14);
        }

        if (uAoStrength > 0.01) {
          vec3 farA = texture2D(tDiffuse, uv + uTexelSize * vec2(3.5, 3.5)).rgb;
          vec3 farB = texture2D(tDiffuse, uv + uTexelSize * vec2(-3.5, 3.5)).rgb;
          vec3 farC = texture2D(tDiffuse, uv + uTexelSize * vec2(3.5, -3.5)).rgb;
          vec3 farD = texture2D(tDiffuse, uv + uTexelSize * vec2(-3.5, -3.5)).rgb;
          float centerLuma = getLuma(col);
          float surrLuma = (getLuma(ringAvg) + getLuma((farA + farB + farC + farD) * 0.25)) * 0.5;
          float cavity = clamp((surrLuma - centerLuma) * 2.8, 0.0, 0.45);
          float shadowWeight = 1.0 - smoothstep(0.15, 0.78, centerLuma);
          col *= (1.0 - cavity * shadowWeight * uAoStrength);
        }

        // PS5 EGO Engine Anamorphic Red Rain-Light & Emissive Beacon Horizontal Glare
        vec3 hLeft = texture2D(tDiffuse, uv - vec2(uTexelSize.x * 8.0, 0.0)).rgb;
        vec3 hRight = texture2D(tDiffuse, uv + vec2(uTexelSize.x * 8.0, 0.0)).rgb;
        vec3 hFarL = texture2D(tDiffuse, uv - vec2(uTexelSize.x * 18.0, 0.0)).rgb;
        vec3 hFarR = texture2D(tDiffuse, uv + vec2(uTexelSize.x * 18.0, 0.0)).rgb;
        vec3 streakSample = (hLeft + hRight) * 0.35 + (hFarL + hFarR) * 0.15;
        float redBeaconMask = smoothstep(0.55, 0.95, streakSample.r - streakSample.g * 0.85);
        col += vec3(1.0, 0.18, 0.24) * redBeaconMask * (0.14 + uWetness * 0.18);
      }

      // Volumetric atmospheric crepuscular sun shafts + anamorphic broadcast lens streak
      if (uVolumetric > 0.005) {
        vec2 deltaRay = (uv - uSunPos) * (1.0 / 12.0) * 0.72;
        vec2 rayUv = uv;
        float illumDecay = 1.0;
        vec3 godRays = vec3(0.0);
        for (int i = 0; i < 12; i++) {
          rayUv -= deltaRay;
          vec3 sCol = texture2D(tDiffuse, clamp(rayUv, 0.001, 0.999)).rgb;
          float sLuma = getLuma(sCol);
          float brightMask = smoothstep(0.62, 1.08, sLuma);
          godRays += sCol * brightMask * illumDecay;
          illumDecay *= 0.88;
        }
        float sunDist = length(uv - uSunPos);
        float radialFalloff = exp(-sunDist * 1.35);
        col += (godRays * 0.048) * uSunTint * uVolumetric * radialFalloff;

        float streakY = exp(-abs(uv.y - uSunPos.y) * 34.0);
        float streakX = exp(-abs(uv.x - uSunPos.x) * 3.4);
        col += uSunTint * (streakY * streakX * 0.16 * uVolumetric);
      }

      col += vec3(dropSpec * 0.92, dropSpec * 0.96, dropSpec);

      // Filmic HDR color grading: crisp S-curve contrast, highlight halation & subtle cinema grain
      if (uGradeContrast > 0.001) {
        vec3 sCurve = col * col * (3.0 - 2.0 * clamp(col, 0.0, 1.0));
        col = mix(col, sCurve, uGradeContrast);
        float luma = getLuma(col);
        float halation = smoothstep(0.84, 1.15, luma);
        col += vec3(0.06, 0.032, 0.012) * halation * uGradeContrast * 2.5;
        vec3 coolShadows = col * vec3(0.96, 0.98, 1.03);
        vec3 warmHighlights = col * vec3(1.03, 1.00, 0.96);
        col = mix(coolShadows, warmHighlights, smoothstep(0.18, 0.82, luma));
        float filmGrain = (hash21(vUv * 960.0 + fract(uTime) * 37.0) - 0.5) * 0.009;
        col += vec3(filmGrain);
      }

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class RacingEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bokehPass: BokehPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private speedPass: ShaderPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private audio = new RacingAudio();
  private textures: ProceduralTextureSet;
  private envTexture: THREE.Texture | null = null;
  private activeEnvMode: string = '';
  private heroCubeTarget: THREE.WebGLCubeRenderTarget | null = null;
  private heroCubeCamera: THREE.CubeCamera | null = null;
  private cubeFrameCounter = 0;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

  private builtTrack: BuiltTrack | null = null;
  private showroomGroup: THREE.Group;
  private garageTurntableGroup: THREE.Group;
  private garageWorkshop: GarageWorkshopModel;
  private garageDoorsOpen = true;
  private garageLightsOn = true;
  private showroomCar: FormulaCarModel;

  private driverShowroomGroup: THREE.Group;
  private showroomDriver: DriverCharacterModel;
  private driverAzimuth = 0.15;
  private driverTargetAzimuth = 0.15;
  private driverSelectAnimTimer = 0;

  private podiumStage: PodiumStageModel;
  private podiumCameraShot: PodiumCameraShot = 'auto';
  private podiumElapsed = 0;

  private pitBoard: PitBoardModel;

  private racers: RacerEntity[] = [];
  private currentTrack: CircuitTrack = CIRCUIT_TRACKS[0];
  private currentTeam: FormulaTeam = FORMULA_TEAMS[0];
  private currentDriver: DriverProfile = FORMULA_DRIVERS[0];
  private customPrimaryHex = '#10131A';
  private customNumber = '';
  private currentWheelFinish: WheelFinish = WHEEL_FINISHES[0];
  private currentCompound: TyreCompound = 'wet';
  private upgrades: CarUpgrades = {
    engineLevel: 1,
    tyreLevel: 1,
    brakeLevel: 1,
    suspensionLevel: 1,
    aeroLevel: 1,
  };
  private gameMode: GameMode = 'quick_race';
  private activeRivalId: string | null = null;
  private screen: GameScreen = 'title';
  private settings: GameSettings = {
    transmission: 'auto',
    steeringSensitivity: 1.0,
    difficulty: 'pro',
    touchControls: false,
    muted: false,
    cameraMode: 'chase',
    weather: 'rain',
    dynamicWeather: false,
    totalLaps: 3,
    graphicsQuality: 'ultra',
    targetFps: 60,
    motionBlur: true,
    absAssist: true,
    tcAssist: true,
    ps5GraphicsMode: 'rt_pro',
    rayTracingQuality: 'ultra',
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
  };

  // Dynamic Weather & Pit Strategy State
  private liveWeather: WeatherMode = 'rain';
  private nextWeather: WeatherMode | null = null;
  private trackWetness = 0.78;
  private weatherSchedule: { atProgress: number; mode: WeatherMode }[] = [];
  private weatherPhaseIndex = 0;
  private weatherForecastAlerted = false;
  private queuedCompound: TyreCompound | null = null;
  private pitStopTimer = 0;
  private pitCooldownTimer = 0;
  private curSkyColor = new THREE.Color(0x3b4859);
  private curFogColor = new THREE.Color(0x3b4859);
  private curFogDensity = 0.0052;
  private curSunColor = new THREE.Color(0xdbeafe);
  private curSunIntensity = 1.45;
  private curHemiSky = new THREE.Color(0x94a3b8);
  private curHemiGround = new THREE.Color(0x1e293b);
  private curHemiIntensity = 0.96;
  private curRainOpacity = 0.62;
  private curRainSize = 0.65;
  private curRainAudio = 0.06;

  // Dynamic Track Rubbering-In Progression
  private baseAsphaltCanvas: HTMLCanvasElement | null = null;
  private baseRoughnessCanvas: HTMLCanvasElement | null = null;
  private trackRubberLevel = 0;
  private renderedRubberLevel = -1;
  private completedRaceLaps = 0;

  // Pooled Skid Marks & Surface Hazard Meshes (Oil Spills & Carbon Debris)
  private skidMesh: THREE.InstancedMesh;
  private skidCursor = 0;
  private readonly skidPoolSize = 360;
  private oilSpillMesh: THREE.InstancedMesh;
  private debrisMesh: THREE.InstancedMesh;
  private readonly maxHazardZones = 14;
  private readonly shardsPerDebrisZone = 6;
  private surfaceHazards: SurfaceHazardZone[] = [];
  private hazardIdCounter = 0;
  private playerSurfaceGripPct = 100;
  private playerActiveHazard: SurfaceHazardType | null = null;

  // Pooled Tyre Smoke / Heavy Rear Water Spray & Mist Particles
  private smokeGeo: THREE.BufferGeometry;
  private smokePoints: THREE.Points;
  private smokePositions: Float32Array;
  private smokeLife: Float32Array;
  private smokeVel: Float32Array;
  private smokeCursor = 0;
  private readonly smokePoolSize = 480;

  // Pooled Titanium Underfloor Sparks
  private sparkGeo: THREE.BufferGeometry;
  private sparkPoints: THREE.Points;
  private sparkPositions: Float32Array;
  private sparkLife: Float32Array;
  private sparkVel: Float32Array;
  private sparkCursor = 0;
  private readonly sparkPoolSize = 140;

  // Pooled Rain Particles
  private rainGeo: THREE.BufferGeometry;
  private rainPoints: THREE.Points;
  private rainPositions: Float32Array;
  private readonly rainCount = 900;

  // Pooled Finish-Line Fireworks Particles
  private fireworkGeo: THREE.BufferGeometry;
  private fireworkPoints: THREE.Points;
  private fireworkPositions: Float32Array;
  private fireworkColors: Float32Array;
  private fireworkVel: Float32Array;
  private fireworkLife: Float32Array;
  private fireworkCursor = 0;
  private fireworkCooldown = 0;
  private readonly fireworkPoolSize = 540;

  private heldKeys = new Set<string>();
  private touchState = {
    left: false,
    right: false,
    throttle: false,
    brake: false,
    drs: false,
  };

  private frameId = 0;
  private lastTimestamp = 0;
  private raceElapsedMs = 0;
  private countdownTimer = 0;
  private lastCountdownStage = 0;
  private countdownState: HudTelemetry['countdownState'] = 'lights_1';
  private bannerMessage: string | null = null;
  private bannerTimer = 0;
  private pitBoardTimer = 0;
  private finalLapBoardShown = false;
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private hudEmitAccum = 0;
  private titleAngle = 0;
  private lastTitleShotId = -1;
  private smoothBokehFocus = 6.0;
  private smoothBloomStrength = 0.56;
  private smoothBloomRadius = 0.68;
  private smoothBloomThreshold = 0.76;
  private victoryAngle = 0;
  private tvStationIdx = 28;
  private tvStationSide = 1;
  private gridIntroDrivers: DriverCharacterModel[] = [];

  private garageAzimuth = 0.72;
  private garageTargetAzimuth = 0.72;
  private garagePolar = 1.24;
  private garageTargetPolar = 1.24;
  private garageDistance = 6.2;
  private garageTargetDistance = 6.2;
  private isDraggingGarage = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private adaptiveDprScale = 1.0;
  private smoothFrameMs = 16.6;

  private callbacks: EngineCallbacks;
  private disposed = false;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(width, height);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.2, 950);

    this.updateEnvironment('day');

    // Multisampled Half-Float HDR EffectComposer on Hardware GPUs (8x MSAA + 512px Ray-Traced CubeCamera)
    if (!this.isSoftwareGl) {
      const rt = new THREE.WebGLRenderTarget(width, height, {
        samples: 8,
        type: THREE.HalfFloatType,
      });
      const composer = new EffectComposer(this.renderer, rt);
      composer.addPass(new RenderPass(this.scene, this.camera));

      const bokehPass = new BokehPass(this.scene, this.camera, {
        focus: 6.0,
        aperture: 0.00014,
        maxblur: 0.006,
      });
      bokehPass.enabled = false;
      composer.addPass(bokehPass);

      const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.56, 0.68, 0.76);
      composer.addPass(bloomPass);

      const speedPass = new ShaderPass(SpeedEffectShader);
      (speedPass.uniforms['uTexelSize'].value as THREE.Vector2).set(1 / Math.max(1, width), 1 / Math.max(1, height));
      composer.addPass(speedPass);

      const vignettePass = new ShaderPass(VignetteShader);
      vignettePass.uniforms['offset'].value = 1.05;
      vignettePass.uniforms['darkness'].value = 0.36;
      composer.addPass(vignettePass);

      composer.addPass(new OutputPass());
      this.composer = composer;
      this.bokehPass = bokehPass;
      this.bloomPass = bloomPass;
      this.speedPass = speedPass;

      this.heroCubeTarget = new THREE.WebGLCubeRenderTarget(512, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
        type: THREE.HalfFloatType,
      });
      this.heroCubeCamera = new THREE.CubeCamera(0.35, 460, this.heroCubeTarget);
    }

    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x2a3529, 0.82);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 2.45);
    this.sunLight.position.set(85, 110, 65);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = this.isSoftwareGl ? 1024 : 4096;
    this.sunLight.shadow.mapSize.height = this.isSoftwareGl ? 1024 : 4096;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 260;
    const sd = 38;
    this.sunLight.shadow.camera.left = -sd;
    this.sunLight.shadow.camera.right = sd;
    this.sunLight.shadow.camera.top = sd;
    this.sunLight.shadow.camera.bottom = -sd;
    this.sunLight.shadow.radius = 2.0;
    this.sunLight.shadow.bias = -0.00025;
    this.sunLight.shadow.normalBias = 0.015;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0xbae6fd, 0.72);
    this.rimLight.position.set(-70, 45, -80);
    this.scene.add(this.rimLight);

    this.textures = createProceduralTextures(
      this.renderer.capabilities.getMaxAnisotropy(),
      this.currentTrack.kerbColorA,
      this.currentTrack.kerbColorB,
      this.settings.weather
    );

    // Showroom Turntable + Indoor Team Racing Workshop
    this.showroomGroup = new THREE.Group();
    this.garageWorkshop = buildGarageWorkshop(this.textures.carbonMap);
    this.showroomGroup.add(this.garageWorkshop.root);

    this.garageTurntableGroup = new THREE.Group();
    const turntable = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.6, 0.16, 48),
      new THREE.MeshStandardMaterial({ color: 0x11151d, metalness: 0.8, roughness: 0.16 })
    );
    turntable.position.y = -0.08;
    turntable.receiveShadow = true;
    this.garageTurntableGroup.add(turntable);

    const ringGlow = new THREE.Mesh(
      new THREE.RingGeometry(4.32, 4.44, 48),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.8, side: THREE.DoubleSide })
    );
    ringGlow.rotation.x = -Math.PI / 2;
    ringGlow.position.y = 0.01;
    this.garageTurntableGroup.add(ringGlow);

    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const overheadSoftbox = new THREE.RectAreaLight(0xffffff, 4.8, 7, 2.5);
      overheadSoftbox.position.set(0, 4.6, 0);
      overheadSoftbox.lookAt(0, 0, 0);
      this.showroomGroup.add(overheadSoftbox);

      const sideSoftbox = new THREE.RectAreaLight(0x93c5fd, 3.2, 5, 2);
      sideSoftbox.position.set(-4.5, 2.2, 2.5);
      sideSoftbox.lookAt(0, 0.5, 0);
      this.showroomGroup.add(sideSoftbox);
    }

    this.showroomCar = buildFormulaCar(
      this.textures.carbonMap,
      this.textures.carbonNormalMap,
      this.textures.paintFlakeNormalMap,
      this.textures.tyreTreadNormalMap,
      this.textures.brakeDiscMap,
      this.textures.contactShadowMap,
      this.currentTeam.primaryColor,
      this.currentTeam.secondaryColor,
      this.currentTeam.accentColor,
      this.currentDriver.helmetColor,
      this.currentWheelFinish,
      this.currentCompound,
      this.currentTeam.number,
      this.currentDriver.skinTone,
      this.textures.bodyRoughnessMap,
      this.textures.carAoMap
    );
    this.garageTurntableGroup.add(this.showroomCar.root);
    this.showroomGroup.add(this.garageTurntableGroup);
    this.showroomGroup.visible = false;
    this.scene.add(this.showroomGroup);

    // Driver Selection Dark Carbon Studio Plinth Showroom
    this.driverShowroomGroup = new THREE.Group();
    const driverPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.65, 0.18, 40),
      new THREE.MeshStandardMaterial({
        map: this.textures.carbonMap,
        color: 0x14171f,
        metalness: 0.78,
        roughness: 0.22,
      })
    );
    driverPlinth.position.y = -0.09;
    driverPlinth.receiveShadow = true;
    this.driverShowroomGroup.add(driverPlinth);

    const driverRing = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.49, 44),
      new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0xdc2626,
        emissiveIntensity: 2.1,
        side: THREE.DoubleSide,
      })
    );
    driverRing.rotation.x = -Math.PI / 2;
    driverRing.position.y = 0.01;
    this.driverShowroomGroup.add(driverRing);

    const driverCarbonBackdrop = new THREE.Mesh(
      new THREE.CylinderGeometry(7.2, 7.2, 5.2, 32, 1, true, Math.PI * 0.65, Math.PI * 0.7),
      new THREE.MeshStandardMaterial({
        map: this.textures.carbonMap,
        color: 0x10131a,
        metalness: 0.45,
        roughness: 0.55,
        side: THREE.BackSide,
      })
    );
    driverCarbonBackdrop.position.set(0, 2.2, 0);
    this.driverShowroomGroup.add(driverCarbonBackdrop);

    const driverStudioAccent = new THREE.Mesh(
      new THREE.BoxGeometry(5.8, 0.06, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 })
    );
    driverStudioAccent.position.set(0, 2.75, -5.8);
    this.driverShowroomGroup.add(driverStudioAccent);

    const driverRedRim = new THREE.PointLight(0xef4444, 12, 10, 1.5);
    driverRedRim.position.set(-1.9, 1.9, -2.2);
    this.driverShowroomGroup.add(driverRedRim);

    const driverFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({
        map: this.textures.carbonMap,
        color: 0x090b10,
        metalness: 0.52,
        roughness: 0.34,
      })
    );
    driverFloor.rotation.x = -Math.PI / 2;
    driverFloor.position.y = -0.18;
    this.driverShowroomGroup.add(driverFloor);

    this.showroomDriver = buildDriverCharacter(
      this.textures.carbonMap,
      this.currentDriver.suitPrimary,
      this.currentDriver.suitSecondary,
      this.currentDriver.helmetColor,
      this.currentDriver.visorColor,
      this.currentDriver.skinTone
    );
    this.driverShowroomGroup.add(this.showroomDriver.root);
    this.driverShowroomGroup.visible = false;
    this.scene.add(this.driverShowroomGroup);

    // 3D Championship Podium Stage
    this.podiumStage = buildPodiumStage(this.textures.carbonMap);
    this.podiumStage.root.visible = false;
    this.scene.add(this.podiumStage.root);

    // Skid Marks InstancedMesh
    const skidGeo = new THREE.PlaneGeometry(0.42, 1.35);
    skidGeo.rotateX(-Math.PI / 2);
    const skidMat = new THREE.MeshBasicMaterial({
      color: 0x0b0c0e,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.skidMesh = new THREE.InstancedMesh(skidGeo, skidMat, this.skidPoolSize);
    this.skidMesh.frustumCulled = false;
    _skidDummy.position.set(0, -50, 0);
    _skidDummy.updateMatrix();
    for (let i = 0; i < this.skidPoolSize; i++) {
      this.skidMesh.setMatrixAt(i, _skidDummy.matrix);
    }
    this.skidMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.skidMesh);

    // Pooled Oil Spill Slicks InstancedMesh
    const oilGeo = new THREE.PlaneGeometry(4.4, 6.6);
    oilGeo.rotateX(-Math.PI / 2);
    const oilMat = new THREE.MeshPhysicalMaterial({
      map: this.textures.oilSpillMap,
      transparent: true,
      opacity: 0.9,
      roughness: 0.06,
      metalness: 0.38,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      iridescence: 0.95,
      iridescenceIOR: 1.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    this.oilSpillMesh = new THREE.InstancedMesh(oilGeo, oilMat, this.maxHazardZones);
    this.oilSpillMesh.frustumCulled = false;
    for (let i = 0; i < this.maxHazardZones; i++) {
      this.oilSpillMesh.setMatrixAt(i, _skidDummy.matrix);
    }
    this.oilSpillMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.oilSpillMesh);

    // Pooled Carbon-Fibre Wing/Endplate Debris Shards InstancedMesh
    const debrisGeo = new THREE.BoxGeometry(0.34, 0.045, 0.24);
    const debrisMat = new THREE.MeshStandardMaterial({
      map: this.textures.carbonMap,
      color: 0x1e2430,
      roughness: 0.34,
      metalness: 0.52,
    });
    const totalDebrisShards = this.maxHazardZones * this.shardsPerDebrisZone;
    this.debrisMesh = new THREE.InstancedMesh(debrisGeo, debrisMat, totalDebrisShards);
    this.debrisMesh.frustumCulled = false;
    this.debrisMesh.castShadow = true;
    for (let i = 0; i < totalDebrisShards; i++) {
      this.debrisMesh.setMatrixAt(i, _skidDummy.matrix);
    }
    this.debrisMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.debrisMesh);

    // Pooled Tyre Smoke / Wet Rooster-Tail Spray
    this.smokePositions = new Float32Array(this.smokePoolSize * 3);
    this.smokeLife = new Float32Array(this.smokePoolSize);
    this.smokeVel = new Float32Array(this.smokePoolSize * 3);
    this.smokeGeo = new THREE.BufferGeometry();
    this.smokeGeo.setAttribute('position', new THREE.BufferAttribute(this.smokePositions, 3));
    this.smokePoints = new THREE.Points(
      this.smokeGeo,
      new THREE.PointsMaterial({
        color: 0xe2e8f0,
        map: this.textures.smokeSpriteMap,
        size: 2.35,
        transparent: true,
        opacity: 0.56,
        depthWrite: false,
      })
    );
    this.smokePoints.frustumCulled = false;
    this.scene.add(this.smokePoints);

    // Pooled Titanium Underfloor Sparks (Additive Glow)
    this.sparkPositions = new Float32Array(this.sparkPoolSize * 3);
    this.sparkPositions.fill(-9999);
    this.sparkLife = new Float32Array(this.sparkPoolSize);
    this.sparkVel = new Float32Array(this.sparkPoolSize * 3);
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparkPoints = new THREE.Points(
      this.sparkGeo,
      new THREE.PointsMaterial({
        color: 0xffc66d,
        map: this.textures.sparkSpriteMap,
        size: 0.55,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.sparkPoints.frustumCulled = false;
    this.scene.add(this.sparkPoints);

    // Pooled Rain Streaks
    this.rainPositions = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 60;
      this.rainPositions[i * 3 + 1] = Math.random() * 26;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rainPoints = new THREE.Points(
      this.rainGeo,
      new THREE.PointsMaterial({
        color: 0xdbeafe,
        map: this.textures.rainSpriteMap,
        size: 0.65,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      })
    );
    this.rainPoints.frustumCulled = false;
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);

    // Pooled Finish-Line Fireworks (Additive Multi-Color Bursts)
    this.fireworkPositions = new Float32Array(this.fireworkPoolSize * 3);
    this.fireworkPositions.fill(-9999);
    this.fireworkColors = new Float32Array(this.fireworkPoolSize * 3);
    this.fireworkVel = new Float32Array(this.fireworkPoolSize * 3);
    this.fireworkLife = new Float32Array(this.fireworkPoolSize);
    this.fireworkGeo = new THREE.BufferGeometry();
    this.fireworkGeo.setAttribute('position', new THREE.BufferAttribute(this.fireworkPositions, 3));
    this.fireworkGeo.setAttribute('color', new THREE.BufferAttribute(this.fireworkColors, 3));
    this.fireworkPoints = new THREE.Points(
      this.fireworkGeo,
      new THREE.PointsMaterial({
        size: 1.45,
        map: this.textures.sparkSpriteMap,
        vertexColors: true,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.fireworkPoints.frustumCulled = false;
    this.scene.add(this.fireworkPoints);

    this.pitBoard = buildPitBoard(this.renderer.capabilities.getMaxAnisotropy());
    this.scene.add(this.pitBoard.root);

    this.rebuildWorldAndGrid();
    this.applyGraphicsSettings();
    this.bindEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.lastTimestamp = performance.now();
    this.startLoop();
  }

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
    dom.addEventListener('webglcontextlost', this.onContextLost);
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
  };

  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.applyGraphicsSettings();
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloomPass) {
      const pr = this.renderer.getPixelRatio();
      this.bloomPass.setSize(Math.max(1, Math.round(w * pr)), Math.max(1, Math.round(h * pr)));
    }
    if (this.speedPass) {
      (this.speedPass.uniforms['uTexelSize'].value as THREE.Vector2).set(1 / Math.max(1, w), 1 / Math.max(1, h));
    }
    if (this.bokehPass) {
      const uniforms = this.bokehPass.uniforms as Record<string, THREE.IUniform>;
      if (uniforms['aspect']) uniforms['aspect'].value = w / h;
    }
  };

  private onWindowBlur = () => {
    this.heldKeys.clear();
    this.touchState.left = false;
    this.touchState.right = false;
    this.touchState.throttle = false;
    this.touchState.brake = false;
    this.touchState.drs = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    this.audio.unlock();
    const firstPress = !this.heldKeys.has(e.code);
    this.heldKeys.add(e.code);

    if (firstPress) {
      if (e.code === 'Escape' && (this.screen === 'playing' || this.screen === 'paused')) {
        this.callbacks.onPauseRequested();
      } else if (e.code === 'KeyC' && this.screen === 'playing') {
        this.cycleCameraMode();
      } else if (e.code === 'KeyE' && this.screen === 'playing') {
        this.manualShift(1);
      } else if (e.code === 'KeyQ' && this.screen === 'playing') {
        this.manualShift(-1);
      } else if (e.code === 'Digit1' && this.screen === 'playing') {
        this.requestTyreSwitch('soft');
      } else if (e.code === 'Digit2' && this.screen === 'playing') {
        this.requestTyreSwitch('medium');
      } else if (e.code === 'Digit3' && this.screen === 'playing') {
        this.requestTyreSwitch('hard');
      } else if (e.code === 'Digit4' && this.screen === 'playing') {
        this.requestTyreSwitch('wet');
      } else if (e.code === 'KeyB' && this.screen === 'playing') {
        const recommended: TyreCompound =
          this.trackWetness >= 0.35 ? 'wet' : this.currentCompound === 'wet' ? 'soft' : this.currentCompound;
        this.requestTyreSwitch(recommended);
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent) => {
    this.audio.unlock();
    if (this.screen !== 'garage' && this.screen !== 'drivers') return;
    this.isDraggingGarage = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isDraggingGarage) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    if (this.screen === 'garage') {
      this.garageTargetAzimuth -= dx * 0.008;
      this.garageTargetPolar = THREE.MathUtils.clamp(this.garageTargetPolar - dy * 0.005, 0.72, 1.44);
    } else if (this.screen === 'drivers') {
      this.driverTargetAzimuth += dx * 0.011;
    }
  };

  private onPointerUp = () => {
    this.isDraggingGarage = false;
  };

  private onWheel = (e: WheelEvent) => {
    if (this.screen !== 'garage') return;
    this.garageTargetDistance = THREE.MathUtils.clamp(this.garageTargetDistance + e.deltaY * 0.004, 3.4, 9.5);
  };

  public setGarageCameraPreset(preset: GarageCameraPreset) {
    if (preset === 'overview') {
      this.garageTargetAzimuth = 0.72;
      this.garageTargetPolar = 1.24;
      this.garageTargetDistance = 6.2;
    } else if (preset === 'front') {
      this.garageTargetAzimuth = 0.14;
      this.garageTargetPolar = 1.32;
      this.garageTargetDistance = 4.6;
    } else if (preset === 'side') {
      this.garageTargetAzimuth = Math.PI * 0.5;
      this.garageTargetPolar = 1.36;
      this.garageTargetDistance = 5.4;
    } else if (preset === 'cockpit') {
      this.garageTargetAzimuth = -0.35;
      this.garageTargetPolar = 0.88;
      this.garageTargetDistance = 3.5;
    } else if (preset === 'rear') {
      this.garageTargetAzimuth = Math.PI - 0.18;
      this.garageTargetPolar = 1.28;
      this.garageTargetDistance = 4.4;
    }
  }

  public adjustGarageZoom(delta: number) {
    this.garageTargetDistance = THREE.MathUtils.clamp(this.garageTargetDistance + delta, 3.4, 9.5);
  }

  public toggleGarageLights(): boolean {
    this.garageLightsOn = !this.garageLightsOn;
    this.audio.playUiConfirm();
    return this.garageLightsOn;
  }

  public triggerDriverSelectAnim() {
    this.audio.unlock();
    this.audio.playUiConfirm();
    this.driverSelectAnimTimer = 1.1;
  }

  public setPodiumCameraShot(shot: PodiumCameraShot) {
    this.podiumCameraShot = shot;
  }

  public unlockAudio() {
    this.audio.unlock();
  }

  public isAudioReady(): boolean {
    return this.audio.isReady();
  }

  public setTouchInput(control: keyof typeof this.touchState, pressed: boolean) {
    this.audio.unlock();
    this.touchState[control] = pressed;
  }

  public manualShift(dir: 1 | -1) {
    if (this.settings.transmission !== 'manual') return;
    const player = this.racers.find((r) => r.isPlayer);
    if (!player) return;
    const next = THREE.MathUtils.clamp(player.gear + dir, -1, 8);
    if (next !== player.gear) {
      player.gear = next;
      player.shiftFlash = 1.0;
      this.audio.playGearShift(dir > 0);
    }
  }

  public cycleCameraMode(): CameraMode {
    const order: CameraMode[] = [
      'chase',
      'tcam',
      'cockpit',
      'low_track',
      'wing_tyre',
      'tv_wide',
      'bumper',
      'side',
      'rear',
    ];
    const next = order[(order.indexOf(this.settings.cameraMode) + 1) % order.length];
    this.settings.cameraMode = next;
    if (next === 'tv_wide' && this.builtTrack) {
      const player = this.racers.find((r) => r.isPlayer);
      if (player) {
        this.tvStationIdx = (player.closestIdx + 26) % this.builtTrack.samples.length;
      }
    }
    this.emitHud();
    return next;
  }

  public setScreen(nextScreen: GameScreen) {
    this.screen = nextScreen;
    const isGarage = nextScreen === 'garage';
    const isDrivers = nextScreen === 'drivers';
    const isPodium = nextScreen === 'podium';
    const isTrackView = !isGarage && !isDrivers && !isPodium;

    this.showroomGroup.visible = isGarage;
    this.driverShowroomGroup.visible = isDrivers;
    this.podiumStage.root.visible = isPodium;
    this.skidMesh.visible = isTrackView;
    this.oilSpillMesh.visible = isTrackView;
    this.debrisMesh.visible = isTrackView;
    this.sparkPoints.visible = isTrackView;
    this.fireworkPoints.visible = isTrackView;
    if (!isTrackView) this.pitBoard.root.visible = false;
    if (this.builtTrack) this.builtTrack.group.visible = isTrackView;
    for (const r of this.racers) r.model.root.visible = isTrackView;
    if (nextScreen !== 'title') {
      for (const d of this.gridIntroDrivers) d.root.visible = false;
    }

    if (isGarage) {
      this.garageDoorsOpen = true;
      this.applyAtmosphere('night');
      this.scene.background = new THREE.Color(0x06080d);
      this.sunLight.intensity = 1.95;
      this.hemiLight.intensity = 0.42;
      this.rimLight.intensity = 1.15;
      this.updateEnvironment('garage');
      this.audio.setRainLevel(0);
      this.audio.updateEngine(0, MAX_RPM, 0, 0, false);
      this.audio.updateSpatialTraffic([], false);
      this.audio.updateCrowdAmbience(0);
      this.audio.updateCinematicTrailer(0, 0, 1, false);
    } else if (isDrivers) {
      this.applyAtmosphere('night');
      this.scene.background = new THREE.Color(0x080a0f);
      this.sunLight.intensity = 1.75;
      this.hemiLight.intensity = 0.55;
      this.updateEnvironment('garage');
      this.audio.setRainLevel(0);
      this.audio.updateEngine(0, MAX_RPM, 0, 0, false);
      this.audio.updateSpatialTraffic([], false);
      this.audio.updateCrowdAmbience(0);
      this.audio.updateCinematicTrailer(0, 0, 1, false);
    } else if (isPodium) {
      this.applyAtmosphere('night');
      this.sunLight.intensity = 1.85;
      this.hemiLight.intensity = 0.68;
      this.updateEnvironment('garage');
      this.audio.setRainLevel(0);
      this.audio.updateEngine(0, MAX_RPM, 0, 0, false);
      this.audio.updateSpatialTraffic([], false);
      this.audio.updateCrowdAmbience(0.14);
      this.audio.updateCinematicTrailer(0, 0, 1, false);
    } else {
      this.rimLight.intensity = 0.72;
      this.applyAtmosphere(this.liveWeather);
      this.updateEnvironment(this.liveWeather);
      if (nextScreen === 'playing') {
        this.audio.updateCinematicTrailer(0, 0, 1, false);
      } else if (nextScreen === 'title' && this.trackRubberLevel < 0.42) {
        this.trackRubberLevel = 0.42;
        this.updateTrackRubberTexture(true);
      }
    }

    if (nextScreen !== 'playing' && nextScreen !== 'title') {
      this.audio.updateEngine(0, MAX_RPM, 0, 0, false);
      this.audio.updateSpatialTraffic([], false);
      if (this.speedPass) {
        this.speedPass.uniforms['uIntensity'].value = 0;
        this.speedPass.uniforms['uHeatDistort'].value = 0;
        this.speedPass.uniforms['uWetness'].value = 0;
        this.speedPass.uniforms['uVolumetric'].value = 0;
      }
    }
  }

  public configureSession(params: {
    track?: CircuitTrack;
    team?: FormulaTeam;
    driver?: DriverProfile;
    customPrimaryHex?: string;
    customNumber?: string;
    wheelFinish?: WheelFinish;
    compound?: TyreCompound;
    upgrades?: CarUpgrades;
    gameMode?: GameMode;
    activeRivalId?: string | null;
    settings?: Partial<GameSettings>;
  }) {
    let needsTrackRebuild = false;
    if (params.track && params.track.id !== this.currentTrack.id) {
      this.currentTrack = params.track;
      needsTrackRebuild = true;
    }
    if (params.settings) {
      const weatherChanged = params.settings.weather && params.settings.weather !== this.settings.weather;
      const dynamicChanged =
        params.settings.dynamicWeather !== undefined &&
        params.settings.dynamicWeather !== this.settings.dynamicWeather;
      if (weatherChanged) {
        needsTrackRebuild = true;
      }
      this.settings = { ...this.settings, ...params.settings };
      if (params.settings.tractionControlMode !== undefined) {
        this.settings.tcAssist = params.settings.tractionControlMode !== 'off';
      } else if (params.settings.tcAssist !== undefined) {
        this.settings.tractionControlMode = params.settings.tcAssist ? 'full' : 'off';
      }
      if (params.settings.difficulty && params.settings.aiDifficultyRating === undefined) {
        this.settings.aiDifficultyRating =
          params.settings.difficulty === 'legend' ? 102 : params.settings.difficulty === 'pro' ? 85 : 55;
      } else if (params.settings.aiDifficultyRating !== undefined) {
        const r = params.settings.aiDifficultyRating;
        this.settings.difficulty = r >= 95 ? 'legend' : r >= 70 ? 'pro' : 'rookie';
      }
      this.audio.setMuted(this.settings.muted);
      this.applyGraphicsSettings();
      this.builtTrack?.setRacingLineMode(this.settings.racingLine ?? 'corners');
      const aiDiffMult = this.getAiDifficultyMultiplier();
      for (let i = 0; i < this.racers.length; i++) {
        const r = this.racers[i];
        if (!r.isPlayer) {
          r.aiBasePace = aiDiffMult * (0.93 + (i % 3) * 0.03);
        }
      }
      if ((dynamicChanged || params.settings.totalLaps !== undefined) && this.screen === 'title') {
        this.buildWeatherSchedule();
      }
    }
    if (params.team) this.currentTeam = params.team;
    if (params.driver) {
      this.currentDriver = params.driver;
      this.showroomDriver.applyStyle(
        params.driver.suitPrimary,
        params.driver.suitSecondary,
        params.driver.helmetColor,
        params.driver.visorColor,
        params.driver.skinTone
      );
    }
    if (params.customPrimaryHex !== undefined) this.customPrimaryHex = params.customPrimaryHex;
    if (params.customNumber !== undefined) this.customNumber = params.customNumber;
    if (params.wheelFinish) this.currentWheelFinish = params.wheelFinish;
    if (params.compound) this.currentCompound = params.compound;
    if (params.upgrades) this.upgrades = { ...params.upgrades };
    if (params.gameMode) this.gameMode = params.gameMode;
    if (params.activeRivalId !== undefined) this.activeRivalId = params.activeRivalId;

    const activePrimary = this.customPrimaryHex || this.currentTeam.primaryColor;
    const activeNumber = this.customNumber || this.currentDriver.number || this.currentTeam.number;
    const activeHelmet = this.currentDriver.helmetColor || this.currentTeam.helmetColor;

    this.showroomCar.applyLivery(
      activePrimary,
      this.currentTeam.secondaryColor,
      this.currentTeam.accentColor,
      activeHelmet,
      this.currentWheelFinish,
      this.currentCompound,
      activeNumber,
      this.currentDriver.skinTone
    );

    const player = this.racers.find((r) => r.isPlayer);
    if (player) {
      player.driverId = this.currentDriver.id;
      player.team = this.currentTeam;
      player.name = this.currentDriver.name;
      player.tyreCompound = this.currentCompound;
      player.wheelFinish = this.currentWheelFinish;
      player.model.applyLivery(
        activePrimary,
        this.currentTeam.secondaryColor,
        this.currentTeam.accentColor,
        activeHelmet,
        this.currentWheelFinish,
        this.currentCompound,
        activeNumber,
        this.currentDriver.skinTone
      );
    }
    for (const r of this.racers) {
      r.model.setRival(!r.isPlayer && r.driverId === this.activeRivalId);
    }

    if (needsTrackRebuild) {
      this.rebuildWorldAndGrid();
    }
  }

  public startNewRace() {
    this.audio.unlock();
    this.queuedCompound = null;
    this.pitStopTimer = 0;
    this.pitCooldownTimer = 0;
    this.rebuildWorldAndGrid();
    this.setScreen('playing');
    this.completedRaceLaps = 0;
    this.trackRubberLevel = 0;
    this.updateTrackRubberTexture(true);
    this.raceElapsedMs = 0;
    this.countdownTimer = 0;
    this.lastCountdownStage = 0;
    this.countdownState = 'lights_1';
    this.bannerMessage = this.isDynamicWeatherEnabled()
      ? 'DYNAMIC WEATHER ACTIVE — WATCH RADAR & TYRE STRATEGY'
      : 'FORMATION READY — HOLD THROTTLE FOR LAUNCH';
    this.bannerTimer = 3.2;
    this.pitBoardTimer = 0;
    this.finalLapBoardShown = false;
    this.pitBoard.root.visible = false;
    this.emitHud();
  }

  private isDynamicWeatherEnabled(): boolean {
    return this.settings.dynamicWeather || this.settings.totalLaps >= 5;
  }

  private buildWeatherSchedule() {
    if (!this.isDynamicWeatherEnabled()) {
      this.liveWeather = this.settings.weather;
      this.nextWeather = null;
      this.weatherSchedule = [{ atProgress: 0, mode: this.settings.weather }];
      this.weatherPhaseIndex = 0;
      this.weatherForecastAlerted = false;
      this.trackWetness =
        this.settings.weather === 'heavy_rain' ? 1.0 : this.settings.weather === 'rain' ? 0.72 : 0;
      this.builtTrack?.setSurfaceWetness(this.trackWetness);
      return;
    }

    const startMode: WeatherMode = this.settings.weather === 'night' ? 'day' : this.settings.weather;
    if (startMode === 'heavy_rain' || startMode === 'rain') {
      this.weatherSchedule = [
        { atProgress: 0, mode: startMode },
        { atProgress: 0.34, mode: 'cloudy' },
        { atProgress: 0.62, mode: 'day' },
        { atProgress: 0.84, mode: 'rain' },
      ];
    } else if (startMode === 'cloudy') {
      this.weatherSchedule = [
        { atProgress: 0, mode: 'cloudy' },
        { atProgress: 0.24, mode: 'rain' },
        { atProgress: 0.56, mode: 'heavy_rain' },
        { atProgress: 0.78, mode: 'cloudy' },
        { atProgress: 0.90, mode: 'day' },
      ];
    } else {
      this.weatherSchedule = [
        { atProgress: 0, mode: 'day' },
        { atProgress: 0.22, mode: 'cloudy' },
        { atProgress: 0.44, mode: 'rain' },
        { atProgress: 0.74, mode: 'cloudy' },
        { atProgress: 0.87, mode: 'day' },
      ];
    }

    this.weatherPhaseIndex = 0;
    this.weatherForecastAlerted = false;
    this.liveWeather = this.weatherSchedule[0].mode;
    this.nextWeather = this.weatherSchedule[1]?.mode ?? null;
    this.trackWetness =
      this.liveWeather === 'heavy_rain' ? 0.95 : this.liveWeather === 'rain' ? 0.68 : 0;
    this.builtTrack?.setSurfaceWetness(this.trackWetness);
  }

  private isPlayerInPitWindow(player: RacerEntity): boolean {
    const t = player.lastT;
    const onPitStraight = t >= 0.85 || t <= 0.14;
    const pulledOverSlow = Math.abs(player.speed) < 22;
    return onPitStraight || pulledOverSlow;
  }

  public requestTyreSwitch(compound: TyreCompound) {
    if (this.screen !== 'playing') return;
    const player = this.racers.find((r) => r.isPlayer);
    if (!player) return;

    this.audio.unlock();
    this.audio.playPitRadioBeep();
    this.queuedCompound = compound;

    if (this.pitStopTimer > 0) {
      this.bannerMessage = `PIT CREW UPDATING ORDER — ${compound.toUpperCase()} TYRES`;
      this.bannerTimer = 2.0;
      this.emitHud();
      return;
    }

    if (this.isPlayerInPitWindow(player) && this.pitCooldownTimer <= 0 && this.countdownState === 'racing') {
      this.startPlayerPitStop(player);
    } else {
      this.bannerMessage = `BOX THIS LAP — ${compound.toUpperCase()} TYRES READY IN PIT LANE`;
      this.bannerTimer = 2.6;
    }
    this.emitHud();
  }

  private startPlayerPitStop(player: RacerEntity) {
    const target = this.queuedCompound ?? this.currentCompound;
    this.pitStopTimer = 2.0;
    this.bannerMessage = `PIT STOP — FITTING ${target.toUpperCase()} TYRES...`;
    this.bannerTimer = 2.2;
    player.drsOpen = false;
  }

  private completePlayerPitStop(player: RacerEntity) {
    const nextCompound = this.queuedCompound ?? this.currentCompound;
    this.currentCompound = nextCompound;
    player.tyreCompound = nextCompound;
    this.queuedCompound = null;
    player.tyreWearPct = 100;
    player.fuelPct = Math.min(100, player.fuelPct + 35);
    player.damagePct = Math.max(0, player.damagePct - 35);
    this.pitCooldownTimer = 6.0;

    const activePrimary = this.customPrimaryHex || this.currentTeam.primaryColor;
    const activeNumber = this.customNumber || this.currentDriver.number || this.currentTeam.number;
    const activeHelmet = this.currentDriver.helmetColor || this.currentTeam.helmetColor;
    player.model.applyLivery(
      activePrimary,
      this.currentTeam.secondaryColor,
      this.currentTeam.accentColor,
      activeHelmet,
      player.wheelFinish,
      nextCompound,
      activeNumber,
      this.currentDriver.skinTone
    );

    this.audio.playUiConfirm();
    this.bannerMessage = `PIT EXIT — ${nextCompound.toUpperCase()} TYRES FITTED!`;
    this.bannerTimer = 2.6;
    this.emitHud();
  }

  private applyGraphicsSettings() {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      return;
    }
    const q = this.settings.graphicsQuality;
    const ps5Mode = this.settings.ps5GraphicsMode ?? 'rt_pro';
    const rtQual = this.settings.rayTracingQuality ?? (q === 'ultra' ? 'ultra' : q === 'high' ? 'high' : 'off');
    const pssrOn = this.settings.pssrUpscaling !== false;
    const hdrMode = this.settings.hdrMode ?? 'hdr10';
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    // Support true 4K (3840x2160) supersampled rendering on Ultra / PS5 Quality & RT Pro modes
    const dpr4k = Math.min(3.0, Math.max(window.devicePixelRatio || 1, Math.min(3840 / w, 2160 / h)));
    const modeScale = ps5Mode === 'performance' ? 0.85 : ps5Mode === 'rt_pro' ? 1.05 : 1.0;
    const basePr =
      q === 'low'
        ? 0.75
        : q === 'medium'
          ? 1.0
          : q === 'high'
            ? Math.min(window.devicePixelRatio || 1, 1.65) * modeScale
            : dpr4k * this.adaptiveDprScale * modeScale;
    const targetPr = THREE.MathUtils.clamp(basePr, 0.75, 3.0);
    this.renderer.setPixelRatio(targetPr);
    if (this.composer) {
      this.composer.setPixelRatio(targetPr);
    }

    this.renderer.toneMappingExposure =
      hdrMode === 'hdr10' ? 1.16 : hdrMode === 'scrgb' ? 1.12 : 1.04;

    const shadowsOn = q !== 'low';
    this.renderer.shadowMap.enabled = shadowsOn;
    this.sunLight.castShadow = shadowsOn;

    if (this.bloomPass) {
      this.bloomPass.enabled = q !== 'low';
      this.updateBloomPass(0, 'race', true);
    }
    if (this.speedPass) {
      this.speedPass.enabled = q !== 'low';
      const hdrGradeBoost = hdrMode === 'hdr10' ? 0.03 : hdrMode === 'scrgb' ? 0.015 : 0;
      this.speedPass.uniforms['uGradeContrast'].value =
        (q === 'ultra' ? 0.18 : q === 'high' ? 0.14 : 0.08) + hdrGradeBoost;
      this.speedPass.uniforms['uAoStrength'].value =
        rtQual === 'ultra' ? 0.38 : rtQual === 'high' ? 0.26 : rtQual === 'medium' ? 0.14 : 0.0;
      this.speedPass.uniforms['uSharpness'].value =
        pssrOn ? (q === 'ultra' ? 0.34 : q === 'high' ? 0.22 : 0.12) : 0.0;
      (this.speedPass.uniforms['uTexelSize'].value as THREE.Vector2).set(
        1 / Math.max(1, w * targetPr),
        1 / Math.max(1, h * targetPr)
      );
      if (!this.speedPass.enabled || !this.settings.motionBlur) {
        this.speedPass.uniforms['uIntensity'].value = 0;
      }
      if (!this.speedPass.enabled) {
        this.speedPass.uniforms['uHeatDistort'].value = 0;
        this.speedPass.uniforms['uWetness'].value = 0;
        this.speedPass.uniforms['uVolumetric'].value = 0;
        this.speedPass.uniforms['uAoStrength'].value = 0;
        this.speedPass.uniforms['uSharpness'].value = 0;
      }
    }
    if (this.bokehPass && (q === 'low' || q === 'medium')) {
      this.bokehPass.enabled = false;
    }
    if (q !== 'ultra' || rtQual === 'off') {
      for (let i = 0; i < this.racers.length; i++) {
        this.racers[i].model.setBodyEnvMap(null);
      }
    }
  }

  private updateVolumetricSunUniforms() {
    if (!this.speedPass) return;
    const q = this.settings.graphicsQuality;
    if (q === 'low') {
      this.speedPass.uniforms['uVolumetric'].value = 0;
      return;
    }
    const w = this.liveWeather;
    const baseStrength = w === 'sunset' ? 0.56 : w === 'day' ? 0.24 : w === 'cloudy' ? 0.06 : 0;
    if (baseStrength <= 0.001) {
      this.speedPass.uniforms['uVolumetric'].value = 0;
      return;
    }

    _vecA.subVectors(this.sunLight.position, this.sunLight.target.position).normalize();
    this.camera.getWorldDirection(_camFwd);
    const alignment = Math.max(0, (_camFwd.dot(_vecA) + 0.25) / 1.25);

    _vecB.copy(this.camera.position).addScaledVector(_vecA, 220).project(this.camera);
    const sunU = _vecB.x * 0.5 + 0.5;
    const sunV = _vecB.y * 0.5 + 0.5;
    (this.speedPass.uniforms['uSunPos'].value as THREE.Vector2).set(sunU, sunV);

    const tint = this.speedPass.uniforms['uSunTint'].value as THREE.Vector3;
    if (w === 'sunset') tint.set(1.0, 0.70, 0.38);
    else tint.set(1.0, 0.96, 0.88);

    const qScale = q === 'ultra' ? 1.0 : q === 'high' ? 0.72 : 0.35;
    this.speedPass.uniforms['uVolumetric'].value = baseStrength * alignment * alignment * qScale;
  }

  private updateHeroReflections(force = false) {
    if (this.isSoftwareGl || !this.heroCubeCamera || !this.heroCubeTarget) return;
    const player = this.racers.find((r) => r.isPlayer);
    if (!player) return;
    const rtQual = this.settings.rayTracingQuality ?? 'ultra';
    if (this.settings.graphicsQuality === 'low' || rtQual === 'off') {
      for (let i = 0; i < this.racers.length; i++) {
        this.racers[i].model.setBodyEnvMap(null);
      }
      return;
    }
    this.cubeFrameCounter++;
    const interval = rtQual === 'ultra' ? 2 : rtQual === 'high' ? 3 : 5;
    if (!force && this.screen !== 'title' && this.cubeFrameCounter % interval !== 0) return;

    this.heroCubeCamera.position.set(player.position.x, player.position.y + 0.65, player.position.z);
    const prevVis = player.model.root.visible;
    player.model.root.visible = false;
    this.heroCubeCamera.update(this.renderer, this.scene);
    player.model.root.visible = prevVis;

    // PS5 Full-Grid Ray-Traced Reflections across all 22 Formula 1 cars
    for (let i = 0; i < this.racers.length; i++) {
      this.racers[i].model.setBodyEnvMap(this.heroCubeTarget.texture);
    }
  }

  private updateBokehPass(enabled: boolean, focusDist: number, aperture = 0.00014, maxblur = 0.0055, snap = false) {
    if (!this.bokehPass || this.isSoftwareGl) return;
    const q = this.settings.graphicsQuality;
    const allowed = enabled && (q === 'high' || q === 'ultra');
    this.bokehPass.enabled = allowed;
    if (allowed) {
      const clampedTarget = THREE.MathUtils.clamp(focusDist, 1.5, 90);
      this.smoothBokehFocus = snap ? clampedTarget : this.smoothBokehFocus + (clampedTarget - this.smoothBokehFocus) * 0.28;
      const uniforms = this.bokehPass.uniforms as Record<string, THREE.IUniform>;
      if (uniforms['focus']) uniforms['focus'].value = this.smoothBokehFocus;
      if (uniforms['aperture']) uniforms['aperture'].value = aperture;
      if (uniforms['maxblur']) uniforms['maxblur'].value = maxblur;
    }
  }

  private updateBloomPass(
    boostFactor = 0,
    context: 'race' | 'showroom' | 'podium' = 'race',
    snap = false
  ) {
    if (!this.bloomPass || this.isSoftwareGl) return;
    const q = this.settings.graphicsQuality;
    if (q === 'low') {
      this.bloomPass.enabled = false;
      return;
    }
    this.bloomPass.enabled = true;

    const hdrBoost =
      this.settings.hdrMode === 'hdr10' ? 0.08 : this.settings.hdrMode === 'scrgb' ? 0.04 : 0;

    let targetStrength = q === 'ultra' ? 0.62 : q === 'high' ? 0.5 : 0.36;
    let targetRadius = q === 'ultra' ? 0.72 : q === 'high' ? 0.64 : 0.52;
    let targetThreshold = q === 'ultra' ? 0.76 : q === 'high' ? 0.79 : 0.83;

    if (context === 'showroom') {
      targetStrength += 0.06 + hdrBoost * 0.6;
      targetRadius = 0.66;
      targetThreshold = 0.78;
    } else if (context === 'podium') {
      targetStrength += 0.14 + hdrBoost * 0.8;
      targetRadius = 0.74;
      targetThreshold = 0.74;
    } else {
      const w = this.liveWeather;
      if (w === 'night') {
        targetStrength += 0.22;
        targetRadius += 0.12;
        targetThreshold -= 0.11;
      } else if (w === 'heavy_rain') {
        targetStrength += 0.18;
        targetRadius += 0.14;
        targetThreshold -= 0.09;
      } else if (w === 'rain') {
        targetStrength += 0.13;
        targetRadius += 0.1;
        targetThreshold -= 0.07;
      } else if (w === 'sunset') {
        targetStrength += 0.11;
        targetRadius += 0.08;
        targetThreshold -= 0.05;
      } else if (w === 'cloudy') {
        targetStrength += 0.04;
        targetRadius += 0.04;
      }
      targetStrength += hdrBoost + THREE.MathUtils.clamp(boostFactor, 0, 1.2) * 0.16;
      targetRadius += THREE.MathUtils.clamp(boostFactor, 0, 1.2) * 0.06;
    }

    targetStrength = THREE.MathUtils.clamp(targetStrength, 0.2, 1.05);
    targetRadius = THREE.MathUtils.clamp(targetRadius, 0.35, 0.92);
    targetThreshold = THREE.MathUtils.clamp(targetThreshold, 0.58, 0.9);

    const alpha = snap ? 1.0 : 0.14;
    this.smoothBloomStrength += (targetStrength - this.smoothBloomStrength) * alpha;
    this.smoothBloomRadius += (targetRadius - this.smoothBloomRadius) * alpha;
    this.smoothBloomThreshold += (targetThreshold - this.smoothBloomThreshold) * alpha;

    this.bloomPass.strength = this.smoothBloomStrength;
    this.bloomPass.radius = this.smoothBloomRadius;
    this.bloomPass.threshold = this.smoothBloomThreshold;
  }

  private updateEnvironment(mode: WeatherMode | 'garage') {
    if (this.activeEnvMode === mode) return;
    this.activeEnvMode = mode;

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    let nextTex: THREE.Texture;

    if (mode === 'garage') {
      nextTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    } else {
      const envScene = new THREE.Scene();
      const isRain = mode === 'rain' || mode === 'heavy_rain';
      const isSunset = mode === 'sunset';
      const skyCol =
        mode === 'night'
          ? 0x091326
          : isSunset
            ? 0x4a2038
            : mode === 'heavy_rain'
              ? 0x263244
              : isRain
                ? 0x3b4859
                : mode === 'cloudy'
                  ? 0x94a3b8
                  : 0x7dd3fc;
      const gndCol = mode === 'night' ? 0x0b0f18 : isSunset ? 0x3f1d0b : isRain ? 0x1e293b : 0x2f4534;
      envScene.background = new THREE.Color(skyCol);
      envScene.add(
        new THREE.HemisphereLight(
          skyCol,
          gndCol,
          mode === 'night' ? 1.45 : isSunset ? 2.3 : mode === 'cloudy' ? 1.95 : 2.25
        )
      );

      const panelMat = new THREE.MeshBasicMaterial({
        color:
          mode === 'night'
            ? 0xfff3c4
            : isSunset
              ? 0xffb347
              : isRain || mode === 'cloudy'
                ? 0xe2e8f0
                : 0xfffbeb,
      });
      const panelGeo = new THREE.PlaneGeometry(18, 8);
      const topPanel = new THREE.Mesh(panelGeo, panelMat);
      topPanel.position.set(isSunset ? 16 : 8, isSunset ? 9 : 18, 6);
      topPanel.lookAt(0, 0, 0);
      envScene.add(topPanel);

      const rimMat = new THREE.MeshBasicMaterial({
        color: mode === 'night' ? 0x38bdf8 : isSunset ? 0x60a5fa : 0xbae6fd,
      });
      const rimPanel = new THREE.Mesh(panelGeo, rimMat);
      rimPanel.position.set(-14, 10, -10);
      rimPanel.lookAt(0, 0, 0);
      envScene.add(rimPanel);

      // Multi-bounce indirect GI bounce cards (asphalt warm bounce, horizon glow & stadium strips)
      const bounceFloorMat = new THREE.MeshBasicMaterial({
        color: isSunset ? 0x78350f : isRain ? 0x334155 : mode === 'night' ? 0x1e293b : 0x475569,
      });
      const bounceFloorGeo = new THREE.PlaneGeometry(26, 26);
      const bounceFloor = new THREE.Mesh(bounceFloorGeo, bounceFloorMat);
      bounceFloor.position.set(0, -10, 0);
      bounceFloor.rotation.x = -Math.PI / 2;
      envScene.add(bounceFloor);

      const horizonStripMat = new THREE.MeshBasicMaterial({
        color: isSunset ? 0xfb923c : mode === 'night' ? 0xfef08a : 0xfef9c3,
      });
      const horizonStripGeo = new THREE.PlaneGeometry(24, 3.2);
      const horizonStrip = new THREE.Mesh(horizonStripGeo, horizonStripMat);
      horizonStrip.position.set(22, 2.5, -14);
      horizonStrip.lookAt(0, 0, 0);
      envScene.add(horizonStrip);

      const coolFillMat = new THREE.MeshBasicMaterial({
        color: isSunset ? 0x93c5fd : mode === 'night' ? 0x0ea5e9 : 0xe0f2fe,
      });
      const coolFill = new THREE.Mesh(horizonStripGeo, coolFillMat);
      coolFill.position.set(-18, 11, 14);
      coolFill.lookAt(0, 0, 0);
      envScene.add(coolFill);

      nextTex = pmremGenerator.fromScene(envScene, 0.04).texture;
      panelGeo.dispose();
      panelMat.dispose();
      rimMat.dispose();
      bounceFloorGeo.dispose();
      bounceFloorMat.dispose();
      horizonStripGeo.dispose();
      horizonStripMat.dispose();
      coolFillMat.dispose();
    }

    pmremGenerator.dispose();
    if (this.envTexture) this.envTexture.dispose();
    this.envTexture = nextTex;
    this.scene.environment = nextTex;
  }

  private getAtmosphereTarget(weather: WeatherMode) {
    if (weather === 'sunset') {
      return {
        skyHex: 0x3b2235,
        fogHex: 0x7c3e2a,
        fogDensity: 0.0020,
        sunHex: 0xffae52,
        sunIntensity: 3.15,
        hemiSkyHex: 0x7dd3fc,
        hemiGroundHex: 0x3f1d0b,
        hemiIntensity: 0.96,
        rainOpacity: 0,
        rainSize: 0.65,
        rainAudio: 0,
      };
    }
    if (weather === 'night') {
      return {
        skyHex: 0x090d16,
        fogHex: 0x090d16,
        fogDensity: 0.0034,
        sunHex: 0xcbd5e1,
        sunIntensity: 1.2,
        hemiSkyHex: 0x38bdf8,
        hemiGroundHex: 0x0f172a,
        hemiIntensity: 0.78,
        rainOpacity: 0,
        rainSize: 0.65,
        rainAudio: 0,
      };
    }
    if (weather === 'heavy_rain') {
      return {
        skyHex: 0x263244,
        fogHex: 0x263244,
        fogDensity: 0.0078,
        sunHex: 0xcbd5e1,
        sunIntensity: 1.1,
        hemiSkyHex: 0x64748b,
        hemiGroundHex: 0x0f172a,
        hemiIntensity: 0.85,
        rainOpacity: 0.82,
        rainSize: 0.85,
        rainAudio: 0.12,
      };
    }
    if (weather === 'rain') {
      return {
        skyHex: 0x3b4859,
        fogHex: 0x3b4859,
        fogDensity: 0.0052,
        sunHex: 0xdbeafe,
        sunIntensity: 1.45,
        hemiSkyHex: 0x94a3b8,
        hemiGroundHex: 0x1e293b,
        hemiIntensity: 0.96,
        rainOpacity: 0.62,
        rainSize: 0.65,
        rainAudio: 0.06,
      };
    }
    if (weather === 'cloudy') {
      return {
        skyHex: 0x94a3b8,
        fogHex: 0x94a3b8,
        fogDensity: 0.0028,
        sunHex: 0xe2e8f0,
        sunIntensity: 1.75,
        hemiSkyHex: 0xcbd5e1,
        hemiGroundHex: 0x334155,
        hemiIntensity: 1.05,
        rainOpacity: 0,
        rainSize: 0.65,
        rainAudio: 0,
      };
    }
    return {
      skyHex: 0x8dc6f0,
      fogHex: 0x9fd0f5,
      fogDensity: 0.0018,
      sunHex: 0xfff4e0,
      sunIntensity: 2.48,
      hemiSkyHex: 0x93c5fd,
      hemiGroundHex: 0x2a3b2a,
      hemiIntensity: 0.92,
      rainOpacity: 0,
      rainSize: 0.65,
      rainAudio: 0,
    };
  }

  private applyAtmosphere(weather: WeatherMode) {
    const t = this.getAtmosphereTarget(weather);
    this.curSkyColor.setHex(t.skyHex);
    this.curFogColor.setHex(t.fogHex);
    this.curFogDensity = t.fogDensity;
    this.curSunColor.setHex(t.sunHex);
    this.curSunIntensity = t.sunIntensity;
    this.curHemiSky.setHex(t.hemiSkyHex);
    this.curHemiGround.setHex(t.hemiGroundHex);
    this.curHemiIntensity = t.hemiIntensity;
    this.curRainOpacity = t.rainOpacity;
    this.curRainSize = t.rainSize;
    this.curRainAudio = t.rainAudio;

    this.scene.background = this.curSkyColor.clone();
    this.scene.fog = new THREE.FogExp2(this.curFogColor.getHex(), this.curFogDensity);
    this.sunLight.color.copy(this.curSunColor);
    this.sunLight.intensity = this.curSunIntensity;
    this.hemiLight.color.copy(this.curHemiSky);
    this.hemiLight.groundColor.copy(this.curHemiGround);
    this.hemiLight.intensity = this.curHemiIntensity;

    const rainMat = this.rainPoints.material as THREE.PointsMaterial;
    rainMat.opacity = this.curRainOpacity;
    rainMat.size = this.curRainSize;
    this.rainPoints.visible = this.screen !== 'garage' && this.curRainOpacity > 0.04;
    this.audio.setRainLevel(this.screen === 'garage' ? 0 : this.curRainAudio);
  }

  private updateDynamicWeather(dt: number, raceLive: boolean) {
    const player = this.racers.find((r) => r.isPlayer);
    if (raceLive && this.isDynamicWeatherEnabled() && player) {
      const raceFrac = THREE.MathUtils.clamp(
        player.totalProgress / Math.max(1, this.settings.totalLaps),
        0,
        1
      );
      const nextStep = this.weatherSchedule[this.weatherPhaseIndex + 1];
      if (nextStep) {
        if (!this.weatherForecastAlerted && raceFrac >= nextStep.atProgress - 0.065) {
          this.weatherForecastAlerted = true;
          this.audio.playPitRadioBeep();
          const comingWet = nextStep.mode === 'rain' || nextStep.mode === 'heavy_rain';
          this.bannerMessage = comingWet
            ? `RADAR: ${nextStep.mode === 'heavy_rain' ? 'STORM' : 'RAIN'} APPROACHING — PRESS 4 OR B TO BOX FOR WETS`
            : nextStep.mode === 'day'
              ? 'RADAR: SKIES CLEARING SOON — PREPARE SLICK TYRES'
              : 'RADAR: HEAVY CLOUD COVER MOVING OVER CIRCUIT';
          this.bannerTimer = 3.6;
        }
        if (raceFrac >= nextStep.atProgress) {
          this.weatherPhaseIndex += 1;
          this.weatherForecastAlerted = false;
          this.liveWeather = nextStep.mode;
          this.nextWeather = this.weatherSchedule[this.weatherPhaseIndex + 1]?.mode ?? null;
          this.audio.playPitRadioBeep();
          if (this.liveWeather === 'heavy_rain') {
            this.bannerMessage = 'WEATHER SHIFT: TORRENTIAL RAIN — STANDING WATER BUILDING';
          } else if (this.liveWeather === 'rain') {
            this.bannerMessage = 'WEATHER SHIFT: RAIN FALLING — WET TYRES ADVISED (4 / B)';
          } else if (this.liveWeather === 'cloudy') {
            this.bannerMessage = 'WEATHER SHIFT: OVERCAST CONDITIONS';
          } else {
            this.bannerMessage = 'WEATHER SHIFT: SUNLIGHT RETURNING — TRACK DRYING';
          }
          this.bannerTimer = 3.4;
          this.updateEnvironment(this.liveWeather);
        }
      }

      const targetWet =
        this.liveWeather === 'heavy_rain'
          ? 1.0
          : this.liveWeather === 'rain'
            ? 0.72
            : this.liveWeather === 'cloudy'
              ? Math.min(this.trackWetness, 0.45)
              : 0;
      const rate =
        targetWet > this.trackWetness
          ? this.liveWeather === 'heavy_rain'
            ? 0.085
            : 0.052
          : this.liveWeather === 'day'
            ? 0.042
            : 0.018;
      if (this.trackWetness < targetWet) {
        this.trackWetness = Math.min(targetWet, this.trackWetness + rate * dt);
      } else if (this.trackWetness > targetWet) {
        this.trackWetness = Math.max(targetWet, this.trackWetness - rate * dt);
      }
      this.builtTrack?.setSurfaceWetness(this.trackWetness);
    }

    // Smoothly interpolate scene atmosphere toward liveWeather
    const t = this.getAtmosphereTarget(this.liveWeather);
    const blend = Math.min(1, dt * 0.65);
    this.curSkyColor.lerp(_weatherCol.setHex(t.skyHex), blend);
    this.curFogColor.lerp(_weatherCol.setHex(t.fogHex), blend);
    this.curFogDensity = THREE.MathUtils.lerp(this.curFogDensity, t.fogDensity, blend);
    this.curSunColor.lerp(_weatherCol.setHex(t.sunHex), blend);
    this.curSunIntensity = THREE.MathUtils.lerp(this.curSunIntensity, t.sunIntensity, blend);
    this.curHemiSky.lerp(_weatherCol.setHex(t.hemiSkyHex), blend);
    this.curHemiGround.lerp(_weatherCol.setHex(t.hemiGroundHex), blend);
    this.curHemiIntensity = THREE.MathUtils.lerp(this.curHemiIntensity, t.hemiIntensity, blend);
    this.curRainOpacity = THREE.MathUtils.lerp(this.curRainOpacity, t.rainOpacity, blend);
    this.curRainSize = THREE.MathUtils.lerp(this.curRainSize, t.rainSize, blend);
    this.curRainAudio = THREE.MathUtils.lerp(this.curRainAudio, t.rainAudio, blend);

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.curSkyColor);
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.curFogColor);
      this.scene.fog.density = this.curFogDensity;
    }
    this.sunLight.color.copy(this.curSunColor);
    this.sunLight.intensity = this.curSunIntensity;
    this.hemiLight.color.copy(this.curHemiSky);
    this.hemiLight.groundColor.copy(this.curHemiGround);
    this.hemiLight.intensity = this.curHemiIntensity;

    const rainMat = this.rainPoints.material as THREE.PointsMaterial;
    rainMat.opacity = this.curRainOpacity;
    rainMat.size = this.curRainSize;
    this.rainPoints.visible = this.curRainOpacity > 0.04;
    this.audio.setRainLevel(this.screen === 'playing' ? this.curRainAudio : 0);
  }

  private snapshotBaseTrackTextures() {
    const srcAsphalt = this.textures.asphaltMap.image as HTMLCanvasElement | undefined;
    if (srcAsphalt) {
      if (!this.baseAsphaltCanvas) {
        this.baseAsphaltCanvas = document.createElement('canvas');
      }
      this.baseAsphaltCanvas.width = srcAsphalt.width;
      this.baseAsphaltCanvas.height = srcAsphalt.height;
      const bCtx = this.baseAsphaltCanvas.getContext('2d');
      bCtx?.drawImage(srcAsphalt, 0, 0);
    }

    const srcRough = this.textures.asphaltRoughnessMap.image as HTMLCanvasElement | undefined;
    if (srcRough) {
      if (!this.baseRoughnessCanvas) {
        this.baseRoughnessCanvas = document.createElement('canvas');
      }
      this.baseRoughnessCanvas.width = srcRough.width;
      this.baseRoughnessCanvas.height = srcRough.height;
      const brCtx = this.baseRoughnessCanvas.getContext('2d');
      brCtx?.drawImage(srcRough, 0, 0);
    }

    this.completedRaceLaps = 0;
    this.renderedRubberLevel = -1;
    this.trackRubberLevel = this.screen === 'title' ? 0.42 : 0;
    this.updateTrackRubberTexture(true);
  }

  private recomputeTrackRubberLevel() {
    const player = this.racers.find((r) => r.isPlayer);
    const effectiveLaps = this.gameMode === 'time_trial' ? 3 : Math.max(1, this.settings.totalLaps);
    const gridCount = Math.max(1, this.racers.length);
    const lapUnits = this.completedRaceLaps / gridCount;
    const playerProg = player ? Math.max(0, player.totalProgress) : 0;
    const normalized = Math.max(lapUnits, playerProg) / effectiveLaps;
    this.trackRubberLevel = THREE.MathUtils.clamp(normalized, 0, 1);
  }

  private updateTrackRubberTexture(force = false) {
    if (!force && Math.abs(this.trackRubberLevel - this.renderedRubberLevel) < 0.035) return;
    this.renderedRubberLevel = this.trackRubberLevel;

    const level = THREE.MathUtils.clamp(this.trackRubberLevel, 0, 1);
    const asphaltCanvas = this.textures.asphaltMap.image as HTMLCanvasElement | undefined;
    if (asphaltCanvas && this.baseAsphaltCanvas) {
      const actx = asphaltCanvas.getContext('2d');
      if (actx) {
        const w = asphaltCanvas.width;
        const h = asphaltCanvas.height;
        actx.clearRect(0, 0, w, h);
        actx.drawImage(this.baseAsphaltCanvas, 0, 0);

        if (level > 0.008) {
          // Twin tyre-track darkened racing groove + central acceleration/braking corridor
          const groove = actx.createLinearGradient(0, 0, w, 0);
          groove.addColorStop(0.0, 'rgba(5, 6, 9, 0.0)');
          groove.addColorStop(0.14, 'rgba(5, 6, 9, 0.0)');
          groove.addColorStop(0.24, `rgba(4, 5, 8, ${(0.56 * level).toFixed(3)})`);
          groove.addColorStop(0.31, `rgba(3, 4, 7, ${(0.64 * level).toFixed(3)})`);
          groove.addColorStop(0.41, `rgba(8, 9, 13, ${(0.28 * level).toFixed(3)})`);
          groove.addColorStop(0.50, `rgba(9, 10, 14, ${(0.22 * level).toFixed(3)})`);
          groove.addColorStop(0.59, `rgba(8, 9, 13, ${(0.28 * level).toFixed(3)})`);
          groove.addColorStop(0.69, `rgba(3, 4, 7, ${(0.64 * level).toFixed(3)})`);
          groove.addColorStop(0.76, `rgba(4, 5, 8, ${(0.56 * level).toFixed(3)})`);
          groove.addColorStop(0.86, 'rgba(5, 6, 9, 0.0)');
          groove.addColorStop(1.0, 'rgba(5, 6, 9, 0.0)');
          actx.fillStyle = groove;
          actx.fillRect(0, 0, w, h);

          // Deterministic longitudinal rubber lay-down streaks along the racing groove
          const activeStreaks = Math.floor(level * 76);
          for (let i = 0; i < activeStreaks; i++) {
            const h1 = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
            const r1 = h1 - Math.floor(h1);
            const h2 = Math.sin(i * 78.233 + 1.732) * 24634.6345;
            const r2 = h2 - Math.floor(h2);
            const h3 = Math.sin(i * 39.425 + 9.21) * 18423.123;
            const r3 = h3 - Math.floor(h3);

            const sideCenter = i % 2 === 0 ? 0.28 : 0.72;
            const sx = (sideCenter + (r1 - 0.5) * 0.14) * w;
            const sy = r2 * (h - 90);
            const sw = 3 + r3 * 5;
            const sh = 42 + r1 * 110;
            const streakAlpha = (0.14 + 0.34 * level) * (1 - i / 95);
            actx.fillStyle = `rgba(3, 4, 6, ${streakAlpha.toFixed(3)})`;
            actx.fillRect(sx, sy, sw, sh);
          }

          // Off-line rubber marbling accumulating past 25% race rubbering
          if (level > 0.25) {
            const marbleStrength = (level - 0.25) / 0.75;
            const marbleCount = Math.floor(marbleStrength * 480);
            actx.fillStyle = `rgba(5, 6, 9, ${(0.45 * marbleStrength).toFixed(3)})`;
            for (let m = 0; m < marbleCount; m++) {
              const mh = Math.sin(m * 91.731 + 2.31) * 31542.81;
              const mr1 = mh - Math.floor(mh);
              const mh2 = Math.sin(m * 17.53 + 6.18) * 19412.44;
              const mr2 = mh2 - Math.floor(mh2);
              const mx = (m % 2 === 0 ? 0.055 + mr1 * 0.08 : 0.865 + mr1 * 0.08) * w;
              const my = mr2 * h;
              actx.fillRect(mx, my, 3, 4);
            }
          }
        }

        this.textures.asphaltMap.needsUpdate = true;
      }
    }

    // Polish the racing line in the roughness map so rubbered-in grooves catch subtle sheen
    const roughCanvas = this.textures.asphaltRoughnessMap.image as HTMLCanvasElement | undefined;
    if (roughCanvas && this.baseRoughnessCanvas) {
      const rctx = roughCanvas.getContext('2d');
      if (rctx) {
        const rw = roughCanvas.width;
        const rh = roughCanvas.height;
        rctx.clearRect(0, 0, rw, rh);
        rctx.drawImage(this.baseRoughnessCanvas, 0, 0);

        if (level > 0.015) {
          const polish = rctx.createLinearGradient(0, 0, rw, 0);
          polish.addColorStop(0.0, 'rgba(20, 20, 20, 0.0)');
          polish.addColorStop(0.16, 'rgba(20, 20, 20, 0.0)');
          polish.addColorStop(0.28, `rgba(18, 18, 18, ${(0.46 * level).toFixed(3)})`);
          polish.addColorStop(0.50, `rgba(24, 24, 24, ${(0.22 * level).toFixed(3)})`);
          polish.addColorStop(0.72, `rgba(18, 18, 18, ${(0.46 * level).toFixed(3)})`);
          polish.addColorStop(0.84, 'rgba(20, 20, 20, 0.0)');
          polish.addColorStop(1.0, 'rgba(20, 20, 20, 0.0)');
          rctx.fillStyle = polish;
          rctx.fillRect(0, 0, rw, rh);
        }

        this.textures.asphaltRoughnessMap.needsUpdate = true;
      }
    }
  }

  private rebuildWorldAndGrid() {
    if (this.builtTrack) {
      this.scene.remove(this.builtTrack.group);
      this.builtTrack.dispose();
    }
    for (const r of this.racers) {
      this.scene.remove(r.model.root);
    }
    this.racers = [];
    for (const gd of this.gridIntroDrivers) {
      this.scene.remove(gd.root);
      gd.dispose();
    }
    this.gridIntroDrivers = [];

    this.textures.dispose();
    this.textures = createProceduralTextures(
      this.renderer.capabilities.getMaxAnisotropy(),
      this.currentTrack.kerbColorA,
      this.currentTrack.kerbColorB,
      this.settings.weather
    );
    this.snapshotBaseTrackTextures();

    const smokeMat = this.smokePoints.material as THREE.PointsMaterial;
    smokeMat.map = this.textures.smokeSpriteMap;
    smokeMat.needsUpdate = true;

    const sparkMat = this.sparkPoints.material as THREE.PointsMaterial;
    sparkMat.map = this.textures.sparkSpriteMap;
    sparkMat.needsUpdate = true;

    const rainMat = this.rainPoints.material as THREE.PointsMaterial;
    rainMat.map = this.textures.rainSpriteMap;
    rainMat.needsUpdate = true;

    const oilMat = this.oilSpillMesh.material as THREE.MeshPhysicalMaterial;
    oilMat.map = this.textures.oilSpillMap;
    oilMat.needsUpdate = true;

    const debrisMat = this.debrisMesh.material as THREE.MeshStandardMaterial;
    debrisMat.map = this.textures.carbonMap;
    debrisMat.needsUpdate = true;

    this.builtTrack = buildCircuitTrack(this.currentTrack, this.textures, this.settings.weather);
    this.builtTrack.setRacingLineMode(this.settings.racingLine ?? 'corners');
    this.scene.add(this.builtTrack.group);
    this.buildWeatherSchedule();
    this.applyAtmosphere(this.liveWeather);
    this.updateEnvironment(this.screen === 'garage' ? 'garage' : this.liveWeather);

    const availableAiDrivers = FORMULA_DRIVERS.filter((d) => d.id !== this.currentDriver.id);
    const numAi = this.gameMode === 'time_trial' ? 0 : 21;
    const totalGrid = numAi + 1;

    for (let slot = 0; slot < totalGrid; slot++) {
      const isPlayer = slot === totalGrid - 1;
      const aiDriver =
        availableAiDrivers[slot % availableAiDrivers.length] ??
        FORMULA_DRIVERS[slot % FORMULA_DRIVERS.length];
      const activeDriver = isPlayer ? this.currentDriver : aiDriver;
      const team = isPlayer
        ? this.currentTeam
        : (FORMULA_TEAMS.find((t) => t.id === aiDriver.teamId) ?? FORMULA_TEAMS[slot % FORMULA_TEAMS.length]);

      const primary = isPlayer && this.customPrimaryHex ? this.customPrimaryHex : team.primaryColor;
      const wheel = isPlayer ? this.currentWheelFinish : WHEEL_FINISHES[slot % WHEEL_FINISHES.length];
      const isRain = this.settings.weather === 'rain' || this.settings.weather === 'heavy_rain';
      const compound: TyreCompound =
        isRain ? 'wet' : isPlayer ? this.currentCompound : (['soft', 'medium', 'hard'][slot % 3] as TyreCompound);

      const activeNumber = this.customNumber || this.currentDriver.number || this.currentTeam.number;
      const activeHelmet = activeDriver.helmetColor;
      const activeSkin = activeDriver.skinTone;
      const model = buildFormulaCar(
        this.textures.carbonMap,
        this.textures.carbonNormalMap,
        this.textures.paintFlakeNormalMap,
        this.textures.tyreTreadNormalMap,
        this.textures.brakeDiscMap,
        this.textures.contactShadowMap,
        primary,
        team.secondaryColor,
        team.accentColor,
        activeHelmet,
        wheel,
        compound,
        isPlayer ? activeNumber : aiDriver.number,
        activeSkin,
        this.textures.bodyRoughnessMap,
        this.textures.carAoMap
      );
      model.setRival(!isPlayer && aiDriver.id === this.activeRivalId);

      const row = Math.floor(slot / 2);
      const side = slot % 2 === 0 ? -3.1 : 3.1;
      const startT = this.screen === 'title' ? ((0.06 + (totalGrid - 1 - slot) * 0.0085) % 1) : 1 - (0.01 + row * 0.0085);
      const frame = this.builtTrack.getFrameAtT(startT);
      const pos = frame.point.clone().addScaledVector(frame.right, side);

      const yaw = Math.atan2(-frame.tangent.x, -frame.tangent.z);
      model.root.position.copy(pos);
      model.root.rotation.y = yaw;
      this.scene.add(model.root);

      // Standing 3D Driver Character beside their 2026 car for Clip 1 Arrival Sequence
      const standingDriver = buildDriverCharacter(
        this.textures.carbonMap,
        activeDriver.suitPrimary,
        activeDriver.suitSecondary,
        activeDriver.helmetColor,
        activeDriver.visorColor,
        activeDriver.skinTone
      );
      standingDriver.root.position.set(
        pos.x + frame.right.x * (side < 0 ? 1.45 : -1.45),
        pos.y,
        pos.z + frame.right.z * (side < 0 ? 1.45 : -1.45)
      );
      standingDriver.root.rotation.y = yaw + Math.PI;
      standingDriver.root.visible = false;
      this.scene.add(standingDriver.root);
      this.gridIntroDrivers.push(standingDriver);

      const diffMult = this.getAiDifficultyMultiplier();

      this.racers.push({
        id: isPlayer ? 'player' : `ai_${slot}`,
        driverId: activeDriver.id,
        name: activeDriver.name,
        team,
        isPlayer,
        model,
        position: pos,
        yaw,
        speed: this.screen === 'title' ? 68 : 0,
        lateralVel: 0,
        steerAngle: 0,
        rpm: this.screen === 'title' ? 11850 : 3800,
        gear: this.screen === 'title' ? 7 : 1,
        drsOpen: false,
        ersCharge: 100,
        fuelPct: 100,
        tyreWearPct: 100,
        damagePct: 0,
        tyreCompound: compound,
        wheelFinish: wheel,
        shiftFlash: 0,
        closestIdx: Math.floor(startT * this.builtTrack.samples.length) % this.builtTrack.samples.length,
        lastT: startT,
        lap: 1,
        totalProgress: this.screen === 'title' ? startT : startT - 1,
        lapStartTimeMs: 0,
        lastLapMs: this.screen === 'title' ? 81420 : null,
        bestLapMs: this.screen === 'title' ? 80945 : null,
        finished: false,
        finishTimeMs: null,
        aiTargetLane: side * 0.85,
        aiBasePace: diffMult * (0.93 + (slot % 3) * 0.03),
        aiLaneTimer: 1 + Math.random() * 2,
        incidentTimer: 0,
        incidentCooldown: 10 + slot * 3.5,
        spinRate: 0,
      });
    }

    this.smokeLife.fill(0);
    this.smokePositions.fill(-9999);
    this.smokeGeo.attributes.position.needsUpdate = true;

    this.sparkLife.fill(0);
    this.sparkPositions.fill(-9999);
    this.sparkGeo.attributes.position.needsUpdate = true;

    _skidDummy.position.set(0, -50, 0);
    _skidDummy.updateMatrix();
    for (let i = 0; i < this.skidPoolSize; i++) {
      this.skidMesh.setMatrixAt(i, _skidDummy.matrix);
    }
    this.skidMesh.instanceMatrix.needsUpdate = true;

    const isTrackView = this.screen === 'title' || this.screen === 'playing' || this.screen === 'paused';
    this.builtTrack.group.visible = isTrackView;
    this.skidMesh.visible = isTrackView;
    this.oilSpillMesh.visible = isTrackView;
    this.debrisMesh.visible = isTrackView;
    this.sparkPoints.visible = isTrackView;
    this.pitBoardTimer = 0;
    this.finalLapBoardShown = false;
    this.pitBoard.root.visible = false;
    this.titleAngle = 8.05;
    this.lastTitleShotId = -1;
    this.shakeIntensity = 0;
    this.tvStationIdx = 28;
    this.seedInitialTrackHazards();
    for (const r of this.racers) r.model.root.visible = isTrackView;
    this.emitHud();
  }

  private getAiDifficultyMultiplier(): number {
    if (typeof this.settings.aiDifficultyRating === 'number') {
      // Official F1 0-110 AI difficulty scale mapped smoothly to 0.78..1.06 pace
      return THREE.MathUtils.lerp(0.78, 1.06, THREE.MathUtils.clamp(this.settings.aiDifficultyRating / 110, 0, 1));
    }
    return this.settings.difficulty === 'legend' ? 1.03 : this.settings.difficulty === 'pro' ? 0.95 : 0.85;
  }

  private getSectorFromT(t: number): 1 | 2 | 3 {
    const norm = ((t % 1) + 1) % 1;
    return norm < 0.333 ? 1 : norm < 0.666 ? 2 : 3;
  }

  private seedInitialTrackHazards() {
    this.surfaceHazards = [];
    this.playerSurfaceGripPct = 100;
    this.playerActiveHazard = null;
    if (!this.builtTrack || this.gameMode === 'time_trial') {
      this.syncHazardInstancedMeshes();
      return;
    }

    const samples = this.builtTrack.samples;
    const n = samples.length;
    // Find high-curvature corner in Sector 2 for an apex oil spill and Sector 3 for corner-exit carbon debris
    let bestS2Idx = Math.floor(n * 0.46);
    let bestS2Curv = -1;
    for (let i = Math.floor(n * 0.36); i < Math.floor(n * 0.62); i++) {
      if (samples[i].curvature > bestS2Curv) {
        bestS2Curv = samples[i].curvature;
        bestS2Idx = i;
      }
    }

    let bestS3Idx = Math.floor(n * 0.76);
    let bestS3Curv = -1;
    for (let i = Math.floor(n * 0.68); i < Math.floor(n * 0.90); i++) {
      if (samples[i].curvature > bestS3Curv) {
        bestS3Curv = samples[i].curvature;
        bestS3Idx = i;
      }
    }

    this.spawnSurfaceHazard('oil', bestS2Idx, -1.35, 110);
    this.spawnSurfaceHazard('debris', bestS3Idx, 1.45, 110);
  }

  private spawnSurfaceHazard(
    type: SurfaceHazardType,
    sampleIdx: number,
    lateralOffset: number,
    ttl = 68
  ) {
    if (!this.builtTrack) return;
    const samples = this.builtTrack.samples;
    const clampedIdx = ((sampleIdx % samples.length) + samples.length) % samples.length;
    const sample = samples[clampedIdx];
    const halfW = this.builtTrack.trackWidth * 0.5;
    const clampedLat = THREE.MathUtils.clamp(lateralOffset, -(halfW - 1.4), halfW - 1.4);
    const worldPos = sample.point.clone().addScaledVector(sample.right, clampedLat);
    worldPos.y = sample.point.y + 0.036;

    // Avoid stacking duplicate hazards on top of each other
    for (const existing of this.surfaceHazards) {
      if (existing.position.distanceToSquared(worldPos) < 11 * 11) {
        existing.ttl = Math.max(existing.ttl, ttl);
        return;
      }
    }

    if (this.surfaceHazards.length >= this.maxHazardZones) {
      this.surfaceHazards.shift();
    }

    const yaw = Math.atan2(-sample.tangent.x, -sample.tangent.z);
    this.surfaceHazards.push({
      id: `hz_${++this.hazardIdCounter}`,
      type,
      sampleIdx: clampedIdx,
      t: sample.t,
      sector: this.getSectorFromT(sample.t),
      position: worldPos,
      yaw,
      lateralOffset: clampedLat,
      radius: type === 'oil' ? 3.5 : 3.8,
      gripMultiplier: type === 'oil' ? 0.46 : 0.66,
      ttl,
    });

    this.syncHazardInstancedMeshes();
  }

  private syncHazardInstancedMeshes() {
    _skidDummy.position.set(0, -50, 0);
    _skidDummy.rotation.set(0, 0, 0);
    _skidDummy.scale.set(1, 1, 1);
    _skidDummy.updateMatrix();

    for (let i = 0; i < this.maxHazardZones; i++) {
      this.oilSpillMesh.setMatrixAt(i, _skidDummy.matrix);
    }
    const totalShards = this.maxHazardZones * this.shardsPerDebrisZone;
    for (let i = 0; i < totalShards; i++) {
      this.debrisMesh.setMatrixAt(i, _skidDummy.matrix);
    }

    for (let i = 0; i < this.surfaceHazards.length; i++) {
      const hz = this.surfaceHazards[i];
      if (hz.type === 'oil') {
        _skidDummy.position.set(hz.position.x, hz.position.y, hz.position.z);
        _skidDummy.rotation.set(0, hz.yaw, 0);
        _skidDummy.scale.set(1, 1, 1);
        _skidDummy.updateMatrix();
        this.oilSpillMesh.setMatrixAt(i, _skidDummy.matrix);
      } else {
        const baseIdx = i * this.shardsPerDebrisZone;
        for (let s = 0; s < this.shardsPerDebrisZone; s++) {
          const angle = (s / this.shardsPerDebrisZone) * Math.PI * 2 + i * 0.7;
          const dist = 0.55 + ((s * 37) % 10) * 0.22;
          _skidDummy.position.set(
            hz.position.x + Math.cos(angle) * dist,
            hz.position.y + 0.01,
            hz.position.z + Math.sin(angle) * dist
          );
          _skidDummy.rotation.set(0.08 * (s % 2), hz.yaw + s * 1.1, 0.05);
          const sc = 0.75 + (s % 3) * 0.28;
          _skidDummy.scale.set(sc, 1, sc);
          _skidDummy.updateMatrix();
          this.debrisMesh.setMatrixAt(baseIdx + s, _skidDummy.matrix);
        }
      }
    }

    this.oilSpillMesh.instanceMatrix.needsUpdate = true;
    this.debrisMesh.instanceMatrix.needsUpdate = true;
  }

  private updateSurfaceHazards(dt: number) {
    if (this.surfaceHazards.length === 0) return;
    let removed = false;
    for (let i = this.surfaceHazards.length - 1; i >= 0; i--) {
      this.surfaceHazards[i].ttl -= dt;
      if (this.surfaceHazards[i].ttl <= 0) {
        this.surfaceHazards.splice(i, 1);
        removed = true;
      }
    }
    if (removed) {
      this.syncHazardInstancedMeshes();
    }
  }

  private evaluateSurfaceHazardAt(pos: THREE.Vector3): {
    gripMultiplier: number;
    hazardType: SurfaceHazardType | null;
  } {
    let minGrip = 1.0;
    let activeType: SurfaceHazardType | null = null;
    for (let i = 0; i < this.surfaceHazards.length; i++) {
      const hz = this.surfaceHazards[i];
      const dx = pos.x - hz.position.x;
      const dz = pos.z - hz.position.z;
      const dSq = dx * dx + dz * dz;
      if (dSq <= hz.radius * hz.radius) {
        if (hz.gripMultiplier < minGrip) {
          minGrip = hz.gripMultiplier;
          activeType = hz.type;
        }
      }
    }
    return { gripMultiplier: minGrip, hazardType: activeType };
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawMs = now - this.lastTimestamp;
      if (!this.isSoftwareGl && this.settings.targetFps === 30 && rawMs < 31) {
        this.frameId = requestAnimationFrame(tick);
        return;
      }
      const rawDt = rawMs / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      // Adaptive 4K Frame-Rate Governor: maintain butter-smooth frame pacing across varying GPUs
      if (!this.isSoftwareGl && this.settings.graphicsQuality === 'ultra' && rawMs > 4 && rawMs < 120) {
        this.smoothFrameMs = this.smoothFrameMs * 0.92 + rawMs * 0.08;
        const budgetMs = this.settings.targetFps === 30 ? 34.5 : 21.5;
        if (this.smoothFrameMs > budgetMs && this.adaptiveDprScale > 0.72) {
          this.adaptiveDprScale = Math.max(0.72, this.adaptiveDprScale - 0.08);
          this.applyGraphicsSettings();
        } else if (this.smoothFrameMs < budgetMs * 0.72 && this.adaptiveDprScale < 1.0) {
          this.adaptiveDprScale = Math.min(1.0, this.adaptiveDprScale + 0.04);
          this.applyGraphicsSettings();
        }
      }

      this.stepSimulation(dt);

      if (this.isSoftwareGl || !this.composer) {
        this.renderer.render(this.scene, this.camera);
      } else {
        this.composer.render();
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private stepSimulation(dt: number) {
    const elapsed = performance.now() * 0.001;
    if (this.screen === 'garage') {
      this.garageWorkshop.updateWorkshop(
        dt,
        elapsed,
        this.currentTeam.accentColor,
        this.garageDoorsOpen,
        this.garageLightsOn
      );
      this.showroomCar.updateVisuals(0, 0, false, this.garageLightsOn, 0, 0, this.garageLightsOn ? 1 : 0);
      this.updateGarageCamera(dt);
      return;
    }

    if (this.screen === 'drivers') {
      this.updateDriverShowroom(dt, elapsed);
      return;
    }

    if (this.screen === 'title') {
      this.shakeIntensity = 0;
      this.raceElapsedMs += dt * 1000;
      const snap = this.lastTitleShotId === -1;
      this.titleAngle += dt;
      const phaseTime = this.titleAngle % 32.0;
      const isArrivalStanding = phaseTime < 5.4;
      const simDt = isArrivalStanding ? dt * 0.12 : dt;

      for (let i = 0; i < this.racers.length; i++) {
        const racer = this.racers[i];
        this.stepAiPhysics(racer, simDt);
        this.updateLapProgress(racer);
        const standDrv = this.gridIntroDrivers[i];
        if (standDrv) {
          standDrv.root.visible = isArrivalStanding;
          if (isArrivalStanding) {
            const rRightX = Math.cos(racer.yaw);
            const rRightZ = -Math.sin(racer.yaw);
            const sideSign = i % 2 === 0 ? 1.42 : -1.42;
            standDrv.root.position.set(
              racer.position.x + rRightX * sideSign,
              racer.position.y,
              racer.position.z + rRightZ * sideSign
            );
            standDrv.root.rotation.y = racer.yaw + Math.PI * 0.88;
            standDrv.updateAnimation(elapsed + i * 0.4, i % 3 === 0 ? 'select' : 'idle', 0.75);
          }
        }
      }
      this.updateParticles(dt);
      this.updateDynamicWeather(dt, false);
      this.builtTrack?.updateTime(elapsed);

      const player = this.racers.find((r) => r.isPlayer);
      if (player) {
        const py = player.position.y;
        const fwdX = -Math.sin(player.yaw);
        const fwdZ = -Math.cos(player.yaw);
        const rightX = Math.cos(player.yaw);
        const rightZ = -Math.sin(player.yaw);
        let targetFov = 54;
        let focalDist = 6.0;
        let aperture = 0.00014;
        let maxblur = 0.0055;
        let speedBlur = 0.35;
        const shotId =
          phaseTime < 2.8
            ? 10
            : phaseTime < 5.4
              ? 11
              : phaseTime < 8.0
                ? 12
                : phaseTime < 11.2
                  ? 20
                  : phaseTime < 13.8
                    ? 21
                    : phaseTime < 16.0
                      ? 22
                      : phaseTime < 18.8
                        ? 30
                        : phaseTime < 21.4
                          ? 31
                          : phaseTime < 24.0
                            ? 32
                            : phaseTime < 27.2
                              ? 40
                              : 41;
        const forceCut = snap || shotId !== this.lastTitleShotId;
        this.lastTitleShotId = shotId;

        if (phaseTime < 8.0) {
          // CLIP 1 (0.0s - 8.0s): 2026 Championship Arrival & Real-World Drivers Beside Their Cars
          if (phaseTime < 2.8) {
            const t1a = phaseTime / 2.8;
            const along = 14.0 - t1a * 9.5;
            _targetPos.set(
              player.position.x + fwdX * along + rightX * 3.2,
              py + 1.65 - t1a * 0.45,
              player.position.z + fwdZ * along + rightZ * 3.2
            );
            _lookTarget.set(
              player.position.x + fwdX * (along - 5.5),
              py + 0.85,
              player.position.z + fwdZ * (along - 5.5)
            );
            targetFov = 42;
            focalDist = 6.2;
            aperture = 0.00016;
            speedBlur = 0.12;
          } else if (phaseTime < 5.4) {
            const t1b = (phaseTime - 2.8) / 2.6;
            const sweep = Math.sin(t1b * Math.PI * 0.85) * 0.9;
            _targetPos.set(
              player.position.x + fwdX * (3.6 - t1b * 0.8) + rightX * (-2.25 + sweep),
              py + 0.92 + t1b * 0.12,
              player.position.z + fwdZ * (3.6 - t1b * 0.8) + rightZ * (-2.25 + sweep)
            );
            _lookTarget.set(
              player.position.x - rightX * 0.75 + fwdX * 0.35,
              py + 0.95,
              player.position.z - rightZ * 0.75 + fwdZ * 0.35
            );
            targetFov = 35;
            focalDist = 3.8;
            aperture = 0.00022;
            speedBlur = 0.1;
          } else {
            const t1c = (phaseTime - 5.4) / 2.6;
            _targetPos.set(
              player.position.x + fwdX * (2.1 - t1c * 0.45) + rightX * 0.85,
              py + 0.82,
              player.position.z + fwdZ * (2.1 - t1c * 0.45) + rightZ * 0.85
            );
            _lookTarget.set(player.position.x + fwdX * 0.15, py + 0.66, player.position.z + fwdZ * 0.15);
            targetFov = 30;
            focalDist = 2.1;
            aperture = 0.00026;
            maxblur = 0.0068;
            speedBlur = 0.18;
          }
        } else if (phaseTime < 16.0) {
          // CLIP 2 (8.0s - 16.0s): EGO Engine Wet Race Chase & Steep Elevation Climb with Heavy Rear Tire Spray
          const sub2 = phaseTime - 8.0;
          if (sub2 < 3.6) {
            // Shot 2A: Signature EGO Engine rear chase tracking shot showing rear tire water spray, glowing red rain light & steep hill ahead
            const t2a = sub2 / 3.6;
            const latSweep = Math.sin(t2a * Math.PI) * 0.85;
            _targetPos.set(
              player.position.x - fwdX * 5.2 + rightX * (0.95 + latSweep),
              py + 1.18,
              player.position.z - fwdZ * 5.2 + rightZ * (0.95 + latSweep)
            );
            _lookTarget.set(player.position.x + fwdX * 8.5, py + 1.15, player.position.z + fwdZ * 8.5);
            targetFov = 54;
            focalDist = 5.2;
            aperture = 0.00012;
            speedBlur = 1.05;
          } else if (sub2 < 5.8) {
            // Shot 2B: Dynamic cornering, suspension detail, tire movement & overtaking tracking
            const t2b = (sub2 - 3.6) / 2.2;
            const orbit = Math.sin(t2b * Math.PI * 0.9) * 0.95;
            _targetPos.set(
              player.position.x - fwdX * 4.4 - rightX * (1.85 + orbit),
              py + 0.96,
              player.position.z - fwdZ * 4.4 - rightZ * (1.85 + orbit)
            );
            _lookTarget.set(player.position.x + fwdX * 5.2, py + 0.82, player.position.z + fwdZ * 5.2);
            targetFov = 48;
            focalDist = 4.5;
            aperture = 0.00015;
            speedBlur = 0.78;
          } else {
            // Shot 2C: Aerial drone & onboard T-Cam perspective over the 22-car field climbing through the pines
            const t2c = (sub2 - 5.8) / 2.2;
            _targetPos.set(
              player.position.x - fwdX * (1.4 + t2c * 4.8) + rightX * (t2c * 2.1),
              py + 1.45 + t2c * 3.4,
              player.position.z - fwdZ * (1.4 + t2c * 4.8) + rightZ * (t2c * 2.1)
            );
            _lookTarget.set(player.position.x + fwdX * 9.5, py + 0.95, player.position.z + fwdZ * 9.5);
            targetFov = 50;
            focalDist = 5.5;
            aperture = 0.00012;
            speedBlur = 0.85;
          }
        } else if (phaseTime < 24.0) {
          // CLIP 3 (16.0s - 24.0s): Motorsport Documentary — Cockpit Expressions, Steering Wheel & Pit/Wing Macro
          const sub3 = phaseTime - 16.0;
          if (sub3 < 2.8) {
            _targetPos.set(
              player.position.x - fwdX * 0.56 + rightX * 0.22,
              py + 1.02,
              player.position.z - fwdZ * 0.56 + rightZ * 0.22
            );
            _lookTarget.set(player.position.x + fwdX * 0.52, py + 0.62, player.position.z + fwdZ * 0.52);
            targetFov = 31;
            focalDist = 1.55;
            aperture = 0.00025;
            maxblur = 0.0068;
            speedBlur = 0.32;
          } else if (sub3 < 5.4) {
            _targetPos.set(
              player.position.x + fwdX * 0.95 - rightX * 1.65,
              py + 0.76,
              player.position.z + fwdZ * 0.95 - rightZ * 1.65
            );
            _lookTarget.set(player.position.x - fwdX * 0.05, py + 0.65, player.position.z - fwdZ * 0.05);
            targetFov = 29;
            focalDist = 1.85;
            aperture = 0.00028;
            maxblur = 0.007;
            speedBlur = 0.38;
          } else {
            _targetPos.set(
              player.position.x + fwdX * 2.42 - rightX * 1.48,
              py + 0.39,
              player.position.z + fwdZ * 2.42 - rightZ * 1.48
            );
            _lookTarget.set(
              player.position.x + fwdX * 1.05 + rightX * 0.1,
              py + 0.34,
              player.position.z + fwdZ * 1.05 + rightZ * 0.1
            );
            targetFov = 31;
            focalDist = 2.0;
            aperture = 0.00028;
            maxblur = 0.007;
            speedBlur = 0.45;
          }
        } else {
          // CLIP 4 (24.0s - 32.0s): Epic Grand Prix Finale — Finish-Line Sprint, Stadium Fireworks & Aerial Pullback
          const sub4 = phaseTime - 24.0;
          this.fireworkCooldown -= dt;
          if (this.fireworkCooldown <= 0) {
            this.fireworkCooldown = 0.34;
            const spreadR = (Math.random() - 0.5) * 38;
            const ahead = 14 + Math.random() * 28;
            this.spawnFireworkBurst(
              player.position.x + fwdX * ahead + rightX * spreadR,
              py + 20 + Math.random() * 22,
              player.position.z + fwdZ * ahead + rightZ * spreadR
            );
          }

          if (sub4 < 3.2) {
            const t4a = sub4 / 3.2;
            _targetPos.set(
              player.position.x - fwdX * (3.4 + t4a * 2.2) + rightX * (1.25 - t4a * 0.5),
              py + 0.74 + t4a * 0.4,
              player.position.z - fwdZ * (3.4 + t4a * 2.2) + rightZ * (1.25 - t4a * 0.5)
            );
            _lookTarget.set(player.position.x + fwdX * 5.5, py + 0.72, player.position.z + fwdZ * 5.5);
            targetFov = 48;
            focalDist = 4.2;
            aperture = 0.00014;
            speedBlur = 0.85;
          } else {
            const t4b = (sub4 - 3.2) / 4.8;
            const pullback = 7.5 + t4b * t4b * 82;
            const height = py + 2.6 + t4b * t4b * 40;
            const sweepSide = Math.sin(t4b * 1.4) * (4 + t4b * 16);
            _targetPos.set(
              player.position.x - fwdX * pullback + rightX * sweepSide,
              height,
              player.position.z - fwdZ * pullback + rightZ * sweepSide
            );
            _lookTarget.set(
              player.position.x + fwdX * (8 - t4b * 4),
              py + 1.4 + t4b * 4.5,
              player.position.z + fwdZ * (8 - t4b * 4)
            );
            targetFov = 46 + t4b * 8;
            focalDist = THREE.MathUtils.clamp(_targetPos.distanceTo(player.position), 6, 95);
            aperture = 0.00009;
            maxblur = 0.004;
            speedBlur = 0.25 * (1 - t4b);
          }
        }

        // Natural motorsport gimbal micro-sway for authentic handheld/Russian-arm cinematography
        const gimbalSwayX = Math.sin(elapsed * 2.15) * 0.018 + Math.cos(elapsed * 4.8) * 0.006;
        const gimbalSwayY = Math.cos(elapsed * 1.85) * 0.012 + Math.sin(elapsed * 5.3) * 0.005;
        _lookTarget.x += gimbalSwayX;
        _lookTarget.y += gimbalSwayY;

        if (forceCut || _targetPos.distanceToSquared(this.camera.position) > 900) {
          this.camera.position.copy(_targetPos);
        } else {
          this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _targetPos.x, 14, dt);
          this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _targetPos.y, 14, dt);
          this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _targetPos.z, 14, dt);
        }
        this.camera.lookAt(_lookTarget);
        if (forceCut || Math.abs(this.camera.fov - targetFov) > 0.08) {
          this.camera.fov = forceCut ? targetFov : THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
          this.camera.updateProjectionMatrix();
        }
        const focusX = player.position.x + fwdX * 12;
        const focusZ = player.position.z + fwdZ * 12;
        const sunY = this.liveWeather === 'sunset' ? 36 : 108;
        this.sunLight.position.set(focusX + 90, py + sunY, focusZ + 55);
        this.sunLight.target.position.set(focusX, py, focusZ);
        if (this.speedPass) {
          const allowBlur = this.settings.motionBlur && this.settings.graphicsQuality !== 'low';
          const clipIdx = phaseTime < 8.0 ? 1 : phaseTime < 16.0 ? 2 : phaseTime < 24.0 ? 3 : 4;
          this.speedPass.uniforms['uTime'].value = elapsed;
          this.speedPass.uniforms['uIntensity'].value = allowBlur ? speedBlur : 0;
          this.speedPass.uniforms['uHeatDistort'].value = clipIdx === 2 || clipIdx === 3 ? 0.55 : 0.25;
          this.speedPass.uniforms['uWetness'].value = Math.max(this.trackWetness, this.curRainOpacity * 0.9);
          this.speedPass.uniforms['uGradeContrast'].value = this.settings.graphicsQuality === 'ultra' ? 0.18 : 0.14;
          this.updateVolumetricSunUniforms();
        }
        this.updateBokehPass(true, focalDist, aperture, maxblur, forceCut);
        const hasActiveSparks = this.sparkLife[this.sparkCursor] > 0 || this.sparkLife[0] > 0;
        const attractSparkRatio = Math.min(0.35, (hasActiveSparks ? 0.15 : 0) + (phaseTime >= 24 ? 0.25 : 0));
        this.updateBloomPass(
          Math.min(1.0, (player.speed / 88) * 0.65 + (player.drsOpen ? 0.25 : 0) + attractSparkRatio),
          'race',
          forceCut
        );
        this.updateHeroReflections(forceCut);

        // Cinematic 32-Second 4-Clip Trailer Soundscape: 2026 Hybrid V6 + MGU-K Electric Deployment + Orchestral Score
        const sceneIndex: 1 | 2 | 3 | 4 | 5 =
          phaseTime < 8.0 ? 1 : phaseTime < 16.0 ? 2 : phaseTime < 24.0 ? 3 : phaseTime < 27.2 ? 4 : 5;
        const cornerLoad = Math.min(1, Math.abs(player.steerAngle) * (player.speed / 36));
        const heroThrottle = sceneIndex === 1 ? (isArrivalStanding ? 0.38 : 0.68) : player.drsOpen ? 1.0 : 0.88;
        this.audio.updateTelemetry({
          rpm: isArrivalStanding ? 5400 + Math.sin(elapsed * 4.2) * 1400 : player.rpm,
          maxRpm: MAX_RPM,
          throttle: heroThrottle,
          brake: cornerLoad > 0.45 ? 0.35 : 0,
          speedMs: isArrivalStanding ? 18 : player.speed,
          slipAmount: cornerLoad * 0.72,
          drsOpen: player.drsOpen || sceneIndex === 2,
          onKerb: false,
          offTrack: false,
          active: true,
        });
        this.updateSpatialTrafficAudio();
        this.audio.updateCinematicTrailer(dt, phaseTime, sceneIndex, true);
      }

      this.hudEmitAccum += dt;
      if (this.hudEmitAccum >= 0.065) {
        this.hudEmitAccum = 0;
        this.emitHud();
      }
      return;
    }

    if (this.screen === 'podium') {
      this.podiumElapsed += dt;
      this.podiumStage.updatePodium(dt, this.podiumElapsed);
      this.updatePodiumCamera(dt);
      return;
    }

    if (this.screen === 'paused') {
      this.audio.updateEngine(0, MAX_RPM, 0, 0, false);
      this.audio.updateSpatialTraffic([], false);
      this.audio.updateCrowdAmbience(0);
      this.updateBokehPass(false, 6.0);
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateRaceCamera(dt);
      return;
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerMessage = null;
    }

    if (this.countdownState !== 'racing') {
      this.countdownTimer += dt;
      const stage = Math.min(6, Math.floor(this.countdownTimer / 0.85) + 1);
      if (stage !== this.lastCountdownStage) {
        this.lastCountdownStage = stage;
        if (stage <= 5) {
          this.countdownState = (`lights_${stage}`) as HudTelemetry['countdownState'];
          this.audio.playStartLightBeep(false);
          if (this.builtTrack) {
            for (let i = 0; i < 5; i++) {
              this.builtTrack.startLights[i].emissiveIntensity = i < stage ? 5.2 : 0;
            }
          }
        } else {
          this.countdownState = 'go';
          this.audio.playStartLightBeep(true);
          this.bannerMessage = 'LIGHTS OUT AND AWAY WE GO!';
          this.bannerTimer = 2.0;
          if (this.builtTrack) {
            for (let i = 0; i < 5; i++) this.builtTrack.startLights[i].emissiveIntensity = 0;
          }
        }
      }
      if (this.countdownTimer > 5.3) {
        this.countdownState = 'racing';
      }
    }

    const raceLive = this.countdownState === 'go' || this.countdownState === 'racing';
    if (!raceLive) {
      this.audio.updateGridTension(this.countdownTimer, true);
      this.audio.updateCrowdAmbience(0.065);
      this.audio.updateSpatialTraffic([], false);
    } else {
      this.audio.updateGridTension(0, false);
      this.raceElapsedMs += dt * 1000;
    }
    this.updateDynamicWeather(dt, raceLive);

    if (this.pitCooldownTimer > 0) {
      this.pitCooldownTimer = Math.max(0, this.pitCooldownTimer - dt);
    }

    for (const racer of this.racers) {
      if (racer.isPlayer) {
        this.stepPlayerPhysics(racer, dt, raceLive);
      } else if (raceLive) {
        this.stepAiPhysics(racer, dt);
      }
      this.updateLapProgress(racer);
    }
    if (raceLive) {
      this.recomputeTrackRubberLevel();
      this.updateTrackRubberTexture(false);
      this.updateSurfaceHazards(dt);
    }

    const player = this.racers.find((r) => r.isPlayer);
    if (player && raceLive) {
      const onFinishStraight = player.lastT < 0.08 || player.lastT > 0.92;
      this.audio.updateCrowdAmbience(onFinishStraight ? 0.12 : 0.04);
      this.updateSpatialTrafficAudio();
    }
    if (
      player &&
      raceLive &&
      this.queuedCompound &&
      this.pitStopTimer <= 0 &&
      this.pitCooldownTimer <= 0 &&
      this.isPlayerInPitWindow(player)
    ) {
      this.startPlayerPitStop(player);
    }
    if (
      player &&
      raceLive &&
      !this.finalLapBoardShown &&
      player.lap === this.settings.totalLaps &&
      (this.settings.totalLaps > 1 || player.totalProgress > 0.03)
    ) {
      this.triggerFinalLapPitBoard(player);
    }

    if (this.pitBoardTimer > 0) {
      this.pitBoardTimer = Math.max(0, this.pitBoardTimer - dt);
      const elapsed = 5.5 - this.pitBoardTimer;
      const slideIn = Math.min(1, elapsed / 0.35);
      const slideOut = Math.min(1, this.pitBoardTimer / 0.35);
      const ext = Math.min(slideIn, slideOut);
      this.pitBoard.boardPivot.position.x = (1 - ext) * -1.4;
      if (this.pitBoardTimer <= 0) {
        this.pitBoard.root.visible = false;
      }
    }

    this.resolveCarCollisions();
    this.updateParticles(dt);
    this.updateRaceCamera(dt);
    this.builtTrack?.updateTime(performance.now() * 0.001);

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.045) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private stepPlayerPhysics(car: RacerEntity, dt: number, raceLive: boolean) {
    const throttleIn =
      this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') || this.touchState.throttle ? 1 : 0;
    const brakeIn =
      this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') || this.touchState.brake ? 1 : 0;
    const steerLeft =
      this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') || this.touchState.left ? 1 : 0;
    const steerRight =
      this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') || this.touchState.right ? 1 : 0;
    const drsRequested =
      this.heldKeys.has('Space') || this.heldKeys.has('ShiftLeft') || this.touchState.drs;

    const steerTarget = (steerLeft - steerRight) * this.settings.steeringSensitivity;

    if (!raceLive) {
      const targetRpm = 3800 + throttleIn * 8200;
      car.rpm = THREE.MathUtils.damp(car.rpm, targetRpm, 9, dt);
      car.steerAngle = THREE.MathUtils.damp(car.steerAngle, steerTarget * 0.35, 10, dt);
      car.model.updateVisuals(0, car.steerAngle, false, brakeIn > 0, 0, 0, 0);
      this.audio.updateEngine(car.rpm, MAX_RPM, throttleIn, 0, true);
      return;
    }

    const engineBonus = 1 + (this.upgrades.engineLevel - 1) * 0.055;
    const tyreBonus = 1 + (this.upgrades.tyreLevel - 1) * 0.05;
    const suspensionBonus = 1 + (this.upgrades.suspensionLevel - 1) * 0.05;
    const aeroBonus = 1 + (this.upgrades.aeroLevel - 1) * 0.06;
    const brakeBonus = 1 + (this.upgrades.brakeLevel - 1) * 0.07;

    const wet = this.trackWetness;
    const isRain = wet > 0.25 || this.liveWeather === 'rain' || this.liveWeather === 'heavy_rain';
    const dmgFactor = 1 - (car.damagePct / 100) * 0.22;

    if (this.pitStopTimer > 0) {
      this.pitStopTimer = Math.max(0, this.pitStopTimer - dt);
      car.speed = THREE.MathUtils.damp(car.speed, 0, 6.5, dt);
      car.lateralVel = THREE.MathUtils.damp(car.lateralVel, 0, 10, dt);
      car.rpm = THREE.MathUtils.damp(car.rpm, 4400, 8, dt);
      const fwdX = -Math.sin(car.yaw);
      const fwdZ = -Math.cos(car.yaw);
      car.position.x += fwdX * car.speed * dt;
      car.position.z += fwdZ * car.speed * dt;
      car.model.root.position.copy(car.position);
      car.model.updateVisuals((car.speed * dt) / 0.34, 0, false, true, 0, 0, 0);
      this.audio.updateEngine(car.rpm, MAX_RPM, 0.2, 0, true);
      if (this.pitStopTimer <= 0) {
        this.completePlayerPitStop(car);
      }
      return;
    }

    const damageScale =
      this.settings.carDamageMode === 'off' ? 0 : this.settings.carDamageMode === 'simulation' ? 1.65 : 1.0;
    const maxSpeedMs = (82 + (car.team.baseTopSpeed - 85) * 0.85) * engineBonus * dmgFactor;
    const accelForce = (34 + (car.team.baseAcceleration - 85) * 0.55) * engineBonus * (1 - (car.damagePct / 100) * 0.14);
    const brakeForce = (54 + (car.team.baseBraking - 85) * 0.7) * brakeBonus * (this.settings.absAssist ? 1.0 : 0.92);

    let offTrack = false;
    let onKerb = false;
    let trackBaseY = 0;
    let trackSlopePitch = 0;
    let effectiveBrakeIn = brakeIn;
    let effectiveSteerTarget = steerTarget;
    if (this.builtTrack) {
      const sample = this.builtTrack.findClosestSample(car.position, car.closestIdx);
      car.closestIdx = sample.index;
      trackBaseY = sample.point.y;
      trackSlopePitch = -Math.asin(THREE.MathUtils.clamp(sample.tangent.y, -0.35, 0.35));
      const halfW = this.builtTrack.trackWidth * 0.5;
      const absLat = Math.abs(sample.lateralOffset);
      onKerb = absLat > halfW - 0.35 && absLat <= halfW + 1.3;
      offTrack = absLat > halfW + 1.3;

      // PS5 F1 Braking Assist (Low / Medium / High) entering high-curvature corners
      const brakeAssistMode = this.settings.brakingAssist ?? 'low';
      if (brakeAssistMode !== 'off' && car.speed > 26) {
        const samples = this.builtTrack.samples;
        const n = samples.length;
        const aheadA = samples[(sample.index + 6) % n].curvature;
        const aheadB = samples[(sample.index + 12) % n].curvature;
        const maxCurv = Math.max(aheadA, aheadB);
        if (maxCurv > 0.085) {
          const assistMult = brakeAssistMode === 'high' ? 1.0 : brakeAssistMode === 'medium' ? 0.68 : 0.36;
          const safeCornerSpeed = Math.max(30, maxSpeedMs * (1 - Math.min(0.62, maxCurv * 1.75)));
          if (car.speed > safeCornerSpeed) {
            const autoBrake = THREE.MathUtils.clamp(((car.speed - safeCornerSpeed) / 22) * assistMult, 0, assistMult);
            effectiveBrakeIn = Math.max(effectiveBrakeIn, autoBrake);
          }
        }
      }

      // PS5 F1 Steering Assist gently guides car toward the optimal circuit line
      if (this.settings.steeringAssist) {
        const samples = this.builtTrack.samples;
        const lookS = samples[(sample.index + 6) % samples.length];
        const desiredYaw = Math.atan2(-lookS.tangent.x, -lookS.tangent.z);
        let yErr = desiredYaw - car.yaw;
        while (yErr > Math.PI) yErr -= Math.PI * 2;
        while (yErr < -Math.PI) yErr += Math.PI * 2;
        const guideSteer = THREE.MathUtils.clamp(yErr * 1.2 - sample.lateralOffset * 0.045, -0.5, 0.5);
        effectiveSteerTarget = THREE.MathUtils.lerp(effectiveSteerTarget, guideSteer, 0.32);
      }

      const wallLimit = halfW + 5.7;
      if (absLat > wallLimit) {
        const sign = Math.sign(sample.lateralOffset);
        car.position.copy(sample.point).addScaledVector(sample.right, sign * wallLimit);
        if (Math.abs(car.speed) > 10) {
          this.audio.playCollision(Math.min(1, Math.abs(car.speed) / 45));
          this.shakeIntensity = Math.max(this.shakeIntensity, Math.min(0.65, Math.abs(car.speed) / 80));
          car.damagePct = Math.min(100, car.damagePct + Math.min(18, Math.abs(car.speed) * 0.22) * damageScale);
          if (Math.abs(car.speed) > 38) this.hitstopTimer = 0.04;
        }
        car.speed *= 0.62;
        car.lateralVel = -sign * 4;
      }
    }

    const weatherGrip =
      this.currentCompound === 'wet'
        ? THREE.MathUtils.lerp(0.86, 0.91, wet)
        : THREE.MathUtils.lerp(1.0, 0.54, wet);
    const compoundGrip =
      this.currentCompound === 'soft' ? 1.05 : this.currentCompound === 'medium' ? 0.98 : this.currentCompound === 'hard' ? 0.92 : 0.95;
    const wearGrip = 0.75 + (car.tyreWearPct / 100) * 0.25;
    const hazardEval = this.evaluateSurfaceHazardAt(car.position);
    this.playerActiveHazard = hazardEval.hazardType;
    const surfaceGrip =
      (offTrack ? 0.55 : 1.0) *
      hazardEval.gripMultiplier *
      weatherGrip *
      compoundGrip *
      wearGrip *
      aeroBonus *
      tyreBonus *
      suspensionBonus *
      dmgFactor;
    this.playerSurfaceGripPct = Math.round(
      THREE.MathUtils.clamp((offTrack ? 0.55 : 1.0) * hazardEval.gripMultiplier * weatherGrip * wearGrip * 100, 25, 100)
    );

    const speedKmh = Math.abs(car.speed) * 3.6;
    const drsEligible = speedKmh > 140 && Math.abs(effectiveSteerTarget) < 0.25 && car.ersCharge > 4;
    const autoDrsErs = Boolean((this.settings.drsAssist || this.settings.ersAssist) && throttleIn > 0 && effectiveBrakeIn <= 0.05 && car.ersCharge > 22);
    car.drsOpen = (drsRequested || autoDrsErs) && drsEligible;
    if (car.drsOpen) {
      car.ersCharge = Math.max(0, car.ersCharge - dt * 18);
    } else {
      car.ersCharge = Math.min(100, car.ersCharge + (effectiveBrakeIn > 0 ? dt * 16 : dt * 3.5));
    }

    const forwardAccel = throttleIn * accelForce * (car.drsOpen ? 1.24 : 1.0) * (car.fuelPct > 0 ? 1 : 0.45);
    let longForce = 0;

    if (this.settings.transmission === 'auto') {
      if (effectiveBrakeIn > 0 && car.speed <= 1.2 && brakeIn > 0) {
        car.gear = -1;
        longForce = -effectiveBrakeIn * 22;
      } else {
        if (car.gear < 1) car.gear = 1;
        longForce = forwardAccel - effectiveBrakeIn * brakeForce;
      }
    } else {
      if (car.gear === -1) {
        longForce = throttleIn > 0 ? -throttleIn * 22 : effectiveBrakeIn * 30;
      } else if (car.gear === 0) {
        longForce = -effectiveBrakeIn * brakeForce;
      } else {
        const gearSpeedRatio = Math.abs(car.speed) / (maxSpeedMs / GEAR_RATIOS[car.gear]);
        const torqueFalloff = gearSpeedRatio > 1.15 ? 0.35 : 1.0;
        longForce = forwardAccel * torqueFalloff - effectiveBrakeIn * brakeForce;
      }
    }

    const dragCoeff = (car.drsOpen ? 0.0029 : 0.0038) + (offTrack ? 0.018 : 0.0012);
    const dragForce = car.speed * Math.abs(car.speed) * dragCoeff + car.speed * 0.14;
    car.speed += (longForce - dragForce) * dt;
    car.speed = THREE.MathUtils.clamp(car.speed, -22, maxSpeedMs * (car.drsOpen ? 1.09 : 1.0));

    const absSpeed = Math.abs(car.speed);
    if (this.settings.transmission === 'auto' && car.gear >= 1) {
      const targetGear = Math.min(8, Math.max(1, Math.floor((absSpeed / maxSpeedMs) * 7.8) + 1));
      if (targetGear !== car.gear) {
        this.audio.playGearShift(targetGear > car.gear);
        car.gear = targetGear;
        car.shiftFlash = 1.0;
      }
    }
    car.shiftFlash = Math.max(0, car.shiftFlash - dt * 5.5);

    const gearFactor = car.gear <= 0 ? 2.4 : GEAR_RATIOS[car.gear];
    const wheelRpm = (absSpeed / maxSpeedMs) * MAX_RPM * (gearFactor * 0.85);
    const targetRpm = THREE.MathUtils.clamp(3600 + wheelRpm + (car.gear === 0 ? throttleIn * 8500 : 0), 3500, MAX_RPM);
    car.rpm = THREE.MathUtils.damp(car.rpm, targetRpm, 12, dt);

    const maxSteer = THREE.MathUtils.lerp(0.55, 0.22, Math.min(1, absSpeed / 75));
    car.steerAngle = THREE.MathUtils.damp(car.steerAngle, effectiveSteerTarget * maxSteer, 11, dt);

    const turnRate = (car.speed / 3.4) * Math.sin(car.steerAngle) * Math.min(1.15, surfaceGrip);
    car.yaw += turnRate * dt;

    const fwdX = -Math.sin(car.yaw);
    const fwdZ = -Math.cos(car.yaw);
    const rightX = Math.cos(car.yaw);
    const rightZ = -Math.sin(car.yaw);

    let slipKick = 0;
    const tcMode = this.settings.tractionControlMode ?? (this.settings.tcAssist ? 'full' : 'off');
    const slickOnWet = wet > 0.35 && this.currentCompound !== 'wet';
    if (tcMode !== 'full' && throttleIn > 0 && absSpeed < 55 && (isRain || Math.abs(car.steerAngle) > 0.16)) {
      const tcScale = tcMode === 'medium' ? 0.45 : 1.0;
      slipKick += -Math.sign(car.steerAngle || 1) * (isRain ? 7.2 : 4.2) * tcScale;
    } else if (slickOnWet && throttleIn > 0 && Math.abs(car.steerAngle) > 0.12) {
      slipKick += -Math.sign(car.steerAngle) * (wet * 5.2);
    }
    if (!this.settings.absAssist && effectiveBrakeIn > 0 && absSpeed > 26) {
      slipKick += Math.sin(this.raceElapsedMs * 0.03) * 3.8;
    }

    if (hazardEval.hazardType === 'oil' && absSpeed > 18) {
      slipKick += -Math.sign(car.steerAngle || (Math.sin(this.raceElapsedMs * 0.02) >= 0 ? 1 : -1)) * 6.4;
    } else if (hazardEval.hazardType === 'debris' && absSpeed > 18) {
      slipKick += Math.sin(this.raceElapsedMs * 0.045) * 3.2;
      if (Math.random() < 0.55) this.spawnUnderfloorSparks(car);
    }

    const centrifugal = turnRate * car.speed * 0.18 + slipKick;
    car.lateralVel = THREE.MathUtils.damp(car.lateralVel + centrifugal * dt, 0, 6.5 * surfaceGrip, dt);

    car.position.x += (fwdX * car.speed + rightX * car.lateralVel) * dt;
    car.position.z += (fwdZ * car.speed + rightZ * car.lateralVel) * dt;
    if (this.builtTrack) {
      const postSample = this.builtTrack.findClosestSample(car.position, car.closestIdx);
      car.closestIdx = postSample.index;
      trackBaseY = postSample.point.y;
      trackSlopePitch = -Math.asin(THREE.MathUtils.clamp(postSample.tangent.y, -0.35, 0.35));
    }
    car.position.y = trackBaseY + (onKerb ? Math.sin(this.raceElapsedMs * 0.08) * 0.025 : 0);

    car.fuelPct = Math.max(0, car.fuelPct - (0.08 + throttleIn * 0.16) * dt);
    const lockupWear = !this.settings.absAssist && brakeIn > 0 && absSpeed > 24 ? 0.35 : 0;
    const debrisAbrasion = hazardEval.hazardType === 'debris' ? 0.95 : 0;
    const wetOnDryMult = this.currentCompound === 'wet' && wet < 0.18 ? 2.25 : 1.0;
    const wearRate =
      (Math.abs(car.lateralVel) * 0.09 + (offTrack ? 0.45 : 0.04) + lockupWear + debrisAbrasion) * wetOnDryMult * dt;
    car.tyreWearPct = Math.max(5, car.tyreWearPct - wearRate);

    const roll = THREE.MathUtils.clamp(-car.lateralVel * 0.014, -0.06, 0.06);
    const pitch = THREE.MathUtils.clamp(brakeIn * 0.035 - throttleIn * 0.02, -0.04, 0.04) + trackSlopePitch;

    const headlightsOn =
      this.liveWeather === 'sunset' ||
      this.liveWeather === 'night' ||
      this.liveWeather === 'rain' ||
      this.liveWeather === 'heavy_rain';
    const exhaustLoad = THREE.MathUtils.clamp(throttleIn * 0.72 + (car.rpm / MAX_RPM) * 0.35, 0.1, 1.0);
    const tyreLoad = THREE.MathUtils.clamp((Math.abs(car.lateralVel) / 8) * 0.7 + (speedKmh / 330) * 0.35, 0.05, 1.0);
    car.model.root.position.copy(car.position);
    car.model.root.rotation.y = car.yaw;
    car.model.updateVisuals(
      (car.speed * dt) / 0.34,
      car.steerAngle,
      car.drsOpen,
      brakeIn > 0,
      roll,
      pitch,
      car.shiftFlash,
      headlightsOn,
      exhaustLoad,
      tyreLoad
    );

    const slipAmount = Math.abs(car.lateralVel) / 6 + (offTrack && absSpeed > 8 ? 0.5 : 0);
    if ((slipAmount > 0.35 || isRain) && absSpeed > 10) {
      this.spawnRearSpray(car);
    }
    if (slipAmount > 0.4 && absSpeed > 12 && !offTrack) {
      this.stampSkidMarks(car);
    }
    if ((speedKmh > 235 || (onKerb && speedKmh > 125)) && Math.random() < 0.65) {
      this.spawnUnderfloorSparks(car);
    }

    this.audio.updateTelemetry({
      rpm: car.rpm,
      maxRpm: MAX_RPM,
      throttle: throttleIn,
      brake: brakeIn,
      speedMs: car.speed,
      slipAmount,
      drsOpen: car.drsOpen,
      onKerb,
      offTrack,
      active: true,
    });
  }

  private stampSkidMarks(car: RacerEntity) {
    const fwdX = -Math.sin(car.yaw);
    const fwdZ = -Math.cos(car.yaw);
    const rightX = Math.cos(car.yaw);
    const rightZ = -Math.sin(car.yaw);

    for (const side of [-0.92, 0.92]) {
      const idx = this.skidCursor % this.skidPoolSize;
      this.skidCursor++;
      _skidDummy.position.set(
        car.position.x - fwdX * 1.54 + rightX * side,
        car.position.y + 0.032,
        car.position.z - fwdZ * 1.54 + rightZ * side
      );
      _skidDummy.rotation.set(0, car.yaw, 0);
      _skidDummy.updateMatrix();
      this.skidMesh.setMatrixAt(idx, _skidDummy.matrix);
    }
    this.skidMesh.instanceMatrix.needsUpdate = true;
  }

  private spawnUnderfloorSparks(car: RacerEntity) {
    const fwdX = -Math.sin(car.yaw);
    const fwdZ = -Math.cos(car.yaw);
    for (let k = 0; k < 2; k++) {
      const idx = this.sparkCursor % this.sparkPoolSize;
      this.sparkCursor++;
      this.sparkPositions[idx * 3] = car.position.x - fwdX * 2.0 + (Math.random() - 0.5) * 0.5;
      this.sparkPositions[idx * 3 + 1] = car.position.y + 0.14 + Math.random() * 0.08;
      this.sparkPositions[idx * 3 + 2] = car.position.z - fwdZ * 2.0 + (Math.random() - 0.5) * 0.5;

      this.sparkVel[idx * 3] = -fwdX * (8 + Math.random() * 6) + (Math.random() - 0.5) * 3;
      this.sparkVel[idx * 3 + 1] = 1.4 + Math.random() * 2.6;
      this.sparkVel[idx * 3 + 2] = -fwdZ * (8 + Math.random() * 6) + (Math.random() - 0.5) * 3;
      this.sparkLife[idx] = 0.22 + Math.random() * 0.18;
    }
  }

  private stepAiPhysics(car: RacerEntity, dt: number) {
    if (!this.builtTrack) return;
    const samples = this.builtTrack.samples;
    const n = samples.length;

    const current = this.builtTrack.findClosestSample(car.position, car.closestIdx);
    car.closestIdx = current.index;

    car.aiLaneTimer -= dt;
    if (car.aiLaneTimer <= 0) {
      car.aiLaneTimer = 2.0 + Math.random() * 2.5;
      car.aiTargetLane = (Math.random() - 0.5) * (this.builtTrack.trackWidth * 0.55);
    }

    // AI Look-Ahead Surface Hazard Avoidance: shift racing line away from oil spills or debris ahead
    let avoidingHazardAhead = false;
    if (this.surfaceHazards.length > 0) {
      const halfW = this.builtTrack.trackWidth * 0.5;
      for (let h = 0; h < this.surfaceHazards.length; h++) {
        const hz = this.surfaceHazards[h];
        const sampleDelta = ((hz.sampleIdx - current.index) % n + n) % n;
        if (sampleDelta > 0 && sampleDelta <= 28) {
          if (Math.abs(car.aiTargetLane - hz.lateralOffset) < hz.radius + 1.5) {
            const safeSide = hz.lateralOffset >= 0 ? -1 : 1;
            car.aiTargetLane = safeSide * Math.min(halfW - 1.4, Math.max(2.4, halfW * 0.62));
            car.aiLaneTimer = 1.6;
          }
          avoidingHazardAhead = true;
          break;
        }
      }
    }

    const lookIdx = (current.index + 8) % n;
    const farIdx = (current.index + 18) % n;
    const targetSample = samples[lookIdx];
    const farSample = samples[farIdx];

    _vecA.copy(targetSample.point).addScaledVector(targetSample.right, car.aiTargetLane);
    const dx = _vecA.x - car.position.x;
    const dz = _vecA.z - car.position.z;
    const desiredYaw = Math.atan2(-dx, -dz);

    let yawDiff = desiredYaw - car.yaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

    car.steerAngle = THREE.MathUtils.clamp(yawDiff * 1.4, -0.45, 0.45);
    car.yaw += THREE.MathUtils.clamp(yawDiff, -2.8 * dt, 2.8 * dt);

    const wet = this.trackWetness;
    const isRain = wet > 0.25 || this.liveWeather === 'rain' || this.liveWeather === 'heavy_rain';
    // AI adapts tyre compound when passing pit straight during dynamic weather
    if (this.isDynamicWeatherEnabled() && current.t < 0.05) {
      const desiredCompound: TyreCompound = wet > 0.45 ? 'wet' : car.tyreCompound === 'wet' && wet < 0.16 ? 'medium' : car.tyreCompound;
      if (desiredCompound !== car.tyreCompound) {
        car.tyreCompound = desiredCompound;
        car.model.applyLivery(
          car.team.primaryColor,
          car.team.secondaryColor,
          car.team.accentColor,
          car.team.helmetColor,
          car.wheelFinish,
          desiredCompound
        );
        car.speed *= 0.72;
      }
    }

    if (car.incidentCooldown > 0) {
      car.incidentCooldown = Math.max(0, car.incidentCooldown - dt);
    }

    const aiHazardEval = this.evaluateSurfaceHazardAt(car.position);
    const cornerSeverity = Math.max(targetSample.curvature, farSample.curvature);
    const weatherPace = (1 - wet * (car.tyreCompound === 'wet' ? 0.14 : 0.3)) * (avoidingHazardAhead ? 0.93 : 1.0);
    const maxAiSpeed = 84 * car.aiBasePace * weatherPace * (aiHazardEval.gripMultiplier < 1 ? 0.82 : 1.0);
    let cornerSpeed = Math.max(24, maxAiSpeed * (1 - Math.min(0.68, cornerSeverity * 1.85)));
    if (aiHazardEval.hazardType === 'oil') {
      car.lateralVel += (car.steerAngle >= 0 ? -1 : 1) * 9.5 * dt;
    }

    // Organic AI spin/crash incident on high-curvature corners or wet asphalt during live races
    if (
      this.screen === 'playing' &&
      !car.isPlayer &&
      this.raceElapsedMs > 8500 &&
      car.incidentTimer <= 0 &&
      car.incidentCooldown <= 0 &&
      cornerSeverity > 0.22 &&
      car.speed > 34
    ) {
      const slickPenalty = wet > 0.3 && car.tyreCompound !== 'wet' ? 0.055 : 0;
      const incidentProb = (0.015 + wet * 0.04 + slickPenalty) * dt;
      if (Math.random() < incidentProb) {
        car.incidentTimer = 3.6;
        car.incidentCooldown = 28 + Math.random() * 14;
        car.spinRate = (Math.random() > 0.5 ? 1 : -1) * (3.3 + Math.random() * 1.7);
        car.lateralVel += Math.sign(car.spinRate) * 7.5;
        // Deposit oil spill or carbon debris at the incident apex
        this.spawnSurfaceHazard(
          Math.random() < 0.55 ? 'oil' : 'debris',
          current.index,
          current.lateralOffset,
          68
        );
      }
    }

    let braking = car.speed > cornerSpeed + 3;
    if (car.incidentTimer > 0) {
      car.incidentTimer = Math.max(0, car.incidentTimer - dt);
      cornerSpeed = 11.5;
      braking = true;
      car.speed = Math.max(8.5, car.speed - 36 * dt);
      if (car.incidentTimer > 1.7) {
        car.yaw += car.spinRate * dt;
        car.spinRate = THREE.MathUtils.damp(car.spinRate, 0, 2.2, dt);
        car.steerAngle = THREE.MathUtils.clamp(-Math.sign(car.spinRate) * 0.42, -0.45, 0.45);
      } else {
        car.spinRate = 0;
      }
    } else {
      if (braking) {
        car.speed = Math.max(cornerSpeed, car.speed - 42 * dt);
      } else {
        car.speed = Math.min(cornerSpeed, car.speed + 27 * dt);
      }
    }

    car.lateralVel = THREE.MathUtils.damp(car.lateralVel, 0, 4.2, dt);
    const fwdX = -Math.sin(car.yaw);
    const fwdZ = -Math.cos(car.yaw);
    const rightX = Math.cos(car.yaw);
    const rightZ = -Math.sin(car.yaw);
    car.position.x += (fwdX * car.speed + rightX * car.lateralVel) * dt;
    car.position.z += (fwdZ * car.speed + rightZ * car.lateralVel) * dt;

    const updatedSample = this.builtTrack.findClosestSample(car.position, car.closestIdx);
    car.closestIdx = updatedSample.index;
    car.position.y = updatedSample.point.y;
    const aiSlopePitch = -Math.asin(THREE.MathUtils.clamp(updatedSample.tangent.y, -0.35, 0.35));

    // Keep AI incident slides bounded cleanly within track walls
    if (car.incidentTimer > 0) {
      const wallLimit = this.builtTrack.trackWidth * 0.5 + 4.8;
      if (Math.abs(updatedSample.lateralOffset) > wallLimit) {
        const sgn = Math.sign(updatedSample.lateralOffset);
        car.position.copy(updatedSample.point).addScaledVector(updatedSample.right, sgn * wallLimit);
        car.lateralVel = -sgn * 3.5;
        car.speed *= 0.68;
      }
    }

    const nextGear = Math.min(8, Math.max(1, Math.floor((car.speed / 88) * 7.8) + 1));
    if (this.screen === 'title' && car.isPlayer && nextGear !== car.gear) {
      this.audio.playGearShift(nextGear > car.gear);
      car.shiftFlash = 1.0;
    }
    car.gear = nextGear;
    car.rpm = 4800 + ((car.speed % 11.5) / 11.5) * 7900;
    car.drsOpen = car.incidentTimer <= 0 && cornerSeverity < 0.08 && car.speed > 55 && wet < 0.4;

    const headlightsOn =
      this.liveWeather === 'sunset' ||
      this.liveWeather === 'night' ||
      this.liveWeather === 'rain' ||
      this.liveWeather === 'heavy_rain';
    const aiRoll = THREE.MathUtils.clamp(-car.steerAngle * (car.speed / 80) * 0.075, -0.06, 0.06);
    const aiPitch = (braking ? 0.028 : -0.014) + aiSlopePitch;
    const aiExhaust = braking ? 0.15 : 0.72;
    const aiTyreLoad = THREE.MathUtils.clamp(Math.abs(car.steerAngle) * 1.4 + (car.speed / 88) * 0.32, 0.08, 1.0);
    car.model.root.position.copy(car.position);
    car.model.root.rotation.y = car.yaw;
    car.model.updateVisuals(
      (car.speed * dt) / 0.34,
      car.steerAngle,
      car.drsOpen,
      braking,
      aiRoll,
      aiPitch,
      0,
      headlightsOn,
      aiExhaust,
      aiTyreLoad
    );

    if ((isRain && car.speed > 14 && (car.isPlayer || Math.random() < 0.85)) || (car.incidentTimer > 0 && Math.random() < 0.85)) {
      this.spawnRearSpray(car);
    }
    if (car.incidentTimer > 0.8 && car.speed > 9) {
      this.stampSkidMarks(car);
    }
    if ((car.speed * 3.6 > 245 && Math.random() < 0.3) || (car.incidentTimer > 1.8 && Math.random() < 0.5)) {
      this.spawnUnderfloorSparks(car);
    }
  }

  private resolveCarCollisions() {
    const minDist = 2.45;
    for (let i = 0; i < this.racers.length; i++) {
      for (let j = i + 1; j < this.racers.length; j++) {
        const a = this.racers[i];
        const b = this.racers[j];
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const distSq = dx * dx + dz * dz;
        if (distSq > 0.0001 && distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const nz = dz / dist;

          a.position.x -= nx * overlap;
          a.position.z -= nz * overlap;
          b.position.x += nx * overlap;
          b.position.z += nz * overlap;

          const relSpeed = Math.abs(a.speed - b.speed);
          a.speed *= 0.91;
          b.speed *= 0.91;

          // Flag heavy AI impacts as active track incidents and scatter carbon debris or oil on the racing line
          if (relSpeed > 8.5 && this.screen === 'playing') {
            if (!a.isPlayer && a.incidentTimer <= 0) {
              a.incidentTimer = 3.0;
              a.spinRate = (Math.random() > 0.5 ? 1 : -1) * 2.4;
              a.lateralVel -= nx * 4.5;
            }
            if (!b.isPlayer && b.incidentTimer <= 0) {
              b.incidentTimer = 3.0;
              b.spinRate = (Math.random() > 0.5 ? 1 : -1) * 2.4;
              b.lateralVel += nx * 4.5;
            }
            if (this.builtTrack) {
              const colSample = this.builtTrack.findClosestSample(a.position, a.closestIdx);
              this.spawnSurfaceHazard(
                relSpeed > 15 ? 'oil' : 'debris',
                colSample.index,
                colSample.lateralOffset,
                68
              );
            }
          }

          if (a.isPlayer || b.isPlayer) {
            if (relSpeed > 4) {
              this.audio.playCollision(Math.min(1, relSpeed / 25));
              this.shakeIntensity = Math.max(this.shakeIntensity, Math.min(0.45, relSpeed / 40));
              const playerRacer = a.isPlayer ? a : b;
              playerRacer.damagePct = Math.min(100, playerRacer.damagePct + Math.min(12, relSpeed * 0.25));
              if (relSpeed > 24) this.hitstopTimer = 0.035;
            }
          }
        }
      }
    }
  }

  private updateLapProgress(car: RacerEntity) {
    if (!this.builtTrack || car.finished) return;
    const curT = this.builtTrack.samples[car.closestIdx].t;
    const prevT = car.lastT;
    let deltaT = curT - prevT;

    if (deltaT < -0.5) {
      deltaT += 1;
      if (car.totalProgress >= 0.4) {
        const lapTime = this.raceElapsedMs - car.lapStartTimeMs;
        if (lapTime > 4000) {
          car.lastLapMs = lapTime;
          if (car.bestLapMs === null || lapTime < car.bestLapMs) {
            car.bestLapMs = lapTime;
            if (car.isPlayer && this.screen === 'playing') {
              this.bannerMessage = 'PURPLE SECTOR — NEW PERSONAL BEST!';
              this.bannerTimer = 2.6;
            }
          }
        }
        car.lapStartTimeMs = this.raceElapsedMs;
        this.completedRaceLaps += 1;
        this.recomputeTrackRubberLevel();
        this.updateTrackRubberTexture(true);
        if (this.screen === 'playing' && car.lap >= this.settings.totalLaps && this.gameMode !== 'time_trial') {
          car.finished = true;
          car.finishTimeMs = this.raceElapsedMs;
          if (car.isPlayer) {
            this.finishRace();
          }
        } else {
          car.lap = this.screen === 'title' ? ((car.lap % this.settings.totalLaps) + 1) : car.lap + 1;
          if (this.screen === 'playing' && car.isPlayer && car.lap === this.settings.totalLaps) {
            this.bannerMessage = 'FINAL LAP — PUSH TO THE FLAG!';
            this.bannerTimer = 2.8;
            this.triggerFinalLapPitBoard(car);
          }
        }
      }
    } else if (deltaT > 0.5) {
      deltaT -= 1;
    }

    car.totalProgress += deltaT;
    car.lastT = curT;
  }

  private getGapToCarAhead(player: RacerEntity): { position: number; gapAheadSeconds: number | null } {
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return (a.finishTimeMs ?? 0) - (b.finishTimeMs ?? 0);
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.totalProgress - a.totalProgress;
    });
    const playerIdx = sorted.findIndex((r) => r.isPlayer);
    const position = playerIdx >= 0 ? playerIdx + 1 : 1;
    if (playerIdx <= 0) {
      return { position, gapAheadSeconds: 0 };
    }
    const trackLen = this.builtTrack?.totalLength ?? 1000;
    const carAhead = sorted[playerIdx - 1];
    const gapAheadSeconds = Math.max(0.05, ((carAhead.totalProgress - player.totalProgress) * trackLen) / 62);
    return { position, gapAheadSeconds };
  }

  private triggerFinalLapPitBoard(player: RacerEntity) {
    if (!this.builtTrack || this.finalLapBoardShown) return;
    this.finalLapBoardShown = true;
    this.pitBoardTimer = 5.5;

    const { position, gapAheadSeconds } = this.getGapToCarAhead(player);
    this.pitBoard.updateBoard(position, this.racers.length, gapAheadSeconds, player.team.accentColor);

    const samples = this.builtTrack.samples;
    const boardIdx = (player.closestIdx + 10) % samples.length;
    const f = samples[boardIdx];
    const halfW = this.builtTrack.trackWidth * 0.5;

    this.pitBoard.root.position.copy(f.point).addScaledVector(f.right, -(halfW + 1.85));
    this.pitBoard.root.position.y = f.point.y;
    // Face back toward oncoming driver along pit wall
    this.pitBoard.root.rotation.y = Math.atan2(-f.tangent.x, -f.tangent.z) + 0.25;
    this.pitBoard.boardPivot.position.x = -1.4;
    this.pitBoard.root.visible = true;
    this.audio.playPitRadioBeep();
  }

  private finishRace() {
    this.victoryAngle = 0.45;
    this.podiumElapsed = 0;
    this.podiumCameraShot = 'auto';
    const standings = this.computeStandings();
    this.podiumStage.activatePodium(standings);
    this.setScreen('podium');
    this.audio.playVictoryFanfare();
    this.callbacks.onRaceFinished(standings);
  }

  private computeStandings(): RacerStanding[] {
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return (a.finishTimeMs ?? 0) - (b.finishTimeMs ?? 0);
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.totalProgress - a.totalProgress;
    });

    const leaderProg = sorted[0]?.totalProgress ?? 0;
    const trackLen = this.builtTrack?.totalLength ?? 1000;

    return sorted.map((r, idx) => {
      const gapSeconds = idx === 0 ? 0 : Math.max(0.1, ((leaderProg - r.totalProgress) * trackLen) / 62);
      return {
        id: r.id,
        driverId: r.driverId,
        name: r.name,
        teamName: r.team.name,
        color: r.isPlayer && this.customPrimaryHex ? this.customPrimaryHex : r.team.primaryColor,
        secondaryColor: r.team.secondaryColor,
        helmetColor: r.isPlayer ? this.currentDriver.helmetColor : r.team.helmetColor,
        position: idx + 1,
        lap: Math.min(r.lap, this.settings.totalLaps),
        totalProgress: r.totalProgress,
        lastLapMs: r.lastLapMs,
        bestLapMs: r.bestLapMs,
        raceTimeMs: this.raceElapsedMs + gapSeconds * 1000,
        pointsAwarded: CHAMPIONSHIP_POINTS[idx] ?? 0,
        gapSeconds,
        isPlayer: r.isPlayer,
        isRival: !r.isPlayer && r.driverId === this.activeRivalId,
        finished: r.finished,
      };
    });
  }

  private spawnRearSpray(car: RacerEntity) {
    const fwdX = -Math.sin(car.yaw);
    const fwdZ = -Math.cos(car.yaw);
    const rightX = Math.cos(car.yaw);
    const rightZ = -Math.sin(car.yaw);
    const isWet = this.trackWetness > 0.2 || this.liveWeather === 'rain' || this.liveWeather === 'heavy_rain';
    const plumes = car.isPlayer && isWet ? 3 : isWet ? 2 : 1;

    for (let p = 0; p < plumes; p++) {
      const idx = this.smokeCursor % this.smokePoolSize;
      this.smokeCursor++;
      // Emit directly from left rear tire (-0.92), right rear tire (+0.92), and central Venturi diffuser wake (0)
      const tireSide = p === 0 ? -0.92 : p === 1 ? 0.92 : 0;
      const rearDist = p === 2 ? 2.25 : 1.62 + Math.random() * 0.45;
      const spread = (Math.random() - 0.5) * 0.42;

      this.smokePositions[idx * 3] = car.position.x - fwdX * rearDist + rightX * (tireSide + spread);
      this.smokePositions[idx * 3 + 1] = car.position.y + 0.24 + Math.random() * 0.34;
      this.smokePositions[idx * 3 + 2] = car.position.z - fwdZ * rearDist + rightZ * (tireSide + spread);

      const backSpeed = Math.min(14, Math.abs(car.speed) * 0.16);
      this.smokeVel[idx * 3] = -fwdX * backSpeed + rightX * (tireSide * 1.15 + (Math.random() - 0.5) * 1.8);
      this.smokeVel[idx * 3 + 1] = (isWet ? 2.1 : 1.2) + Math.random() * 1.9;
      this.smokeVel[idx * 3 + 2] = -fwdZ * backSpeed + rightZ * (tireSide * 1.15 + (Math.random() - 0.5) * 1.8);
      this.smokeLife[idx] = isWet ? 0.72 + Math.random() * 0.25 : 0.62;
    }
  }

  private updateParticles(dt: number) {
    for (let i = 0; i < this.smokePoolSize; i++) {
      if (this.smokeLife[i] > 0) {
        this.smokeLife[i] -= dt;
        this.smokePositions[i * 3] += this.smokeVel[i * 3] * dt;
        this.smokePositions[i * 3 + 1] += this.smokeVel[i * 3 + 1] * dt;
        this.smokePositions[i * 3 + 2] += this.smokeVel[i * 3 + 2] * dt;
        if (this.smokeLife[i] <= 0) {
          this.smokePositions[i * 3 + 1] = -999;
        }
      }
    }
    this.smokeGeo.attributes.position.needsUpdate = true;

    for (let i = 0; i < this.sparkPoolSize; i++) {
      if (this.sparkLife[i] > 0) {
        this.sparkLife[i] -= dt;
        this.sparkVel[i * 3 + 1] -= 9.8 * dt;
        this.sparkPositions[i * 3] += this.sparkVel[i * 3] * dt;
        this.sparkPositions[i * 3 + 1] += this.sparkVel[i * 3 + 1] * dt;
        this.sparkPositions[i * 3 + 2] += this.sparkVel[i * 3 + 2] * dt;
        if (this.sparkLife[i] <= 0) {
          this.sparkPositions[i * 3 + 1] = -999;
        }
      }
    }
    this.sparkGeo.attributes.position.needsUpdate = true;

    if (this.rainPoints.visible) {
      const cx = this.camera.position.x;
      const cy = this.camera.position.y;
      const cz = this.camera.position.z;
      const fallSpeed = this.liveWeather === 'heavy_rain' ? 46 : 34;
      for (let i = 0; i < this.rainCount; i++) {
        this.rainPositions[i * 3 + 1] -= fallSpeed * dt;
        if (this.rainPositions[i * 3 + 1] < cy - 4) {
          this.rainPositions[i * 3] = cx + (Math.random() - 0.5) * 65;
          this.rainPositions[i * 3 + 1] = cy + 18 + Math.random() * 10;
          this.rainPositions[i * 3 + 2] = cz + (Math.random() - 0.5) * 65;
        }
      }
      this.rainGeo.attributes.position.needsUpdate = true;
    }

    let fireworksActive = false;
    for (let i = 0; i < this.fireworkPoolSize; i++) {
      if (this.fireworkLife[i] > 0) {
        fireworksActive = true;
        this.fireworkLife[i] -= dt;
        const drag = Math.max(0, 1 - 1.25 * dt);
        this.fireworkVel[i * 3] *= drag;
        this.fireworkVel[i * 3 + 1] = this.fireworkVel[i * 3 + 1] * drag - 7.8 * dt;
        this.fireworkVel[i * 3 + 2] *= drag;
        this.fireworkPositions[i * 3] += this.fireworkVel[i * 3] * dt;
        this.fireworkPositions[i * 3 + 1] += this.fireworkVel[i * 3 + 1] * dt;
        this.fireworkPositions[i * 3 + 2] += this.fireworkVel[i * 3 + 2] * dt;
        if (this.fireworkLife[i] <= 0) {
          this.fireworkPositions[i * 3 + 1] = -9999;
        }
      }
    }
    if (fireworksActive) {
      this.fireworkGeo.attributes.position.needsUpdate = true;
    }
  }

  public jumpToTitleScene(sceneNum: 1 | 2 | 3 | 4 | 5) {
    this.audio.unlock();
    const starts: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0.05,
      2: 8.05,
      3: 16.05,
      4: 24.05,
      5: 27.25,
    };
    this.titleAngle = starts[sceneNum];
    this.lastTitleShotId = -1;
    this.fireworkCooldown = 0;
  }

  private updateSpatialTrafficAudio() {
    this.camera.getWorldDirection(_camFwd);
    _camRight.crossVectors(_camFwd, this.camera.up).normalize();

    const maxDistSq = 145 * 145;
    let count = 0;
    const bestDistSq0 = [Infinity, Infinity, Infinity];
    const bestRacer: (RacerEntity | null)[] = [null, null, null];

    for (let k = 0; k < this.racers.length; k++) {
      const r = this.racers[k];
      if (r.isPlayer || !r.model.root.visible) continue;
      const dSq = r.position.distanceToSquared(this.camera.position);
      if (dSq > maxDistSq) continue;

      if (dSq < bestDistSq0[0]) {
        bestDistSq0[2] = bestDistSq0[1];
        bestRacer[2] = bestRacer[1];
        bestDistSq0[1] = bestDistSq0[0];
        bestRacer[1] = bestRacer[0];
        bestDistSq0[0] = dSq;
        bestRacer[0] = r;
      } else if (dSq < bestDistSq0[1]) {
        bestDistSq0[2] = bestDistSq0[1];
        bestRacer[2] = bestRacer[1];
        bestDistSq0[1] = dSq;
        bestRacer[1] = r;
      } else if (dSq < bestDistSq0[2]) {
        bestDistSq0[2] = dSq;
        bestRacer[2] = r;
      }
    }

    _spatialActiveList.length = 0;
    for (let i = 0; i < 3; i++) {
      const r = bestRacer[i];
      if (!r) continue;
      _vecA.subVectors(r.position, this.camera.position);
      const dist = Math.sqrt(bestDistSq0[i]);
      const relX = _vecA.dot(_camRight);
      const relY = _vecA.y;
      const relZ = _vecA.dot(_camFwd);
      const fwdX = -Math.sin(r.yaw);
      const fwdZ = -Math.cos(r.yaw);
      const invDist = dist > 0.001 ? 1 / dist : 0;
      const radialVel = (fwdX * r.speed * _vecA.x + fwdZ * r.speed * _vecA.z) * invDist;

      const slot = _spatialInputs[count++];
      slot.relX = relX;
      slot.relY = relY;
      slot.relZ = relZ;
      slot.radialVel = radialVel;
      slot.rpm = r.rpm;
      slot.maxRpm = MAX_RPM;
      slot.speedMs = r.speed;
      slot.throttle = r.drsOpen ? 1.0 : 0.78;
      _spatialActiveList.push(slot);
    }
    this.audio.updateSpatialTraffic(_spatialActiveList, true);
  }

  private spawnFireworkBurst(x: number, y: number, z: number) {
    this.camera.getWorldDirection(_camFwd);
    _camRight.crossVectors(_camFwd, this.camera.up).normalize();
    _vecB.set(x - this.camera.position.x, y - this.camera.position.y, z - this.camera.position.z);
    const pan = _vecB.length() > 0.1 ? THREE.MathUtils.clamp(_vecB.dot(_camRight) / _vecB.length(), -0.9, 0.9) : 0;
    this.audio.playFireworkBurst(pan);

    const palette = [
      [1.0, 0.84, 0.25],
      [1.0, 0.22, 0.28],
      [0.22, 0.82, 1.0],
      [0.98, 0.98, 1.0],
      [0.2, 0.95, 0.55],
    ];
    const col = palette[Math.floor(Math.random() * palette.length)];
    for (let k = 0; k < 56; k++) {
      const idx = this.fireworkCursor % this.fireworkPoolSize;
      this.fireworkCursor++;
      this.fireworkPositions[idx * 3] = x;
      this.fireworkPositions[idx * 3 + 1] = y;
      this.fireworkPositions[idx * 3 + 2] = z;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 9 + Math.random() * 14;
      this.fireworkVel[idx * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      this.fireworkVel[idx * 3 + 1] = Math.cos(phi) * speed + 4.5;
      this.fireworkVel[idx * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
      this.fireworkColors[idx * 3] = col[0];
      this.fireworkColors[idx * 3 + 1] = col[1];
      this.fireworkColors[idx * 3 + 2] = col[2];
      this.fireworkLife[idx] = 1.15 + Math.random() * 0.75;
    }
    this.fireworkGeo.attributes.position.needsUpdate = true;
    this.fireworkGeo.attributes.color.needsUpdate = true;
  }

  private updateRaceCamera(dt: number) {
    const player = this.racers.find((r) => r.isPlayer);
    if (!player) return;

    const fwdX = -Math.sin(player.yaw);
    const fwdZ = -Math.cos(player.yaw);
    const rightX = Math.cos(player.yaw);
    const rightZ = -Math.sin(player.yaw);
    const mode = this.settings.cameraMode;
    let instantCut = false;

    if (mode === 'chase') {
      _targetPos.set(player.position.x - fwdX * 7.2, player.position.y + 2.65, player.position.z - fwdZ * 7.2);
      _lookTarget.set(player.position.x + fwdX * 9.0, player.position.y + 0.9, player.position.z + fwdZ * 9.0);
    } else if (mode === 'tcam') {
      _targetPos.set(player.position.x - fwdX * 0.15, player.position.y + 1.38, player.position.z - fwdZ * 0.15);
      _lookTarget.set(player.position.x + fwdX * 18.0, player.position.y + 0.85, player.position.z + fwdZ * 18.0);
    } else if (mode === 'cockpit') {
      _targetPos.set(player.position.x + fwdX * 0.1, player.position.y + 0.96, player.position.z + fwdZ * 0.1);
      _lookTarget.set(player.position.x + fwdX * 22.0, player.position.y + 0.72, player.position.z + fwdZ * 22.0);
    } else if (mode === 'low_track') {
      _targetPos.set(
        player.position.x - fwdX * 4.9 + rightX * 1.35,
        player.position.y + 0.52,
        player.position.z - fwdZ * 4.9 + rightZ * 1.35
      );
      _lookTarget.set(player.position.x + fwdX * 8.5, player.position.y + 0.55, player.position.z + fwdZ * 8.5);
    } else if (mode === 'wing_tyre') {
      _targetPos.set(
        player.position.x + fwdX * 2.55 - rightX * 1.65,
        player.position.y + 0.44,
        player.position.z + fwdZ * 2.55 - rightZ * 1.65
      );
      _lookTarget.set(
        player.position.x + fwdX * 0.9 + rightX * 0.15,
        player.position.y + 0.36,
        player.position.z + fwdZ * 0.9 + rightZ * 0.15
      );
    } else if (mode === 'tv_wide' && this.builtTrack) {
      const samples = this.builtTrack.samples;
      const n = samples.length;
      const curSample = samples[this.tvStationIdx % n];
      _vecB.subVectors(player.position, curSample.point);
      const along = _vecB.dot(curSample.tangent);
      if (along > 34 || _vecB.lengthSq() > 80 * 80) {
        this.tvStationIdx = (player.closestIdx + 26) % n;
        this.tvStationSide = this.tvStationSide > 0 ? -1 : 1;
        instantCut = true;
      }
      const station = samples[this.tvStationIdx % n];
      const sideOff = (this.builtTrack.trackWidth * 0.5 + 9.5) * this.tvStationSide;
      _targetPos.copy(station.point).addScaledVector(station.right, sideOff);
      _targetPos.y = 4.6;
      _lookTarget.set(player.position.x + fwdX * 1.5, player.position.y + 0.65, player.position.z + fwdZ * 1.5);
    } else if (mode === 'side') {
      _targetPos.set(
        player.position.x + rightX * 3.1 - fwdX * 2.2,
        player.position.y + 1.05,
        player.position.z + rightZ * 3.1 - fwdZ * 2.2
      );
      _lookTarget.set(player.position.x + fwdX * 5.0, player.position.y + 0.52, player.position.z + fwdZ * 5.0);
    } else if (mode === 'rear') {
      _targetPos.set(player.position.x - fwdX * 1.45, player.position.y + 1.15, player.position.z - fwdZ * 1.45);
      _lookTarget.set(player.position.x - fwdX * 22.0, player.position.y + 0.65, player.position.z - fwdZ * 22.0);
    } else {
      _targetPos.set(player.position.x + fwdX * 2.4, player.position.y + 0.55, player.position.z + fwdZ * 2.4);
      _lookTarget.set(player.position.x + fwdX * 24.0, player.position.y + 0.45, player.position.z + fwdZ * 24.0);
    }

    if (instantCut || (mode === 'tv_wide' && _targetPos.distanceToSquared(this.camera.position) > 900)) {
      this.camera.position.copy(_targetPos);
    } else {
      const damping = mode === 'chase' || mode === 'side' ? 10 : mode === 'low_track' ? 14 : 28;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _targetPos.x, damping, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _targetPos.y, damping, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _targetPos.z, damping, dt);
    }

    const shakeScale = (this.settings.cameraShakeScale ?? 100) / 100;
    if (this.shakeIntensity > 0.002 && shakeScale > 0.01) {
      const tShake = this.raceElapsedMs * 0.001;
      const waveX = Math.sin(tShake * 54) * 0.55 + Math.cos(tShake * 83) * 0.45;
      const waveY = Math.cos(tShake * 61) * 0.55 + Math.sin(tShake * 97) * 0.45;
      const amp = Math.min(0.32, this.shakeIntensity * 0.55) * shakeScale;
      this.camera.position.x += waveX * amp;
      this.camera.position.y += waveY * amp * 0.65;
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 12, dt);
    } else if (this.shakeIntensity > 0.002) {
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 12, dt);
    }

    // PS5 F1 Look-to-Apex camera head-turn into corners
    if (this.settings.lookToApex !== false && (mode === 'cockpit' || mode === 'tcam' || mode === 'chase')) {
      const apexShift = -player.steerAngle * (mode === 'cockpit' ? 3.8 : 2.2);
      _lookTarget.x += rightX * apexShift;
      _lookTarget.z += rightZ * apexShift;
    }

    this.camera.lookAt(_lookTarget);

    const speedRatio = Math.min(1, Math.abs(player.speed) / 88);
    const camDist = this.camera.position.distanceTo(player.position);
    const fovOff = this.settings.fovOffset ?? 0;
    const targetFov =
      (mode === 'wing_tyre'
        ? 42
        : mode === 'tv_wide'
          ? THREE.MathUtils.clamp(46 - camDist * 0.38, 26, 44)
          : mode === 'low_track'
            ? 62 + speedRatio * 14 + (player.drsOpen ? 3 : 0)
            : 60 + speedRatio * 15 + (player.drsOpen ? 3 : 0)) + fovOff;

    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }

    const focusX = player.position.x + fwdX * 12;
    const focusZ = player.position.z + fwdZ * 12;
    const sunY = this.liveWeather === 'sunset' ? 36 : 105;
    this.sunLight.position.set(focusX + 85, sunY, focusZ + 55);
    this.sunLight.target.position.set(focusX, 0, focusZ);

    if (this.speedPass) {
      this.speedPass.uniforms['uTime'].value = this.raceElapsedMs * 0.001;
      const lensRain = mode === 'cockpit' ? 0.45 : mode === 'tcam' ? 0.75 : 1.0;
      this.speedPass.uniforms['uWetness'].value = Math.max(this.trackWetness, this.curRainOpacity * 0.9) * lensRain;
      const rearFacing = mode === 'chase' || mode === 'low_track';
      this.speedPass.uniforms['uHeatDistort'].value = rearFacing ? (0.18 + speedRatio * 0.52) : 0;
      this.speedPass.uniforms['uGradeContrast'].value = this.settings.graphicsQuality === 'ultra' ? 0.18 : 0.14;
      if (this.settings.motionBlur && this.settings.graphicsQuality !== 'low') {
        const modeScale = mode === 'tv_wide' ? 0.35 : mode === 'low_track' ? 1.15 : 1.0;
        const boostFactor =
          (Math.max(0, (speedRatio - 0.55) / 0.45) + (player.drsOpen ? 0.35 : 0)) * modeScale;
        this.speedPass.uniforms['uIntensity'].value = THREE.MathUtils.clamp(boostFactor, 0, 1.35);
      } else {
        this.speedPass.uniforms['uIntensity'].value = 0;
      }
      this.updateVolumetricSunUniforms();
    }

    const useCinematicDof = mode === 'low_track' || mode === 'wing_tyre' || mode === 'tv_wide';
    const dofAperture = mode === 'wing_tyre' ? 0.00022 : mode === 'tv_wide' ? 0.00009 : 0.00014;
    this.updateBokehPass(useCinematicDof, camDist, dofAperture, mode === 'tv_wide' ? 0.0042 : 0.0058);
    const raceBloomBoost =
      speedRatio * 0.45 +
      (player.drsOpen ? 0.28 : 0) +
      (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') || this.touchState.brake ? 0.25 : 0) +
      (this.countdownState !== 'go' ? 0.25 : 0);
    this.updateBloomPass(raceBloomBoost, 'race', instantCut);
    this.updateHeroReflections(instantCut);
  }

  private updateGarageCamera(dt: number) {
    if (!this.isDraggingGarage) {
      this.garageTargetAzimuth += dt * 0.14;
    }
    this.garageAzimuth = THREE.MathUtils.damp(this.garageAzimuth, this.garageTargetAzimuth, 8, dt);
    this.garagePolar = THREE.MathUtils.damp(this.garagePolar, this.garageTargetPolar, 8, dt);
    this.garageDistance = THREE.MathUtils.damp(this.garageDistance, this.garageTargetDistance, 8, dt);

    const sinP = Math.sin(this.garagePolar);
    this.camera.position.set(
      this.garageDistance * sinP * Math.sin(this.garageAzimuth),
      this.garageDistance * Math.cos(this.garagePolar) + 0.5,
      this.garageDistance * sinP * Math.cos(this.garageAzimuth)
    );
    this.camera.lookAt(0, 0.52, 0);
    if (Math.abs(this.camera.fov - 50) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 50, 8, dt);
      this.camera.updateProjectionMatrix();
    }
    this.updateBokehPass(true, this.garageDistance, 0.00012, 0.0045);
    this.updateBloomPass(0, 'showroom');
    this.sunLight.position.set(14, 24, 18);
    this.sunLight.target.position.set(0, 0, 0);
  }

  private updateDriverShowroom(dt: number, elapsedSec: number) {
    if (!this.isDraggingGarage) {
      this.driverTargetAzimuth += dt * 0.15;
    }
    this.driverAzimuth = THREE.MathUtils.damp(this.driverAzimuth, this.driverTargetAzimuth, 8, dt);
    this.showroomDriver.root.rotation.y = this.driverAzimuth;

    if (this.driverSelectAnimTimer > 0) {
      this.driverSelectAnimTimer = Math.max(0, this.driverSelectAnimTimer - dt);
      this.showroomDriver.updateAnimation(elapsedSec, 'select', 1.1 - this.driverSelectAnimTimer);
    } else {
      this.showroomDriver.updateAnimation(elapsedSec, 'idle');
    }

    this.camera.position.set(0.35, 1.32, 3.1);
    this.camera.lookAt(0.25, 1.05, 0);
    if (Math.abs(this.camera.fov - 46) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 46, 8, dt);
      this.camera.updateProjectionMatrix();
    }
    this.updateBokehPass(true, 3.1, 0.00014, 0.0045);
    this.updateBloomPass(0, 'showroom');
    this.sunLight.position.set(8, 14, 12);
    this.sunLight.target.position.set(0, 1, 0);
  }

  private updatePodiumCamera(dt: number) {
    let shot: PodiumCameraShot = this.podiumCameraShot;
    if (shot === 'auto') {
      const cycle = this.podiumElapsed % 20;
      shot =
        cycle < 3.8
          ? 'wide'
          : cycle < 7.6
            ? 'winner'
            : cycle < 11.4
              ? 'trophy'
              : cycle < 15.6
                ? 'full'
                : 'victory';
    }

    let targetFov = 48;
    if (shot === 'wide') {
      _targetPos.set(Math.sin(this.podiumElapsed * 0.28) * 3.8, 3.35, 8.9);
      _lookTarget.set(0, 2.0, 0);
      targetFov = 52;
    } else if (shot === 'winner') {
      _targetPos.set(-1.15, 2.25, 3.25);
      _lookTarget.set(0, 2.7, 0);
      targetFov = 43;
    } else if (shot === 'trophy') {
      const microSweep = Math.sin(this.podiumElapsed * 0.65) * 0.35;
      _targetPos.set(0.85 + microSweep, 3.35, 2.05);
      _lookTarget.set(0, 3.12, 0.08);
      targetFov = 36;
    } else if (shot === 'full') {
      _targetPos.set(0, 2.35, 6.8);
      _lookTarget.set(0, 1.9, 0);
      targetFov = 48;
    } else {
      const ang = this.podiumElapsed * 0.42;
      _targetPos.set(Math.sin(ang) * 6.3, 2.75 + Math.sin(ang * 1.4) * 0.4, Math.cos(ang) * 6.3);
      _lookTarget.set(0, 2.05, 0);
      targetFov = 46;
    }

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _targetPos.x, 3.6, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _targetPos.y, 3.6, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _targetPos.z, 3.6, dt);
    this.camera.lookAt(_lookTarget);

    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 4.5, dt);
      this.camera.updateProjectionMatrix();
    }
    this.updateBokehPass(true, this.camera.position.distanceTo(_lookTarget), 0.00012, 0.0045);
    this.updateBloomPass(0.35, 'podium');
    this.sunLight.position.set(10, 18, 12);
    this.sunLight.target.position.set(0, 1.5, 0);
  }

  private emitHud() {
    if (!this.builtTrack) return;
    const player = this.racers.find((r) => r.isPlayer);
    if (!player) return;

    const standings = this.computeStandings();
    const playerStanding = standings.find((s) => s.isPlayer);

    const trackLen = this.builtTrack.totalLength || 1000;
    const standingById = new Map(standings.map((s) => [s.id, s]));

    const miniMapBlips: MiniMapBlip[] = this.racers.map((r) => {
      const pt = this.builtTrack!.worldToMiniMap(r.position.x, r.position.z);
      const fwdX = -Math.sin(r.yaw);
      const fwdZ = -Math.cos(r.yaw);
      const headingDeg = (Math.atan2(fwdX, -fwdZ) * 180) / Math.PI;

      const avgPace = Math.max(42, Math.min(80, (Math.abs(player.speed) + Math.abs(r.speed)) * 0.5 || 56));
      const progressDiff = r.totalProgress - player.totalProgress;
      const gapToPlayerSeconds = r.isPlayer ? 0 : (progressDiff * trackLen) / avgPace;
      const isWithinTwoSeconds = !r.isPlayer && Math.abs(gapToPlayerSeconds) <= 2.0;

      const racerStanding = standingById.get(r.id);
      const code = r.isPlayer
        ? this.currentDriver.code
        : r.name.slice(0, 3).toUpperCase();

      const isIncidentCar = !r.isPlayer && (r.incidentTimer > 0 || (this.raceElapsedMs > 6000 && r.speed < 18));

      return {
        id: r.id,
        code,
        x: pt.x,
        y: pt.y,
        color: r.isPlayer ? '#F59E0B' : r.team.primaryColor,
        isPlayer: r.isPlayer,
        heading: headingDeg,
        position: racerStanding?.position ?? 1,
        gapToPlayerSeconds,
        isWithinTwoSeconds,
        isRival: !r.isPlayer && r.driverId === this.activeRivalId,
        hasIncident: isIncidentCar,
      };
    });

    const closest = this.builtTrack.findClosestSample(player.position, player.closestIdx);
    const fwdX = -Math.sin(player.yaw);
    const fwdZ = -Math.cos(player.yaw);
    const dot = fwdX * closest.tangent.x + fwdZ * closest.tangent.z;
    const wrongWay = dot < -0.35 && player.speed > 4;

    const trackFlag = this.computeTrackFlag(player, trackLen);

    const miniMapHazards: TrackHazardBlip[] = this.surfaceHazards.map((hz) => {
      const pt = this.builtTrack!.worldToMiniMap(hz.position.x, hz.position.z);
      return {
        id: hz.id,
        type: hz.type,
        sector: hz.sector,
        x: pt.x,
        y: pt.y,
        gripMultiplier: hz.gripMultiplier,
      };
    });

    const baseWeatherGrip = Math.round(
      (this.currentCompound === 'wet'
        ? THREE.MathUtils.lerp(88, 92, this.trackWetness)
        : THREE.MathUtils.lerp(100, 56, this.trackWetness))
    );
    const sectorGripPct: [number, number, number] = [baseWeatherGrip, baseWeatherGrip, baseWeatherGrip];
    for (const hz of this.surfaceHazards) {
      const sIdx = hz.sector - 1;
      const hzGrip = Math.round(baseWeatherGrip * hz.gripMultiplier);
      if (hzGrip < sectorGripPct[sIdx]) {
        sectorGripPct[sIdx] = hzGrip;
      }
    }

    const currentSector = this.getSectorFromT(player.lastT);
    const currentLapMs = Math.max(0, this.raceElapsedMs - player.lapStartTimeMs);
    const deltaMs =
      player.bestLapMs !== null && player.lastLapMs !== null ? player.lastLapMs - player.bestLapMs : null;
    const { gapAheadSeconds } = this.getGapToCarAhead(player);

    this.callbacks.onTelemetry({
      speedKmh: Math.round(Math.abs(player.speed) * 3.6),
      rpm: Math.round(player.rpm),
      maxRpm: MAX_RPM,
      gear: player.gear,
      drsAvailable: Math.abs(player.speed) * 3.6 > 140 && player.ersCharge > 4,
      drsActive: player.drsOpen,
      ersCharge: Math.round(player.ersCharge),
      fuelPct: Math.round(player.fuelPct),
      tyreWearPct: Math.round(player.tyreWearPct),
      tyreCompound: this.currentCompound,
      lap: Math.min(player.lap, this.settings.totalLaps),
      totalLaps: this.settings.totalLaps,
      position: playerStanding?.position ?? 1,
      totalRacers: this.racers.length,
      currentLapMs,
      lastLapMs: player.lastLapMs,
      bestLapMs: player.bestLapMs,
      deltaMs,
      countdownState: this.countdownState,
      bannerMessage: this.bannerMessage,
      wrongWay,
      miniMapPath: this.builtTrack.miniMapPath,
      miniMapStart: this.builtTrack.miniMapStart,
      miniMapBlips,
      miniMapHazards,
      standings,
      cameraMode: this.settings.cameraMode,
      pitBoardActive: this.pitBoardTimer > 0,
      gapAheadSeconds,
      damagePct: Math.round(player.damagePct),
      liveWeather: this.liveWeather,
      nextWeather: this.nextWeather,
      dynamicWeather: this.isDynamicWeatherEnabled(),
      trackWetnessPct: Math.round(this.trackWetness * 100),
      surfaceGripPct: this.playerSurfaceGripPct,
      currentSector,
      sectorGripPct,
      activeSurfaceHazard: this.playerActiveHazard,
      queuedCompound: this.queuedCompound,
      pitStopRemainingSec: Number(this.pitStopTimer.toFixed(1)),
      inPitWindow: this.isPlayerInPitWindow(player),
      trackFlag,
    });
  }

  private computeTrackFlag(player: RacerEntity, trackLen: number): TrackFlagState {
    if (!this.builtTrack || this.screen !== 'playing' || (this.countdownState !== 'go' && this.countdownState !== 'racing')) {
      return { flag: 'none', reason: '', distanceMeters: null };
    }

    let nearestYellowDist = Infinity;
    let yellowReason = '';

    for (const r of this.racers) {
      if (r.isPlayer) continue;
      const sample = this.builtTrack.samples[r.closestIdx];
      const rFwdX = -Math.sin(r.yaw);
      const rFwdZ = -Math.cos(r.yaw);
      const alignment = rFwdX * sample.tangent.x + rFwdZ * sample.tangent.z;
      const isSidewaysOrSpun = r.incidentTimer > 0 || (this.raceElapsedMs > 4500 && alignment < 0.65);
      const isSlowHazard = this.raceElapsedMs > 6000 && r.speed < 18 && !r.finished;

      if (!isSidewaysOrSpun && !isSlowHazard) continue;

      const fracAhead = (((r.lastT - player.lastT) % 1) + 1) % 1;
      const trackDistAhead = fracAhead * trackLen;
      const euclidDist = r.position.distanceTo(player.position);

      if ((trackDistAhead > 3 && trackDistAhead <= 220) || (euclidDist <= 160 && trackDistAhead < trackLen * 0.45)) {
        const effectiveDist = Math.min(trackDistAhead > 1 ? trackDistAhead : euclidDist, euclidDist);
        if (effectiveDist < nearestYellowDist) {
          nearestYellowDist = effectiveDist;
          yellowReason = r.incidentTimer > 0 || alignment < 0.65
            ? `INCIDENT AHEAD (${r.name.split(' ').pop()?.toUpperCase() ?? 'CAR'} SPIN)`
            : 'CAUTION — SLOW CAR AHEAD';
        }
      }
    }

    if (nearestYellowDist < Infinity) {
      return {
        flag: 'yellow',
        reason: yellowReason,
        distanceMeters: Math.max(5, Math.round(nearestYellowDist)),
      };
    }

    // Surface Flag (FIA Yellow/Red Striped): oil spill or carbon debris ahead in sector
    let nearestSurfaceDist = Infinity;
    let surfaceReason = '';
    for (const hz of this.surfaceHazards) {
      const fracAhead = (((hz.t - player.lastT) % 1) + 1) % 1;
      const trackDistAhead = fracAhead * trackLen;
      const euclidDist = hz.position.distanceTo(player.position);
      if ((trackDistAhead > 2 && trackDistAhead <= 195) || (euclidDist <= 130 && trackDistAhead < trackLen * 0.35)) {
        const effectiveDist = Math.min(trackDistAhead > 1 ? trackDistAhead : euclidDist, euclidDist);
        if (effectiveDist < nearestSurfaceDist) {
          nearestSurfaceDist = effectiveDist;
          const lineAdvice = hz.lateralOffset < 0 ? 'TAKE RIGHT LINE' : 'TAKE LEFT LINE';
          const label = hz.type === 'oil' ? 'OIL SPILL' : 'CARBON DEBRIS';
          surfaceReason = `${label} IN S${hz.sector} — ${lineAdvice}`;
        }
      }
    }

    if (nearestSurfaceDist < Infinity) {
      return {
        flag: 'surface',
        reason: surfaceReason,
        distanceMeters: Math.max(4, Math.round(nearestSurfaceDist)),
      };
    }

    // Blue Flag: faster lapping car approaching closely behind player
    let nearestBlueDist = Infinity;
    let blueReason = '';
    for (const r of this.racers) {
      if (r.isPlayer || r.finished) continue;
      const isLappingPlayer = r.totalProgress - player.totalProgress >= 0.75;
      if (!isLappingPlayer) continue;

      const fracBehind = (((player.lastT - r.lastT) % 1) + 1) % 1;
      const trackDistBehind = fracBehind * trackLen;
      if (trackDistBehind > 1 && trackDistBehind <= 120 && r.speed > player.speed * 0.8) {
        if (trackDistBehind < nearestBlueDist) {
          nearestBlueDist = trackDistBehind;
          blueReason = `YIELD TO FASTER CAR (${r.name.split(' ').pop()?.toUpperCase() ?? 'LEAD'})`;
        }
      }
    }

    if (nearestBlueDist < Infinity) {
      return {
        flag: 'blue',
        reason: blueReason,
        distanceMeters: Math.max(3, Math.round(nearestBlueDist)),
      };
    }

    return { flag: 'none', reason: '', distanceMeters: null };
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('wheel', this.onWheel);
    dom.removeEventListener('webglcontextlost', this.onContextLost);

    this.audio.dispose();
    this.builtTrack?.dispose();
    this.textures.dispose();
    this.baseAsphaltCanvas = null;
    this.baseRoughnessCanvas = null;
    this.pitBoard.dispose();
    this.garageWorkshop.dispose();
    this.showroomDriver.dispose();
    for (const gd of this.gridIntroDrivers) gd.dispose();
    this.podiumStage.dispose();
    this.envTexture?.dispose();
    this.heroCubeTarget?.dispose();
    this.smokeGeo.dispose();
    this.sparkGeo.dispose();
    this.rainGeo.dispose();
    this.fireworkGeo.dispose();
    this.skidMesh.geometry.dispose();
    this.oilSpillMesh.geometry.dispose();
    (this.oilSpillMesh.material as THREE.Material).dispose();
    this.debrisMesh.geometry.dispose();
    (this.debrisMesh.material as THREE.Material).dispose();
    this.bloomPass?.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
