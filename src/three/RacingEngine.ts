import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { RacingAudio, SpatialCarAudioInput } from '../audio/RacingAudio';
import {
  CHAMPIONSHIP_POINTS,
  CIRCUIT_TRACKS,
  FORMULA_DRIVERS,
  FORMULA_TEAMS,
  WHEEL_FINISHES,
} from '../data/racingData';
import { GRAPHICS_COLOR_CODE_PROFILES } from '../data/graphicsCodePalette';
import {
  ActiveAeroMode,
  AiStrategyArchetype,
  CameraMode,
  CarUpgrades,
  CircuitTrack,
  DEFAULT_ONLINE_GAMEPLAY_SETTINGS,
  DriverProfile,
  DrsStateTelemetry,
  DrsZoneNotificationType,
  DynamicWeatherTyreImpact,
  ErsDeploymentMode,
  FormulaTeam,
  GameMode,
  GameScreen,
  GameSettings,
  GarageCameraPreset,
  HudTelemetry,
  MiniMapBlip,
  MiniMapDrsZone,
  PodiumCameraShot,
  RacerStanding,
  SurfaceHazardType,
  TeamManagementConfig,
  TimeOfDayMode,
  TrackFlagState,
  TrackHazardBlip,
  TyreCompound,
  TyreContactPatchTelemetry,
  WeatherMode,
  WheelFinish,
} from '../types/racing';
import { buildFormulaCar, FormulaCarModel } from './carBuilder';
import {
  didCrossTrackT,
  findActiveDrsZoneAtT,
  findApproachingDrsZone,
  getCircuitDrsZones,
  getCircuitEnvironmentConfig,
  getDrsZoneRemainingRatio,
  getTimeOfDayProfile,
  getWeatherAtmosphereProfile,
  kelvinToHex,
} from './circuitEnvironments';
import { buildDriverCharacter, DriverCharacterModel } from './driverBuilder';
import { resolveCircuitBiome } from './environmentBuilder';
import { buildGarageWorkshop, GarageWorkshopModel } from './garageBuilder';
import { buildPitBoard, PitBoardModel } from './pitBoardBuilder';
import { buildPodiumStage, PodiumStageModel } from './podiumBuilder';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { buildCircuitTrack, BuiltTrack } from './trackBuilder';
import {
  calculate2026ActiveAero,
  calculate2026PowerUnitDeployment,
  calculateGForces,
  calculateCockpitGOffset,
  calculatePitStrategy,
  calculateTrackSurfaceEvolution,
  calculateTrackTemperatureC,
  calculateTyreContactPatchPhysics,
  calculateWheelWearDeltas,
  CockpitHeadPhysicsState,
  createInitialCockpitHeadState,
  evaluateAiPitStrategy,
  evaluateDynamicWeatherTyreImpact,
  evaluateRacingLineSurfaceGrip,
  GForceVector,
  resolveEffectiveSessionAssists,
  stepCockpitHeadPhysics,
  StrategyCalculationResult,
} from '../physics/simulationCalculus';

const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _skidDummy = new THREE.Object3D();
const _weatherCol = new THREE.Color();
const _envSunDir = new THREE.Vector3(0.6, 0.72, 0.35);
const _envSkyCol = new THREE.Color(0x0b4ea2);
const _envFogCol = new THREE.Color(0x9fd0f5);
const _envCityGlowCol = new THREE.Color(0xf59e0b);
const _envCloudTintCol = new THREE.Color(0xffffff);
const _hdrZenithCol = new THREE.Color();
const _hdrHorizonCol = new THREE.Color();
const _hdrGroundCol = new THREE.Color();
const _hdrBounceCol = new THREE.Color();
const _hdrSkyReflectCol = new THREE.Color();
const _hdrKeyPanelCol = new THREE.Color();
const _hdrRimPanelCol = new THREE.Color();
const _hdrHorizonStripCol = new THREE.Color();
const _hdrSunCol = new THREE.Color();
const _hdrKelvinCol = new THREE.Color();
const _hdrAccentNeonCol = new THREE.Color();
const _hdrSecondaryNeonCol = new THREE.Color();
const _hdrWaterCol = new THREE.Color();
const _hdrOverCol = new THREE.Color();
const _hdrSnowCol = new THREE.Color(0xeef6ff);
const _hdrDir = new THREE.Vector3();
const _hdrOppositeDir = new THREE.Vector3();
const _hdrPixel = new THREE.Color();
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
  brakeTempC: number;
  // F1 2026 Physics & Strategy Properties
  wheelWearPct: [number, number, number, number];
  activeAeroMode: ActiveAeroMode;
  manualOverrideActive: boolean;
  mgukPowerKw: number;
  aiStrategyArchetype: AiStrategyArchetype;
  aiPitTimer: number;
  pitStops: number;
  aiQueuedCompound: TyreCompound | null;
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
  onCameraModeChanged?: (mode: CameraMode) => void;
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
    uPaletteMix: { value: 0.42 },
    uCodeShadow: { value: new THREE.Vector3(0.176, 0.098, 0.204) },
    uCodeMid: { value: new THREE.Vector3(0.4, 0.396, 0.388) },
    uCodeHighlight: { value: new THREE.Vector3(0.847, 0.851, 0.859) },
    uCodeAccentWarm: { value: new THREE.Vector3(0.698, 0.69, 0.365) },
    uCodeAccentCool: { value: new THREE.Vector3(0.145, 0.588, 0.745) },
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
    uniform float uPaletteMix;
    uniform vec3 uCodeShadow;
    uniform vec3 uCodeMid;
    uniform vec3 uCodeHighlight;
    uniform vec3 uCodeAccentWarm;
    uniform vec3 uCodeAccentCool;
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
          vec3 minRing = min(min(nUp, nDown), min(nLeft, nRight));
          vec3 maxRing = max(max(nUp, nDown), max(nLeft, nRight));
          vec3 casWeight = clamp(min(col - minRing, maxRing - col) / max(maxRing, vec3(0.08)), 0.0, 1.0);
          vec3 detail = (col - ringAvg) * (0.65 + 0.55 * casWeight);
          col += clamp(detail * uSharpness * 1.28, -0.18, 0.18);
        }

        if (uAoStrength > 0.01) {
          vec3 s1 = texture2D(tDiffuse, uv + uTexelSize * vec2(2.0, 0.0)).rgb;
          vec3 s2 = texture2D(tDiffuse, uv + uTexelSize * vec2(-2.0, 0.0)).rgb;
          vec3 s3 = texture2D(tDiffuse, uv + uTexelSize * vec2(0.0, 2.0)).rgb;
          vec3 s4 = texture2D(tDiffuse, uv + uTexelSize * vec2(0.0, -2.0)).rgb;
          vec3 s5 = texture2D(tDiffuse, uv + uTexelSize * vec2(4.5, 4.5)).rgb;
          vec3 s6 = texture2D(tDiffuse, uv + uTexelSize * vec2(-4.5, 4.5)).rgb;
          vec3 s7 = texture2D(tDiffuse, uv + uTexelSize * vec2(4.5, -4.5)).rgb;
          vec3 s8 = texture2D(tDiffuse, uv + uTexelSize * vec2(-4.5, -4.5)).rgb;
          
          float centerLuma = getLuma(col);
          float surrLuma = (getLuma(s1) + getLuma(s2) + getLuma(s3) + getLuma(s4) + getLuma(s5) + getLuma(s6) + getLuma(s7) + getLuma(s8)) * 0.125;
          float cavity = clamp((surrLuma - centerLuma) * 3.75, 0.0, 0.62);
          float shadowWeight = 1.0 - smoothstep(0.12, 0.85, centerLuma);
          col *= (1.0 - cavity * shadowWeight * uAoStrength * 1.45);
        }

        // PS5 EGO Engine Anamorphic Red Rain-Light & Specular Highlight Horizontal + Starburst Optical Glare
        vec3 hLeft = texture2D(tDiffuse, uv - vec2(uTexelSize.x * 8.0, 0.0)).rgb;
        vec3 hRight = texture2D(tDiffuse, uv + vec2(uTexelSize.x * 8.0, 0.0)).rgb;
        vec3 hFarL = texture2D(tDiffuse, uv - vec2(uTexelSize.x * 18.0, 0.0)).rgb;
        vec3 hFarR = texture2D(tDiffuse, uv + vec2(uTexelSize.x * 18.0, 0.0)).rgb;
        vec3 dUL = texture2D(tDiffuse, uv + uTexelSize * vec2(-6.5, 6.5)).rgb;
        vec3 dUR = texture2D(tDiffuse, uv + uTexelSize * vec2(6.5, 6.5)).rgb;
        vec3 dDL = texture2D(tDiffuse, uv + uTexelSize * vec2(-6.5, -6.5)).rgb;
        vec3 dDR = texture2D(tDiffuse, uv + uTexelSize * vec2(6.5, -6.5)).rgb;
        vec3 streakSample = (hLeft + hRight) * 0.35 + (hFarL + hFarR) * 0.15;
        vec3 starburstSample = (dUL + dUR + dDL + dDR) * 0.25;
        float redBeaconMask = smoothstep(0.52, 0.92, streakSample.r - streakSample.g * 0.85);
        col += vec3(1.0, 0.18, 0.24) * redBeaconMask * (0.18 + uWetness * 0.22);

        // Broadcast Anamorphic Clearcoat & 4-Point Starburst Specular Glint
        float specLuma = getLuma(streakSample);
        float starLuma = getLuma(starburstSample);
        float specGlint = smoothstep(0.84, 1.18, specLuma);
        float starGlint = smoothstep(0.88, 1.24, starLuma);
        col += mix(streakSample, vec3(0.82, 0.92, 1.0), 0.38) * specGlint * (0.15 + uWetness * 0.12);
        col += mix(starburstSample, vec3(1.0, 0.96, 0.88), 0.35) * starGlint * 0.11;
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
          float brightMask = smoothstep(0.58, 1.05, sLuma);
          godRays += sCol * brightMask * illumDecay;
          illumDecay *= 0.89;
        }
        float sunDist = length(uv - uSunPos);
        float radialFalloff = exp(-sunDist * 1.28);
        col += (godRays * 0.055) * uSunTint * uVolumetric * radialFalloff;

        float streakY = exp(-abs(uv.y - uSunPos.y) * 32.0);
        float streakX = exp(-abs(uv.x - uSunPos.x) * 3.1);
        col += uSunTint * (streakY * streakX * 0.19 * uVolumetric);
      }

      col += vec3(dropSpec * 0.92, dropSpec * 0.96, dropSpec);

      // Filmic HDR color grading: crisp S-curve contrast, adaptive vibrance, highlight halation & subtle cinema grain
      if (uGradeContrast > 0.001) {
        vec3 sCurve = col * col * (3.0 - 2.0 * clamp(col, 0.0, 1.0));
        col = mix(col, sCurve, uGradeContrast);
        float luma = getLuma(col);
        float maxC = max(col.r, max(col.g, col.b));
        float minC = min(col.r, min(col.g, col.b));
        float sat = maxC - minC;
        col = mix(vec3(luma), col, 1.0 + (1.0 - sat) * uGradeContrast * 0.52);
        float halation = smoothstep(0.82, 1.12, luma);
        col += vec3(0.065, 0.036, 0.014) * halation * uGradeContrast * 2.65;
        vec3 coolShadows = col * vec3(0.95, 0.98, 1.04);
        vec3 warmHighlights = col * vec3(1.035, 1.005, 0.96);
        col = mix(coolShadows, warmHighlights, smoothstep(0.16, 0.84, luma));
        float filmGrain = (hash21(vUv * 960.0 + fract(uTime) * 37.0) - 0.5) * 0.0075;
        col += vec3(filmGrain);
      }

      // 12-Color Graphics Code LUT Color Harmony (Shadows -> Midtones -> Highlights + Warm/Cool Accent Split)
      if (uPaletteMix > 0.001) {
        float lum = clamp(getLuma(col), 0.0, 1.25);
        float wShadow = 1.0 - smoothstep(0.05, 0.42, lum);
        float wHigh = smoothstep(0.48, 0.95, lum);
        float wMid = clamp(1.0 - wShadow - wHigh, 0.0, 1.0);
        vec3 lutTarget = uCodeShadow * wShadow * 1.15 + uCodeMid * wMid * 1.05 + uCodeHighlight * wHigh * 1.08;
        float warmth = clamp((col.r - col.b) * 1.8, -1.0, 1.0);
        vec3 accentBias = mix(uCodeAccentCool, uCodeAccentWarm, warmth * 0.5 + 0.5);
        vec3 harmonized = mix(col, col * normalize(lutTarget + vec3(0.12)) * 1.62, 0.52);
        harmonized = mix(harmonized, mix(harmonized, accentBias * max(lum, 0.22) * 1.55, 0.24), abs(warmth) * 0.65);
        col = mix(col, max(harmonized, vec3(0.0)), clamp(uPaletteMix, 0.0, 1.0) * 0.42);
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
  private gtaoPass: GTAOPass | null = null;
  private gtaoSamplesApplied = -1;
  private smaaPass: SMAAPass | null = null;
  private speedPass: ShaderPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private audio = new RacingAudio();
  public getAudio(): RacingAudio {
    return this.audio;
  }
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
  private teamManagement: TeamManagementConfig = {
    developmentFocus: 'balanced',
    staffAllocation: { aero: 45, powertrain: 45, strategy: 45 },
    puWear: { ice: 100, mguk: 100, battery: 100, gearbox: 100 },
  };
  private playerManualOverrideAvailable = false;
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
    weather: 'day',
    dynamicWeather: false,
    timeOfDay: 'afternoon',
    dynamicTimeOfDay: false,
    totalLaps: 3,
    graphicsQuality: 'ultra_8k',
    resolutionScale: 2.0,
    textureQuality: 'cinematic',
    shadowQuality: 'cinematic',
    reflectionQuality: 'cinematic',
    ambientOcclusion: 'ultra',
    antiAliasing: 'high',
    particleDensity: 'ultra',
    motionBlurLevel: 'cinematic',
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
    graphicsColorCode: 'palette_lut',
    graphicsColorCodeIntensity: 0.42,
    onlineGameplay: { ...DEFAULT_ONLINE_GAMEPLAY_SETTINGS },
  };

  // Dynamic Weather, Time of Day & Pit Strategy State
  private liveWeather: WeatherMode = 'day';
  private nextWeather: WeatherMode | null = null;
  private liveTimeOfDay: TimeOfDayMode = 'afternoon';
  private trackWetness = 0.0;
  private timeOfDayProgress = 0.35;
  private weatherSchedule: { atProgress: number; mode: WeatherMode }[] = [];
  private playerSlipstreamPct = 0;
  private playerDirtyAirPct = 0;
  private weatherPhaseIndex = 0;
  private weatherForecastAlerted = false;
  private queuedCompound: TyreCompound | null = null;
  private queuedFuelTargetPct: number | null = null;
  private queuedPlannedStopId: string | null = null;
  private completedPlannedStopIds = new Set<string>();
  private manualGearOverrideTimer = 0;
  private pitStopTimer = 0;
  private maxPitTimer = 2.4;
  private frontJackGroup!: THREE.Group;
  private rearJackGroup!: THREE.Group;
  private wheelChangerGroups: THREE.Group[] = [];
  private fuelOperatorGroup!: THREE.Group;
  private lollipopGroup!: THREE.Group;
  private spareTyresMeshes: THREE.Mesh[] = [];
  private tyreGunMeshes: THREE.Mesh[] = [];
  private fuelHoseMesh!: THREE.Mesh;
  private pitCooldownTimer = 0;
  private curSkyColor = new THREE.Color(0x3b4859);
  private curFogColor = new THREE.Color(0x3b4859);
  private curFogDensity = 0.0052;
  private curSunColor = new THREE.Color(0xdbeafe);
  private curSunIntensity = 1.45;
  private curHemiSky = new THREE.Color(0x94a3b8);
  private curHemiGround = new THREE.Color(0x1e293b);
  private curHemiIntensity = 0.96;
  private curRimColor = new THREE.Color(0xbae6fd);
  private curRimIntensity = 0.72;
  private curEnvIntensity = 1.15;
  private curExposure = 1.12;
  private curRainOpacity = 0.62;
  private curRainSize = 0.65;
  private curRainAudio = 0.06;
  private lightningFlash = 0;
  private lightningCooldown = 6.5;

  // Dynamic Track Rubbering-In Progression & Per-Sector Racing Line Evolution
  private baseAsphaltCanvas: HTMLCanvasElement | null = null;
  private baseRoughnessCanvas: HTMLCanvasElement | null = null;
  private trackRubberLevel = 0;
  private sectorRubberLevels: [number, number, number] = [0, 0, 0];
  private sectorDepositionAccum: [number, number, number] = [0, 0, 0];
  private sectorGripPctState: [number, number, number] = [90, 87, 89];
  private renderedRubberLevel = -1;
  private completedRaceLaps = 0;

  // Realism Upgrade: Real-time G-force physics, pit strategy, and microscopic tyre contact patch calculus
  private prevPlayerSpeed = 0;
  private currentGForce: GForceVector = { gLat: 0, gLong: 0, gTotal: 0 };
  private playerOnKerb = false;
  private playerOffTrack = false;
  private cockpitHeadState: CockpitHeadPhysicsState = createInitialCockpitHeadState();
  private trackTemperatureC = 34;
  private prevTrackTemperatureC = 34;
  private currentWeatherTyreImpact: DynamicWeatherTyreImpact = {
    weather: 'day',
    trackTemperatureC: 34,
    trackTempTrend: 'stable',
    trackWetnessPct: 0,
    rainIntensity: 0,
    gripMultiplier: 1.0,
    wearMultiplier: 1.0,
    thermalOffsetC: 0,
    optimalCompound: 'medium',
    crossoverUrgent: false,
    regime: 'optimal',
    strategyRecommendation: null,
  };
  private currentContactPatch: TyreContactPatchTelemetry = {
    trackTemperatureC: 34,
    contactAreaRatio: 0.86,
    adhesionRatio: 0.94,
    microSlipRatio: 0.06,
    microSlipPct: 6,
    grainingProbabilityPct: 8,
    grainingSeverityPct: 0,
    wheelMicroSlipPct: [6, 6, 7, 7],
    wheelSurfaceTempC: [91, 91, 93, 93],
    wheelCoreTempC: [94, 94, 96, 96],
    patchState: 'stick',
    gripPenaltyMultiplier: 1.0,
    wearRateMultiplier: 1.0,
  };
  private currentStrategy: StrategyCalculationResult = {
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
  };
  private lastTacticalRadioCall: string | null = null;

  // Pooled Skid Marks & Surface Hazard Meshes (Oil Spills & Carbon Debris)
  private skidMesh: THREE.InstancedMesh;
  private skidCursor = 0;
  private readonly skidPoolSize = 720;
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
  private readonly smokePoolSize = 960;

  // Pooled Titanium Underfloor Sparks
  private sparkGeo: THREE.BufferGeometry;
  private sparkPoints: THREE.Points;
  private sparkPositions: Float32Array;
  private sparkLife: Float32Array;
  private sparkVel: Float32Array;
  private sparkCursor = 0;
  private readonly sparkPoolSize = 320;

  // Pooled Surface Deformation Particles (Tyre Rubber Marbles, Clag & Track Aggregate)
  private surfaceDebrisGeo: THREE.BufferGeometry;
  private surfaceDebrisPoints: THREE.Points;
  private surfaceDebrisPositions: Float32Array;
  private surfaceDebrisColors: Float32Array;
  private surfaceDebrisVel: Float32Array;
  private surfaceDebrisLife: Float32Array;
  private surfaceDebrisCursor = 0;
  private readonly surfaceDebrisPoolSize = 640;

  // Pooled Rain Particles
  private rainGeo: THREE.BufferGeometry;
  private rainPoints: THREE.Points;
  private rainPositions: Float32Array;
  private readonly rainCount = 2000;

  // Pooled Volumetric Snow Particles
  private snowGeo: THREE.BufferGeometry;
  private snowPoints: THREE.Points;
  private snowPositions: Float32Array;
  private readonly snowCount = 1800;

  // Pooled Finish-Line Fireworks Particles
  private fireworkGeo: THREE.BufferGeometry;
  private fireworkPoints: THREE.Points;
  private fireworkPositions: Float32Array;
  private fireworkColors: Float32Array;
  private fireworkVel: Float32Array;
  private fireworkLife: Float32Array;
  private fireworkCursor = 0;
  private fireworkCooldown = 0;
  private readonly fireworkPoolSize = 1080;
  private pitCrewGroup: THREE.Group;

  private heldKeys = new Set<string>();
  private touchState = {
    left: false,
    right: false,
    throttle: false,
    brake: false,
    drs: false,
  };
  private touchAnalogSteer = 0;
  private touchAnalogThrottle = 0;
  private touchAnalogBrake = 0;
  private mobileAeroMode: 'auto' | 'x_mode' | 'z_mode' = 'auto';
  private mobileVibrateCooldown = 0;

  private frameId = 0;
  private lastTimestamp = 0;
  private raceElapsedMs = 0;
  private countdownTimer = 0;
  private lastCountdownStage = 0;
  private countdownState: HudTelemetry['countdownState'] = 'lights_1';
  private bannerMessage: string | null = null;
  private bannerTimer = 0;
  private trackLimitWarnings = 0;
  private trackLimitCooldown = 0;
  private timePenaltySec = 0;
  private overtakesCount = 0;
  private lastTrackedPosition = 0;
  private playerLaunched = false;
  private launchFeedback: string | null = null;
  private launchFeedbackTimer = 0;
  private ersMode: ErsDeploymentMode = 'balanced';
  private brakeBiasPct = 57;
  private dualsenseConnected = false;
  private dualsenseName: string | null = null;
  private prevGamepadButtons = new Map<number, boolean>();
  private hapticCooldown = 0;
  private playerThrottleInputPct = 0;
  private playerBrakeInputPct = 0;
  private playerDrsZoneId: string | null = null;
  private playerDrsGapQualified = true;
  private drsNotification: DrsZoneNotificationType = null;
  private drsNotificationZoneNumber: number | null = null;
  private drsNotificationZoneName: string | null = null;
  private drsNotificationTimer = 0;
  private drsNotificationSeq = 0;
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
  private smoothEyeAdaptation = 1.0;
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

    // Multisampled Half-Float HDR EffectComposer on Hardware GPUs (16x MSAA + 2048px Ray-Traced CubeCamera)
    if (!this.isSoftwareGl) {
      const rt = new THREE.WebGLRenderTarget(width, height, {
        samples: 16,
        type: THREE.HalfFloatType,
      });
      const composer = new EffectComposer(this.renderer, rt);
      composer.addPass(new RenderPass(this.scene, this.camera));

      // Real horizon-based ground-truth AO (contact shadows under car, kerbs, barriers, trees)
      const gtaoPass = new GTAOPass(this.scene, this.camera, width, height);
      gtaoPass.blendIntensity = 1.0;
      gtaoPass.enabled = false; // switched on in applyGraphicsSettings() for ultra+ quality
      composer.addPass(gtaoPass);
      this.gtaoPass = gtaoPass;

      const bokehPass = new BokehPass(this.scene, this.camera, {
        focus: 6.0,
        aperture: 0.00014,
        maxblur: 0.006,
      });
      bokehPass.enabled = false;
      composer.addPass(bokehPass);

      const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.64, 0.72, 0.74);
      composer.addPass(bloomPass);

      const speedPass = new ShaderPass(SpeedEffectShader);
      (speedPass.uniforms['uTexelSize'].value as THREE.Vector2).set(1 / Math.max(1, width), 1 / Math.max(1, height));
      composer.addPass(speedPass);

      const vignettePass = new ShaderPass(VignetteShader);
      vignettePass.uniforms['offset'].value = 1.05;
      vignettePass.uniforms['darkness'].value = 0.36;
      composer.addPass(vignettePass);

      composer.addPass(new OutputPass());

      // Post-tonemap SMAA cleans up shader/specular aliasing that MSAA cannot reach
      const smaaPass = new SMAAPass();
      smaaPass.enabled = false;
      composer.addPass(smaaPass);
      this.smaaPass = smaaPass;
      this.composer = composer;
      this.bokehPass = bokehPass;
      this.bloomPass = bloomPass;
      this.speedPass = speedPass;

      this.heroCubeTarget = new THREE.WebGLCubeRenderTarget(2048, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
        type: THREE.HalfFloatType,
      });
      this.heroCubeCamera = new THREE.CubeCamera(0.35, 460, this.heroCubeTarget);
    }

    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x2a3529, 0.82);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 2.55);
    this.sunLight.position.set(85, 110, 65);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = this.isSoftwareGl ? 1024 : 8192;
    this.sunLight.shadow.mapSize.height = this.isSoftwareGl ? 1024 : 8192;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 260;
    const sd = 38;
    this.sunLight.shadow.camera.left = -sd;
    this.sunLight.shadow.camera.right = sd;
    this.sunLight.shadow.camera.top = sd;
    this.sunLight.shadow.camera.bottom = -sd;
    this.sunLight.shadow.radius = 2.5;
    this.sunLight.shadow.bias = -0.0002;
    this.sunLight.shadow.normalBias = 0.012;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0xbae6fd, 0.72);
    this.rimLight.position.set(-70, 45, -80);
    this.scene.add(this.rimLight);
    this.scene.add(this.rimLight.target);

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

    // Pooled Surface Deformation Particles (Tyre Rubber Marbles, Clag & Aggregate)
    this.surfaceDebrisPositions = new Float32Array(this.surfaceDebrisPoolSize * 3);
    this.surfaceDebrisPositions.fill(-9999);
    this.surfaceDebrisColors = new Float32Array(this.surfaceDebrisPoolSize * 3);
    this.surfaceDebrisColors.fill(0.1);
    this.surfaceDebrisVel = new Float32Array(this.surfaceDebrisPoolSize * 3);
    this.surfaceDebrisLife = new Float32Array(this.surfaceDebrisPoolSize);
    this.surfaceDebrisGeo = new THREE.BufferGeometry();
    this.surfaceDebrisGeo.setAttribute('position', new THREE.BufferAttribute(this.surfaceDebrisPositions, 3));
    this.surfaceDebrisGeo.setAttribute('color', new THREE.BufferAttribute(this.surfaceDebrisColors, 3));
    this.surfaceDebrisPoints = new THREE.Points(
      this.surfaceDebrisGeo,
      new THREE.PointsMaterial({
        size: 0.48,
        vertexColors: true,
        map: this.textures.sparkSpriteMap,
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
      })
    );
    this.surfaceDebrisPoints.frustumCulled = false;
    this.scene.add(this.surfaceDebrisPoints);

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

    // Pooled Volumetric Snow Flakes
    this.snowPositions = new Float32Array(this.snowCount * 3);
    for (let i = 0; i < this.snowCount; i++) {
      this.snowPositions[i * 3] = (Math.random() - 0.5) * 65;
      this.snowPositions[i * 3 + 1] = Math.random() * 28;
      this.snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 65;
    }
    this.snowGeo = new THREE.BufferGeometry();
    this.snowGeo.setAttribute('position', new THREE.BufferAttribute(this.snowPositions, 3));
    this.snowPoints = new THREE.Points(
      this.snowGeo,
      new THREE.PointsMaterial({
        color: 0xf8fafc,
        map: this.textures.sparkSpriteMap,
        size: 0.85,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      })
    );
    this.snowPoints.frustumCulled = false;
    this.snowPoints.visible = false;
    this.scene.add(this.snowPoints);

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

    this.pitCrewGroup = this.buildPitCrewSquad();
    this.scene.add(this.pitCrewGroup);

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
    this.touchAnalogSteer = 0;
    this.touchAnalogThrottle = 0;
    this.touchAnalogBrake = 0;
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
        const smartCompound: TyreCompound =
          this.trackWetness >= 0.36
            ? 'wet'
            : this.currentWeatherTyreImpact.optimalCompound !== this.currentCompound
              ? this.currentWeatherTyreImpact.optimalCompound
              : this.currentStrategy.recommendedCompound;
        this.requestTyreSwitch(smartCompound);
      } else if (e.code === 'KeyR' && this.screen === 'playing') {
        this.cycleErsMode();
      } else if (e.code === 'BracketLeft' && this.screen === 'playing') {
        this.adjustBrakeBias(-1);
      } else if (e.code === 'BracketRight' && this.screen === 'playing') {
        this.adjustBrakeBias(1);
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

  public setTouchSteerAxis(axis: number) {
    this.audio.unlock();
    this.touchAnalogSteer = THREE.MathUtils.clamp(axis, -1, 1);
  }

  public setTouchPedalAxis(throttle: number, brake: number) {
    this.audio.unlock();
    this.touchAnalogThrottle = THREE.MathUtils.clamp(throttle, 0, 1);
    this.touchAnalogBrake = THREE.MathUtils.clamp(brake, 0, 1);
  }

  public setMobileAeroMode(mode: 'auto' | 'x_mode' | 'z_mode') {
    this.audio.unlock();
    this.mobileAeroMode = mode;
    if (mode === 'x_mode') {
      this.triggerMobileHaptic('aero_x', 1);
      this.bannerMessage = 'ACTIVE AERO: X-MODE LOW DRAG ARMED';
      this.bannerTimer = 1.6;
      this.audio.playEngineerTelemetryCue('aero_x');
    } else if (mode === 'z_mode') {
      this.triggerMobileHaptic('aero_z', 1);
      this.bannerMessage = 'ACTIVE AERO: Z-MODE HIGH DOWNFORCE LOCKED';
      this.bannerTimer = 1.6;
      this.audio.playEngineerTelemetryCue('aero_z');
    } else {
      this.triggerMobileHaptic('aero_z', 0.6);
      this.bannerMessage = 'ACTIVE AERO: AUTO FIA ZONE CONTROL';
      this.bannerTimer = 1.4;
      this.audio.playEngineerTelemetryCue('aero_z');
    }
  }

  public triggerMobileHaptic(
    event: 'shift_up' | 'shift_down' | 'aero_x' | 'aero_z' | 'collision' | 'kerb' | 'brake' | 'accel',
    intensity = 1
  ) {
    const level = this.settings.hapticFeedback ?? 'full';
    if (!this.settings.touchControls || level === 'off') return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    const scale = level === 'subtle' ? 0.58 : 1.0;
    const clamped = THREE.MathUtils.clamp(intensity, 0.2, 1.0) * scale;
    try {
      if (event === 'collision') {
        if (intensity > 0.85) {
          navigator.vibrate([
            Math.round(52 * scale),
            16,
            Math.round(72 * scale),
            18,
            Math.round(44 * scale),
            14,
            Math.round(24 * scale),
          ]);
        } else if (intensity > 0.55) {
          navigator.vibrate([Math.round(36 * scale), 16, Math.round(48 * scale), 15, Math.round(24 * scale)]);
        } else if (intensity > 0.3) {
          navigator.vibrate([Math.round(24 * scale), 14, Math.round(30 * scale)]);
        } else {
          navigator.vibrate([Math.max(10, Math.round(16 * clamped)), 12, Math.max(10, Math.round(18 * clamped))]);
        }
        this.mobileVibrateCooldown = 0.2;
      } else if (event === 'aero_x') {
        navigator.vibrate([Math.max(8, Math.round(12 * scale)), 15, Math.max(9, Math.round(14 * scale))]);
        this.mobileVibrateCooldown = 0.14;
      } else if (event === 'aero_z') {
        navigator.vibrate(Math.max(11, Math.round(18 * scale)));
        this.mobileVibrateCooldown = 0.14;
      } else if (event === 'shift_up') {
        navigator.vibrate([Math.max(7, Math.round(10 * scale)), 10, Math.max(6, Math.round(8 * scale))]);
      } else if (event === 'shift_down') {
        navigator.vibrate([Math.max(10, Math.round(14 * scale)), 12, Math.max(8, Math.round(10 * scale))]);
      } else if (event === 'brake') {
        if (intensity > 0.85) {
          // Heavy ABS threshold lockup chatter
          navigator.vibrate([
            Math.max(7, Math.round(10 * scale)),
            12,
            Math.max(8, Math.round(12 * scale)),
            12,
            Math.max(7, Math.round(10 * scale)),
          ]);
        } else if (intensity > 0.55) {
          // Progressive threshold braking pulse
          navigator.vibrate([Math.max(7, Math.round(9 * scale)), 14, Math.max(8, Math.round(11 * scale))]);
        } else {
          navigator.vibrate(Math.max(7, Math.round(13 * clamped)));
        }
      } else if (event === 'accel') {
        navigator.vibrate(Math.max(6, Math.round(11 * clamped)));
      } else if (event === 'kerb') {
        if (intensity > 0.88) {
          // Rough off-track gravel / marbles chatter
          navigator.vibrate([
            Math.max(10, Math.round(17 * scale)),
            12,
            Math.max(12, Math.round(22 * scale)),
            14,
            Math.max(9, Math.round(14 * scale)),
          ]);
        } else {
          // Striated kerb rib bump rhythm
          navigator.vibrate([Math.max(7, Math.round(10 * clamped)), 16, Math.max(8, Math.round(12 * clamped))]);
        }
      } else {
        navigator.vibrate(Math.max(8, Math.round(15 * clamped)));
      }
    } catch {
      // ignore unsupported vibration errors
    }
  }

  public manualShift(dir: 1 | -1) {
    const player = this.racers.find((r) => r.isPlayer);
    if (!player) return;
    const minGear = this.settings.transmission === 'manual' ? -1 : 1;
    const next = THREE.MathUtils.clamp(player.gear + dir, minGear, 8);
    if (this.settings.transmission === 'auto') {
      // Allow smooth semi-auto sequential swipe/paddle override in Automatic mode
      this.manualGearOverrideTimer = 2.6;
    }
    if (next !== player.gear) {
      player.gear = next;
      player.shiftFlash = 1.0;
      this.audio.playGearShift(dir > 0);
      this.triggerMobileHaptic(dir > 0 ? 'shift_up' : 'shift_down', 1);
    }
  }

  public cycleCameraMode(): CameraMode {
    const order: CameraMode[] = [
      'chase',
      'tcam',
      'cockpit',
      'bumper',
      'low_track',
      'wing_tyre',
      'side',
      'rear',
      'tv_wide',
      'heli',
      'trackside',
    ];
    const next = order[(order.indexOf(this.settings.cameraMode) + 1) % order.length];
    this.settings.cameraMode = next;
    if ((next === 'tv_wide' || next === 'trackside') && this.builtTrack) {
      const player = this.racers.find((r) => r.isPlayer);
      if (player) {
        this.tvStationIdx = (player.closestIdx + 26) % this.builtTrack.samples.length;
      }
    }
    this.callbacks.onCameraModeChanged?.(next);
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
      this.rimLight.color.setHex(0x93c5fd);
      this.rimLight.intensity = 1.15;
      this.rimLight.position.set(-70, 45, -80);
      this.scene.environmentIntensity = 1.05;
      this.renderer.toneMappingExposure = this.getHdrExposureBase();
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
      this.rimLight.color.setHex(0xbae6fd);
      this.rimLight.intensity = 0.95;
      this.rimLight.position.set(-14, 10, -16);
      this.scene.environmentIntensity = 1.0;
      this.renderer.toneMappingExposure = this.getHdrExposureBase();
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
      this.rimLight.color.setHex(0xfde68a);
      this.rimLight.intensity = 1.05;
      this.rimLight.position.set(-16, 14, -18);
      this.scene.environmentIntensity = 1.08;
      this.renderer.toneMappingExposure = this.getHdrExposureBase();
      this.updateEnvironment('garage');
      this.audio.setRainLevel(0);
      this.audio.updateEngine(0, MAX_RPM, 0, 0, false);
      this.audio.updateSpatialTraffic([], false);
      this.audio.updateCrowdAmbience(0.14);
      this.audio.updateCinematicTrailer(0, 0, 1, false);
    } else {
      this.applyAtmosphere(this.liveWeather);
      this.updateEnvironment(this.liveWeather);
      if (nextScreen === 'playing') {
        this.audio.updateCinematicTrailer(0, 0, 1, false);
      } else if (nextScreen === 'title' && this.trackRubberLevel < 0.42) {
        this.trackRubberLevel = 0.42;
        this.sectorRubberLevels = [0.42, 0.45, 0.40];
        this.builtTrack?.setSurfaceRubbering(this.trackRubberLevel, this.sectorRubberLevels);
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
    teamManagement?: TeamManagementConfig;
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
      const todChanged =
        params.settings.timeOfDay !== undefined && params.settings.timeOfDay !== this.settings.timeOfDay;
      const qualityChanged =
        params.settings.graphicsQuality && params.settings.graphicsQuality !== this.settings.graphicsQuality;
      const dynamicChanged =
        params.settings.dynamicWeather !== undefined &&
        params.settings.dynamicWeather !== this.settings.dynamicWeather;
      if (weatherChanged || todChanged || qualityChanged) {
        needsTrackRebuild = true;
      }
      this.settings = {
        ...this.settings,
        ...params.settings,
        onlineGameplay: params.settings.onlineGameplay
          ? { ...(this.settings.onlineGameplay ?? DEFAULT_ONLINE_GAMEPLAY_SETTINGS), ...params.settings.onlineGameplay }
          : (this.settings.onlineGameplay ?? { ...DEFAULT_ONLINE_GAMEPLAY_SETTINGS }),
      };
      if (params.settings.timeOfDay) {
        this.liveTimeOfDay = params.settings.timeOfDay;
      } else if (params.track) {
        this.liveTimeOfDay = getCircuitEnvironmentConfig(this.currentTrack).defaultTimeOfDay;
      }
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
      const effectiveAssists = resolveEffectiveSessionAssists(this.settings);
      this.builtTrack?.setRacingLineMode(effectiveAssists.racingLine);
      const aiDiffMult = this.getAiDifficultyMultiplier();
      const onlineEqualSpec = Boolean(
        this.settings.onlineGameplay?.applyOnlineRulesToSession &&
          this.settings.onlineGameplay.carPerformance === 'equal'
      );
      for (let i = 0; i < this.racers.length; i++) {
        const r = this.racers[i];
        if (!r.isPlayer) {
          r.aiBasePace = onlineEqualSpec
            ? aiDiffMult * (0.955 + (i % 3) * 0.015)
            : aiDiffMult * (0.93 + (i % 3) * 0.03);
        }
      }
      if ((dynamicChanged || params.settings.totalLaps !== undefined) && this.screen === 'title') {
        this.buildWeatherSchedule();
      }
    } else if (params.track) {
      this.liveTimeOfDay = getCircuitEnvironmentConfig(this.currentTrack).defaultTimeOfDay;
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
    if (params.teamManagement) this.teamManagement = params.teamManagement;
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
    this.queuedFuelTargetPct = null;
    this.queuedPlannedStopId = null;
    this.completedPlannedStopIds.clear();
    if (this.settings.pitStrategyPlan?.startingCompound) {
      this.currentCompound = this.settings.pitStrategyPlan.startingCompound;
    }
    this.pitStopTimer = 0;
    this.pitCooldownTimer = 0;
    this.rebuildWorldAndGrid();
    this.setScreen('playing');
    this.completedRaceLaps = 0;
    this.trackRubberLevel = 0;
    this.sectorRubberLevels = [0, 0, 0];
    this.sectorDepositionAccum = [0, 0, 0];
    this.recomputeTrackRubberLevel();
    this.updateTrackRubberTexture(true);
    this.raceElapsedMs = 0;
    this.countdownTimer = 0;
    this.lastCountdownStage = 0;
    this.countdownState = 'lights_1';
    this.bannerMessage = this.isDynamicWeatherEnabled()
      ? 'DYNAMIC WEATHER ACTIVE — WATCH RADAR & TYRE STRATEGY'
      : 'FORMATION READY — HOLD THROTTLE FOR LAUNCH';
    this.bannerTimer = 3.2;
    this.playerDrsZoneId = null;
    this.playerDrsGapQualified = true;
    this.drsNotification = null;
    this.drsNotificationZoneNumber = null;
    this.drsNotificationZoneName = null;
    this.drsNotificationTimer = 0;
    this.drsNotificationSeq = 0;
    this.pitBoardTimer = 0;
    this.finalLapBoardShown = false;
    this.pitBoard.root.visible = false;
    this.playerOnKerb = false;
    this.playerOffTrack = false;
    this.trackLimitWarnings = 0;
    this.trackLimitCooldown = 0;
    this.timePenaltySec = 0;
    this.overtakesCount = 0;
    this.lastTrackedPosition = this.racers.findIndex((r) => r.isPlayer) + 1 || 1;
    this.playerLaunched = false;
    this.launchFeedback = null;
    this.launchFeedbackTimer = 0;
    this.ersMode = 'balanced';
    this.brakeBiasPct = 57;
    this.playerThrottleInputPct = 0;
    this.playerBrakeInputPct = 0;
    this.cockpitHeadState = createInitialCockpitHeadState();
    this.trackTemperatureC = calculateTrackTemperatureC(
      this.liveWeather,
      this.getEffectiveLiveTimeOfDay(),
      this.trackWetness,
      0,
      0
    );
    const blanketTemp = this.currentCompound === 'wet' ? 68 : 88;
    this.currentContactPatch = {
      trackTemperatureC: this.trackTemperatureC,
      contactAreaRatio: 0.85,
      adhesionRatio: 0.96,
      microSlipRatio: 0.04,
      microSlipPct: 4,
      grainingProbabilityPct: 6,
      grainingSeverityPct: 0,
      wheelMicroSlipPct: [4, 4, 5, 5],
      wheelSurfaceTempC: [blanketTemp, blanketTemp, blanketTemp + 2, blanketTemp + 2],
      wheelCoreTempC: [blanketTemp + 4, blanketTemp + 4, blanketTemp + 6, blanketTemp + 6],
      patchState: 'stick',
      gripPenaltyMultiplier: 1.0,
      wearRateMultiplier: 1.0,
    };
    this.emitHud();
  }

  private isDynamicWeatherEnabled(): boolean {
    return this.settings.dynamicWeather || this.settings.totalLaps >= 5;
  }

  private getEffectiveLiveTimeOfDay(weather: WeatherMode = this.liveWeather): TimeOfDayMode {
    if (weather === 'night') return 'night';
    if (weather === 'sunset') return 'sunset';
    return this.liveTimeOfDay;
  }

  private buildWeatherSchedule() {
    const envCfg = getCircuitEnvironmentConfig(this.currentTrack);
    this.liveTimeOfDay = this.settings.timeOfDay ?? envCfg.defaultTimeOfDay;
    const todOrder: TimeOfDayMode[] = ['morning', 'midday', 'afternoon', 'golden_hour', 'sunset', 'night'];
    const todIdx = Math.max(0, todOrder.indexOf(this.liveTimeOfDay));
    this.timeOfDayProgress = todIdx / Math.max(1, todOrder.length - 1);

    if (!this.isDynamicWeatherEnabled()) {
      this.liveWeather = this.settings.weather;
      this.nextWeather = null;
      this.weatherSchedule = [{ atProgress: 0, mode: this.settings.weather }];
      this.weatherPhaseIndex = 0;
      this.weatherForecastAlerted = false;
      this.trackWetness = getWeatherAtmosphereProfile(this.settings.weather).wetnessTarget;
      this.builtTrack?.setSurfaceWetness(this.trackWetness);
      return;
    }

    const startMode: WeatherMode = this.settings.weather === 'night' ? 'partly_cloudy' : this.settings.weather;
    if (startMode === 'snow' || startMode === 'blizzard') {
      this.weatherSchedule = [
        { atProgress: 0, mode: startMode },
        { atProgress: 0.28, mode: 'blizzard' },
        { atProgress: 0.58, mode: 'snow' },
        { atProgress: 0.80, mode: 'cloudy' },
        { atProgress: 0.92, mode: 'partly_cloudy' },
      ];
    } else if (startMode === 'heavy_rain' || startMode === 'rain') {
      this.weatherSchedule = [
        { atProgress: 0, mode: startMode },
        { atProgress: 0.34, mode: 'cloudy' },
        { atProgress: 0.62, mode: 'partly_cloudy' },
        { atProgress: 0.84, mode: 'rain' },
      ];
    } else if (startMode === 'fog' || startMode === 'cloudy') {
      this.weatherSchedule = [
        { atProgress: 0, mode: startMode },
        { atProgress: 0.26, mode: 'rain' },
        { atProgress: 0.56, mode: 'heavy_rain' },
        { atProgress: 0.78, mode: 'cloudy' },
        { atProgress: 0.90, mode: 'partly_cloudy' },
      ];
    } else {
      this.weatherSchedule = [
        { atProgress: 0, mode: startMode },
        { atProgress: 0.22, mode: 'cloudy' },
        { atProgress: 0.44, mode: 'rain' },
        { atProgress: 0.74, mode: 'fog' },
        { atProgress: 0.88, mode: 'day' },
      ];
    }

    this.weatherPhaseIndex = 0;
    this.weatherForecastAlerted = false;
    this.liveWeather = this.weatherSchedule[0].mode;
    this.nextWeather = this.weatherSchedule[1]?.mode ?? null;
    this.trackWetness = getWeatherAtmosphereProfile(this.liveWeather).wetnessTarget;
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
    this.queuedFuelTargetPct = null;
    this.queuedPlannedStopId = null;

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
    const fuelMsg =
      this.queuedFuelTargetPct !== null ? ` · FUEL TO ${Math.round(this.queuedFuelTargetPct)}%` : '';
    const strategyStaffSpeedup =
      Math.min(0.45, Math.max(0, (this.teamManagement.staffAllocation.strategy - 45) * 0.008)) +
      (this.teamManagement.developmentFocus === 'tyre_thermal' ? 0.25 : 0);
    this.maxPitTimer = Math.max(1.65, (this.queuedFuelTargetPct !== null ? 2.6 : 2.2) - strategyStaffSpeedup);
    this.pitStopTimer = this.maxPitTimer;
    this.bannerMessage = `PIT STOP — FITTING ${target.toUpperCase()} TYRES${fuelMsg}...`;
    this.bannerTimer = 2.2;
    player.drsOpen = false;
    player.activeAeroMode = 'z_mode';
    player.manualOverrideActive = false;

    this.pitCrewGroup.position.copy(player.position);
    this.pitCrewGroup.rotation.y = player.yaw;
    this.pitCrewGroup.visible = true;
  }

  private completePlayerPitStop(player: RacerEntity) {
    const nextCompound = this.queuedCompound ?? this.currentCompound;
    this.currentCompound = nextCompound;
    player.tyreCompound = nextCompound;
    player.tyreWearPct = 100;
    player.wheelWearPct = [100, 100, 100, 100];
    player.pitStops += 1;
    if (this.queuedFuelTargetPct !== null) {
      player.fuelPct = Math.min(100, Math.max(player.fuelPct, this.queuedFuelTargetPct));
    } else {
      player.fuelPct = Math.min(100, player.fuelPct + 35);
    }
    if (this.queuedPlannedStopId) {
      this.completedPlannedStopIds.add(this.queuedPlannedStopId);
    }
    this.queuedCompound = null;
    this.queuedFuelTargetPct = null;
    this.queuedPlannedStopId = null;
    player.damagePct = Math.max(0, player.damagePct - 35);
    this.pitCooldownTimer = 6.0;
    this.pitCrewGroup.visible = false;
    const blanketTemp = nextCompound === 'wet' ? 68 : 88;
    this.currentContactPatch = {
      ...this.currentContactPatch,
      grainingProbabilityPct: 5,
      grainingSeverityPct: 0,
      microSlipRatio: 0.05,
      microSlipPct: 5,
      adhesionRatio: 0.95,
      wheelMicroSlipPct: [5, 5, 5, 5],
      wheelSurfaceTempC: [blanketTemp, blanketTemp, blanketTemp + 2, blanketTemp + 2],
      wheelCoreTempC: [blanketTemp + 4, blanketTemp + 4, blanketTemp + 6, blanketTemp + 6],
      patchState: 'stick',
      gripPenaltyMultiplier: 1.0,
      wearRateMultiplier: 1.0,
    };

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

  public setErsMode(mode: ErsDeploymentMode) {
    this.ersMode = mode;
    this.audio.playUiConfirm();
    this.bannerMessage = `ERS MODE: ${mode.toUpperCase()}`;
    this.bannerTimer = 1.6;
    this.emitHud();
  }

  public cycleErsMode() {
    const order: ErsDeploymentMode[] = ['harvest', 'balanced', 'overtake'];
    const next = order[(order.indexOf(this.ersMode) + 1) % order.length];
    this.setErsMode(next);
  }

  public adjustBrakeBias(deltaPct: number) {
    this.brakeBiasPct = Math.round(THREE.MathUtils.clamp(this.brakeBiasPct + deltaPct, 52, 62));
    this.audio.playUiConfirm();
    this.bannerMessage = `BRAKE BIAS: ${this.brakeBiasPct}% FRONT`;
    this.bannerTimer = 1.5;
    this.emitHud();
  }

  private pollDualSenseGamepad(): {
    throttle: number;
    brake: number;
    steer: number;
    drs: boolean;
    clutch: boolean;
  } {
    const pads =
      typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'
        ? navigator.getGamepads()
        : null;
    let activePad: Gamepad | null = null;
    if (pads) {
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i]!.connected) {
          activePad = pads[i];
          break;
        }
      }
    }

    if (!activePad) {
      this.dualsenseConnected = false;
      this.dualsenseName = null;
      this.prevGamepadButtons.clear();
      return { throttle: 0, brake: 0, steer: 0, drs: false, clutch: false };
    }

    this.dualsenseConnected = true;
    this.dualsenseName = activePad.id || 'DualSense Wireless Controller';

    const btnEdge = (idx: number): boolean => {
      const pressed = Boolean(activePad!.buttons[idx]?.pressed);
      const prev = this.prevGamepadButtons.get(idx) ?? false;
      this.prevGamepadButtons.set(idx, pressed);
      return pressed && !prev;
    };

    if (this.screen === 'playing') {
      if (btnEdge(3)) this.cycleCameraMode(); // Triangle
      if (btnEdge(2)) {
        const smartCompound: TyreCompound =
          this.trackWetness >= 0.36
            ? 'wet'
            : this.currentWeatherTyreImpact.optimalCompound !== this.currentCompound
              ? this.currentWeatherTyreImpact.optimalCompound
              : this.currentStrategy.recommendedCompound;
        this.requestTyreSwitch(smartCompound); // Square -> Box this lap
      }
      if (btnEdge(5)) this.manualShift(1); // R1 -> Upshift
      if (btnEdge(1)) this.manualShift(-1); // Circle -> Downshift
      if (btnEdge(12)) this.adjustBrakeBias(1); // D-Pad Up -> Brake Bias Forward
      if (btnEdge(13)) this.adjustBrakeBias(-1); // D-Pad Down -> Brake Bias Rearward
      if (btnEdge(15)) this.cycleErsMode(); // D-Pad Right -> Next ERS Mode
      if (btnEdge(14)) {
        const order: ErsDeploymentMode[] = ['harvest', 'balanced', 'overtake'];
        const prevMode = order[(order.indexOf(this.ersMode) + 2) % order.length];
        this.setErsMode(prevMode); // D-Pad Left -> Prev ERS Mode
      }
      if (btnEdge(9)) this.callbacks.onPauseRequested(); // Options -> Pause
    }

    const rawSteer = activePad.axes[0] ?? 0;
    const deadzone = 0.08;
    const mag = Math.max(0, Math.abs(rawSteer) - deadzone) / (1 - deadzone);
    const steer = -Math.sign(rawSteer) * Math.pow(mag, 1.15);

    const throttle = activePad.buttons[7]?.value ?? 0; // R2 Adaptive Trigger
    const brake = activePad.buttons[6]?.value ?? 0; // L2 Adaptive Trigger
    const drs = Boolean(activePad.buttons[4]?.pressed || activePad.buttons[0]?.pressed); // L1 / Cross
    return { throttle, brake, steer, drs, clutch: drs };
  }

  private applyDualSenseHaptics(params: {
    dt: number;
    onKerb: boolean;
    offTrack: boolean;
    brakeIn: number;
    speedKmh: number;
    slipRatio: number;
    shiftFlash: number;
    wetRatio: number;
  }) {
    if (!this.dualsenseConnected) return;
    const hapticSetting = this.settings.hapticFeedback ?? 'full';
    const triggerSetting = this.settings.adaptiveTriggers ?? 'strong';
    if (hapticSetting === 'off' && triggerSetting === 'off') return;

    this.hapticCooldown = Math.max(0, this.hapticCooldown - params.dt);
    if (this.hapticCooldown > 0) return;

    const pads =
      typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'
        ? navigator.getGamepads()
        : null;
    const pad = pads ? Array.from(pads).find((p) => p && p.connected) : null;
    const actuator = (pad as (Gamepad & {
      vibrationActuator?: {
        playEffect?: (
          type: string,
          opts: { startDelay: number; duration: number; weakMagnitude: number; strongMagnitude: number }
        ) => Promise<void>;
      };
    }) | null)?.vibrationActuator;
    if (!actuator?.playEffect) return;

    const hapScale = hapticSetting === 'full' ? 1.0 : hapticSetting === 'subtle' ? 0.45 : 0;
    const trigScale = triggerSetting === 'strong' ? 1.0 : triggerSetting === 'medium' ? 0.55 : 0;

    let weak = 0;
    let strong = 0;
    if (params.onKerb && params.speedKmh > 60) {
      weak = Math.max(weak, 0.55 * hapScale);
      strong = Math.max(strong, 0.3 * hapScale);
    }
    if (params.offTrack && params.speedKmh > 35) {
      weak = Math.max(weak, 0.72 * hapScale);
      strong = Math.max(strong, 0.52 * hapScale);
    }
    if (params.brakeIn > 0.45 && params.speedKmh > 95) {
      // Simulate DualSense L2 trigger ABS pulsation & threshold braking bite
      strong = Math.max(strong, (0.35 + params.brakeIn * 0.42) * trigScale);
    }
    if (params.slipRatio > 0.16 && params.speedKmh > 70) {
      weak = Math.max(weak, Math.min(0.65, params.slipRatio * 1.4) * hapScale);
    }
    if (params.shiftFlash > 0.7) {
      strong = Math.max(strong, 0.48 * hapScale);
    }
    if (params.speedKmh > 250) {
      weak = Math.max(weak, (0.12 + params.wetRatio * 0.18) * hapScale);
    }

    if (weak > 0.04 || strong > 0.04) {
      this.hapticCooldown = 0.075;
      actuator
        .playEffect('dual-rumble', {
          startDelay: 0,
          duration: 85,
          weakMagnitude: Math.min(1, weak),
          strongMagnitude: Math.min(1, strong),
        })
        .catch(() => {
          // ignore unsupported browser vibration errors
        });
    }
  }

  private getHdrExposureBase(): number {
    const hdrMode = this.settings.hdrMode ?? 'hdr10';
    return hdrMode === 'hdr10' ? 1.15 : hdrMode === 'scrgb' ? 1.11 : 1.03;
  }

  private applyGraphicsSettings() {
    const isTrackView = this.screen !== 'garage' && this.screen !== 'drivers' && this.screen !== 'podium';
    this.renderer.toneMappingExposure = isTrackView ? this.curExposure : this.getHdrExposureBase();
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      return;
    }
    const q = this.settings.graphicsQuality;
    const isTopTier = q === 'ultra_8k' || q === 'extreme' || q === 'cinematic';
    const ps5Mode = this.settings.ps5GraphicsMode ?? 'rt_pro';
    const rtQual =
      this.settings.rayTracingQuality ??
      (isTopTier ? 'cinematic' : q === 'ultra' ? 'ultra' : q === 'high' ? 'high' : 'off');
    const pssrOn = this.settings.pssrUpscaling !== false;
    const hdrMode = this.settings.hdrMode ?? 'hdr10';
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);

    // Support true 4K/8K supersampled rendering on Ultra 8K / Extreme / Ultra / Cinematic modes
    const dpr4k = Math.min(3.5, Math.max(window.devicePixelRatio || 1, Math.min(3840 / w, 2160 / h)));
    const modeScale = ps5Mode === 'performance' ? 0.85 : ps5Mode === 'rt_pro' ? 1.05 : ps5Mode === 'cinematic' ? 1.25 : 1.0;

    let basePr: number;
    if (this.settings.resolutionScale !== undefined && this.settings.resolutionScale > 0) {
      // Direct render scale multiplier (e.g. 2.0 = 200% Render quality)
      basePr = (window.devicePixelRatio || 1) * this.settings.resolutionScale * this.adaptiveDprScale;
    } else {
      basePr =
        q === 'low'
          ? 0.75
          : q === 'medium'
            ? 1.0
            : q === 'high'
              ? Math.min(window.devicePixelRatio || 1, 1.65) * modeScale
              : q === 'ultra_8k'
                ? dpr4k * 1.65 * this.adaptiveDprScale * modeScale
                : q === 'extreme'
                  ? dpr4k * 1.5 * this.adaptiveDprScale * modeScale
                  : q === 'cinematic'
                    ? dpr4k * 1.35 * this.adaptiveDprScale * modeScale
                    : dpr4k * this.adaptiveDprScale * modeScale;
    }
    const targetPr = THREE.MathUtils.clamp(basePr, 0.75, 4.0);
    this.renderer.setPixelRatio(targetPr);
    if (this.composer) {
      this.composer.setPixelRatio(targetPr);
    }

    const shadowSetting =
      this.settings.shadowQuality ??
      (q === 'low' ? 'off' : q === 'medium' ? 'medium' : q === 'high' ? 'high' : isTopTier ? 'cinematic' : 'ultra');
    const shadowsOn = shadowSetting !== 'off';
    this.renderer.shadowMap.enabled = shadowsOn;
    this.sunLight.castShadow = shadowsOn;
    if (shadowsOn) {
      const shadowRes =
        shadowSetting === 'medium'
          ? 1024
          : shadowSetting === 'high'
            ? 2048
            : shadowSetting === 'cinematic' || isTopTier
              ? 8192
              : 4096;
      if (this.sunLight.shadow.mapSize.width !== shadowRes) {
        this.sunLight.shadow.mapSize.set(shadowRes, shadowRes);
        if (this.sunLight.shadow.map) {
          this.sunLight.shadow.map.dispose();
          this.sunLight.shadow.map = null;
        }
      }
    }

    if (this.bloomPass) {
      this.bloomPass.enabled = q !== 'low';
      this.updateBloomPass(0, 'race', true, 0.016);
    }
    const aoSettingGtao = this.settings.ambientOcclusion;
    const gtaoOn =
      !!this.gtaoPass &&
      (isTopTier || q === 'ultra') &&
      aoSettingGtao !== 'off' &&
      aoSettingGtao !== 'low';
    if (this.gtaoPass) {
      this.gtaoPass.enabled = gtaoOn;
      if (gtaoOn) {
        const gtaoSamples = q === 'ultra_8k' ? 24 : q === 'ultra' ? 8 : 16;
        if (gtaoSamples !== this.gtaoSamplesApplied) {
          this.gtaoSamplesApplied = gtaoSamples;
          this.gtaoPass.updateGtaoMaterial({
            radius: q === 'ultra_8k' ? 0.62 : 0.55,
            distanceExponent: 1.0,
            thickness: 1.5,
            scale: 1.0,
            samples: gtaoSamples,
            distanceFallOff: 1.0,
            screenSpaceRadius: false,
          });
        }
        this.gtaoPass.blendIntensity = q === 'ultra' ? 0.85 : 1.0;
      }
    }
    if (this.smaaPass) {
      const aaS = this.settings.antiAliasing;
      this.smaaPass.enabled = aaS !== 'off' && q !== 'low' && q !== 'medium';
    }

    if (this.speedPass) {
      this.speedPass.enabled = q !== 'low';
      const hdrGradeBoost = hdrMode === 'hdr10' ? 0.03 : hdrMode === 'scrgb' ? 0.015 : 0;
      this.speedPass.uniforms['uGradeContrast'].value =
        (q === 'ultra_8k' ? 0.27 : isTopTier ? 0.24 : q === 'ultra' ? 0.18 : q === 'high' ? 0.14 : 0.08) + hdrGradeBoost;

      const aoSetting = this.settings.ambientOcclusion;
      const aoVal =
        aoSetting === 'off'
          ? 0.0
          : aoSetting === 'low'
            ? 0.16
            : aoSetting === 'medium'
              ? 0.28
              : aoSetting === 'high'
                ? 0.44
                : aoSetting === 'ultra'
                  ? 0.64
                  : q === 'ultra_8k' || q === 'extreme'
                    ? 0.62
                    : rtQual === 'cinematic'
                      ? 0.48
                      : rtQual === 'ultra'
                        ? 0.38
                        : rtQual === 'high'
                          ? 0.26
                          : rtQual === 'medium'
                            ? 0.14
                            : 0.0;
      // The old luma-cavity AO is dialled back when real GTAO is active to avoid double-darkening
      this.speedPass.uniforms['uAoStrength'].value = gtaoOn ? aoVal * 0.35 : aoVal;

      const aaSetting = this.settings.antiAliasing;
      const sharpVal =
        aaSetting === 'off'
          ? 0.0
          : aaSetting === 'fxaa'
            ? 0.18
            : aaSetting === 'smaa'
              ? 0.30
              : aaSetting === 'high'
                ? q === 'ultra_8k'
                  ? 0.56
                  : 0.48
                : pssrOn
                  ? q === 'ultra_8k'
                    ? 0.56
                    : q === 'extreme'
                      ? 0.48
                      : q === 'cinematic'
                        ? 0.42
                        : q === 'ultra'
                          ? 0.34
                          : q === 'high'
                            ? 0.22
                            : 0.12
                  : 0.0;
      this.speedPass.uniforms['uSharpness'].value = sharpVal;

      (this.speedPass.uniforms['uTexelSize'].value as THREE.Vector2).set(
        1 / Math.max(1, w * targetPr),
        1 / Math.max(1, h * targetPr)
      );

      const mbSetting =
        this.settings.motionBlurLevel ??
        (this.settings.motionBlur ? (isTopTier ? 'cinematic' : 'medium') : 'off');
      if (!this.speedPass.enabled || mbSetting === 'off' || !this.settings.motionBlur) {
        this.speedPass.uniforms['uIntensity'].value = 0;
      }
      if (!this.speedPass.enabled) {
        this.speedPass.uniforms['uHeatDistort'].value = 0;
        this.speedPass.uniforms['uWetness'].value = 0;
        this.speedPass.uniforms['uVolumetric'].value = 0;
        this.speedPass.uniforms['uAoStrength'].value = 0;
        this.speedPass.uniforms['uSharpness'].value = 0;
        this.speedPass.uniforms['uPaletteMix'].value = 0;
      } else {
        const codeMode = this.settings.graphicsColorCode ?? 'palette_lut';
        const codeProfile = GRAPHICS_COLOR_CODE_PROFILES[codeMode];
        const codeMix =
          codeMode === 'standard'
            ? 0
            : (this.settings.graphicsColorCodeIntensity ?? codeProfile.defaultMix);
        this.speedPass.uniforms['uPaletteMix'].value = codeMix;
        (this.speedPass.uniforms['uCodeShadow'].value as THREE.Vector3).set(...codeProfile.shadowTint);
        (this.speedPass.uniforms['uCodeMid'].value as THREE.Vector3).set(...codeProfile.midtoneTint);
        (this.speedPass.uniforms['uCodeHighlight'].value as THREE.Vector3).set(...codeProfile.highlightTint);
        (this.speedPass.uniforms['uCodeAccentWarm'].value as THREE.Vector3).set(...codeProfile.accentWarm);
        (this.speedPass.uniforms['uCodeAccentCool'].value as THREE.Vector3).set(...codeProfile.accentCool);
      }
    }
    if (this.bokehPass && (q === 'low' || q === 'medium')) {
      this.bokehPass.enabled = false;
    }

    const refSetting =
      this.settings.reflectionQuality ??
      (isTopTier || q === 'ultra' ? 'cinematic' : q === 'high' ? 'high' : 'off');
    if (refSetting === 'off' || rtQual === 'off') {
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
    const effTod = this.getEffectiveLiveTimeOfDay(w);
    const todProf = getTimeOfDayProfile(effTod);
    const wProf = getWeatherAtmosphereProfile(w);
    const weatherAtten =
      w === 'heavy_rain' ? 0.0 : w === 'rain' ? 0.08 : w === 'fog' ? 0.22 : w === 'cloudy' ? 0.25 : 1.0;
    const baseStrength = todProf.volumetricStrength * weatherAtten * wProf.sunDim;
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

    const envCfg = getCircuitEnvironmentConfig(this.currentTrack);
    const tint = this.speedPass.uniforms['uSunTint'].value as THREE.Vector3;
    _hdrSunCol
      .setHex(envCfg.lighting.sunColorHex)
      .lerp(_hdrKelvinCol.setHex(kelvinToHex(envCfg.lighting.sunColorTempK)), 0.3)
      .lerp(_weatherCol.setHex(todProf.sunHex), effTod === 'sunset' || effTod === 'golden_hour' ? 0.65 : 0.35);
    tint.set(_hdrSunCol.r, _hdrSunCol.g, _hdrSunCol.b);

    const qScale =
      q === 'ultra_8k' ? 1.72 : q === 'extreme' ? 1.55 : q === 'cinematic' ? 1.45 : q === 'ultra' ? 1.08 : q === 'high' ? 0.78 : 0.35;
    this.speedPass.uniforms['uVolumetric'].value = baseStrength * alignment * alignment * qScale;
  }

  private updateHeroReflections(force = false) {
    if (this.isSoftwareGl || !this.heroCubeCamera || !this.heroCubeTarget) return;
    const player = this.racers.find((r) => r.isPlayer);
    if (!player) return;
    const rtQual = this.settings.rayTracingQuality ?? 'cinematic';
    if (this.settings.graphicsQuality === 'low' || rtQual === 'off') {
      for (let i = 0; i < this.racers.length; i++) {
        this.racers[i].model.setBodyEnvMap(null);
      }
      return;
    }
    this.cubeFrameCounter++;
    const adaptiveStride = this.adaptiveDprScale < 0.82 ? 2 : this.adaptiveDprScale < 0.92 ? 1 : 0;
    const interval = Math.min(
      6,
      (rtQual === 'cinematic' ||
      this.settings.graphicsQuality === 'ultra_8k' ||
      this.settings.graphicsQuality === 'extreme'
        ? 1
        : rtQual === 'ultra'
          ? 2
          : rtQual === 'high'
            ? 3
            : 5) + adaptiveStride
    );
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
    const allowed = enabled && (q === 'high' || q === 'ultra' || q === 'cinematic' || q === 'extreme' || q === 'ultra_8k');
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
    snap = false,
    dt = 0.016
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

    let targetStrength =
      q === 'ultra_8k' ? 0.88 : q === 'extreme' ? 0.82 : q === 'cinematic' ? 0.76 : q === 'ultra' ? 0.64 : q === 'high' ? 0.52 : 0.36;
    let targetRadius =
      q === 'ultra_8k' ? 0.88 : q === 'extreme' ? 0.85 : q === 'cinematic' ? 0.82 : q === 'ultra' ? 0.74 : q === 'high' ? 0.64 : 0.52;
    let targetThreshold =
      q === 'ultra_8k' ? 0.66 : q === 'extreme' ? 0.68 : q === 'cinematic' ? 0.70 : q === 'ultra' ? 0.75 : q === 'high' ? 0.79 : 0.83;

    // Realistic eye-adaptation simulation between tunnels / shaded areas and bright sunlight
    let targetEyeAdaptation = 1.0;
    if (context === 'race') {
      const player = this.racers[0];
      const isTunnelOrShade = player && (
        (this.currentTrack.biome === 'monaco' && player.closestIdx >= 22 && player.closestIdx <= 32) ||
        player.position.y < -1.2 ||
        (this.liveTimeOfDay === 'night' && player.position.y < 2.0)
      );
      targetEyeAdaptation = isTunnelOrShade ? 1.65 : (this.liveTimeOfDay === 'midday' ? 0.82 : 1.0);
    } else if (context === 'showroom') {
      targetEyeAdaptation = 1.12;
    } else if (context === 'podium') {
      targetEyeAdaptation = 0.95;
    }

    const adaptAlpha = snap ? 1.0 : Math.min(1.0, dt * 4.2);
    this.smoothEyeAdaptation += (targetEyeAdaptation - this.smoothEyeAdaptation) * adaptAlpha;

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
      const envCfg = getCircuitEnvironmentConfig(this.currentTrack);
      targetStrength +=
        hdrBoost +
        envCfg.reflection.bloomBias +
        THREE.MathUtils.clamp(boostFactor, 0, 1.2) * 0.16;
      targetRadius += THREE.MathUtils.clamp(boostFactor, 0, 1.2) * 0.06;
    }

    // Apply eye adaptation scaling (pupil dilation in shade/tunnels vs constriction in bright sun)
    targetStrength *= this.smoothEyeAdaptation;
    targetThreshold = THREE.MathUtils.clamp(targetThreshold / Math.max(0.4, this.smoothEyeAdaptation * 0.7 + 0.3), 0.45, 0.92);

    targetStrength = THREE.MathUtils.clamp(targetStrength, 0.2, 1.25);
    targetRadius = THREE.MathUtils.clamp(targetRadius, 0.35, 0.92);

    const alpha = snap ? 1.0 : 0.14;
    this.smoothBloomStrength += (targetStrength - this.smoothBloomStrength) * alpha;
    this.smoothBloomRadius += (targetRadius - this.smoothBloomRadius) * alpha;
    this.smoothBloomThreshold += (targetThreshold - this.smoothBloomThreshold) * alpha;

    this.bloomPass.strength = this.smoothBloomStrength;
    this.bloomPass.radius = this.smoothBloomRadius;
    this.bloomPass.threshold = this.smoothBloomThreshold;
  }

  private buildPitCrewSquad(): THREE.Group {
    const group = new THREE.Group();
    const suitMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.65 });
    const vestMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2, metalness: 0.5 });
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
    const jackMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.7, roughness: 0.3 });
    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x151820, roughness: 0.85 });
    const signMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, metalness: 0.2 });

    // Front Jack
    this.frontJackGroup = new THREE.Group();
    this.frontJackGroup.position.set(0, 0, -2.2);
    const fJackBase = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.9), jackMat);
    fJackBase.position.y = 0.14;
    this.frontJackGroup.add(fJackBase);
    const fJackLever = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), jackMat);
    fJackLever.rotation.x = Math.PI / 4;
    fJackLever.position.set(0, 0.6, -0.4);
    this.frontJackGroup.add(fJackLever);
    const fJackMech = new THREE.Group();
    const fBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.75, 4, 8), suitMat);
    fBody.position.y = 0.65;
    fJackMech.add(fBody);
    const fVest = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 8), vestMat);
    fVest.position.y = 0.65;
    fJackMech.add(fVest);
    const fHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), helmetMat);
    fHead.position.y = 1.25;
    fJackMech.add(fHead);
    fJackMech.position.set(0, 0, -0.65);
    this.frontJackGroup.add(fJackMech);
    group.add(this.frontJackGroup);

    // Rear Jack
    this.rearJackGroup = new THREE.Group();
    this.rearJackGroup.position.set(0, 0, 2.3);
    const rJackBase = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.9), jackMat);
    rJackBase.position.y = 0.14;
    this.rearJackGroup.add(rJackBase);
    const rJackLever = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), jackMat);
    rJackLever.rotation.x = -Math.PI / 4;
    rJackLever.position.set(0, 0.6, 0.4);
    this.rearJackGroup.add(rJackLever);
    const rJackMech = new THREE.Group();
    const rBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.75, 4, 8), suitMat);
    rBody.position.y = 0.65;
    rJackMech.add(rBody);
    const rVest = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 8), vestMat);
    rVest.position.y = 0.65;
    rJackMech.add(rVest);
    const rHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), helmetMat);
    rHead.position.y = 1.25;
    rJackMech.add(rHead);
    rJackMech.position.set(0, 0, 0.65);
    this.rearJackGroup.add(rJackMech);
    group.add(this.rearJackGroup);

    // 4 Wheel Changers + Spare Tyres
    this.wheelChangerGroups = [];
    this.tyreGunMeshes = [];
    this.spareTyresMeshes = [];

    const wheelPositions = [
      { x: -1.05, z: -1.6, side: 'left' },
      { x: 1.05, z: -1.6, side: 'right' },
      { x: -1.05, z: 1.5, side: 'left' },
      { x: 1.05, z: 1.5, side: 'right' },
    ];

    wheelPositions.forEach((pos) => {
      const changer = new THREE.Group();
      changer.position.set(pos.x, 0, pos.z);

      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.75, 4, 8), suitMat);
      body.position.y = 0.65;
      changer.add(body);
      const vest = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 8), vestMat);
      vest.position.y = 0.65;
      changer.add(vest);
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), helmetMat);
      helmet.position.y = 1.25;
      changer.add(helmet);

      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 8), gunMat);
      gun.rotation.x = Math.PI / 2;
      gun.position.set(pos.side === 'left' ? 0.35 : -0.35, 0.65, -0.15);
      changer.add(gun);
      this.tyreGunMeshes.push(gun);

      const spareTyre = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.32, 16), tyreMat);
      spareTyre.rotation.z = Math.PI / 2;
      spareTyre.position.set(pos.side === 'left' ? -0.7 : 0.7, 0.34, 0.2);
      changer.add(spareTyre);
      this.spareTyresMeshes.push(spareTyre);

      group.add(changer);
      this.wheelChangerGroups.push(changer);
    });

    // Fuel Rig Operator
    this.fuelOperatorGroup = new THREE.Group();
    this.fuelOperatorGroup.position.set(1.3, 0, -0.2);
    const fBodyOp = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.75, 4, 8), suitMat);
    fBodyOp.position.y = 0.65;
    this.fuelOperatorGroup.add(fBodyOp);
    const fVestOp = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 8), vestMat);
    fVestOp.position.y = 0.65;
    this.fuelOperatorGroup.add(fVestOp);
    const fHeadOp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), helmetMat);
    fHeadOp.position.y = 1.25;
    this.fuelOperatorGroup.add(fHeadOp);

    const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), hoseMat);
    hose.rotation.z = Math.PI / 2;
    hose.position.set(-0.65, 0.85, 0);
    this.fuelOperatorGroup.add(hose);
    this.fuelHoseMesh = hose;
    group.add(this.fuelOperatorGroup);

    // Lollipop Man
    this.lollipopGroup = new THREE.Group();
    this.lollipopGroup.position.set(-0.6, 0, -3.5);
    const lBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.75, 4, 8), suitMat);
    lBody.position.y = 0.65;
    this.lollipopGroup.add(lBody);
    const lVest = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 8), vestMat);
    lVest.position.y = 0.65;
    this.lollipopGroup.add(lVest);
    const lHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), helmetMat);
    lHead.position.y = 1.25;
    this.lollipopGroup.add(lHead);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8), gunMat);
    pole.position.set(0.35, 1.1, 0);
    this.lollipopGroup.add(pole);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.1), signMat);
    sign.position.set(0.35, 2.1, 0);
    this.lollipopGroup.add(sign);
    group.add(this.lollipopGroup);

    group.visible = false;
    return group;
  }

  private animatePitCrew(progress: number, dt: number) {
    const t = performance.now() * 0.015;

    if (this.frontJackGroup) {
      this.frontJackGroup.rotation.x = progress < 0.2 ? THREE.MathUtils.lerp(0, 0.25, progress / 0.2) : progress > 0.75 ? THREE.MathUtils.lerp(0.25, 0, (progress - 0.75) / 0.25) : 0.25;
    }
    if (this.rearJackGroup) {
      this.rearJackGroup.rotation.x = progress < 0.2 ? THREE.MathUtils.lerp(0, -0.25, progress / 0.2) : progress > 0.75 ? THREE.MathUtils.lerp(-0.25, 0, (progress - 0.75) / 0.25) : -0.25;
    }

    this.tyreGunMeshes.forEach((gun, idx) => {
      if (progress >= 0.2 && progress <= 0.78) {
        gun.rotation.y += dt * 32 * (idx % 2 === 0 ? 1 : -1);
      }
    });

    this.spareTyresMeshes.forEach((spare, idx) => {
      if (progress >= 0.2 && progress <= 0.78) {
        spare.position.y = 0.34 + Math.sin(t * 3 + idx) * 0.05;
      }
    });

    if (this.fuelHoseMesh) {
      const activeHose = progress >= 0.15 && progress <= 0.72;
      this.fuelHoseMesh.visible = activeHose;
      if (activeHose) {
        this.fuelHoseMesh.scale.set(1, 1 + Math.sin(t * 4) * 0.08, 1);
      }
    }

    if (this.lollipopGroup) {
      this.lollipopGroup.rotation.y = progress > 0.88 ? 0.35 : 0;
    }
  }

  private computeSunOffset(out: THREE.Vector3, radius = 135) {
    const envCfg = getCircuitEnvironmentConfig(this.currentTrack);
    const effTod = this.getEffectiveLiveTimeOfDay();
    const todProf = getTimeOfDayProfile(effTod);
    const isDynamic = this.settings.dynamicTimeOfDay || this.isDynamicWeatherEnabled();

    let azDeg: number;
    let elDeg: number;

    if (isDynamic) {
      // Continuous 24h orbital solar & lunar transit
      // Sweeps smoothly: morning (low east) -> noon (high peak) -> sunset (low west) -> night (moon rise)
      const sunPhase = this.timeOfDayProgress * Math.PI * 1.35;
      const baseEl = Math.sin(sunPhase) * 64.0;
      if (baseEl < 2.0) {
        // Night: directional light acts as lunar illumination from opposite horizon
        elDeg = Math.max(14.0, 28.0 - baseEl * 0.4);
        azDeg = envCfg.lighting.sunAzimuthDeg + 180.0 + (this.timeOfDayProgress - 0.75) * 55.0;
      } else {
        elDeg = Math.max(3.5, baseEl + envCfg.lighting.sunElevationOffsetDeg);
        azDeg = envCfg.lighting.sunAzimuthDeg + (this.timeOfDayProgress - 0.25) * 115.0;
      }
    } else {
      const dynamicShift = (this.timeOfDayProgress - 0.35) * 42;
      azDeg = envCfg.lighting.sunAzimuthDeg + todProf.azimuthShiftDeg + dynamicShift;
      elDeg = Math.max(7, todProf.elevationDeg + envCfg.lighting.sunElevationOffsetDeg);
    }

    const azRad = THREE.MathUtils.degToRad(azDeg);
    const elRad = THREE.MathUtils.degToRad(elDeg);
    const horiz = Math.cos(elRad) * radius;
    out.set(Math.cos(azRad) * horiz, Math.sin(elRad) * radius, Math.sin(azRad) * horiz);
  }

  private updateSunAndRimRig(focusX: number, focusY: number, focusZ: number, radius = 135) {
    this.computeSunOffset(_vecA, radius);
    this.sunLight.position.set(focusX + _vecA.x, focusY + _vecA.y, focusZ + _vecA.z);
    this.sunLight.target.position.set(focusX, focusY, focusZ);
    // Physically opposed atmospheric rim / architectural skyline bounce light
    this.rimLight.position.set(
      focusX - _vecA.x * 0.72,
      focusY + Math.max(24, _vecA.y * 0.42 + 22),
      focusZ - _vecA.z * 0.72
    );
    this.rimLight.target.position.set(focusX, focusY, focusZ);
  }

  private updateEnvironment(mode: WeatherMode | 'garage') {
    const envCfg = getCircuitEnvironmentConfig(this.currentTrack);
    const effTod = mode === 'garage' ? 'night' : this.getEffectiveLiveTimeOfDay(mode);
    const envKey =
      mode === 'garage'
        ? 'garage'
        : `${mode}_${effTod}_${envCfg.biome}_${envCfg.reflection.hdrSignature}`;
    if (this.activeEnvMode === envKey) return;
    this.activeEnvMode = envKey;

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    let nextTex: THREE.Texture;

    if (mode === 'garage') {
      pmremGenerator.compileEquirectangularShader();
      nextTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 1.05;
    } else {
      pmremGenerator.compileEquirectangularShader();
      const todProf = getTimeOfDayProfile(effTod);
      const wProf = getWeatherAtmosphereProfile(mode);
      const isNight = effTod === 'night' || mode === 'night';
      const isRain = mode === 'rain' || mode === 'heavy_rain';
      const isSunset = effTod === 'sunset' || effTod === 'golden_hour' || mode === 'sunset';
      const isCloudyOrFog = mode === 'cloudy' || mode === 'fog';

      const refl = envCfg.reflection;
      const sig = refl.hdrSignature;

      _hdrSkyReflectCol.setHex(refl.skyHex);
      _hdrZenithCol
        .setHex(envCfg.sky.zenithHex)
        .lerp(_hdrSkyReflectCol, 0.35)
        .lerp(_hdrOverCol.setHex(todProf.zenithBlendHex), isNight ? 0.92 : isSunset ? 0.72 : 0.28);

      _hdrHorizonStripCol.setHex(refl.horizonStripHex);
      _hdrHorizonCol
        .setHex(envCfg.sky.horizonHex)
        .lerp(_hdrHorizonStripCol, isNight ? 0.42 : isSunset ? 0.48 : 0.24)
        .lerp(_hdrOverCol.setHex(todProf.horizonBlendHex), isNight ? 0.9 : isSunset ? 0.7 : 0.28);

      _hdrGroundCol.setHex(refl.groundHex);
      _hdrBounceCol.setHex(refl.bounceFloorHex);
      if (isNight) {
        _hdrGroundCol.lerp(_hdrOverCol.setHex(0x0b0f18), 0.72);
        _hdrBounceCol.lerp(_hdrOverCol.setHex(0x070a12), 0.75);
      } else if (isRain) {
        _hdrGroundCol.lerp(_hdrOverCol.setHex(0x1e293b), 0.52);
        _hdrBounceCol.lerp(_hdrOverCol.setHex(0x111827), 0.58);
      } else if (isSunset) {
        _hdrGroundCol.lerp(_hdrHorizonStripCol, 0.28);
        _hdrBounceCol.lerp(_hdrOverCol.setHex(0x2d1a12), 0.32);
      }

      if (isCloudyOrFog || isRain) {
        _hdrOverCol.setHex(isRain ? 0x263244 : 0x8d9db2);
        _hdrZenithCol.lerp(_hdrOverCol, isNight ? 0.35 : 0.72);
        _hdrHorizonCol.lerp(_hdrOverCol, isNight ? 0.35 : 0.78);
      }

      _hdrKelvinCol.setHex(kelvinToHex(envCfg.lighting.sunColorTempK));
      _hdrSunCol
        .setHex(isSunset ? 0xff9a3c : isNight ? envCfg.lighting.nightFloodlightColor : envCfg.lighting.sunColorHex)
        .lerp(_hdrKelvinCol, isNight ? 0.15 : 0.35);

      _hdrKeyPanelCol.setHex(refl.keyPanelHex);
      _hdrRimPanelCol.setHex(refl.rimPanelHex);
      _hdrAccentNeonCol.setHex(envCfg.trackside.ledRibbonHex);
      _hdrSecondaryNeonCol.setHex(envCfg.trackside.ledSecondaryHex);

      // Compute normalized circuit sun direction + opposed rim vector
      this.computeSunOffset(_vecA, 1);
      _vecA.normalize();
      _hdrOppositeDir.set(-_vecA.x, Math.max(0.22, _vecA.y * 0.5 + 0.15), -_vecA.z).normalize();

      // Procedural Float32 RGBA HDR Equirectangular Light Probe (1024x512 GPU / 256x128 SoftwareGL)
      const w = this.isSoftwareGl ? 256 : 1024;
      const h = this.isSoftwareGl ? 128 : 512;
      const data = new Float32Array(w * h * 4);

      const skyLum = refl.hdrSkyLuminance * (isNight ? 0.78 : isRain ? 0.72 : 1.0);
      const sunRadiance =
        refl.hdrSunRadiance * (isNight ? 0.04 : isRain ? 0.14 : isCloudyOrFog ? 0.32 : isSunset ? 0.85 : 1.0) * wProf.sunDim;
      const keyGlow =
        refl.hdrKeyPanelGlow * (isNight ? 0.65 : isRain ? 0.45 : isCloudyOrFog ? 0.58 : 1.0) * wProf.sunDim;
      const rimGlow = refl.hdrRimPanelGlow * (isNight ? 1.15 : isRain ? 0.78 : 1.0) * wProf.rimDim;
      const horizonGlow = refl.hdrHorizonGlow * (isNight ? 0.92 : isSunset ? 1.25 : 0.75);
      const groundBounce = refl.hdrGroundBounce * (isNight ? 0.55 : isRain ? 0.82 : 1.0);
      const floodStrength = isNight
        ? envCfg.lighting.alwaysFloodlitAtNightOrDusk
          ? 7.2
          : 4.0
        : isSunset && envCfg.lighting.alwaysFloodlitAtNightOrDusk
          ? 2.8
          : 0.0;

      const hasWater = envCfg.water.enabled;
      if (hasWater) {
        _hdrWaterCol.setHex(envCfg.water.colorHex);
      }

      const isUrbanNeon = sig === 'neon_skyline' || sig === 'desert_neon' || sig === 'marina_twilight' || sig === 'lusail_floodlit';
      const isDesert = sig === 'desert_dunes' || sig === 'lusail_floodlit';
      const isSnowPeaks = sig === 'alpine_snow' || sig === 'sakura_mountain';
      const isOvercast = sig === 'overcast_countryside' || sig === 'misty_forest';

      const addScaledColor = (dst: THREE.Color, src: THREE.Color, scale: number) => {
        if (scale <= 0) return;
        dst.r += src.r * scale;
        dst.g += src.g * scale;
        dst.b += src.b * scale;
      };

      for (let y = 0; y < h; y++) {
        const v = (y + 0.5) / h; // 0 = nadir, 1 = zenith
        const phi = (v - 0.5) * Math.PI;
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);

        for (let x = 0; x < w; x++) {
          const u = (x + 0.5) / w;
          const theta = u * Math.PI * 2;
          _hdrDir.set(cosPhi * Math.cos(theta), sinPhi, cosPhi * Math.sin(theta));

          if (sinPhi >= 0) {
            const skyBlend = Math.pow(1.0 - sinPhi, isDesert ? 1.85 : 2.15);
            _hdrPixel.copy(_hdrZenithCol).lerp(_hdrHorizonCol, skyBlend).multiplyScalar(skyLum);

            // Azimuthal horizon glow strip (location-specific coastal/skyline/desert band)
            const horizonMask = Math.exp(-Math.pow(sinPhi * 7.2, 2.0));
            addScaledColor(_hdrPixel, _hdrHorizonStripCol, horizonMask * horizonGlow * 0.42);

            // Cloud softbox bounce patterns tailored to biome
            const cloudFreq = isOvercast ? 3.5 : 5.5;
            const cloudWave =
              0.5 +
              0.5 *
                Math.sin(theta * cloudFreq + sinPhi * 7.0) *
                Math.cos(theta * (cloudFreq - 2.0) - sinPhi * 5.0);
            const cloudGain = (isNight ? 0.08 : isOvercast ? 0.32 : 0.44) * cloudWave * (1.0 - sinPhi * 0.42);
            _hdrPixel.multiplyScalar(1.0 + cloudGain);

            // HDR Solar Core + Mie Aureole + Location Key Softbox Panel
            const sunDot = Math.max(0, _hdrDir.dot(_vecA));
            const aureole = Math.pow(sunDot, isDesert ? 6.0 : 10.0) * (isRain ? 0.45 : 1.75) * wProf.sunDim;
            const core = Math.pow(sunDot, 280.0) * sunRadiance;
            addScaledColor(_hdrPixel, _hdrSunCol, aureole + core);

            const keyLobe = Math.pow(sunDot, 16.0) * keyGlow * 0.48;
            addScaledColor(_hdrPixel, _hdrKeyPanelCol, keyLobe);

            // Opposing Atmospheric Rim / Architectural Bounce Lobe
            const rimDot = Math.max(0, _hdrDir.dot(_hdrOppositeDir));
            const rimLobe = Math.pow(rimDot, 5.0) * rimGlow * 0.42;
            addScaledColor(_hdrPixel, _hdrRimPanelCol, rimLobe);

            // Alpine / Suzuka snow peak reflection band near lower sky horizon
            if (isSnowPeaks && sinPhi < 0.2) {
              const peakProfile = 0.5 + 0.5 * Math.sin(theta * 5.0 + 0.7) * Math.cos(theta * 3.0);
              const snowMask = Math.exp(-Math.pow((sinPhi - 0.06 * peakProfile) * 18.0, 2.0));
              addScaledColor(_hdrPixel, _hdrSnowCol, snowMask * (isNight ? 0.18 : 0.65));
            }

            // Urban Skyline Neon Columns, Searchlights & Floodlight Towers
            if (isUrbanNeon || floodStrength > 0) {
              if (sinPhi < 0.42) {
                const towerEnv = Math.exp(-Math.pow((sinPhi - 0.13) * 8.5, 2.0));
                if (floodStrength > 0) {
                  const lightPods = Math.pow(Math.max(0, Math.sin(theta * (isDesert ? 8.0 : 6.0))), 18.0);
                  addScaledColor(_hdrPixel, _hdrSunCol, towerEnv * lightPods * floodStrength);
                }
                if (isUrbanNeon) {
                  const skylineRibbons = Math.pow(Math.max(0, Math.cos(theta * 7.0 + 0.4)), 8.0);
                  const windowBands = 0.55 + 0.45 * Math.sin(sinPhi * 90.0);
                  const urbanScale = (isNight ? 2.4 : isSunset ? 1.15 : 0.35) * towerEnv * skylineRibbons * windowBands;
                  addScaledColor(_hdrPixel, _hdrAccentNeonCol, urbanScale);
                  addScaledColor(
                    _hdrPixel,
                    _hdrSecondaryNeonCol,
                    Math.pow(Math.max(0, Math.sin(theta * 5.0 - 1.1)), 10.0) * (isNight ? 1.85 : 0.65) * towerEnv
                  );
                }
              }
              // Las Vegas Strip vertical skyward searchlight beams
              if (sig === 'desert_neon' && isNight && sinPhi > 0.06 && sinPhi < 0.85) {
                const beamMask = Math.pow(Math.max(0, Math.cos(theta * 4.0 + 0.3)), 44.0) * (1.0 - sinPhi * 0.75);
                addScaledColor(_hdrPixel, _hdrKeyPanelCol, beamMask * 3.4);
              }
            }
          } else {
            // Lower Hemisphere: Ground Albedo, Track Bounce Floor, Harbor/Lake & Rain Specular
            const absSin = -sinPhi;
            const gBlend = Math.pow(1.0 - Math.min(1, absSin * 1.35), 1.5);
            _hdrPixel
              .copy(_hdrBounceCol)
              .lerp(_hdrGroundCol, gBlend * 0.85)
              .lerp(_hdrHorizonCol, gBlend * 0.45)
              .multiplyScalar(groundBounce);

            // Water directional specular reflection (Monaco East Harbor, Singapore Marina Bay, Abu Dhabi, Melbourne Lake)
            if (hasWater) {
              const waterSector = envCfg.water.harborEast
                ? Math.max(0, Math.cos(theta))
                : 0.75;
              const waterBlend = (0.35 + 0.45 * gBlend) * (0.4 + 0.6 * waterSector);
              _hdrPixel.lerp(_hdrWaterCol, waterBlend * (isNight ? 0.55 : 0.85));
              const glint = Math.pow(Math.max(0, _hdrDir.x * _vecA.x + _hdrDir.z * _vecA.z), 10.0) * gBlend;
              addScaledColor(
                _hdrPixel,
                _hdrKeyPanelCol,
                glint * refl.waterSpecularBoost * (isNight ? 0.9 : 1.6) * waterSector
              );
            }

            // Wet Rain-Slick Lower Asphalt Fresnel Mirror Reflection
            if (isRain) {
              const fresnel = Math.pow(1.0 - absSin, 2.2) * (mode === 'heavy_rain' ? 0.65 : 0.45);
              addScaledColor(_hdrPixel, _hdrHorizonStripCol, fresnel * 0.6);
              addScaledColor(_hdrPixel, _hdrAccentNeonCol, fresnel * (isNight ? 0.7 : 0.2));
            } else if (isNight) {
              addScaledColor(_hdrPixel, _hdrAccentNeonCol, gBlend * 0.22);
            }
          }

          const idx = (y * w + x) * 4;
          data[idx] = _hdrPixel.r;
          data[idx + 1] = _hdrPixel.g;
          data[idx + 2] = _hdrPixel.b;
          data[idx + 3] = 1.0;
        }
      }

      const equirectTex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
      equirectTex.mapping = THREE.EquirectangularReflectionMapping;
      equirectTex.colorSpace = THREE.LinearSRGBColorSpace;
      equirectTex.magFilter = THREE.LinearFilter;
      equirectTex.minFilter = THREE.LinearFilter;
      equirectTex.needsUpdate = true;

      nextTex = pmremGenerator.fromEquirectangular(equirectTex).texture;
      equirectTex.dispose();
    }

    pmremGenerator.dispose();
    if (this.envTexture) this.envTexture.dispose();
    this.envTexture = nextTex;
    this.scene.environment = nextTex;
  }

  private getAtmosphereTarget(weather: WeatherMode) {
    const envCfg = getCircuitEnvironmentConfig(this.currentTrack);
    const effTod = this.getEffectiveLiveTimeOfDay(weather);
    const todProf = getTimeOfDayProfile(effTod);
    const wProf = getWeatherAtmosphereProfile(weather);

    const isNight = effTod === 'night' || weather === 'night';
    const isSunset = effTod === 'sunset' || effTod === 'golden_hour' || weather === 'sunset';

    // Blend circuit sky zenith/horizon with time-of-day sky curves
    const todBlendWeight =
      effTod === 'night'
        ? 0.92
        : effTod === 'sunset'
          ? 0.78
          : effTod === 'golden_hour'
            ? 0.56
            : effTod === 'morning'
              ? 0.35
              : 0.22;

    const skyColor = new THREE.Color(envCfg.sky.zenithHex).lerp(
      new THREE.Color(todProf.zenithBlendHex),
      todBlendWeight
    );
    const fogColor = new THREE.Color(envCfg.fog.hex).lerp(
      new THREE.Color(todProf.horizonBlendHex),
      todBlendWeight
    );

    if (wProf.fogOverrideHex !== null) {
      const ovCol = new THREE.Color(wProf.fogOverrideHex);
      skyColor.lerp(ovCol, isNight ? 0.35 : 0.78);
      fogColor.lerp(ovCol, isNight ? 0.42 : 0.85);
    }

    // Physically based solar temperature + circuit sun color + ToD tint
    const sunColor = new THREE.Color(envCfg.lighting.sunColorHex)
      .lerp(new THREE.Color(kelvinToHex(envCfg.lighting.sunColorTempK)), isNight ? 0.15 : 0.32)
      .lerp(new THREE.Color(todProf.sunHex), isNight ? 0.85 : isSunset ? 0.72 : 0.38);

    const hemiSky = new THREE.Color(envCfg.lighting.hemiSkyHex).lerp(
      new THREE.Color(todProf.hemiSkyHex),
      isNight ? 0.82 : isSunset ? 0.65 : 0.42
    );
    const hemiGround = new THREE.Color(envCfg.lighting.hemiGroundHex).lerp(
      new THREE.Color(todProf.hemiGroundHex),
      isNight ? 0.82 : 0.45
    );
    const rimColor = new THREE.Color(envCfg.lighting.rimLightHex).lerp(
      new THREE.Color(envCfg.reflection.rimPanelHex),
      0.42
    );
    if (isSunset) {
      rimColor.lerp(new THREE.Color(envCfg.reflection.horizonStripHex), 0.35);
    } else if (isNight) {
      rimColor.lerp(new THREE.Color(envCfg.trackside.ledRibbonHex), 0.45);
    }

    if (wProf.fogOverrideHex !== null && !isNight) {
      const ovCol = new THREE.Color(wProf.fogOverrideHex);
      hemiSky.lerp(ovCol, 0.55);
      rimColor.lerp(ovCol, 0.48);
    }

    const baseFogDensity = isNight ? 0.0029 : isSunset ? 0.0021 : 0.00175;
    const fogDensity = baseFogDensity * envCfg.fog.densityMult * wProf.fogDensityMult;

    const rimIntensity =
      envCfg.lighting.rimIntensityMult * todProf.rimIntensityMult * wProf.rimDim;
    const envIntensity =
      envCfg.lighting.envIntensity * todProf.reflectionMult * wProf.reflectionMult;
    const exposure =
      this.getHdrExposureBase() * envCfg.lighting.exposureBias * todProf.exposureMult * wProf.exposureMult;

    return {
      skyHex: skyColor.getHex(),
      fogHex: fogColor.getHex(),
      fogDensity,
      sunHex: sunColor.getHex(),
      sunIntensity: todProf.sunIntensity * envCfg.lighting.sunIntensityMult * wProf.sunDim,
      hemiSkyHex: hemiSky.getHex(),
      hemiGroundHex: hemiGround.getHex(),
      hemiIntensity: todProf.hemiIntensity * envCfg.lighting.hemiIntensityMult * wProf.hemiDim,
      rimHex: rimColor.getHex(),
      rimIntensity,
      envIntensity,
      exposure,
      rainOpacity: wProf.rainOpacity,
      rainSize: wProf.rainSize,
      rainAudio: wProf.rainAudio,
    };
  }

  private pushAtmosphereToTrack() {
    if (!this.builtTrack) return;
    const envCfg = getCircuitEnvironmentConfig(this.currentTrack);
    const w = this.liveWeather;
    const effTod = this.getEffectiveLiveTimeOfDay(w);
    const todProf = getTimeOfDayProfile(effTod);
    const wProf = getWeatherAtmosphereProfile(w);

    const cloudCover = THREE.MathUtils.clamp(
      wProf.cloudOverride !== null
        ? Math.max(wProf.cloudOverride, envCfg.sky.baseCloudCover)
        : envCfg.sky.baseCloudCover + wProf.cloudCoverAdd,
      0.04,
      0.98
    );

    _envSunDir.subVectors(this.sunLight.position, this.sunLight.target.position);
    if (_envSunDir.lengthSq() < 0.001) {
      this.computeSunOffset(_envSunDir, 1);
    }
    _envSunDir.normalize();

    _envSkyCol.copy(this.curSkyColor);
    _envFogCol.copy(this.curFogColor);
    _envCityGlowCol.setHex(envCfg.sky.cityGlowHex);
    _envCloudTintCol.setHex(envCfg.sky.cloudTintHex);

    this.builtTrack.updateAtmosphereState({
      sunDir: _envSunDir,
      fogColor: _envFogCol,
      skyColor: _envSkyCol,
      cloudCover,
      rainFactor: wProf.rainFactor,
      sunsetFactor: todProf.sunsetFactor,
      nightFactor: todProf.nightFactor,
      lightningFlash: this.lightningFlash,
      cityGlowColor: _envCityGlowCol,
      cloudTint: _envCloudTintCol,
    });
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
    this.curRimColor.setHex(t.rimHex);
    this.curRimIntensity = t.rimIntensity;
    this.curEnvIntensity = t.envIntensity;
    this.curExposure = t.exposure;
    this.curRainOpacity = t.rainOpacity;
    this.curRainSize = t.rainSize;
    this.curRainAudio = t.rainAudio;

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.curSkyColor);
    } else {
      this.scene.background = this.curSkyColor.clone();
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.curFogColor);
      this.scene.fog.density = this.curFogDensity;
    } else {
      this.scene.fog = new THREE.FogExp2(this.curFogColor.getHex(), this.curFogDensity);
    }

    this.sunLight.color.copy(this.curSunColor);
    this.sunLight.intensity = this.curSunIntensity;
    this.hemiLight.color.copy(this.curHemiSky);
    this.hemiLight.groundColor.copy(this.curHemiGround);
    this.hemiLight.intensity = this.curHemiIntensity;
    this.rimLight.color.copy(this.curRimColor);
    this.rimLight.intensity = this.curRimIntensity;

    const isTrackView = this.screen !== 'garage' && this.screen !== 'drivers' && this.screen !== 'podium';
    if (isTrackView) {
      this.scene.environmentIntensity = this.curEnvIntensity;
      this.renderer.toneMappingExposure = this.curExposure;
    }

    const isSnow = weather === 'snow' || weather === 'blizzard';
    const rainMat = this.rainPoints.material as THREE.PointsMaterial;
    rainMat.opacity = isSnow ? 0 : this.curRainOpacity;
    rainMat.size = this.curRainSize;
    this.rainPoints.visible = isTrackView && !isSnow && this.curRainOpacity > 0.04;

    const snowMat = this.snowPoints.material as THREE.PointsMaterial;
    snowMat.opacity = isSnow ? Math.min(0.95, this.curRainOpacity * 1.35) : 0;
    snowMat.size = weather === 'blizzard' ? 1.2 : 0.85;
    this.snowPoints.visible = isTrackView && isSnow && this.curRainOpacity > 0.04;

    this.audio.setRainLevel(!isTrackView ? 0 : this.curRainAudio);
    this.pushAtmosphereToTrack();
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
          const comingSnow = nextStep.mode === 'snow' || nextStep.mode === 'blizzard';
          this.bannerMessage = comingSnow
            ? `RADAR: ${nextStep.mode === 'blizzard' ? 'BLIZZARD STORM' : 'VOLUMETRIC SNOW'} APPROACHING — REDUCE SPEED & BOX FOR INTERMEDIATE/WETS`
            : comingWet
              ? `RADAR: ${nextStep.mode === 'heavy_rain' ? 'STORM' : 'RAIN'} APPROACHING — PRESS 4 OR B TO BOX FOR WETS`
              : nextStep.mode === 'fog'
                ? 'RADAR: DENSE CIRCUIT MIST & FOG FORMING'
                : nextStep.mode === 'day' || nextStep.mode === 'partly_cloudy'
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
          if (this.liveWeather === 'blizzard') {
            this.bannerMessage = 'WEATHER SHIFT: FREEZING BLIZZARD — EXTREME LOW SURFACE GRIP';
          } else if (this.liveWeather === 'snow') {
            this.bannerMessage = 'WEATHER SHIFT: VOLUMETRIC SNOW FLURRIES — COLD ASPHALT';
          } else if (this.liveWeather === 'heavy_rain') {
            this.bannerMessage = 'WEATHER SHIFT: TORRENTIAL RAIN — STANDING WATER BUILDING';
          } else if (this.liveWeather === 'rain') {
            this.bannerMessage = 'WEATHER SHIFT: RAIN FALLING — WET TYRES ADVISED (4 / B)';
          } else if (this.liveWeather === 'fog') {
            this.bannerMessage = 'WEATHER SHIFT: VISIBILITY DROPPING IN CIRCUIT FOG';
          } else if (this.liveWeather === 'cloudy') {
            this.bannerMessage = 'WEATHER SHIFT: OVERCAST CONDITIONS';
          } else {
            this.bannerMessage = 'WEATHER SHIFT: SUNLIGHT RETURNING — TRACK DRYING';
          }
          this.bannerTimer = 3.4;
          this.updateEnvironment(this.liveWeather);
        }
      }

      const targetWet = getWeatherAtmosphereProfile(this.liveWeather).wetnessTarget;
      const rate =
        targetWet > this.trackWetness
          ? this.liveWeather === 'heavy_rain'
            ? 0.085
            : 0.052
          : this.liveWeather === 'day' || this.liveWeather === 'partly_cloudy'
            ? 0.042
            : 0.018;
      if (this.trackWetness < targetWet) {
        this.trackWetness = Math.min(targetWet, this.trackWetness + rate * dt);
      } else if (this.trackWetness > targetWet) {
        this.trackWetness = Math.max(targetWet, this.trackWetness - rate * dt);
      }
      this.builtTrack?.setSurfaceWetness(this.trackWetness);
    }

    // Thunderstorm lightning flash pulses during heavy_rain
    if (this.liveWeather === 'heavy_rain') {
      this.lightningCooldown -= dt;
      if (this.lightningCooldown <= 0) {
        this.lightningFlash = 0.85 + Math.random() * 0.15;
        this.lightningCooldown = 4.2 + Math.random() * 7.8;
      }
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 5.2);
    } else {
      this.lightningFlash = 0;
    }

    // Smoothly interpolate scene atmosphere toward effective liveWeather + liveTimeOfDay
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
    this.curRimColor.lerp(_weatherCol.setHex(t.rimHex), blend);
    this.curRimIntensity = THREE.MathUtils.lerp(this.curRimIntensity, t.rimIntensity, blend);
    this.curEnvIntensity = THREE.MathUtils.lerp(this.curEnvIntensity, t.envIntensity, blend);
    this.curExposure = THREE.MathUtils.lerp(this.curExposure, t.exposure, blend);
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
    this.sunLight.intensity = this.curSunIntensity + this.lightningFlash * 2.4;
    this.hemiLight.color.copy(this.curHemiSky);
    this.hemiLight.groundColor.copy(this.curHemiGround);
    this.hemiLight.intensity = this.curHemiIntensity + this.lightningFlash * 0.85;
    this.rimLight.color.copy(this.curRimColor);
    this.rimLight.intensity = this.curRimIntensity + this.lightningFlash * 1.1;
    this.scene.environmentIntensity = this.curEnvIntensity + this.lightningFlash * 0.35;
    this.renderer.toneMappingExposure = this.curExposure;

    const isSnow = this.liveWeather === 'snow' || this.liveWeather === 'blizzard';
    const rainMat = this.rainPoints.material as THREE.PointsMaterial;
    rainMat.opacity = isSnow ? 0 : this.curRainOpacity;
    rainMat.size = this.curRainSize;
    this.rainPoints.visible = !isSnow && this.curRainOpacity > 0.04;

    const snowMat = this.snowPoints.material as THREE.PointsMaterial;
    snowMat.opacity = isSnow ? Math.min(0.95, this.curRainOpacity * 1.35) : 0;
    snowMat.size = this.liveWeather === 'blizzard' ? 1.2 : 0.85;
    this.snowPoints.visible = isSnow && this.curRainOpacity > 0.04;

    this.audio.setRainLevel(this.screen === 'playing' ? this.curRainAudio : 0);
    this.pushAtmosphereToTrack();
  }

  private updateDynamicTimeOfDay(dt: number, raceLive: boolean) {
    const isDynamic = this.settings.dynamicTimeOfDay || this.isDynamicWeatherEnabled();
    if (!isDynamic) return;
    const todOrder: TimeOfDayMode[] = ['morning', 'midday', 'afternoon', 'golden_hour', 'sunset', 'night'];
    if (raceLive && this.screen === 'playing') {
      const startTod = this.settings.timeOfDay ?? getCircuitEnvironmentConfig(this.currentTrack).defaultTimeOfDay;
      const startIdx = Math.max(0, todOrder.indexOf(startTod));
      const startFrac = startIdx / (todOrder.length - 1);
      const player = this.racers.find((r) => r.isPlayer);
      if (player) {
        const raceFrac = THREE.MathUtils.clamp(
          player.totalProgress / Math.max(1, this.settings.totalLaps),
          0,
          1
        );
        this.timeOfDayProgress = Math.min(1, startFrac + raceFrac * 0.55);
      } else {
        this.timeOfDayProgress = (this.timeOfDayProgress + dt * 0.008) % 1.0;
      }
      const nextIdx = Math.min(
        todOrder.length - 1,
        Math.floor(this.timeOfDayProgress * (todOrder.length - 0.01))
      );
      const nextTod = todOrder[nextIdx];
      if (nextTod !== this.liveTimeOfDay && this.liveWeather !== 'night' && this.liveWeather !== 'sunset') {
        this.liveTimeOfDay = nextTod;
        this.updateEnvironment(this.liveWeather);
      }
    }
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
    const initRub = this.screen === 'title' ? 0.42 : 0;
    this.trackRubberLevel = initRub;
    this.sectorRubberLevels = [initRub, initRub, initRub];
    this.sectorDepositionAccum = [0, 0, 0];
    this.builtTrack?.setSurfaceRubbering(this.trackRubberLevel, this.sectorRubberLevels);
    this.updateTrackRubberTexture(true);
  }

  private accumulateCarRubberDeposition(car: RacerEntity, dt: number) {
    if (!this.builtTrack || car.finished) return;
    const absSpeed = Math.abs(car.speed);
    if (absSpeed < 10) return;

    const sample = this.builtTrack.samples[car.closestIdx];
    const halfW = this.builtTrack.trackWidth * 0.5;
    const dx = car.position.x - sample.point.x;
    const dz = car.position.z - sample.point.z;
    const latOffset = dx * sample.right.x + dz * sample.right.z;
    const idealOffset = sample.idealLateralOffset ?? 0;
    const distFromLine = Math.abs(latOffset - idealOffset);

    // Dynamic surface deformation particles: shed rubber clag marbles & verge aggregate
    if (distFromLine > 1.75 && absSpeed > 22 && Math.random() < 0.32) {
      this.spawnSurfaceDebris(car, 'marbles', 0.85);
    } else if (Math.abs(latOffset) > halfW - 0.45 && absSpeed > 18 && Math.random() < 0.45) {
      this.spawnSurfaceDebris(car, Math.abs(latOffset) > halfW + 0.15 ? 'gravel' : 'kerb', 1.1);
    }

    // Cars tracking within the racing line corridor lay down heated vulcanized tyre polymer
    const grooveProximity = Math.max(0, 1.0 - distFromLine / Math.max(2.2, halfW * 0.45));
    if (grooveProximity <= 0.02) return;

    const compoundDepRate =
      car.tyreCompound === 'soft'
        ? 1.28
        : car.tyreCompound === 'medium'
          ? 1.0
          : car.tyreCompound === 'hard'
            ? 0.82
            : 0.16;
    const cornerShear = 1.0 + Math.min(1.4, sample.curvature * 5.5 + Math.abs(car.steerAngle) * 1.8);
    const speedFactor = Math.min(1.2, absSpeed / 65);
    const totalLapsScale = Math.max(1, this.gameMode === 'time_trial' ? 3 : this.settings.totalLaps);
    const gridScale = Math.max(1, this.racers.length);

    const depDelta =
      ((dt * grooveProximity * compoundDepRate * cornerShear * speedFactor) / (gridScale * totalLapsScale)) * 0.22;
    const secIdx = this.getSectorFromT(sample.t) - 1;
    this.sectorDepositionAccum[secIdx] = Math.min(3.0, this.sectorDepositionAccum[secIdx] + depDelta);
  }

  private recomputeTrackRubberLevel() {
    if (this.screen === 'title') {
      this.trackRubberLevel = 0.42;
      this.sectorRubberLevels = [0.42, 0.45, 0.40];
      this.builtTrack?.setSurfaceRubbering(this.trackRubberLevel, this.sectorRubberLevels);
      return;
    }

    const player = this.racers.find((r) => r.isPlayer);
    const effectiveLaps = this.gameMode === 'time_trial' ? 3 : Math.max(1, this.settings.totalLaps);
    const gridCount = Math.max(1, this.racers.length);
    const playerProg = player ? Math.max(0, player.totalProgress) : 0;

    const hazardMults: [number, number, number] = [1.0, 1.0, 1.0];
    for (const hz of this.surfaceHazards) {
      const sIdx = hz.sector - 1;
      if (hz.gripMultiplier < hazardMults[sIdx]) {
        hazardMults[sIdx] = hz.gripMultiplier;
      }
    }

    const evolution = calculateTrackSurfaceEvolution({
      completedRaceLaps: this.completedRaceLaps,
      gridCount,
      playerTotalProgress: playerProg,
      totalLaps: effectiveLaps,
      sectorDepositionAccum: this.sectorDepositionAccum,
      sectorCurvatureLoad: this.builtTrack?.sectorCurvatureLoad,
      trackWetnessRatio: this.trackWetness,
      compound: this.currentCompound,
      sectorHazardMultipliers: hazardMults,
    });

    this.trackRubberLevel = evolution.trackRubberLevel;
    this.sectorRubberLevels = evolution.sectorRubberLevels;
    this.sectorGripPctState = evolution.sectorGripPct;
    this.builtTrack?.setSurfaceRubbering(this.trackRubberLevel, this.sectorRubberLevels);
  }

  private updateTrackRubberTexture(force = false) {
    if (!force && Math.abs(this.trackRubberLevel - this.renderedRubberLevel) < 0.015) return;
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

        if (level > 0.005) {
          // Twin tyre-track darkened racing groove + central acceleration/braking corridor
          const groove = actx.createLinearGradient(0, 0, w, 0);
          groove.addColorStop(0.0, 'rgba(5, 6, 9, 0.0)');
          groove.addColorStop(0.14, 'rgba(5, 6, 9, 0.0)');
          groove.addColorStop(0.24, `rgba(4, 5, 8, ${(0.62 * level).toFixed(3)})`);
          groove.addColorStop(0.31, `rgba(2, 3, 6, ${(0.72 * level).toFixed(3)})`);
          groove.addColorStop(0.41, `rgba(7, 8, 12, ${(0.34 * level).toFixed(3)})`);
          groove.addColorStop(0.50, `rgba(8, 9, 13, ${(0.28 * level).toFixed(3)})`);
          groove.addColorStop(0.59, `rgba(7, 8, 12, ${(0.34 * level).toFixed(3)})`);
          groove.addColorStop(0.69, `rgba(2, 3, 6, ${(0.72 * level).toFixed(3)})`);
          groove.addColorStop(0.76, `rgba(4, 5, 8, ${(0.62 * level).toFixed(3)})`);
          groove.addColorStop(0.86, 'rgba(5, 6, 9, 0.0)');
          groove.addColorStop(1.0, 'rgba(5, 6, 9, 0.0)');
          actx.fillStyle = groove;
          actx.fillRect(0, 0, w, h);

          // Deterministic longitudinal rubber lay-down streaks along the racing groove
          const activeStreaks = Math.floor(level * 96);
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
            const sw = 3 + r3 * 5.5;
            const sh = 46 + r1 * 120;
            const streakAlpha = (0.16 + 0.38 * level) * (1 - i / 115);
            actx.fillStyle = `rgba(2, 3, 5, ${streakAlpha.toFixed(3)})`;
            actx.fillRect(sx, sy, sw, sh);
          }

          // Off-line rubber marbling ("clag") accumulating along outer edges as laps progress
          if (level > 0.12) {
            const marbleStrength = (level - 0.12) / 0.88;
            const marbleCount = Math.floor(marbleStrength * 620);
            actx.fillStyle = `rgba(4, 5, 8, ${(0.52 * marbleStrength).toFixed(3)})`;
            for (let m = 0; m < marbleCount; m++) {
              const mh = Math.sin(m * 91.731 + 2.31) * 31542.81;
              const mr1 = mh - Math.floor(mh);
              const mh2 = Math.sin(m * 17.53 + 6.18) * 19412.44;
              const mr2 = mh2 - Math.floor(mh2);
              const mx = (m % 2 === 0 ? 0.045 + mr1 * 0.10 : 0.855 + mr1 * 0.10) * w;
              const my = mr2 * h;
              actx.fillRect(mx, my, 3 + (m % 2), 4 + (m % 3));
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

        if (level > 0.01) {
          const polish = rctx.createLinearGradient(0, 0, rw, 0);
          polish.addColorStop(0.0, 'rgba(20, 20, 20, 0.0)');
          polish.addColorStop(0.16, 'rgba(20, 20, 20, 0.0)');
          polish.addColorStop(0.28, `rgba(14, 14, 14, ${(0.52 * level).toFixed(3)})`);
          polish.addColorStop(0.50, `rgba(22, 22, 22, ${(0.26 * level).toFixed(3)})`);
          polish.addColorStop(0.72, `rgba(14, 14, 14, ${(0.52 * level).toFixed(3)})`);
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

    this.builtTrack = buildCircuitTrack(
      this.currentTrack,
      this.textures,
      this.settings.weather,
      this.settings.graphicsQuality,
      this.settings.timeOfDay
    );
    const effectiveGridAssists = resolveEffectiveSessionAssists(this.settings);
    this.builtTrack.setRacingLineMode(effectiveGridAssists.racingLine);
    this.scene.add(this.builtTrack.group);
    this.buildWeatherSchedule();
    this.applyAtmosphere(this.liveWeather);
    this.updateEnvironment(this.screen === 'garage' ? 'garage' : this.liveWeather);

    const availableAiDrivers = FORMULA_DRIVERS.filter((d) => d.id !== this.currentDriver.id);
    const numAi = this.gameMode === 'time_trial' ? 0 : 21;
    const totalGrid = numAi + 1;
    const onlineRules = this.settings.onlineGameplay;
    const onlineRulesActive = Boolean(onlineRules?.applyOnlineRulesToSession);
    const onlineEqualPerf = onlineRulesActive && onlineRules?.carPerformance === 'equal';

    // Determine starting grid slot order (Qualifying Pace vs Reverse Grid vs Random Shuffle)
    const slotOrder = Array.from({ length: totalGrid }, (_, idx) => idx);
    if (this.screen !== 'title' && onlineRulesActive && totalGrid > 1) {
      if (onlineRules?.gridOrder === 'reverse_grid') {
        slotOrder.reverse();
      } else if (onlineRules?.gridOrder === 'random') {
        for (let k = slotOrder.length - 1; k > 0; k--) {
          const j = Math.floor(Math.random() * (k + 1));
          const tmp = slotOrder[k];
          slotOrder[k] = slotOrder[j];
          slotOrder[j] = tmp;
        }
      }
    }

    for (let slot = 0; slot < totalGrid; slot++) {
      const entityIdx = slotOrder[slot];
      const isPlayer = entityIdx === totalGrid - 1;
      const aiDriver =
        availableAiDrivers[entityIdx % availableAiDrivers.length] ??
        FORMULA_DRIVERS[entityIdx % FORMULA_DRIVERS.length];
      const activeDriver = isPlayer ? this.currentDriver : aiDriver;
      const team = isPlayer
        ? this.currentTeam
        : (FORMULA_TEAMS.find((t) => t.id === aiDriver.teamId) ?? FORMULA_TEAMS[entityIdx % FORMULA_TEAMS.length]);

      const primary = isPlayer && this.customPrimaryHex ? this.customPrimaryHex : team.primaryColor;
      const wheel = isPlayer ? this.currentWheelFinish : WHEEL_FINISHES[entityIdx % WHEEL_FINISHES.length];
      const isRain = this.settings.weather === 'rain' || this.settings.weather === 'heavy_rain';
      const compound: TyreCompound =
        isRain ? 'wet' : isPlayer ? this.currentCompound : (['soft', 'medium', 'hard'][entityIdx % 3] as TyreCompound);

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
        id: isPlayer ? 'player' : `ai_${entityIdx}`,
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
        fuelPct: isPlayer ? (this.settings.pitStrategyPlan?.startingFuelPct ?? 100) : 100,
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
        aiBasePace: onlineEqualPerf
          ? diffMult * (0.955 + (entityIdx % 3) * 0.015)
          : diffMult * (0.93 + (entityIdx % 3) * 0.03),
        aiLaneTimer: 1 + Math.random() * 2,
        incidentTimer: 0,
        incidentCooldown: 10 + entityIdx * 3.5,
        spinRate: 0,
        brakeTempC: 320,
        wheelWearPct: [100, 100, 100, 100],
        activeAeroMode: 'z_mode',
        manualOverrideActive: false,
        mgukPowerKw: 0,
        aiStrategyArchetype: (['undercut_1stop', 'aggressive_2stop', 'overcut_long', 'wet_gamble'] as AiStrategyArchetype[])[
          slot % 4
        ],
        aiPitTimer: 0,
        pitStops: 0,
        aiQueuedCompound: null,
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
    this.playerDrsZoneId = null;
    this.playerDrsGapQualified = true;
    this.drsNotification = null;
    this.drsNotificationZoneNumber = null;
    this.drsNotificationZoneName = null;
    this.drsNotificationTimer = 0;
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
      if (
        !this.isSoftwareGl &&
        (this.settings.graphicsQuality === 'ultra' ||
          this.settings.graphicsQuality === 'cinematic' ||
          this.settings.graphicsQuality === 'extreme' ||
          this.settings.graphicsQuality === 'ultra_8k') &&
        rawMs > 4 &&
        rawMs < 120
      ) {
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
      this.showroomCar.updateVisuals(0, 0, false, this.garageLightsOn, 0, 0, this.garageLightsOn ? 1 : 0, true, 0.5, 0.2, 0);
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
        this.updateSunAndRimRig(focusX, py, focusZ, 138);
        if (this.speedPass) {
          const allowBlur = this.settings.motionBlur && this.settings.graphicsQuality !== 'low';
          const clipIdx = phaseTime < 8.0 ? 1 : phaseTime < 16.0 ? 2 : phaseTime < 24.0 ? 3 : 4;
          this.speedPass.uniforms['uTime'].value = elapsed;
          this.speedPass.uniforms['uIntensity'].value = allowBlur ? speedBlur : 0;
          this.speedPass.uniforms['uHeatDistort'].value = clipIdx === 2 || clipIdx === 3 ? 0.55 : 0.25;
          this.speedPass.uniforms['uWetness'].value = Math.max(this.trackWetness, this.curRainOpacity * 0.9);
          this.speedPass.uniforms['uGradeContrast'].value =
            this.settings.graphicsQuality === 'ultra_8k'
              ? 0.27
              : this.settings.graphicsQuality === 'extreme'
                ? 0.25
                : this.settings.graphicsQuality === 'cinematic'
                  ? 0.22
                  : this.settings.graphicsQuality === 'ultra'
                    ? 0.19
                    : 0.14;
          this.updateVolumetricSunUniforms();
        }
        this.updateBokehPass(true, focalDist, aperture, maxblur, forceCut);
        const hasActiveSparks = this.sparkLife[this.sparkCursor] > 0 || this.sparkLife[0] > 0;
        const attractSparkRatio = Math.min(0.35, (hasActiveSparks ? 0.15 : 0) + (phaseTime >= 24 ? 0.25 : 0));
        this.updateBloomPass(
          Math.min(1.0, (player.speed / 88) * 0.65 + (player.drsOpen ? 0.25 : 0) + attractSparkRatio),
          'race',
          forceCut,
          dt
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

    if (this.drsNotificationTimer > 0) {
      this.drsNotificationTimer -= dt;
      if (this.drsNotificationTimer <= 0) {
        this.drsNotification = null;
        this.drsNotificationZoneNumber = null;
        this.drsNotificationZoneName = null;
      }
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
    if (this.trackLimitCooldown > 0) {
      this.trackLimitCooldown = Math.max(0, this.trackLimitCooldown - dt);
    }
    if (this.launchFeedbackTimer > 0) {
      this.launchFeedbackTimer = Math.max(0, this.launchFeedbackTimer - dt);
      if (this.launchFeedbackTimer <= 0) {
        this.launchFeedback = null;
      }
    }
    if (!raceLive) {
      this.audio.updateGridTension(this.countdownTimer, true);
      this.audio.updateCrowdAmbience(0.065);
      this.audio.updateSpatialTraffic([], false);
    } else {
      this.audio.updateGridTension(0, false);
      this.raceElapsedMs += dt * 1000;
    }
    this.updateDynamicWeather(dt, raceLive);
    this.updateDynamicTimeOfDay(dt, raceLive);

    if (this.pitCooldownTimer > 0) {
      this.pitCooldownTimer = Math.max(0, this.pitCooldownTimer - dt);
    }

    for (const racer of this.racers) {
      if (racer.isPlayer) {
        this.stepPlayerPhysics(racer, dt, raceLive);
      } else if (raceLive) {
        this.stepAiPhysics(racer, dt);
      }
      if (raceLive) {
        this.accumulateCarRubberDeposition(racer, dt);
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
    const nextScheduledStop = (this.settings.pitStrategyPlan?.stops ?? []).find(
      (s) => !this.completedPlannedStopIds.has(s.id)
    );
    if (
      player &&
      raceLive &&
      nextScheduledStop &&
      player.lap >= nextScheduledStop.pitLap &&
      !this.queuedCompound &&
      this.pitStopTimer <= 0 &&
      this.pitCooldownTimer <= 0
    ) {
      this.queuedCompound = nextScheduledStop.compound;
      this.queuedFuelTargetPct = nextScheduledStop.fuelLoadPct;
      this.queuedPlannedStopId = nextScheduledStop.id;
      this.audio.playPitRadioBeep();
      this.bannerMessage = `SCHEDULED STOP L${nextScheduledStop.pitLap} — BOX FOR ${nextScheduledStop.compound.toUpperCase()} + ${nextScheduledStop.fuelLoadPct}% FUEL`;
      this.bannerTimer = 3.2;
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
    if (player && this.builtTrack) {
      const drsZones = this.builtTrack.drsZones;
      const activeDrsZone = findActiveDrsZoneAtT(drsZones, player.lastT);
      const drsDisabledByWeather = this.trackWetness > 0.48 || this.liveWeather === 'heavy_rain' || this.liveWeather === 'blizzard';
      const effectiveHudAssists = resolveEffectiveSessionAssists(this.settings);
      const drsGapQualified = this.gameMode === 'time_trial' || effectiveHudAssists.drsAssist || this.playerDrsGapQualified;
      const drsAvailable =
        Boolean(activeDrsZone) &&
        !drsDisabledByWeather &&
        drsGapQualified &&
        Math.abs(player.speed) * 3.6 > 120 &&
        player.ersCharge > 4;
      const drsActive = player.drsOpen;
      this.builtTrack.updateDrsOverlays(performance.now() * 0.001, drsAvailable, drsActive);
    }

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.045) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private stepPlayerPhysics(car: RacerEntity, dt: number, raceLive: boolean) {
    const padIn = this.pollDualSenseGamepad();
    const keyThrottle =
      this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') || this.touchState.throttle ? 1 : 0;
    const keyBrake =
      this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') || this.touchState.brake ? 1 : 0;
    const throttleIn = Math.max(keyThrottle, padIn.throttle, this.touchAnalogThrottle);
    const brakeIn = Math.max(keyBrake, padIn.brake, this.touchAnalogBrake);
    this.playerThrottleInputPct = Math.round(throttleIn * 100);
    this.playerBrakeInputPct = Math.round(brakeIn * 100);

    const steerLeft =
      this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') || this.touchState.left ? 1 : 0;
    const steerRight =
      this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') || this.touchState.right ? 1 : 0;
    const keySteer = steerLeft - steerRight;
    const effectiveTouchSteer =
      Math.abs(this.touchAnalogSteer) > 0.01 ? this.touchAnalogSteer : (this.touchState.left ? 1 : 0) - (this.touchState.right ? 1 : 0);
    const combinedSteer =
      Math.abs(padIn.steer) >= Math.max(Math.abs(keySteer), Math.abs(effectiveTouchSteer))
        ? padIn.steer
        : Math.abs(effectiveTouchSteer) >= Math.abs(keySteer)
          ? effectiveTouchSteer
          : keySteer;
    const drsRequested =
      this.mobileAeroMode !== 'z_mode' &&
      (this.mobileAeroMode === 'x_mode' ||
        this.heldKeys.has('Space') ||
        this.heldKeys.has('ShiftLeft') ||
        this.touchState.drs ||
        padIn.drs);

    const steerTarget = combinedSteer * this.settings.steeringSensitivity;

    const clutchHeld =
      this.heldKeys.has('Space') ||
      this.heldKeys.has('ShiftLeft') ||
      this.touchState.drs ||
      padIn.clutch;

    if (!raceLive) {
      // Interactive F1 Grid Launch Clutch: hold W/R2 + Space/L1/Cross to lock into optimal 8,800–11,400 RPM window
      const revTarget = throttleIn > 0 ? (clutchHeld ? 10450 : 12350) : 3800;
      car.rpm = THREE.MathUtils.damp(car.rpm, revTarget, 8.5, dt);
      car.steerAngle = THREE.MathUtils.damp(car.steerAngle, steerTarget * 0.35, 10, dt);
      car.brakeTempC = THREE.MathUtils.damp(car.brakeTempC, brakeIn > 0 ? 520 : 300, 4, dt);
      car.model.updateVisuals(
        0,
        car.steerAngle,
        false,
        brakeIn > 0,
        0,
        0,
        0,
        true,
        0.5,
        0.2,
        car.damagePct,
        car.brakeTempC,
        this.currentContactPatch.grainingSeverityPct,
        this.currentContactPatch.microSlipRatio,
        this.currentContactPatch.wheelSurfaceTempC[0]
      );
      this.audio.updateEngine(car.rpm, MAX_RPM, throttleIn, 0, true);
      return;
    }

    // Evaluate F1 Lights-Out Grid Launch on first throttle launch
    if (!this.playerLaunched && (throttleIn > 0 || this.raceElapsedMs > 1800)) {
      this.playerLaunched = true;
      const reactionSec = Math.max(0.14, this.raceElapsedMs / 1000);
      if (throttleIn > 0 && car.rpm >= 8200 && car.rpm <= 11550) {
        car.speed = Math.max(car.speed, 13.5);
        this.launchFeedback = `PERFECT LAUNCH · ${reactionSec.toFixed(2)}s`;
        this.bannerMessage = `PERFECT LAUNCH! (${reactionSec.toFixed(2)}s REACTION)`;
        this.bannerTimer = 2.4;
      } else if (throttleIn > 0 && car.rpm > 11550) {
        car.speed = Math.max(car.speed, 8.0);
        car.lateralVel += (Math.random() > 0.5 ? 1 : -1) * 1.9;
        this.launchFeedback = `WHEELSPIN START · ${reactionSec.toFixed(2)}s`;
        this.bannerMessage = 'REAR WHEELSPIN — MODULATE LAUNCH RPM!';
        this.bannerTimer = 2.2;
      } else if (throttleIn > 0) {
        car.speed = Math.max(car.speed, 9.5);
        this.launchFeedback = `REACTION ${reactionSec.toFixed(2)}s`;
      }
      this.launchFeedbackTimer = 3.8;
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
      const progress = 1.0 - (this.pitStopTimer / this.maxPitTimer);

      car.speed = THREE.MathUtils.damp(car.speed, 0, 6.5, dt);
      car.lateralVel = THREE.MathUtils.damp(car.lateralVel, 0, 10, dt);
      car.rpm = THREE.MathUtils.damp(car.rpm, 4400, 8, dt);
      const fwdX = -Math.sin(car.yaw);
      const fwdZ = -Math.cos(car.yaw);
      car.position.x += fwdX * car.speed * dt;
      car.position.z += fwdZ * car.speed * dt;

      const trackBaseY = this.builtTrack ? this.builtTrack.findClosestSample(car.position, car.closestIdx).point.y : 0;
      const liftHeight = progress < 0.2 ? THREE.MathUtils.lerp(0, 0.14, progress / 0.2) : progress > 0.75 ? THREE.MathUtils.lerp(0.14, 0, (progress - 0.75) / 0.25) : 0.14;
      car.position.y = trackBaseY + liftHeight;

      car.brakeTempC = THREE.MathUtils.damp(car.brakeTempC, 340, 3.5, dt);
      car.model.root.position.copy(car.position);
      car.model.updateVisuals(
        (car.speed * dt) / 0.34,
        0,
        false,
        true,
        0,
        0,
        0,
        true,
        0.5,
        0.2,
        car.damagePct,
        car.brakeTempC,
        progress > 0.55 ? 0 : this.currentContactPatch.grainingSeverityPct,
        0.04,
        88
      );
      this.audio.updateEngine(car.rpm, MAX_RPM, 0.2, 0, true);

      this.pitCrewGroup.position.copy(car.position);
      this.pitCrewGroup.position.y = trackBaseY;
      this.pitCrewGroup.rotation.y = car.yaw;
      this.animatePitCrew(progress, dt);

      if (this.pitStopTimer <= 0) {
        this.completePlayerPitStop(car);
      }
      return;
    }

    const effectiveAssists = resolveEffectiveSessionAssists(this.settings);
    const onlineRules = this.settings.onlineGameplay;
    const onlineEqualSpec = Boolean(
      onlineRules?.applyOnlineRulesToSession && onlineRules.carPerformance === 'equal'
    );
    const teamTopSpeedStat = onlineEqualSpec ? 88 : car.team.baseTopSpeed;
    const teamAccelStat = onlineEqualSpec ? 88 : car.team.baseAcceleration;
    const teamBrakeStat = onlineEqualSpec ? 88 : car.team.baseBraking;

    const damageScale =
      this.settings.carDamageMode === 'off' ? 0 : this.settings.carDamageMode === 'simulation' ? 1.65 : 1.0;
    const maxSpeedMs = (82 + (teamTopSpeedStat - 85) * 0.85) * (onlineEqualSpec ? 1.04 : engineBonus) * dmgFactor;
    const accelForce = (34 + (teamAccelStat - 85) * 0.55) * (onlineEqualSpec ? 1.04 : engineBonus) * (1 - (car.damagePct / 100) * 0.14);
    const biasStabilityMult = 1.0 + (1.0 - Math.abs(this.brakeBiasPct - 57) * 0.012) * 0.04;
    const brakeForce =
      (54 + (teamBrakeStat - 85) * 0.7) *
      (onlineEqualSpec ? 1.04 : brakeBonus) *
      biasStabilityMult *
      (effectiveAssists.absAssist ? 1.0 : 0.92);

    let offTrack = false;
    let onKerb = false;
    let trackBaseY = 0;
    let trackSlopePitch = 0;
    let playerLatOffset = 0;
    let playerIdealLatOffset = 0;
    let trackHalfWidth = 7.0;
    let effectiveBrakeIn = brakeIn;
    let effectiveSteerTarget = steerTarget;
    if (this.builtTrack) {
      const sample = this.builtTrack.findClosestSample(car.position, car.closestIdx);
      car.closestIdx = sample.index;
      trackBaseY = sample.point.y;
      trackSlopePitch = -Math.asin(THREE.MathUtils.clamp(sample.tangent.y, -0.35, 0.35));
      const halfW = this.builtTrack.trackWidth * 0.5;
      trackHalfWidth = halfW;
      playerLatOffset = sample.lateralOffset;
      playerIdealLatOffset = sample.idealLateralOffset;
      const absLat = Math.abs(sample.lateralOffset);
      const cornerCutRule = onlineRules?.applyOnlineRulesToSession ? onlineRules.cornerCutting : 'regular';
      const offTrackMargin = cornerCutRule === 'strict' ? 0.95 : cornerCutRule === 'relaxed' ? 1.85 : 1.3;
      onKerb = absLat > halfW - 0.35 && absLat <= halfW + offTrackMargin;
      offTrack = absLat > halfW + offTrackMargin;
      this.playerOnKerb = onKerb;
      this.playerOffTrack = offTrack;

      // PS5 F1 Braking Assist (Low / Medium / High) governed by online assist rules
      const brakeAssistMode = effectiveAssists.brakingAssist;
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

      // PS5 F1 Steering Assist gently guides car toward the optimal circuit line (respecting online rules)
      if (effectiveAssists.steeringAssist) {
        const samples = this.builtTrack.samples;
        const lookS = samples[(sample.index + 6) % samples.length];
        const desiredYaw = Math.atan2(-lookS.tangent.x, -lookS.tangent.z);
        let yErr = desiredYaw - car.yaw;
        while (yErr > Math.PI) yErr -= Math.PI * 2;
        while (yErr < -Math.PI) yErr += Math.PI * 2;
        const guideSteer = THREE.MathUtils.clamp(
          yErr * 1.2 - (sample.lateralOffset - sample.idealLateralOffset) * 0.045,
          -0.5,
          0.5
        );
        effectiveSteerTarget = THREE.MathUtils.lerp(effectiveSteerTarget, guideSteer, 0.32);
      }

      const wallLimit = halfW + 5.7;
      if (absLat > wallLimit) {
        const sign = Math.sign(sample.lateralOffset);
        car.position.copy(sample.point).addScaledVector(sample.right, sign * wallLimit);
        if (Math.abs(car.speed) > 10) {
          this.audio.playCollision(Math.min(1, Math.abs(car.speed) / 45));
          this.shakeIntensity = Math.max(this.shakeIntensity, Math.min(0.65, Math.abs(car.speed) / 80));
          this.triggerMobileHaptic('collision', Math.min(1, Math.abs(car.speed) / 42));
          car.damagePct = Math.min(100, car.damagePct + Math.min(18, Math.abs(car.speed) * 0.22) * damageScale);
          if (Math.abs(car.speed) > 38) this.hitstopTimer = 0.04;
        }
        car.speed *= 0.62;
        car.lateralVel = -sign * 4;
      }

      // F1 FIA Race Control: Track Limits Warnings (scaled by Online Corner Cutting stringency)
      if (
        offTrack &&
        this.pitStopTimer <= 0 &&
        Math.abs(car.speed) > 22 &&
        this.trackLimitCooldown <= 0 &&
        this.gameMode !== 'time_trial'
      ) {
        const maxWarningsBeforePenalty = cornerCutRule === 'strict' ? 2 : cornerCutRule === 'relaxed' ? 5 : 3;
        this.trackLimitCooldown = cornerCutRule === 'strict' ? 3.0 : cornerCutRule === 'relaxed' ? 5.5 : 4.2;
        this.trackLimitWarnings += 1;
        if (this.trackLimitWarnings < maxWarningsBeforePenalty) {
          this.bannerMessage = `TRACK LIMITS WARNING (${this.trackLimitWarnings}/${maxWarningsBeforePenalty})`;
          this.bannerTimer = 2.2;
        } else if (this.trackLimitWarnings === maxWarningsBeforePenalty) {
          this.bannerMessage = 'BLACK & WHITE FLAG — FINAL TRACK LIMITS WARNING!';
          this.bannerTimer = 2.8;
          this.audio.playStrategyAlert();
        } else {
          this.timePenaltySec += 5;
          this.bannerMessage = `FIA PENALTY: +5s TIME PENALTY (${this.timePenaltySec}s TOTAL)`;
          this.bannerTimer = 3.2;
          this.audio.playStrategyAlert();
        }
      }
    }

    const compoundGrip =
      this.currentCompound === 'soft' ? 1.05 : this.currentCompound === 'medium' ? 0.98 : this.currentCompound === 'hard' ? 0.92 : 0.95;
    const wearGrip = 0.75 + (car.tyreWearPct / 100) * 0.25;
    const hazardEval = this.evaluateSurfaceHazardAt(car.position);
    this.playerActiveHazard = hazardEval.hazardType;

    const speedKmh = Math.abs(car.speed) * 3.6;
    const drsZones = this.builtTrack?.drsZones ?? getCircuitDrsZones(this.currentTrack);
    const curPlayerT = this.builtTrack ? this.builtTrack.samples[car.closestIdx].t : car.lastT;
    const currentSector = this.getSectorFromT(curPlayerT);
    const sectorGripTuple = this.computeSectorGripPct();
    const activeSectorRubber = this.sectorRubberLevels[currentSector - 1] ?? this.trackRubberLevel;

    // Evaluate progressive racing line rubbering-in vs slippery off-line marbles ("clag")
    const lineGripEval = evaluateRacingLineSurfaceGrip(
      playerLatOffset,
      playerIdealLatOffset,
      trackHalfWidth,
      activeSectorRubber,
      sectorGripTuple[currentSector - 1] ?? 92,
      wet,
      this.currentCompound
    );
    const trackEvolutionGrip = lineGripEval.lineEvolutionGripMultiplier;
    const activeSectorGripPct = Math.round(
      lineGripEval.localSurfaceGripPct * (offTrack ? 0.65 : 1.0)
    );

    const prevTempSnapshot = this.trackTemperatureC;
    this.trackTemperatureC = calculateTrackTemperatureC(
      this.liveWeather,
      this.getEffectiveLiveTimeOfDay(),
      wet,
      this.trackRubberLevel,
      this.raceElapsedMs * 0.001
    );
    if (Math.abs(this.trackTemperatureC - prevTempSnapshot) >= 0.05) {
      this.prevTrackTemperatureC = THREE.MathUtils.damp(this.prevTrackTemperatureC, prevTempSnapshot, 1.2, dt);
    }
    const playerRemainingLaps = Math.max(1, this.settings.totalLaps - car.lap);
    this.currentWeatherTyreImpact = evaluateDynamicWeatherTyreImpact({
      weather: this.liveWeather,
      timeOfDay: this.getEffectiveLiveTimeOfDay(),
      compound: this.currentCompound,
      trackWetnessRatio: wet,
      trackTemperatureC: this.trackTemperatureC,
      prevTrackTemperatureC: this.prevTrackTemperatureC,
      speedMs: car.speed,
      remainingLaps: playerRemainingLaps,
    });
    const tcModeSetting = effectiveAssists.tractionControlMode;
    this.currentContactPatch = calculateTyreContactPatchPhysics({
      speedMs: car.speed,
      lateralVelMs: car.lateralVel,
      steerAngleRad: car.steerAngle,
      throttleIn,
      brakeIn: effectiveBrakeIn,
      gLat: this.currentGForce.gLat,
      gLong: this.currentGForce.gLong,
      compound: this.currentCompound,
      tyreWearPct: car.tyreWearPct,
      sectorGripPct: activeSectorGripPct,
      trackTemperatureC: this.trackTemperatureC,
      trackWetnessRatio: wet,
      absAssist: effectiveAssists.absAssist,
      tcMode: tcModeSetting,
      prevGrainingSeverityPct: this.currentContactPatch.grainingSeverityPct,
      prevWheelSurfaceTempC: this.currentContactPatch.wheelSurfaceTempC,
      prevWheelCoreTempC: this.currentContactPatch.wheelCoreTempC,
      dt,
    });

    // 2026 Aerodynamic Slipstream ("Tow") & Turbulent Dirty-Air Wake Physics
    let targetSlipstream = 0;
    let targetDirtyAir = 0;
    let curTrackCurvature = 0;
    if (this.builtTrack) {
      curTrackCurvature = this.builtTrack.samples[car.closestIdx]?.curvature ?? 0;
      const trackLen = this.builtTrack.totalLength || 1000;
      for (let i = 0; i < this.racers.length; i++) {
        const other = this.racers[i];
        if (other.id === car.id || other.finished) continue;
        let progDelta = other.totalProgress - car.totalProgress;
        if (progDelta > 0 && progDelta * trackLen < 78) {
          const distAheadMeters = progDelta * trackLen;
          const otherSample = this.builtTrack.samples[other.closestIdx];
          const otherLatOffset = otherSample
            ? _vecA.subVectors(other.position, otherSample.point).dot(otherSample.right)
            : other.aiTargetLane;
          const latDelta = Math.abs(playerLatOffset - otherLatOffset);
          if (latDelta < 2.8 && speedKmh > 115) {
            const alignFactor = 1.0 - latDelta / 2.8;
            const distFactor = 1.0 - THREE.MathUtils.clamp((distAheadMeters - 6) / 72, 0, 1);
            const wakeStrength = alignFactor * distFactor * THREE.MathUtils.clamp((speedKmh - 110) / 140, 0, 1);
            if (curTrackCurvature < 0.11) {
              targetSlipstream = Math.max(targetSlipstream, wakeStrength);
            } else {
              targetDirtyAir = Math.max(targetDirtyAir, wakeStrength * THREE.MathUtils.clamp(curTrackCurvature * 5.2, 0.3, 1.0));
            }
          }
        }
      }
    }
    this.playerSlipstreamPct = THREE.MathUtils.damp(this.playerSlipstreamPct, targetSlipstream, 5.5, dt);
    this.playerDirtyAirPct = THREE.MathUtils.damp(this.playerDirtyAirPct, targetDirtyAir, 5.5, dt);

    // F1 2026 Team Management & PU Health Multipliers
    const devFocus = this.teamManagement.developmentFocus;
    const staff = this.teamManagement.staffAllocation;
    const puWear = this.teamManagement.puWear;
    const iceHealthMult = 0.90 + (Math.max(0, Math.min(100, puWear.ice)) / 100) * 0.10;
    const aeroStaffMult = 1.0 + Math.max(-0.02, (staff.aero - 45) * 0.0008);
    const ptStaffMult = 1.0 + Math.max(-0.02, (staff.powertrain - 45) * 0.0008);
    const stratThermalMult = 1.0 - Math.min(0.10, Math.max(0, (staff.strategy - 45) * 0.002));
    const aeroFocusBonus = (devFocus === 'active_aero' ? 1.045 : 1.0) * aeroStaffMult;
    const hybridFocusBonus = (devFocus === 'mguk_hybrid' ? 1.18 : 1.0) * ptStaffMult;
    const thermalFocusReduction = (devFocus === 'tyre_thermal' ? 0.86 : 1.0) * stratThermalMult;

    // F1 2026 Reduced Turbulent Wake (-35% dirty air penalty vs 2025 ground-effect era)
    const dirtyAirGripPenalty = 1.0 - this.playerDirtyAirPct * 0.055;
    const activeDrsZone = findActiveDrsZoneAtT(drsZones, curPlayerT);
    const drsDisabledByWeather = wet > 0.48 || this.liveWeather === 'heavy_rain' || this.liveWeather === 'blizzard';

    // F1 2026 Active Aerodynamics (X-Mode low-drag usable on straights vs Z-Mode high-downforce corners)
    const activeAero = calculate2026ActiveAero({
      inAeroZone: Boolean(activeDrsZone),
      disabledByWeather: drsDisabledByWeather,
      speedKmh,
      absSteerRad: Math.abs(effectiveSteerTarget),
      aeroFocusBonus,
      manualXModeRequested: drsRequested,
      manualZModeLock: this.mobileAeroMode === 'z_mode',
    });
    car.activeAeroMode = activeAero.mode;
    car.drsOpen = activeAero.mode === 'x_mode';

    const surfaceGrip =
      (offTrack ? 0.55 : 1.0) *
      hazardEval.gripMultiplier *
      this.currentWeatherTyreImpact.gripMultiplier *
      compoundGrip *
      wearGrip *
      trackEvolutionGrip *
      this.currentContactPatch.gripPenaltyMultiplier *
      dirtyAirGripPenalty *
      activeAero.downforceGripMultiplier *
      aeroBonus *
      tyreBonus *
      suspensionBonus *
      dmgFactor;
    this.playerSurfaceGripPct = Math.round(
      THREE.MathUtils.clamp(
        (offTrack ? 0.55 : 1.0) *
          hazardEval.gripMultiplier *
          lineGripEval.localSurfaceGripPct *
          this.currentWeatherTyreImpact.gripMultiplier *
          wearGrip *
          dirtyAirGripPenalty *
          this.currentContactPatch.gripPenaltyMultiplier,
        25,
        100
      )
    );

    // F1 2026 350kW MGU-K & Manual Override Mode (MOM) when chasing <1.1s ahead or override assist enabled
    const overrideAvailable =
      !drsDisabledByWeather &&
      (this.gameMode === 'time_trial' || effectiveAssists.drsAssist || this.playerDrsGapQualified) &&
      car.ersCharge > 4;
    this.playerManualOverrideAvailable = overrideAvailable;
    const autoOverride = Boolean(
      (effectiveAssists.drsAssist || effectiveAssists.ersAssist) &&
        this.ersMode !== 'harvest' &&
        throttleIn > 0 &&
        effectiveBrakeIn <= 0.05 &&
        car.ersCharge > 18 &&
        overrideAvailable
    );
    const overrideActive = (drsRequested || autoOverride) && overrideAvailable && throttleIn > 0;
    car.manualOverrideActive = overrideActive;

    const puDeployment = calculate2026PowerUnitDeployment({
      speedKmh,
      throttleIn,
      brakeIn: effectiveBrakeIn,
      ersCharge: car.ersCharge,
      overrideRequested: drsRequested || autoOverride,
      overrideAvailable,
      ersMode: this.ersMode,
      mgukHealthPct: puWear.mguk,
      hybridFocusBonus,
    });
    car.mgukPowerKw = puDeployment.mgukPowerKw;
    car.ersCharge = THREE.MathUtils.clamp(car.ersCharge - puDeployment.ersDrainPerSec * dt, 0, 100);

    const fuelWeightAccelMult = 1 - (car.fuelPct / 100) * 0.045;
    const slipstreamAccelBoost = 1.0 + this.playerSlipstreamPct * 0.075;
    const forwardAccel =
      throttleIn *
      accelForce *
      iceHealthMult *
      fuelWeightAccelMult *
      slipstreamAccelBoost *
      puDeployment.driveBoostMultiplier *
      (car.fuelPct > 0 ? 1 : 0.45);
    let longForce = 0;

    if (effectiveAssists.transmission === 'auto') {
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

    const dragCoeff =
      (0.0038 * activeAero.dragMultiplier * (1.0 - this.playerSlipstreamPct * 0.19)) +
      (offTrack ? 0.018 : 0.0012);
    const dragForce = car.speed * Math.abs(car.speed) * dragCoeff + car.speed * 0.14;
    car.speed += (longForce - dragForce) * dt;
    const slipstreamTopSpeedMult = 1.0 + this.playerSlipstreamPct * 0.042;
    const aeroTopSpeedMult = car.drsOpen ? 1.065 : 1.0;
    const momTopSpeedMult = car.manualOverrideActive ? 1.045 : 1.0;
    car.speed = THREE.MathUtils.clamp(
      car.speed,
      -22,
      maxSpeedMs * aeroTopSpeedMult * momTopSpeedMult * slipstreamTopSpeedMult
    );

    const absSpeed = Math.abs(car.speed);
    if (this.manualGearOverrideTimer > 0) {
      this.manualGearOverrideTimer = Math.max(0, this.manualGearOverrideTimer - dt);
    }
    if (effectiveAssists.transmission === 'auto' && car.gear >= 1 && this.manualGearOverrideTimer <= 0) {
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

    const maxSteer = THREE.MathUtils.lerp(0.56, 0.23, Math.min(1, absSpeed / 75));
    car.steerAngle = THREE.MathUtils.damp(car.steerAngle, effectiveSteerTarget * maxSteer, 11.5, dt);

    // F1 2026 lighter 768kg / shorter wheelbase chassis responsiveness
    const turnRate = (car.speed / 3.28) * Math.sin(car.steerAngle) * Math.min(1.18, surfaceGrip);
    car.yaw += turnRate * dt;

    // Realism Upgrade: Calculate authentic instantaneous G-forces acting on driver & chassis
    this.currentGForce = calculateGForces(car.speed, this.prevPlayerSpeed, turnRate, dt);
    this.prevPlayerSpeed = car.speed;

    const fwdX = -Math.sin(car.yaw);
    const fwdZ = -Math.cos(car.yaw);
    const rightX = Math.cos(car.yaw);
    const rightZ = -Math.sin(car.yaw);

    let slipKick = 0;
    const tcMode = effectiveAssists.tractionControlMode;
    const slickOnWet = wet > 0.35 && this.currentCompound !== 'wet';
    if (tcMode !== 'full' && throttleIn > 0 && absSpeed < 55 && (isRain || Math.abs(car.steerAngle) > 0.16)) {
      const tcScale = tcMode === 'medium' ? 0.45 : 1.0;
      slipKick += -Math.sign(car.steerAngle || 1) * (isRain ? 7.2 : 4.2) * tcScale;
    } else if (slickOnWet && throttleIn > 0 && Math.abs(car.steerAngle) > 0.12) {
      slipKick += -Math.sign(car.steerAngle) * (wet * 5.2);
    }
    if (!effectiveAssists.absAssist && effectiveBrakeIn > 0 && absSpeed > 26) {
      slipKick += Math.sin(this.raceElapsedMs * 0.03) * 3.8;
    }

    if (hazardEval.hazardType === 'oil' && absSpeed > 18) {
      slipKick += -Math.sign(car.steerAngle || (Math.sin(this.raceElapsedMs * 0.02) >= 0 ? 1 : -1)) * 6.4;
    } else if (hazardEval.hazardType === 'debris' && absSpeed > 18) {
      slipKick += Math.sin(this.raceElapsedMs * 0.045) * 3.2;
      if (Math.random() < 0.55) this.spawnUnderfloorSparks(car);
    } else if (
      !offTrack &&
      lineGripEval.offLineRatio > 0.42 &&
      activeSectorRubber > 0.18 &&
      absSpeed > 26 &&
      Math.abs(car.steerAngle) > 0.08
    ) {
      // Off-line tyre marble ("clag") slip instability when cornering outside the rubbered-in racing line
      slipKick +=
        -Math.sign(car.steerAngle) *
        lineGripEval.offLineRatio *
        activeSectorRubber *
        (2.4 + Math.sin(this.raceElapsedMs * 0.038) * 1.1);
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

    const totalLapsForFuel = Math.max(1, this.settings.totalLaps);
    const lapFuelBurnPct = Math.max(7.5, Math.min(24, totalLapsForFuel <= 5 ? 16 : 100 / Math.max(5.5, totalLapsForFuel * 0.72)));
    const perSecFuelScale = lapFuelBurnPct / 58.0; // calibrated to ~58s average lap
    car.fuelPct = Math.max(0, car.fuelPct - perSecFuelScale * (0.45 + throttleIn * 0.85) * dt);
    const lockupWear = !this.settings.absAssist && brakeIn > 0 && absSpeed > 24 ? 0.35 : 0;
    const debrisAbrasion = hazardEval.hazardType === 'debris' ? 0.95 : 0;

    // F1 2026 4-Wheel Differential Tyre Wear [FL, FR, RL, RR]
    const wheelDeltas = calculateWheelWearDeltas({
      lateralVelMs: car.lateralVel,
      gLat: this.currentGForce.gLat,
      gLong: this.currentGForce.gLong,
      speedMs: car.speed,
      offTrack,
      lockupWear,
      debrisAbrasion,
      compound: this.currentCompound,
      trackWetnessRatio: wet,
      wheelWearPct: car.wheelWearPct,
      wheelSurfaceTempC: this.currentContactPatch.wheelSurfaceTempC,
      contactPatchWearMult:
        this.currentContactPatch.wearRateMultiplier * this.currentWeatherTyreImpact.wearMultiplier,
      tyreVerticalLoadFactor: activeAero.tyreVerticalLoadFactor,
      thermalFocusReduction,
      dt,
    });
    for (let w = 0; w < 4; w++) {
      car.wheelWearPct[w] = Math.max(4, car.wheelWearPct[w] - wheelDeltas[w]);
    }
    const meanWheelWear =
      (car.wheelWearPct[0] + car.wheelWearPct[1] + car.wheelWearPct[2] + car.wheelWearPct[3]) * 0.25;
    const minWheelWear = Math.min(
      car.wheelWearPct[0],
      car.wheelWearPct[1],
      car.wheelWearPct[2],
      car.wheelWearPct[3]
    );
    car.tyreWearPct = Math.max(5, meanWheelWear * 0.65 + minWheelWear * 0.35);

    const roll = THREE.MathUtils.clamp(-car.lateralVel * 0.014, -0.06, 0.06);
    const pitch = THREE.MathUtils.clamp(brakeIn * 0.035 - throttleIn * 0.02, -0.04, 0.04) + trackSlopePitch;

    const headlightsOn =
      this.liveWeather === 'sunset' ||
      this.liveWeather === 'night' ||
      this.liveWeather === 'rain' ||
      this.liveWeather === 'heavy_rain';
    const exhaustLoad = THREE.MathUtils.clamp(throttleIn * 0.72 + (car.rpm / MAX_RPM) * 0.35, 0.1, 1.0);
    const tyreLoad = THREE.MathUtils.clamp((Math.abs(car.lateralVel) / 8) * 0.7 + (speedKmh / 330) * 0.35, 0.05, 1.0);

    // Carbon-Carbon Brake Disc Thermodynamics (kinetic energy dissipation vs airflow duct cooling)
    const ambientBrakeTemp = isRain ? 240 : 290;
    const speedHeatMult = THREE.MathUtils.clamp(speedKmh / 295, 0.18, 1.25);
    const brakeHeatGain = effectiveBrakeIn * (580 + 780 * speedHeatMult) * dt;
    const ductCoolingRate = (1.1 + (speedKmh / 310) * 2.6) * (isRain ? 1.3 : 1.0);
    car.brakeTempC = THREE.MathUtils.clamp(
      THREE.MathUtils.damp(car.brakeTempC + brakeHeatGain, ambientBrakeTemp, ductCoolingRate, dt),
      ambientBrakeTemp,
      1140
    );

    const avgWheelSurfTemp =
      (this.currentContactPatch.wheelSurfaceTempC[0] +
        this.currentContactPatch.wheelSurfaceTempC[1] +
        this.currentContactPatch.wheelSurfaceTempC[2] +
        this.currentContactPatch.wheelSurfaceTempC[3]) *
      0.25;

    car.model.root.position.copy(car.position);
    car.model.root.rotation.y = car.yaw;
    car.model.updateVisuals(
      (car.speed * dt) / 0.34,
      car.steerAngle,
      car.drsOpen,
      effectiveBrakeIn > 0,
      roll,
      pitch,
      car.shiftFlash,
      headlightsOn,
      exhaustLoad,
      tyreLoad,
      car.damagePct,
      car.brakeTempC,
      this.currentContactPatch.grainingSeverityPct,
      this.currentContactPatch.microSlipRatio,
      avgWheelSurfTemp
    );

    const slipAmount = Math.abs(car.lateralVel) / 6 + (offTrack && absSpeed > 8 ? 0.5 : 0);
    if ((slipAmount > 0.35 || isRain) && absSpeed > 10) {
      this.spawnRearSpray(car);
    }
    if (slipAmount > 0.4 && absSpeed > 12 && !offTrack) {
      this.stampSkidMarks(car);
    }
    // Dynamic Surface Deformation Particles (Marbles, Gravel & Kerb Chips)
    if (offTrack && absSpeed > 12) {
      this.spawnSurfaceDebris(car, 'gravel', 1.25);
    } else if (onKerb && absSpeed > 16) {
      this.spawnSurfaceDebris(car, 'kerb', 1.0);
    } else if ((slipAmount > 0.28 || lineGripEval.offLineRatio > 0.38) && absSpeed > 20) {
      this.spawnSurfaceDebris(car, 'marbles', 0.9);
    }
    if ((speedKmh > 235 || (onKerb && speedKmh > 125)) && Math.random() < 0.65) {
      this.spawnUnderfloorSparks(car);
    }
    if ((car.drsOpen || car.shiftFlash > 0.5 || speedKmh > 270) && Math.random() < 0.72) {
      this.spawnBoostSparks(car);
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

    this.applyDualSenseHaptics({
      dt,
      onKerb,
      offTrack,
      brakeIn: effectiveBrakeIn,
      speedKmh,
      slipRatio: this.currentContactPatch.microSlipRatio,
      shiftFlash: car.shiftFlash,
      wetRatio: wet,
    });

    if (
      this.settings.touchControls &&
      (this.settings.hapticFeedback ?? 'full') !== 'off' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      this.mobileVibrateCooldown = Math.max(0, this.mobileVibrateCooldown - dt);
      if (this.mobileVibrateCooldown <= 0) {
        if (offTrack && speedKmh > 40) {
          this.mobileVibrateCooldown = 0.13;
          this.triggerMobileHaptic('kerb', 1.0);
        } else if (effectiveBrakeIn > 0.25 && speedKmh > 45) {
          // Braking & multi-stage threshold ABS haptic pulse
          const lockupSlip = THREE.MathUtils.clamp((this.currentContactPatch.microSlipRatio - 0.06) * 5.2, 0, 1);
          const brakeIntensity = THREE.MathUtils.clamp(effectiveBrakeIn * 0.62 + lockupSlip * 0.48, 0.28, 1);
          this.mobileVibrateCooldown = lockupSlip > 0.45 ? 0.08 : lockupSlip > 0.25 ? 0.105 : 0.14;
          this.triggerMobileHaptic('brake', brakeIntensity);
        } else if (onKerb && speedKmh > 65) {
          const kerbFreq = Math.max(0.075, 0.145 - (speedKmh / 340) * 0.065);
          this.mobileVibrateCooldown = kerbFreq;
          this.triggerMobileHaptic('kerb', THREE.MathUtils.clamp(0.48 + speedKmh / 420, 0.48, 0.85));
        } else if (car.shiftFlash > 0.85) {
          this.mobileVibrateCooldown = 0.14;
          this.triggerMobileHaptic('shift_up', 0.85);
        } else if (
          throttleIn > 0.65 &&
          speedKmh > 25 &&
          (slipAmount > 0.34 || (wet > 0.4 && speedKmh > 140))
        ) {
          // Wheelspin / wet aquaplane surface loss tremor
          this.mobileVibrateCooldown = 0.12;
          this.triggerMobileHaptic('kerb', 0.52);
        } else if (
          throttleIn > 0.68 &&
          speedKmh > 12 &&
          (car.gear <= 3 || car.manualOverrideActive || slipAmount > 0.25)
        ) {
          // Acceleration launch torque / MGU-K surge haptic pulse
          this.mobileVibrateCooldown = car.manualOverrideActive ? 0.13 : 0.19;
          this.triggerMobileHaptic('accel', car.manualOverrideActive ? 0.88 : 0.55);
        }
      }
    }
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
    const pDensity =
      this.settings.particleDensity ?? (this.settings.graphicsQuality === 'extreme' ? 'ultra' : 'high');
    const sparkCount = pDensity === 'ultra' ? 5 : pDensity === 'high' ? 3 : pDensity === 'medium' ? 2 : 1;
    for (let k = 0; k < sparkCount; k++) {
      const idx = this.sparkCursor % this.sparkPoolSize;
      this.sparkCursor++;
      this.sparkPositions[idx * 3] = car.position.x - fwdX * 2.0 + (Math.random() - 0.5) * 0.65;
      this.sparkPositions[idx * 3 + 1] = car.position.y + 0.12 + Math.random() * 0.10;
      this.sparkPositions[idx * 3 + 2] = car.position.z - fwdZ * 2.0 + (Math.random() - 0.5) * 0.65;

      this.sparkVel[idx * 3] = -fwdX * (10 + Math.random() * 8) + (Math.random() - 0.5) * 4;
      this.sparkVel[idx * 3 + 1] = 1.6 + Math.random() * 3.2;
      this.sparkVel[idx * 3 + 2] = -fwdZ * (10 + Math.random() * 8) + (Math.random() - 0.5) * 4;
      this.sparkLife[idx] = 0.28 + Math.random() * 0.22;
    }
  }

  private spawnBoostSparks(car: RacerEntity) {
    const fwdX = -Math.sin(car.yaw);
    const fwdZ = -Math.cos(car.yaw);
    const pDensity =
      this.settings.particleDensity ?? (this.settings.graphicsQuality === 'extreme' ? 'ultra' : 'high');
    const sparkCount = pDensity === 'ultra' ? 6 : pDensity === 'high' ? 4 : pDensity === 'medium' ? 3 : 2;
    for (let k = 0; k < sparkCount; k++) {
      const idx = this.sparkCursor % this.sparkPoolSize;
      this.sparkCursor++;
      this.sparkPositions[idx * 3] = car.position.x - fwdX * 2.2 + (Math.random() - 0.5) * 0.9;
      this.sparkPositions[idx * 3 + 1] = car.position.y + 0.32 + Math.random() * 0.18;
      this.sparkPositions[idx * 3 + 2] = car.position.z - fwdZ * 2.2 + (Math.random() - 0.5) * 0.9;

      this.sparkVel[idx * 3] = -fwdX * (16 + Math.random() * 12) + (Math.random() - 0.5) * 5;
      this.sparkVel[idx * 3 + 1] = 2.4 + Math.random() * 4.0;
      this.sparkVel[idx * 3 + 2] = -fwdZ * (16 + Math.random() * 12) + (Math.random() - 0.5) * 5;
      this.sparkLife[idx] = 0.38 + Math.random() * 0.25;
    }
  }

  private spawnSurfaceDebris(
    car: RacerEntity,
    type: 'marbles' | 'gravel' | 'kerb',
    intensity = 1.0
  ) {
    const fwdX = -Math.sin(car.yaw);
    const fwdZ = -Math.cos(car.yaw);
    const rightX = Math.cos(car.yaw);
    const rightZ = -Math.sin(car.yaw);
    const speed = Math.abs(car.speed);
    if (speed < 12) return;

    const pDensity =
      this.settings.particleDensity ?? (this.settings.graphicsQuality === 'extreme' ? 'ultra' : 'high');
    const baseCount = pDensity === 'ultra' ? 4 : pDensity === 'high' ? 3 : pDensity === 'medium' ? 2 : 1;
    const count = Math.min(8, Math.max(1, Math.round(baseCount * intensity)));

    for (let k = 0; k < count; k++) {
      const idx = this.surfaceDebrisCursor % this.surfaceDebrisPoolSize;
      this.surfaceDebrisCursor++;
      const side = (k % 2 === 0 ? -1 : 1) * 0.92;

      // Contact patch position behind rear tyres
      this.surfaceDebrisPositions[idx * 3] = car.position.x - fwdX * 1.55 + rightX * side + (Math.random() - 0.5) * 0.28;
      this.surfaceDebrisPositions[idx * 3 + 1] = car.position.y + 0.045 + Math.random() * 0.06;
      this.surfaceDebrisPositions[idx * 3 + 2] = car.position.z - fwdZ * 1.55 + rightZ * side + (Math.random() - 0.5) * 0.28;

      const kickSpeed = speed * (0.32 + Math.random() * 0.22) + (Math.random() - 0.5) * 3.5;
      this.surfaceDebrisVel[idx * 3] = -fwdX * kickSpeed + (Math.random() - 0.5) * 3.2;
      this.surfaceDebrisVel[idx * 3 + 1] = 1.6 + Math.random() * 3.4;
      this.surfaceDebrisVel[idx * 3 + 2] = -fwdZ * kickSpeed + (Math.random() - 0.5) * 3.2;

      this.surfaceDebrisLife[idx] = 0.55 + Math.random() * 0.55;

      if (type === 'marbles') {
        const c = 0.06 + Math.random() * 0.04;
        this.surfaceDebrisColors[idx * 3] = c;
        this.surfaceDebrisColors[idx * 3 + 1] = c;
        this.surfaceDebrisColors[idx * 3 + 2] = c * 1.1;
      } else if (type === 'gravel') {
        const c = 0.38 + Math.random() * 0.22;
        this.surfaceDebrisColors[idx * 3] = c * 1.05;
        this.surfaceDebrisColors[idx * 3 + 1] = c;
        this.surfaceDebrisColors[idx * 3 + 2] = c * 0.94;
      } else {
        const isRed = Math.random() > 0.45;
        this.surfaceDebrisColors[idx * 3] = isRed ? 0.88 : 0.94;
        this.surfaceDebrisColors[idx * 3 + 1] = isRed ? 0.22 : 0.94;
        this.surfaceDebrisColors[idx * 3 + 2] = isRed ? 0.18 : 0.96;
      }
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
      car.aiLaneTimer = 1.6 + Math.random() * 1.8;
      car.aiTargetLane = (Math.random() - 0.5) * (this.builtTrack.trackWidth * 0.52);
    }

    // AI Look-Ahead Surface Hazard Avoidance: shift racing line away from oil spills or debris ahead
    let avoidingHazardAhead = false;
    const halfW = this.builtTrack.trackWidth * 0.5;
    if (this.surfaceHazards.length > 0) {
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
    const wet = this.trackWetness;
    const isRain = wet > 0.25 || this.liveWeather === 'rain' || this.liveWeather === 'heavy_rain';
    const cornerSeverity = Math.max(targetSample.curvature, farSample.curvature);

    // Dynamic 2026 AI Tactical Racecraft: Attacking Overtakes & Inside Defense
    let tacticalLaneOverride: number | null = null;
    let aiSlipstreamBoost = 1.0;
    let aiOverrideAttack = false;
    let gapAheadAi: number | null = null;
    if (this.screen === 'playing' && !car.isPlayer && !car.finished && !avoidingHazardAhead && car.aiPitTimer <= 0) {
      const tLen = this.builtTrack.totalLength || 1000;
      let closestAheadCar: RacerEntity | null = null;
      let closestAheadDist = Infinity;
      let closestBehindDist = Infinity;

      for (let i = 0; i < this.racers.length; i++) {
        const other = this.racers[i];
        if (other.id === car.id || other.finished) continue;
        const pDiff = (other.totalProgress - car.totalProgress) * tLen;
        if (pDiff > 2 && pDiff < 140) {
          const sec = pDiff / 62;
          if (gapAheadAi === null || sec < gapAheadAi) gapAheadAi = sec;
          if (pDiff < closestAheadDist) {
            closestAheadDist = pDiff;
            closestAheadCar = other;
          }
        } else if (pDiff < -2 && pDiff > -26) {
          const distBehind = -pDiff;
          if (distBehind < closestBehindDist) closestBehindDist = distBehind;
        }
      }

      // Slipstream & Manual Override (MOM) Attacking Pass
      if (closestAheadCar && closestAheadDist < 60 && cornerSeverity < 0.1) {
        aiSlipstreamBoost = 1.048;
        if (car.ersCharge > 22) aiOverrideAttack = true;
        if (closestAheadDist < 34 && (car.speed > closestAheadCar.speed - 2 || closestAheadCar.tyreWearPct < 58)) {
          const otherSample = this.builtTrack.findClosestSample(closestAheadCar.position, closestAheadCar.closestIdx);
          const passSign = current.lateralOffset >= otherSample.lateralOffset ? 1 : -1;
          tacticalLaneOverride = passSign * Math.min(halfW - 1.6, Math.max(2.6, halfW * 0.56));
        }
      } else if (closestBehindDist < 22 && cornerSeverity < 0.08 && car.ersCharge > 20) {
        // Legal one-move inside defense when an attacker threatens within 0.4s
        const insideSign = (targetSample.idealLateralOffset ?? 0) >= 0 ? -1 : 1;
        tacticalLaneOverride = insideSign * Math.min(halfW - 1.8, halfW * 0.44);
      }
    }

    // Blend AI target lane toward the apex-hugging ideal racing line unless avoiding hazard or battling
    const targetLaneOffset = avoidingHazardAhead
      ? car.aiTargetLane
      : tacticalLaneOverride !== null
        ? tacticalLaneOverride
        : (targetSample.idealLateralOffset ?? 0) * 0.78 + car.aiTargetLane * 0.36;
    _vecA.copy(targetSample.point).addScaledVector(targetSample.right, targetLaneOffset);
    const dx = _vecA.x - car.position.x;
    const dz = _vecA.z - car.position.z;
    const desiredYaw = Math.atan2(-dx, -dz);

    let yawDiff = desiredYaw - car.yaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

    car.steerAngle = THREE.MathUtils.clamp(yawDiff * 1.4, -0.45, 0.45);
    car.yaw += THREE.MathUtils.clamp(yawDiff, -2.8 * dt, 2.8 * dt);

    // 2026 AI 4-Corner Tyre Degradation & Fuel Burn Simulation
    if (this.screen === 'playing' && !car.finished) {
      const aiCompoundWear =
        car.tyreCompound === 'soft'
          ? 1.48
          : car.tyreCompound === 'hard'
            ? 0.64
            : car.tyreCompound === 'wet' && wet < 0.18
              ? 2.25
              : 1.0;
      const baseAiWear = (0.045 + cornerSeverity * 0.95 + Math.abs(car.lateralVel) * 0.06) * aiCompoundWear * dt;
      const rightLoad = car.steerAngle < -0.04 ? 1.25 : 0.88;
      const leftLoad = car.steerAngle > 0.04 ? 1.25 : 0.88;
      const rearTractionMult = cornerSeverity < 0.1 && car.speed > 42 ? 1.15 : 0.96;
      car.wheelWearPct = [
        Math.max(5, car.wheelWearPct[0] - baseAiWear * leftLoad * 1.05),
        Math.max(5, car.wheelWearPct[1] - baseAiWear * rightLoad * 1.05),
        Math.max(5, car.wheelWearPct[2] - baseAiWear * leftLoad * rearTractionMult),
        Math.max(5, car.wheelWearPct[3] - baseAiWear * rightLoad * rearTractionMult),
      ];
      car.tyreWearPct =
        (car.wheelWearPct[0] + car.wheelWearPct[1] + car.wheelWearPct[2] + car.wheelWearPct[3]) * 0.25;
      const fuelBurnScale = car.fuelPct < 18 ? 0.13 : 0.18; // Lift & coast fuel saving below 18%
      car.fuelPct = Math.max(4, car.fuelPct - fuelBurnScale * dt);
    }

    // 2026 AI Race Strategy & Dynamic Wet-Crossover / Timed Pit Stop Execution
    if (this.screen === 'playing' && !car.isPlayer && !car.finished) {
      if (car.aiPitTimer > 0) {
        car.aiPitTimer = Math.max(0, car.aiPitTimer - dt);
        car.speed = THREE.MathUtils.damp(car.speed, 11.5, 5.5, dt);
        car.drsOpen = false;
        car.activeAeroMode = 'z_mode';
        if (car.aiPitTimer <= 0 && car.aiQueuedCompound) {
          car.tyreCompound = car.aiQueuedCompound;
          car.aiQueuedCompound = null;
          car.tyreWearPct = 100;
          car.wheelWearPct = [100, 100, 100, 100];
          car.pitStops += 1;
          car.model.applyLivery(
            car.team.primaryColor,
            car.team.secondaryColor,
            car.team.accentColor,
            car.team.helmetColor,
            car.wheelFinish,
            car.tyreCompound
          );
        }
      } else {
        const urgentWeatherMismatch =
          (wet > 0.48 && car.tyreCompound !== 'wet') || (wet < 0.14 && car.tyreCompound === 'wet');
        const inPitEntryWindow = urgentWeatherMismatch
          ? current.t > 0.88 || current.t < 0.05
          : current.t > 0.95 || current.t < 0.04;

        if (inPitEntryWindow && car.totalProgress > 0.72) {
          const decision = evaluateAiPitStrategy({
            archetype: car.aiStrategyArchetype,
            currentLap: car.lap,
            totalLaps: this.settings.totalLaps,
            tyreWearPct: car.tyreWearPct,
            currentCompound: car.tyreCompound,
            trackWetnessRatio: wet,
            pitStopsCompleted: car.pitStops,
            gapAheadSec: gapAheadAi,
          });
          if (decision.shouldPit && decision.nextCompound !== car.tyreCompound) {
            car.aiQueuedCompound = decision.nextCompound;
            car.aiPitTimer = 2.4;
          }
        }
      }
    } else if (this.isDynamicWeatherEnabled() && current.t < 0.05 && this.screen === 'title') {
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
      }
    }

    if (car.incidentCooldown > 0) {
      car.incidentCooldown = Math.max(0, car.incidentCooldown - dt);
    }

    const aiHazardEval = this.evaluateSurfaceHazardAt(car.position);
    const aiSecIdx = this.getSectorFromT(current.t) - 1;
    const aiLineGrip = evaluateRacingLineSurfaceGrip(
      current.lateralOffset,
      current.idealLateralOffset,
      halfW,
      this.sectorRubberLevels[aiSecIdx] ?? this.trackRubberLevel,
      this.sectorGripPctState[aiSecIdx] ?? 92,
      wet,
      car.tyreCompound
    );
    car.manualOverrideActive = aiOverrideAttack && car.aiPitTimer <= 0;
    if (car.manualOverrideActive) {
      car.ersCharge = Math.max(0, car.ersCharge - dt * 11);
    } else {
      car.ersCharge = Math.min(100, car.ersCharge + dt * 5.5);
    }

    const aiCompoundGripPace =
      car.tyreCompound === 'soft' ? 1.028 : car.tyreCompound === 'medium' ? 1.0 : car.tyreCompound === 'hard' ? 0.976 : 0.96;
    const aiWearPace = car.tyreWearPct < 35 ? 0.81 + (car.tyreWearPct / 100) * 0.22 : 0.87 + (car.tyreWearPct / 100) * 0.13;
    const aiFuelSavePace = car.fuelPct < 18 ? 0.965 : 1.0;
    const aiAeroStraightBonus = car.activeAeroMode === 'x_mode' && cornerSeverity < 0.1 ? 1.032 : 1.0;
    const weatherPace =
      (1 - wet * (car.tyreCompound === 'wet' ? 0.12 : 0.34)) *
      (avoidingHazardAhead ? 0.93 : 1.0) *
      (0.96 + (aiLineGrip.lineEvolutionGripMultiplier - 1.0) * 0.55) *
      aiCompoundGripPace *
      aiWearPace *
      aiFuelSavePace *
      aiSlipstreamBoost *
      aiAeroStraightBonus *
      (car.manualOverrideActive ? 1.025 : 1.0);
    const maxAiSpeed = 84 * car.aiBasePace * weatherPace * (aiHazardEval.gripMultiplier < 1 ? 0.82 : 1.0);
    let cornerSpeed = Math.max(24, maxAiSpeed * (1 - Math.min(0.68, cornerSeverity * 1.85)));
    if (aiHazardEval.hazardType === 'oil') {
      car.lateralVel += (car.steerAngle >= 0 ? -1 : 1) * 9.5 * dt;
    }

    // Organic AI spin/crash incident on high-curvature corners or wet asphalt during live races
    if (
      this.screen === 'playing' &&
      !car.isPlayer &&
      car.aiPitTimer <= 0 &&
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
    if (car.aiPitTimer > 0) {
      cornerSpeed = 12.0;
      braking = car.speed > 13.5;
    } else if (car.incidentTimer > 0) {
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
    const aiDrsZones = this.builtTrack?.drsZones ?? getCircuitDrsZones(this.currentTrack);
    const aiInDrsZone = findActiveDrsZoneAtT(aiDrsZones, updatedSample.t) !== null;
    car.drsOpen =
      aiInDrsZone &&
      car.aiPitTimer <= 0 &&
      car.incidentTimer <= 0 &&
      cornerSeverity < 0.14 &&
      car.speed > 38 &&
      wet <= 0.48;
    car.activeAeroMode = car.drsOpen ? 'x_mode' : 'z_mode';

    const headlightsOn =
      this.liveWeather === 'sunset' ||
      this.liveWeather === 'night' ||
      this.liveWeather === 'rain' ||
      this.liveWeather === 'heavy_rain';
    const aiRoll = THREE.MathUtils.clamp(-car.steerAngle * (car.speed / 80) * 0.075, -0.06, 0.06);
    const aiPitch = (braking ? 0.028 : -0.014) + aiSlopePitch;
    const aiExhaust = braking ? 0.15 : 0.72;
    const aiTyreLoad = THREE.MathUtils.clamp(Math.abs(car.steerAngle) * 1.4 + (car.speed / 88) * 0.32, 0.08, 1.0);
    const aiAmbientBrake = isRain ? 240 : 290;
    const aiBrakeGain = braking ? (620 + (car.speed / 88) * 720) * dt : 0;
    const aiCoolingRate = 1.2 + (car.speed / 88) * 2.4;
    car.brakeTempC = THREE.MathUtils.clamp(
      THREE.MathUtils.damp(car.brakeTempC + aiBrakeGain, aiAmbientBrake, aiCoolingRate, dt),
      aiAmbientBrake,
      1120
    );
    const aiGrainingSeverity = Math.max(0, Math.min(100, (100 - car.tyreWearPct) * 0.72));
    const aiMicroSlip = THREE.MathUtils.clamp(aiTyreLoad * 0.42, 0.04, 0.85);
    const aiSurfTemp = (isRain ? 72 : 94) + aiTyreLoad * 24;
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
      aiTyreLoad,
      car.damagePct,
      car.brakeTempC,
      aiGrainingSeverity,
      aiMicroSlip,
      aiSurfTemp
    );

    if ((isRain && car.speed > 14 && (car.isPlayer || Math.random() < 0.85)) || (car.incidentTimer > 0 && Math.random() < 0.85)) {
      this.spawnRearSpray(car);
    }
    if (car.incidentTimer > 0.8 && car.speed > 9) {
      this.stampSkidMarks(car);
    }
    if (car.incidentTimer > 0.4 && car.speed > 14 && Math.random() < 0.45) {
      this.spawnSurfaceDebris(car, 'marbles', 0.85);
    }
    if ((car.speed * 3.6 > 245 && Math.random() < 0.3) || (car.incidentTimer > 1.8 && Math.random() < 0.5)) {
      this.spawnUnderfloorSparks(car);
    }
  }

  private resolveCarCollisions() {
    const online = this.settings.onlineGameplay;
    const rulesActive = Boolean(online?.applyOnlineRulesToSession);
    if (rulesActive && online?.collisionMode === 'ghost_all') {
      return;
    }

    const minDist = 2.45;
    for (let i = 0; i < this.racers.length; i++) {
      for (let j = i + 1; j < this.racers.length; j++) {
        const a = this.racers[i];
        const b = this.racers[j];

        if (rulesActive) {
          if (
            online?.collisionMode === 'lap1_ghost' &&
            ((a.lap <= 1 && a.totalProgress < 0.25) || (b.lap <= 1 && b.totalProgress < 0.25))
          ) {
            continue;
          }
          if (
            online?.ghostLappedCars &&
            (a.incidentTimer > 0 || b.incidentTimer > 0 || Math.abs(a.lap - b.lap) >= 1)
          ) {
            continue;
          }
        }
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
              this.triggerMobileHaptic('collision', Math.min(1, relSpeed / 24));
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
          car.finishTimeMs = this.raceElapsedMs + (car.isPlayer ? this.timePenaltySec * 1000 : 0);
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

    if (
      car.isPlayer &&
      this.screen === 'playing' &&
      (this.countdownState === 'go' || this.countdownState === 'racing')
    ) {
      this.updatePlayerDrsZoneState(car, prevT, curT);
    }
  }

  private updatePlayerDrsZoneState(player: RacerEntity, prevT: number, curT: number) {
    const zones = this.builtTrack?.drsZones ?? getCircuitDrsZones(this.currentTrack);

    // Check DRS detection line crossings for authentic <= 1.0s F1 gap qualification
    for (let i = 0; i < zones.length; i++) {
      if (didCrossTrackT(prevT, curT, zones[i].detectionT)) {
        if (this.gameMode === 'time_trial') {
          this.playerDrsGapQualified = true;
        } else {
          const { position, gapAheadSeconds } = this.getGapToCarAhead(player);
          this.playerDrsGapQualified =
            position > 1 && gapAheadSeconds !== null && gapAheadSeconds <= 1.1;
        }
      }
    }

    const activeZone = findActiveDrsZoneAtT(zones, curT);
    const nextZoneId = activeZone?.id ?? null;
    if (nextZoneId !== this.playerDrsZoneId) {
      if (activeZone) {
        this.drsNotification = 'entered';
        this.drsNotificationZoneNumber = activeZone.zoneNumber;
        this.drsNotificationZoneName = activeZone.name;
        this.drsNotificationTimer = 2.6;
        this.drsNotificationSeq += 1;
        this.audio.playDrsBeep(true);
        this.hudEmitAccum = 0.05;
      } else if (this.playerDrsZoneId !== null) {
        const exitedZone = zones.find((z) => z.id === this.playerDrsZoneId) ?? null;
        this.drsNotification = 'exited';
        this.drsNotificationZoneNumber = exitedZone?.zoneNumber ?? null;
        this.drsNotificationZoneName = exitedZone?.name ?? null;
        this.drsNotificationTimer = 2.0;
        this.drsNotificationSeq += 1;
        this.audio.playDrsBeep(false);
        this.hudEmitAccum = 0.05;
      }
      this.playerDrsZoneId = nextZoneId;
    }
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
        raceTimeMs: this.raceElapsedMs + gapSeconds * 1000 + (r.isPlayer ? this.timePenaltySec * 1000 : 0),
        pointsAwarded: CHAMPIONSHIP_POINTS[idx] ?? 0,
        gapSeconds,
        isPlayer: r.isPlayer,
        isRival: !r.isPlayer && r.driverId === this.activeRivalId,
        finished: r.finished,
        tyreCompound: r.tyreCompound,
        pitStops: r.pitStops,
        isPitting: r.aiPitTimer > 0 || (r.isPlayer && this.pitStopTimer > 0),
        timePenaltySec: r.isPlayer ? this.timePenaltySec : 0,
      };
    });
  }

  private spawnRearSpray(car: RacerEntity) {
    const fwdX = -Math.sin(car.yaw);
    const fwdZ = -Math.cos(car.yaw);
    const rightX = Math.cos(car.yaw);
    const rightZ = -Math.sin(car.yaw);
    const isWet = this.trackWetness > 0.2 || this.liveWeather === 'rain' || this.liveWeather === 'heavy_rain';
    const isSnow = this.liveWeather === 'snow' || this.liveWeather === 'blizzard';
    const pDensity =
      this.settings.particleDensity ?? (this.settings.graphicsQuality === 'extreme' ? 'ultra' : 'high');
    const densityAdd = pDensity === 'ultra' ? 2 : pDensity === 'high' ? 1 : 0;
    const plumes = (car.isPlayer && (isWet || isSnow) ? 3 : isWet || isSnow ? 2 : 1) + densityAdd;

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
      this.smokeVel[idx * 3 + 1] = (isWet ? 2.8 : isSnow ? 2.0 : 1.2) + Math.random() * 2.2;
      this.smokeVel[idx * 3 + 2] = -fwdZ * backSpeed + rightZ * (tireSide * 1.15 + (Math.random() - 0.5) * 1.8);
      this.smokeLife[idx] = (isWet || isSnow) ? 0.88 + Math.random() * 0.32 : 0.62;
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

    let debrisUpdated = false;
    for (let i = 0; i < this.surfaceDebrisPoolSize; i++) {
      if (this.surfaceDebrisLife[i] > 0) {
        debrisUpdated = true;
        this.surfaceDebrisLife[i] -= dt;
        this.surfaceDebrisVel[i * 3 + 1] -= 18.0 * dt;
        this.surfaceDebrisVel[i * 3] *= Math.max(0, 1.0 - 0.85 * dt);
        this.surfaceDebrisVel[i * 3 + 2] *= Math.max(0, 1.0 - 0.85 * dt);

        this.surfaceDebrisPositions[i * 3] += this.surfaceDebrisVel[i * 3] * dt;
        this.surfaceDebrisPositions[i * 3 + 1] += this.surfaceDebrisVel[i * 3 + 1] * dt;
        this.surfaceDebrisPositions[i * 3 + 2] += this.surfaceDebrisVel[i * 3 + 2] * dt;

        if (this.surfaceDebrisPositions[i * 3 + 1] < 0.04) {
          this.surfaceDebrisPositions[i * 3 + 1] = 0.04;
          this.surfaceDebrisVel[i * 3 + 1] = -this.surfaceDebrisVel[i * 3 + 1] * 0.35;
          this.surfaceDebrisVel[i * 3] *= 0.65;
          this.surfaceDebrisVel[i * 3 + 2] *= 0.65;
        }

        if (this.surfaceDebrisLife[i] <= 0) {
          this.surfaceDebrisPositions[i * 3 + 1] = -999;
        }
      }
    }
    if (debrisUpdated) {
      this.surfaceDebrisGeo.attributes.position.needsUpdate = true;
      this.surfaceDebrisGeo.attributes.color.needsUpdate = true;
    }

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

    if (this.snowPoints.visible) {
      const cx = this.camera.position.x;
      const cy = this.camera.position.y;
      const cz = this.camera.position.z;
      const fallSpeed = this.liveWeather === 'blizzard' ? 14.5 : 7.2;
      const timeSec = performance.now() * 0.001;
      const windForce = this.liveWeather === 'blizzard' ? 6.2 : 2.5;
      for (let i = 0; i < this.snowCount; i++) {
        const driftX = Math.sin(timeSec * 1.8 + i * 0.5) * windForce;
        const driftZ = Math.cos(timeSec * 1.4 + i * 0.7) * windForce;
        this.snowPositions[i * 3] += driftX * dt;
        this.snowPositions[i * 3 + 1] -= fallSpeed * dt;
        this.snowPositions[i * 3 + 2] += driftZ * dt;
        if (this.snowPositions[i * 3 + 1] < cy - 4) {
          this.snowPositions[i * 3] = cx + (Math.random() - 0.5) * 65;
          this.snowPositions[i * 3 + 1] = cy + 20 + Math.random() * 8;
          this.snowPositions[i * 3 + 2] = cz + (Math.random() - 0.5) * 65;
        }
      }
      this.snowGeo.attributes.position.needsUpdate = true;
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

    const speedKmh = Math.abs(player.speed) * 3.6;
    const gOffsets = calculateCockpitGOffset(
      this.currentGForce.gLong,
      this.currentGForce.gLat,
      speedKmh,
      this.playerOnKerb,
      this.raceElapsedMs * 0.001
    );
    this.cockpitHeadState = stepCockpitHeadPhysics(
      this.cockpitHeadState,
      gOffsets,
      player.steerAngle,
      player.shiftFlash,
      this.playerOnKerb,
      this.playerOffTrack,
      dt
    );
    const head = this.cockpitHeadState;

    if (mode === 'chase') {
      const chaseLag = Math.max(-1.2, Math.min(1.2, this.currentGForce.gLong * 0.35));
      _targetPos.set(
        player.position.x - fwdX * (7.2 + chaseLag) + rightX * (head.offsetRight * 0.5),
        player.position.y + 2.65 + head.offsetY * 0.4,
        player.position.z - fwdZ * (7.2 + chaseLag) + rightZ * (head.offsetRight * 0.5)
      );
      _lookTarget.set(
        player.position.x + fwdX * 9.0,
        player.position.y + 0.9 - head.pitch * 1.8,
        player.position.z + fwdZ * 9.0
      );
    } else if (mode === 'tcam') {
      _targetPos.set(
        player.position.x - fwdX * (0.15 - head.offsetFwd * 0.45) + rightX * (head.offsetRight * 0.38),
        player.position.y + 1.38 + head.offsetY * 0.48,
        player.position.z - fwdZ * (0.15 - head.offsetFwd * 0.45) + rightZ * (head.offsetRight * 0.38)
      );
      _lookTarget.set(
        player.position.x + fwdX * 18.0 + rightX * (head.yaw * 6.5),
        player.position.y + 0.85 - head.pitch * 3.4,
        player.position.z + fwdZ * 18.0 + rightZ * (head.yaw * 6.5)
      );
    } else if (mode === 'cockpit') {
      // Viscoelastic 6-DOF driver head & helmet positional dampening and angular shifts
      const headPosX = fwdX * (0.1 + head.offsetFwd) + rightX * head.offsetRight;
      const headPosY = 0.96 + head.offsetY;
      const headPosZ = fwdZ * (0.1 + head.offsetFwd) + rightZ * head.offsetRight;
      _targetPos.set(
        player.position.x + headPosX,
        player.position.y + headPosY,
        player.position.z + headPosZ
      );
      // Angular pitch (downward nod on braking, upward lift on acceleration) & inertial yaw shift
      const lookDist = 22.0;
      const yawLateralShift = Math.tan(head.yaw) * lookDist;
      const pitchVerticalShift = -Math.tan(head.pitch) * 6.5;
      _lookTarget.set(
        player.position.x + fwdX * lookDist + rightX * yawLateralShift,
        player.position.y + 0.72 + pitchVerticalShift + head.offsetY * 0.65,
        player.position.z + fwdZ * lookDist + rightZ * yawLateralShift
      );
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
    } else if (mode === 'heli') {
      const heliAngle = this.raceElapsedMs * 0.00035;
      const heliDist = 26.0;
      const heliAlt = 20.0;
      _targetPos.set(
        player.position.x + Math.sin(heliAngle) * heliDist - fwdX * 5.0,
        player.position.y + heliAlt,
        player.position.z + Math.cos(heliAngle) * heliDist - fwdZ * 5.0
      );
      _lookTarget.set(player.position.x + fwdX * 3.0, player.position.y + 0.45, player.position.z + fwdZ * 3.0);
    } else if (mode === 'trackside' && this.builtTrack) {
      const samples = this.builtTrack.samples;
      const n = samples.length;
      const curSample = samples[this.tvStationIdx % n];
      _vecB.subVectors(player.position, curSample.point);
      const distSq = _vecB.lengthSq();
      if (distSq > 95 * 95 || _vecB.dot(curSample.tangent) > 28) {
        this.tvStationIdx = (player.closestIdx + 30) % n;
        this.tvStationSide = this.tvStationSide > 0 ? -1 : 1;
        instantCut = true;
      }
      const station = samples[this.tvStationIdx % n];
      const sideOff = (this.builtTrack.trackWidth * 0.5 + 4.5) * this.tvStationSide;
      _targetPos.copy(station.point).addScaledVector(station.right, sideOff);
      _targetPos.y = 0.92;
      _lookTarget.set(player.position.x + fwdX * 1.0, player.position.y + 0.55, player.position.z + fwdZ * 1.0);
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

    if (
      instantCut ||
      ((mode === 'tv_wide' || mode === 'trackside') && _targetPos.distanceToSquared(this.camera.position) > 900)
    ) {
      this.camera.position.copy(_targetPos);
    } else if (mode === 'cockpit') {
      // Cockpit camera uses local viscoelastic head spring-damper state, so lock directly to damped head target
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _targetPos.x, 42, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _targetPos.y, 42, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _targetPos.z, 42, dt);
    } else {
      const damping =
        mode === 'heli'
          ? 6
          : mode === 'trackside'
            ? 32
            : mode === 'chase' || mode === 'side'
              ? 10
              : mode === 'low_track'
                ? 14
                : 28;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _targetPos.x, damping, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _targetPos.y, damping, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _targetPos.z, damping, dt);
    }

    const shakeScale = (this.settings.cameraShakeScale ?? 100) / 100;
    const totalShake = this.shakeIntensity + head.buffetShake;
    if (totalShake > 0.002 && shakeScale > 0.01) {
      const tShake = this.raceElapsedMs * 0.001;
      const waveX = Math.sin(tShake * 68) * 0.55 + Math.cos(tShake * 105) * 0.45;
      const waveY = Math.cos(tShake * 74) * 0.55 + Math.sin(tShake * 123) * 0.45;
      const modeShakeMult = mode === 'cockpit' ? 0.45 : mode === 'tcam' ? 0.65 : 1.0;
      const amp = Math.min(0.36, (this.shakeIntensity * 0.55 + head.buffetShake)) * shakeScale * modeShakeMult;
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

    if (mode === 'cockpit') {
      const kerbRollJudder =
        this.playerOnKerb && shakeScale > 0.01
          ? Math.sin(this.raceElapsedMs * 0.075) * 0.012 * shakeScale
          : 0;
      this.camera.rotation.z += head.roll + kerbRollJudder;
    } else if (mode === 'tcam') {
      this.camera.rotation.z += head.roll * 0.55;
    } else if (mode === 'chase') {
      this.camera.rotation.z += head.roll * 0.22;
    }

    const speedRatio = Math.min(1, Math.abs(player.speed) / 88);
    const camDist = this.camera.position.distanceTo(player.position);
    const fovOff = this.settings.fovOffset ?? 0;
    const targetFov =
      (mode === 'wing_tyre'
        ? 42
        : mode === 'tv_wide' || mode === 'trackside'
          ? THREE.MathUtils.clamp(46 - camDist * 0.38, 22, 44)
          : mode === 'heli'
            ? 52
            : mode === 'low_track'
              ? 62 + speedRatio * 14 + (player.drsOpen ? 3 : 0)
              : 60 + speedRatio * 15 + (player.drsOpen ? 3 : 0)) + fovOff;

    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }

    const focusX = player.position.x + fwdX * 12;
    const focusY = player.position.y;
    const focusZ = player.position.z + fwdZ * 12;
    this.updateSunAndRimRig(focusX, focusY, focusZ, 135);

    if (this.speedPass) {
      this.speedPass.uniforms['uTime'].value = this.raceElapsedMs * 0.001;
      const lensRain = mode === 'cockpit' ? 0.45 : mode === 'tcam' ? 0.75 : 1.0;
      this.speedPass.uniforms['uWetness'].value = Math.max(this.trackWetness, this.curRainOpacity * 0.9) * lensRain;
      const rearFacing = mode === 'chase' || mode === 'low_track';
      this.speedPass.uniforms['uHeatDistort'].value = rearFacing ? (0.18 + speedRatio * 0.52) : 0;
      this.speedPass.uniforms['uGradeContrast'].value =
        this.settings.graphicsQuality === 'ultra_8k'
          ? 0.27
          : this.settings.graphicsQuality === 'extreme' || this.settings.graphicsQuality === 'cinematic'
            ? 0.24
            : this.settings.graphicsQuality === 'ultra'
              ? 0.18
              : 0.14;
      if (this.settings.motionBlur && this.settings.graphicsQuality !== 'low' && this.settings.motionBlurLevel !== 'off') {
        const mbMult =
          this.settings.motionBlurLevel === 'low'
            ? 0.6
            : this.settings.motionBlurLevel === 'high'
              ? 1.4
              : this.settings.motionBlurLevel === 'cinematic'
                ? 1.8
                : 1.0;
        const modeScale =
          mode === 'tv_wide' || mode === 'trackside' ? 0.35 : mode === 'heli' ? 0.2 : mode === 'low_track' ? 1.15 : 1.0;
        const boostFactor =
          (Math.max(0, (speedRatio - 0.55) / 0.45) + (player.drsOpen ? 0.35 : 0)) * modeScale * mbMult;
        this.speedPass.uniforms['uIntensity'].value = THREE.MathUtils.clamp(boostFactor, 0, 1.85);
      } else {
        this.speedPass.uniforms['uIntensity'].value = 0;
      }
      this.updateVolumetricSunUniforms();
    }

    const useCinematicDof = mode === 'low_track' || mode === 'wing_tyre' || mode === 'tv_wide' || mode === 'trackside' || mode === 'heli';
    const dofAperture = mode === 'wing_tyre' ? 0.00022 : (mode === 'tv_wide' || mode === 'trackside' ? 0.00009 : mode === 'heli' ? 0.00006 : 0.00014);
    this.updateBokehPass(useCinematicDof, camDist, dofAperture, mode === 'tv_wide' || mode === 'trackside' ? 0.0042 : 0.0058);
    const raceBloomBoost =
      speedRatio * 0.45 +
      (player.drsOpen ? 0.28 : 0) +
      (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') || this.touchState.brake ? 0.25 : 0) +
      (this.countdownState !== 'go' ? 0.25 : 0);
    this.updateBloomPass(raceBloomBoost, 'race', instantCut, dt);
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
    this.updateBloomPass(0, 'showroom', false, dt);
    this.sunLight.position.set(14, 24, 18);
    this.sunLight.target.position.set(0, 0, 0);

    // Real-time 3D CubeCamera showroom reflections on the Garage F1 car
    if (!this.isSoftwareGl && this.heroCubeCamera && this.heroCubeTarget && this.settings.graphicsQuality !== 'low') {
      this.cubeFrameCounter++;
      if (this.cubeFrameCounter % 2 === 0) {
        this.heroCubeCamera.position.set(0, 0.68, 0);
        const prevVis = this.showroomCar.root.visible;
        this.showroomCar.root.visible = false;
        this.heroCubeCamera.update(this.renderer, this.scene);
        this.showroomCar.root.visible = prevVis;
        this.showroomCar.setBodyEnvMap(this.heroCubeTarget.texture);
      }
    }
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
    this.updateBloomPass(0, 'showroom', false, dt);
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
    this.updateBloomPass(0.35, 'podium', false, dt);
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

    const sectorGripPct = this.computeSectorGripPct();

    const currentSector = this.getSectorFromT(player.lastT);
    this.trackTemperatureC = calculateTrackTemperatureC(
      this.liveWeather,
      this.getEffectiveLiveTimeOfDay(),
      this.trackWetness,
      this.trackRubberLevel,
      this.raceElapsedMs * 0.001
    );
    const currentLapMs = Math.max(0, this.raceElapsedMs - player.lapStartTimeMs);
    const deltaMs =
      player.bestLapMs !== null && player.lastLapMs !== null ? player.lastLapMs - player.bestLapMs : null;
    const { gapAheadSeconds } = this.getGapToCarAhead(player);

    // Hardcore Pro Simulation: Real-time strategy and pit window calculus
    this.currentStrategy = calculatePitStrategy(
      player.lap,
      this.settings.totalLaps,
      this.currentCompound,
      player.tyreWearPct,
      Math.round(this.trackWetness * 100),
      gapAheadSeconds,
      playerStanding?.position ?? 1,
      this.racers.length,
      player.fuelPct,
      this.settings.pitStrategyPlan,
      this.completedPlannedStopIds,
      this.trackTemperatureC
    );

    if (
      this.currentStrategy.tacticalRadioCall &&
      this.currentStrategy.tacticalRadioCall !== this.lastTacticalRadioCall
    ) {
      this.lastTacticalRadioCall = this.currentStrategy.tacticalRadioCall;
      this.audio.playStrategyAlert();
    }

    const drsZones = this.builtTrack.drsZones;
    const activeDrsZone = findActiveDrsZoneAtT(drsZones, player.lastT);
    const drsDisabledByWeather = this.trackWetness > 0.48 || this.liveWeather === 'heavy_rain' || this.liveWeather === 'blizzard';
    const drsGapQualified =
      this.gameMode === 'time_trial' || this.settings.drsAssist !== false || this.playerDrsGapQualified;
    const drsRemainingMeters = activeDrsZone
      ? Math.max(0, Math.round(getDrsZoneRemainingRatio(player.lastT, activeDrsZone) * activeDrsZone.realLengthMeters))
      : null;
    const approachingDrs = !activeDrsZone
      ? findApproachingDrsZone(drsZones, player.lastT, this.currentTrack.lengthKm)
      : null;

    const drsState: DrsStateTelemetry = {
      inZone: Boolean(activeDrsZone),
      zoneNumber: activeDrsZone?.zoneNumber ?? null,
      zoneName: activeDrsZone?.name ?? null,
      totalZones: drsZones.length,
      zoneLengthMeters: activeDrsZone?.realLengthMeters ?? null,
      remainingMeters: drsRemainingMeters,
      approachingMeters: approachingDrs?.metersToEntry ?? null,
      approachingZoneName: approachingDrs?.zone.name ?? null,
      approachingZoneNumber: approachingDrs?.zone.zoneNumber ?? null,
      gapQualified: drsGapQualified,
      disabledByWeather: drsDisabledByWeather,
      notification: this.drsNotification,
      notificationZoneNumber: this.drsNotificationZoneNumber,
      notificationZoneName: this.drsNotificationZoneName,
      notificationSeq: this.drsNotificationSeq,
    };

    const miniMapDrsZones: MiniMapDrsZone[] = this.builtTrack.miniMapDrsZones.map((z) => ({
      ...z,
      active: activeDrsZone?.id === z.id,
    }));

    const currentPos = playerStanding?.position ?? 1;
    if (
      this.screen === 'playing' &&
      this.countdownState === 'racing' &&
      this.raceElapsedMs > 4500 &&
      this.pitStopTimer <= 0 &&
      this.lastTrackedPosition > 0
    ) {
      if (currentPos < this.lastTrackedPosition) {
        const gained = this.lastTrackedPosition - currentPos;
        this.overtakesCount += gained;
        this.bannerMessage = `OVERTAKE +${gained} · P${currentPos}!`;
        this.bannerTimer = 2.0;
        this.audio.playDrsBeep(true);
      }
      this.lastTrackedPosition = currentPos;
    } else if (this.raceElapsedMs <= 4500) {
      this.lastTrackedPosition = currentPos;
    }

    this.callbacks.onTelemetry({
      speedKmh: Math.round(Math.abs(player.speed) * 3.6),
      rpm: Math.round(player.rpm),
      maxRpm: MAX_RPM,
      gear: player.gear,
      drsAvailable: this.playerManualOverrideAvailable,
      drsActive: player.drsOpen,
      ersCharge: Math.round(player.ersCharge),
      fuelPct: Math.round(player.fuelPct),
      tyreWearPct: Math.round(player.tyreWearPct),
      tyreCompound: this.currentCompound,
      lap: Math.min(player.lap, this.settings.totalLaps),
      totalLaps: this.settings.totalLaps,
      position: currentPos,
      totalRacers: this.racers.length,
      currentLapMs,
      lastLapMs: player.lastLapMs,
      bestLapMs: player.bestLapMs,
      deltaMs,
      countdownState: this.countdownState,
      bannerMessage: this.bannerMessage,
      wrongWay,
      miniMapPath: this.builtTrack.miniMapPath,
      miniMapSectorPaths: this.builtTrack.miniMapSectorPaths,
      miniMapRacingLinePaths: this.builtTrack.miniMapRacingLinePaths,
      miniMapStart: this.builtTrack.miniMapStart,
      miniMapBlips,
      miniMapHazards,
      miniMapDrsZones,
      drsState,
      standings,
      cameraMode: this.settings.cameraMode,
      pitBoardActive: this.pitBoardTimer > 0,
      gapAheadSeconds,
      damagePct: Math.round(player.damagePct),
      liveWeather: this.liveWeather,
      nextWeather: this.nextWeather,
      dynamicWeather: this.isDynamicWeatherEnabled(),
      liveTimeOfDay: this.getEffectiveLiveTimeOfDay(),
      trackWetnessPct: Math.round(this.trackWetness * 100),
      trackTemperature: Math.round(this.trackTemperatureC),
      surfaceGripPct: this.playerSurfaceGripPct,
      currentSector,
      sectorGripPct,
      activeSurfaceHazard: this.playerActiveHazard,
      queuedCompound: this.queuedCompound,
      pitStopRemainingSec: Number(this.pitStopTimer.toFixed(1)),
      inPitWindow: this.isPlayerInPitWindow(player),
      trackFlag,
      gForceLat: this.currentGForce.gLat,
      gForceLong: this.currentGForce.gLong,
      gForceTotal: this.currentGForce.gTotal,
      pitStrategy: this.currentStrategy,
      tyreContactPatch: this.currentContactPatch,
      weatherTyreImpact: this.currentWeatherTyreImpact,
      slipstreamPct: Math.round(this.playerSlipstreamPct * 100),
      dirtyAirPct: Math.round(this.playerDirtyAirPct * 100),
      activeAeroMode: player.activeAeroMode,
      manualOverrideAvailable: this.playerManualOverrideAvailable,
      manualOverrideActive: player.manualOverrideActive,
      mgukPowerKw: player.mgukPowerKw,
      wheelWearPct: [
        Math.round(player.wheelWearPct[0]),
        Math.round(player.wheelWearPct[1]),
        Math.round(player.wheelWearPct[2]),
        Math.round(player.wheelWearPct[3]),
      ],
      trackLimitWarnings: this.trackLimitWarnings,
      timePenaltySec: this.timePenaltySec,
      overtakesCount: this.overtakesCount,
      launchFeedback: this.launchFeedback,
      ersMode: this.ersMode,
      brakeBiasPct: this.brakeBiasPct,
      dualsenseConnected: this.dualsenseConnected,
      dualsenseName: this.dualsenseName,
      throttleInputPct: this.playerThrottleInputPct,
      brakeInputPct: this.playerBrakeInputPct,
    });
  }

  private computeSectorGripPct(): [number, number, number] {
    const player = this.racers.find((r) => r.isPlayer);
    const effectiveLaps = this.gameMode === 'time_trial' ? 3 : Math.max(1, this.settings.totalLaps);
    const gridCount = Math.max(1, this.racers.length);
    const playerProg = player ? Math.max(0, player.totalProgress) : 0;

    const hazardMults: [number, number, number] = [1.0, 1.0, 1.0];
    for (const hz of this.surfaceHazards) {
      const sIdx = hz.sector - 1;
      if (hz.gripMultiplier < hazardMults[sIdx]) {
        hazardMults[sIdx] = hz.gripMultiplier;
      }
    }

    const evolution = calculateTrackSurfaceEvolution({
      completedRaceLaps: this.completedRaceLaps,
      gridCount,
      playerTotalProgress: playerProg,
      totalLaps: effectiveLaps,
      sectorDepositionAccum: this.sectorDepositionAccum,
      sectorCurvatureLoad: this.builtTrack?.sectorCurvatureLoad,
      trackWetnessRatio: this.trackWetness,
      compound: this.currentCompound,
      sectorHazardMultipliers: hazardMults,
    });

    this.sectorRubberLevels = evolution.sectorRubberLevels;
    this.sectorGripPctState = evolution.sectorGripPct;
    return evolution.sectorGripPct;
  }

  private computeTrackFlag(player: RacerEntity, trackLen: number): TrackFlagState {
    if (!this.builtTrack || this.screen !== 'playing' || (this.countdownState !== 'go' && this.countdownState !== 'racing')) {
      return { flag: 'none', reason: '', distanceMeters: null };
    }

    const totalLaps = Math.max(1, this.settings.totalLaps);
    const leaderFinished = this.gameMode !== 'time_trial' && this.racers.some((r) => r.finished);
    const onFinalSprint =
      this.gameMode !== 'time_trial' &&
      player.lap >= totalLaps &&
      player.lastT >= 0.80 &&
      this.raceElapsedMs > 8000;

    // 1. Checkered Flag: Waving at finish line on final lap sprint or once race leader finishes
    if (leaderFinished || onFinalSprint) {
      const distToLine = Math.max(1, Math.round((1 - player.lastT) * trackLen));
      return {
        flag: 'checkered',
        reason: leaderFinished
          ? 'RACE LEADER FINISHED — TAKE CHECKERED FLAG'
          : 'FINAL SECTOR SPRINT — CHECKERED FLAG AHEAD',
        distanceMeters: distToLine,
        sector: 3,
        marshalPost: 18,
        subDirective: 'FINISH LINE MARSHAL POST · FULL THROTTLE TO THE LINE',
      };
    }

    let nearestYellowDist = Infinity;
    let yellowReason = '';
    let yellowSector: 1 | 2 | 3 = this.getSectorFromT(player.lastT);
    let yellowPost = Math.max(1, Math.min(18, Math.ceil(player.lastT * 18)));
    let yellowDriverCode = '';
    let severeBlockageDist = Infinity;
    let severeBlockageReason = '';
    let severeSector: 1 | 2 | 3 = yellowSector;
    let severePost = yellowPost;
    let severeDriverCode = '';
    let activeIncidentCountAhead = 0;

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

      if ((trackDistAhead > 3 && trackDistAhead <= 240) || (euclidDist <= 170 && trackDistAhead < trackLen * 0.45)) {
        const effectiveDist = Math.min(trackDistAhead > 1 ? trackDistAhead : euclidDist, euclidDist);
        const rSector = this.getSectorFromT(r.lastT);
        const rPost = Math.max(1, Math.min(18, Math.ceil(r.lastT * 18)));
        const lastName = r.name.split(' ').pop()?.toUpperCase() ?? 'CAR';
        const code = lastName.slice(0, 3);

        if (isSidewaysOrSpun) {
          activeIncidentCountAhead += 1;
        }

        // Severe stopped/reversed car blocking track or multi-car incident triggers Red Flag condition
        const isTrackBlocked =
          this.raceElapsedMs > 5500 &&
          ((alignment < 0.18 && r.speed < 7.5 && effectiveDist <= 165) || activeIncidentCountAhead >= 2);
        if (isTrackBlocked && effectiveDist < severeBlockageDist) {
          severeBlockageDist = effectiveDist;
          severeSector = rSector;
          severePost = rPost;
          severeDriverCode = code;
          severeBlockageReason =
            activeIncidentCountAhead >= 2
              ? `MULTI-CAR INCIDENT IN SECTOR ${rSector} (${lastName})`
              : `TRACK BLOCKED — ${lastName} STOPPED ON RACING LINE`;
        }

        if (effectiveDist < nearestYellowDist) {
          nearestYellowDist = effectiveDist;
          yellowSector = rSector;
          yellowPost = rPost;
          yellowDriverCode = code;
          yellowReason =
            r.incidentTimer > 0 || alignment < 0.65
              ? `INCIDENT AHEAD — ${lastName} SPUN IN S${rSector}`
              : `CAUTION — SLOW CAR AHEAD (${lastName})`;
        }
      }
    }

    // 2. Red Flag: Multi-car blockage ahead or critical player barrier damage
    if (severeBlockageDist < Infinity || player.damagePct >= 82) {
      const playerSector = this.getSectorFromT(player.lastT);
      const playerPost = Math.max(1, Math.min(18, Math.ceil(player.lastT * 18)));
      return {
        flag: 'red',
        reason:
          severeBlockageDist < Infinity
            ? severeBlockageReason
            : `CRITICAL CHASSIS DAMAGE (${Math.round(player.damagePct)}%) — BOX IMMEDIATELY`,
        distanceMeters:
          severeBlockageDist < Infinity ? Math.max(5, Math.round(severeBlockageDist)) : null,
        sector: severeBlockageDist < Infinity ? severeSector : playerSector,
        marshalPost: severeBlockageDist < Infinity ? severePost : playerPost,
        subDirective: 'RED FLAG CONDITION · NO OVERTAKING · REDUCE SPEED & PREPARE FOR PIT LANE',
        driverCode: severeDriverCode || undefined,
      };
    }

    // 3. Yellow Flag: Single-car spin, slow car ahead, or player off-axis recovery
    if (nearestYellowDist < Infinity || player.incidentTimer > 0.15) {
      const playerSector = this.getSectorFromT(player.lastT);
      const playerPost = Math.max(1, Math.min(18, Math.ceil(player.lastT * 18)));
      return {
        flag: 'yellow',
        reason:
          nearestYellowDist < Infinity
            ? yellowReason
            : `LOCAL YELLOW — RECOVERING TRACTION IN S${playerSector}`,
        distanceMeters:
          nearestYellowDist < Infinity ? Math.max(5, Math.round(nearestYellowDist)) : null,
        sector: nearestYellowDist < Infinity ? yellowSector : playerSector,
        marshalPost: nearestYellowDist < Infinity ? yellowPost : playerPost,
        subDirective: 'NO OVERTAKING IN MARSHAL SECTOR · DRS AUTOMATICALLY DISABLED',
        driverCode: yellowDriverCode || undefined,
      };
    }

    // 4. Surface Flag (FIA Yellow/Red Striped): oil spill or carbon debris ahead in sector
    let nearestSurfaceDist = Infinity;
    let surfaceReason = '';
    let surfaceSector: 1 | 2 | 3 = 1;
    let surfacePost = 1;
    for (const hz of this.surfaceHazards) {
      const fracAhead = (((hz.t - player.lastT) % 1) + 1) % 1;
      const trackDistAhead = fracAhead * trackLen;
      const euclidDist = hz.position.distanceTo(player.position);
      if ((trackDistAhead > 2 && trackDistAhead <= 195) || (euclidDist <= 130 && trackDistAhead < trackLen * 0.35)) {
        const effectiveDist = Math.min(trackDistAhead > 1 ? trackDistAhead : euclidDist, euclidDist);
        if (effectiveDist < nearestSurfaceDist) {
          nearestSurfaceDist = effectiveDist;
          surfaceSector = hz.sector;
          surfacePost = Math.max(1, Math.min(18, Math.ceil(hz.t * 18)));
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
        sector: surfaceSector,
        marshalPost: surfacePost,
        subDirective: 'REDUCED SURFACE ADHESION · AVOID OFF-LINE DEBRIS FIELD',
      };
    }

    // 5. Blue Flag: faster lapping car or high-speed overtaking car approaching closely behind player
    let nearestBlueDist = Infinity;
    let blueReason = '';
    let blueDriverCode = '';
    for (const r of this.racers) {
      if (r.isPlayer || r.finished) continue;
      const isLappingPlayer = r.totalProgress - player.totalProgress >= 0.72;
      const fracBehind = (((player.lastT - r.lastT) % 1) + 1) % 1;
      const trackDistBehind = fracBehind * trackLen;
      const isRapidClosingCar =
        this.raceElapsedMs > 9000 &&
        trackDistBehind > 2 &&
        trackDistBehind <= 72 &&
        r.speed > player.speed + 5.8;

      if (!isLappingPlayer && !isRapidClosingCar) continue;

      if (trackDistBehind > 1 && trackDistBehind <= 125 && r.speed > player.speed * 0.82) {
        if (trackDistBehind < nearestBlueDist) {
          nearestBlueDist = trackDistBehind;
          const lastName = r.name.split(' ').pop()?.toUpperCase() ?? 'LEAD';
          blueDriverCode = lastName.slice(0, 3);
          blueReason = isLappingPlayer
            ? `YIELD TO LAPPING LEADER (${lastName})`
            : `FASTER CAR CLOSING FAST BEHIND (${lastName})`;
        }
      }
    }

    if (nearestBlueDist < Infinity) {
      const playerSector = this.getSectorFromT(player.lastT);
      const playerPost = Math.max(1, Math.min(18, Math.ceil(player.lastT * 18)));
      return {
        flag: 'blue',
        reason: blueReason,
        distanceMeters: Math.max(3, Math.round(nearestBlueDist)),
        sector: playerSector,
        marshalPost: playerPost,
        subDirective: 'CHECK MIRRORS · ALLOW FASTER CAR CLEAN PASSING CORRIDOR',
        driverCode: blueDriverCode || undefined,
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
