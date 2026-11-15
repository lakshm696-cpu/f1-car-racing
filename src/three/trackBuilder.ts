import * as THREE from 'three';
import { CircuitTrack, DrsZoneConfig, GraphicsQuality, MiniMapDrsZone, TimeOfDayMode, WeatherMode } from '../types/racing';
import { getCircuitDrsZones, getCircuitEnvironmentConfig } from './circuitEnvironments';
import {
  AtmosphereRuntimeState,
  buildCircuitEnvironment,
} from './environmentBuilder';
import { ProceduralTextureSet } from './textures';

export interface TrackSample {
  t: number;
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  curvature: number;
  idealLateralOffset?: number;
}

export interface BuiltTrack {
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  samples: TrackSample[];
  totalLength: number;
  trackWidth: number;
  sectorCurvatureLoad: [number, number, number];
  startLights: THREE.MeshStandardMaterial[];
  drsZones: DrsZoneConfig[];
  miniMapPath: string;
  miniMapSectorPaths: [string, string, string];
  miniMapRacingLinePaths: [string, string, string];
  miniMapStart: { x: number; y: number };
  miniMapDrsZones: Omit<MiniMapDrsZone, 'active'>[];
  updateTime: (elapsedSec: number) => void;
  updateDrsOverlays: (elapsedSec: number, drsAvailable: boolean, drsActive: boolean) => void;
  updateAtmosphereState: (state: AtmosphereRuntimeState) => void;
  setSurfaceWetness: (wetness: number) => void;
  setSurfaceRubbering: (rubberLevel: number, sectorRubber?: [number, number, number]) => void;
  setRacingLineMode: (mode: 'off' | 'corners' | 'full') => void;
  worldToMiniMap: (x: number, z: number) => { x: number; y: number };
  findClosestSample: (pos: THREE.Vector3, hintIndex?: number) => {
    index: number;
    t: number;
    point: THREE.Vector3;
    tangent: THREE.Vector3;
    right: THREE.Vector3;
    lateralOffset: number;
    idealLateralOffset: number;
  };
  getFrameAtT: (t: number) => {
    point: THREE.Vector3;
    tangent: THREE.Vector3;
    right: THREE.Vector3;
  };
  dispose: () => void;
}

export function buildCircuitTrack(
  track: CircuitTrack,
  textures: ProceduralTextureSet,
  weather: WeatherMode,
  quality: GraphicsQuality = 'extreme',
  timeOfDay?: TimeOfDayMode
): BuiltTrack {
  const group = new THREE.Group();
  const controlVecs = track.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(controlVecs, true, 'catmullrom', 0.45);
  const totalLength = curve.getLength();
  const sampleCount = 360;
  const samples: TrackSample[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const halfWTmp = track.trackWidth * 0.5;

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleCount;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    samples.push({ t, point, tangent, right, curvature: 0, idealLateralOffset: 0 });
  }

  const rawIdealOffsets = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const prev = samples[(i - 2 + sampleCount) % sampleCount];
    const next = samples[(i + 2) % sampleCount];
    samples[i].curvature = prev.tangent.angleTo(next.tangent);

    const nextApex = samples[(i + 6) % sampleCount];
    const prevApex = samples[(i - 4 + sampleCount) % sampleCount];
    const turnCross =
      (samples[i].tangent.x * nextApex.tangent.z - samples[i].tangent.z * nextApex.tangent.x) * 0.68 +
      (prevApex.tangent.x * samples[i].tangent.z - prevApex.tangent.z * samples[i].tangent.x) * 0.32;
    rawIdealOffsets[i] = THREE.MathUtils.clamp(turnCross * halfWTmp * 2.1, -halfWTmp * 0.54, halfWTmp * 0.54);
  }

  // Smooth the ideal racing line offset across a circular 7-tap window so apex transitions are silky-smooth
  const kernelWeights = [0.07, 0.12, 0.18, 0.26, 0.18, 0.12, 0.07];
  for (let i = 0; i < sampleCount; i++) {
    let accum = 0;
    for (let k = -3; k <= 3; k++) {
      const idx = (i + k + sampleCount) % sampleCount;
      accum += rawIdealOffsets[idx] * kernelWeights[k + 3];
    }
    samples[i].idealLateralOffset = accum;
  }

  // Compute relative sector cornering/braking shear load (0.85..1.25) for S1, S2, S3 rubber deposition
  const sectorCurvatureSums: [number, number, number] = [0, 0, 0];
  const thirdCount = sampleCount / 3;
  for (let i = 0; i < sampleCount; i++) {
    const secIdx = Math.min(2, Math.floor(i / thirdCount));
    sectorCurvatureSums[secIdx] += samples[i].curvature;
  }
  const avgCurv = Math.max(0.001, (sectorCurvatureSums[0] + sectorCurvatureSums[1] + sectorCurvatureSums[2]) / 3);
  const sectorCurvatureLoad: [number, number, number] = [
    THREE.MathUtils.clamp(0.88 + (sectorCurvatureSums[0] / avgCurv - 1.0) * 0.35, 0.85, 1.25),
    THREE.MathUtils.clamp(0.88 + (sectorCurvatureSums[1] / avgCurv - 1.0) * 0.35, 0.85, 1.25),
    THREE.MathUtils.clamp(0.88 + (sectorCurvatureSums[2] / avgCurv - 1.0) * 0.35, 0.85, 1.25),
  ];

  // 0. AAA 3D Sky, Volumetric Clouds, Terrain, Horizon Ridges, Biome Forests & Signature Circuit Landmarks
  const envCfg = getCircuitEnvironmentConfig(track);
  const effTod: TimeOfDayMode =
    timeOfDay ??
    (weather === 'night'
      ? 'night'
      : weather === 'sunset'
        ? 'sunset'
        : envCfg.defaultTimeOfDay);
  const isNight = effTod === 'night' || weather === 'night';
  const isRain = weather === 'rain' || weather === 'heavy_rain';
  const isSunset = effTod === 'sunset' || effTod === 'golden_hour' || weather === 'sunset';
  const builtEnv = buildCircuitEnvironment(track, samples, textures, weather, quality, effTod);
  group.add(builtEnv.group);

  // 2. Astroturf Verge & Gravel Runoff Borders
  const halfW = track.trackWidth * 0.5;
  const barrierOffset = halfW + 6.5;

  const astroMat = new THREE.MeshStandardMaterial({
    color: isNight ? 0x0f2d1e : isSunset ? 0x14532d : 0x166534,
    roughness: 0.88,
  });
  group.add(createRibbonMesh(samples, -halfW - 2.1, -halfW - 1.0, 0.018, astroMat, totalLength / 10));
  group.add(createRibbonMesh(samples, halfW + 1.0, halfW + 2.1, 0.018, astroMat, totalLength / 10));

  const isDesertTrack = envCfg.terrain.groundStyle === 'desert';
  const gravelMat = new THREE.MeshStandardMaterial({
    map: isDesertTrack ? textures.desertSandMap : textures.gravelMap,
    color: isNight ? 0x3b3833 : isSunset ? 0x8a7562 : isDesertTrack ? 0xd9b382 : 0xa89f91,
    roughness: 0.95,
    metalness: 0.02,
  });
  const leftGravel = createRibbonMesh(samples, -barrierOffset, -halfW - 2.05, 0.012, gravelMat, totalLength / 8);
  leftGravel.receiveShadow = true;
  group.add(leftGravel);

  const rightGravel = createRibbonMesh(samples, halfW + 2.05, barrierOffset, 0.012, gravelMat, totalLength / 8);
  rightGravel.receiveShadow = true;
  group.add(rightGravel);

  // 3. High-Fidelity Asphalt Road Ribbon (+ Wet Rain Shimmer / Progressive Racing Line Darkening / Off-Line Marbles)
  const rainUniform = { value: 0 };
  const wetnessUniform = { value: isRain ? (weather === 'heavy_rain' ? 1.0 : 0.78) : 0.0 };
  const rubberLevelUniform = { value: 0.0 };
  const sectorRubberUniform = { value: new THREE.Vector3(0, 0, 0) };
  const roadMat = new THREE.MeshPhysicalMaterial({
    map: textures.asphaltMap,
    normalMap: textures.asphaltNormalMap,
    normalScale: new THREE.Vector2(0.48, 0.48),
    roughnessMap: textures.asphaltRoughnessMap,
    color: isRain ? (weather === 'heavy_rain' ? 0x12161e : 0x181c24) : 0xffffff,
    roughness: isRain ? (weather === 'heavy_rain' ? 0.14 : 0.19) : isSunset ? 0.44 : 0.82,
    metalness: isRain ? 0.34 : isSunset ? 0.16 : 0.06,
    clearcoat: isRain ? 0.96 : isSunset ? 0.28 : 0.06,
    clearcoatRoughness: isRain ? 0.05 : isSunset ? 0.24 : 0.44,
    ior: 1.5,
    specularIntensity: 1.0,
    envMapIntensity: isRain ? 2.35 : isSunset ? 1.58 : 1.05,
  });

  roadMat.onBeforeCompile = (shader) => {
    shader.uniforms.uRainTime = rainUniform;
    shader.uniforms.uWetnessLevel = wetnessUniform;
    shader.uniforms.uRubberLevel = rubberLevelUniform;
    shader.uniforms.uSectorRubber = sectorRubberUniform;
    shader.vertexShader =
      'attribute float aIdealLineU;\nattribute float aTrackProgressT;\nvarying vec3 vTrackWorldPos;\nvarying vec2 vRoadUv;\nvarying float vIdealLineU;\nvarying float vTrackProgressT;\n' +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vTrackWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vRoadUv = uv;
      vIdealLineU = aIdealLineU;
      vTrackProgressT = aTrackProgressT;`
    );
    shader.fragmentShader =
      'uniform float uRainTime;\nuniform float uWetnessLevel;\nuniform float uRubberLevel;\nuniform vec3 uSectorRubber;\nvarying vec3 vTrackWorldPos;\nvarying vec2 vRoadUv;\nvarying float vIdealLineU;\nvarying float vTrackProgressT;\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      {
        float secPos = vTrackProgressT * 3.0;
        float secRub = secPos < 1.0
          ? mix(uSectorRubber.x, uSectorRubber.y, smoothstep(0.82, 1.0, secPos))
          : (secPos < 2.0
            ? mix(uSectorRubber.y, uSectorRubber.z, smoothstep(1.82, 2.0, secPos))
            : mix(uSectorRubber.z, uSectorRubber.x, smoothstep(2.82, 3.0, secPos)));
        float effRubber = clamp(max(uRubberLevel, secRub), 0.0, 1.0);
        if (effRubber > 0.005) {
          float dLine = abs(vRoadUv.x - vIdealLineU);
          float leftWheelDist = abs((vRoadUv.x - vIdealLineU) + 0.052);
          float rightWheelDist = abs((vRoadUv.x - vIdealLineU) - 0.052);
          float wheelGrooves = exp(-leftWheelDist * leftWheelDist * 760.0) + exp(-rightWheelDist * rightWheelDist * 760.0);
          float centerCorridor = exp(-dLine * dLine * 110.0);
          float longStreaks = 0.80 + 0.20 * sin(vRoadUv.y * 64.0 + sin(vRoadUv.x * 38.0) * 2.2) * cos(vRoadUv.y * 21.0);
          float rubberGrooveMask = clamp((centerCorridor * 0.50 + wheelGrooves * 0.62) * longStreaks, 0.0, 1.0);
          // Progressive darkening of the apex-hugging racing line as polymer lays down
          diffuseColor.rgb *= (1.0 - rubberGrooveMask * effRubber * 0.48);

          // Off-line dusty surface & shed vulcanized tyre rubber marbles ('clag')
          float offLineZone = smoothstep(0.16, 0.34, dLine);
          if (offLineZone > 0.01) {
            float mCell = fract(sin(dot(floor(vRoadUv * vec2(170.0, 880.0)), vec2(12.9898, 78.233))) * 43758.5453);
            float marbleClag = step(0.935 - effRubber * 0.085, mCell) * offLineZone * effRubber;
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 1.05, 1.03), offLineZone * effRubber * 0.16);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.035, 0.045), marbleClag * 0.72);
          }
        }
      }`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      {
        float secPosR = vTrackProgressT * 3.0;
        float secRubR = secPosR < 1.0 ? uSectorRubber.x : (secPosR < 2.0 ? uSectorRubber.y : uSectorRubber.z);
        float effRubberR = clamp(max(uRubberLevel, secRubR), 0.0, 1.0);
        if (effRubberR > 0.005) {
          float dLineR = abs(vRoadUv.x - vIdealLineU);
          float groovePolish = exp(-dLineR * dLineR * 120.0) * effRubberR;
          float offLineRough = smoothstep(0.18, 0.36, dLineR) * effRubberR;
          roughnessFactor = clamp(roughnessFactor - groovePolish * 0.28 + offLineRough * 0.12, 0.04, 1.0);
        }
      }
      if (uWetnessLevel > 0.05) {
        float puddleA = sin(vTrackWorldPos.x * 0.14) * cos(vTrackWorldPos.z * 0.14);
        float puddleB = sin((vTrackWorldPos.x + vTrackWorldPos.z) * 0.085) * 0.55 + cos((vTrackWorldPos.x - vTrackWorldPos.z) * 0.21) * 0.35;
        float puddleMask = smoothstep(0.14, 0.65, puddleA + puddleB) * uWetnessLevel;
        float rCellA = sin(vTrackWorldPos.x * 2.6 + uRainTime * 5.1) * cos(vTrackWorldPos.z * 2.6 - uRainTime * 4.4);
        float rCellB = cos(vTrackWorldPos.x * 4.3 - uRainTime * 6.0) * sin(vTrackWorldPos.z * 4.3 + uRainTime * 5.5);
        float rippleRing = smoothstep(0.58, 0.98, abs(rCellA * 0.62 + rCellB * 0.38)) * uWetnessLevel;
        roughnessFactor = clamp(roughnessFactor - puddleMask * 0.36 - rippleRing * 0.18, 0.018, 1.0);
      }`
    );
  };

  const roadMesh = createRibbonMesh(samples, -halfW, halfW, 0.025, roadMat, totalLength / 14);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Crisp FIA White Track-Edge Boundary Lines
  const edgeLineMat = new THREE.MeshStandardMaterial({
    color: isNight ? 0xcbd5e1 : 0xf1f5f9,
    roughness: isRain ? 0.2 : 0.48,
    metalness: 0.08,
  });
  const leftEdgeLine = createRibbonMesh(samples, -halfW + 0.14, -halfW + 0.36, 0.029, edgeLineMat, totalLength / 14);
  leftEdgeLine.receiveShadow = true;
  group.add(leftEdgeLine);
  const rightEdgeLine = createRibbonMesh(samples, halfW - 0.36, halfW - 0.14, 0.029, edgeLineMat, totalLength / 14);
  rightEdgeLine.receiveShadow = true;
  group.add(rightEdgeLine);

  // 3b. PS5 F1 3D Dynamic Racing Line (Green Acceleration -> Amber Lift -> Red Braking Zone)
  const racingLineMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const racingLineFullMesh = createDynamicRacingLineRibbon(samples, halfW, racingLineMat, false);
  const racingLineCornersMesh = createDynamicRacingLineRibbon(samples, halfW, racingLineMat, true);
  racingLineFullMesh.visible = false;
  racingLineCornersMesh.visible = true;
  group.add(racingLineFullMesh);
  group.add(racingLineCornersMesh);

  // 4. FIA Serrated Kerbs with Micro-Relief Normal Detail
  const kerbMat = new THREE.MeshPhysicalMaterial({
    map: textures.kerbMap,
    normalMap: textures.asphaltNormalMap,
    normalScale: new THREE.Vector2(0.22, 0.22),
    roughness: isRain ? 0.24 : 0.56,
    metalness: 0.08,
    clearcoat: isRain ? 0.72 : 0.14,
    clearcoatRoughness: 0.18,
  });
  const leftKerb = createRibbonMesh(samples, -halfW - 1.15, -halfW + 0.05, 0.038, kerbMat, totalLength / 4);
  leftKerb.receiveShadow = true;
  group.add(leftKerb);

  const rightKerb = createRibbonMesh(samples, halfW - 0.05, halfW + 1.15, 0.038, kerbMat, totalLength / 4);
  rightKerb.receiveShadow = true;
  group.add(rightKerb);

  // 5. Outer Safety Barriers + Embankment Hillside Skirts + Catch Fencing + TecPro Corner Blocks
  const embankmentMat = new THREE.MeshStandardMaterial({
    map: isDesertTrack ? textures.desertSandMap : textures.groundGrassMap,
    color: isNight
      ? new THREE.Color(envCfg.terrain.groundTintHex).multiplyScalar(0.32)
      : isRain
        ? new THREE.Color(envCfg.terrain.groundTintHex).multiplyScalar(0.65)
        : envCfg.terrain.groundTintHex,
    roughness: 0.94,
    metalness: 0.02,
  });
  group.add(createWallRibbon(samples, -barrierOffset, 18.5, embankmentMat, -18.5));
  group.add(createWallRibbon(samples, barrierOffset, 18.5, embankmentMat, -18.5));

  const barrierMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    normalMap: textures.asphaltNormalMap,
    normalScale: new THREE.Vector2(0.14, 0.14),
    roughness: 0.36,
    metalness: 0.58,
  });
  const barrierAccentMat = new THREE.MeshStandardMaterial({
    color: envCfg.trackside.ledRibbonHex,
    emissive: isNight || isSunset ? envCfg.trackside.ledRibbonHex : 0x000000,
    emissiveIntensity: isNight ? 1.55 : isSunset ? 0.85 : 0,
    roughness: 0.35,
    metalness: 0.3,
  });

  group.add(createWallRibbon(samples, -barrierOffset, 1.05, barrierMat));
  group.add(createWallRibbon(samples, barrierOffset, 1.05, barrierMat));
  group.add(createWallRibbon(samples, -barrierOffset + 0.06, 0.32, barrierAccentMat, 0.72));
  group.add(createWallRibbon(samples, barrierOffset - 0.06, 0.32, barrierAccentMat, 0.72));

  // Catch-fence along start/finish straight & high-speed sectors
  const fenceMat = new THREE.MeshStandardMaterial({
    map: textures.fenceAlphaMap,
    transparent: true,
    alphaTest: 0.25,
    side: THREE.DoubleSide,
    roughness: 0.5,
    metalness: 0.65,
  });
  const straightSamples = [...samples.slice(sampleCount - 28), ...samples.slice(0, 32)];
  group.add(createWallRibbon(straightSamples, -barrierOffset - 0.25, 2.4, fenceMat, 1.05));
  group.add(createWallRibbon(straightSamples, barrierOffset + 0.25, 2.4, fenceMat, 1.05));

  // TecPro / Tyre Barrier Blocks on outside of high-curvature corners
  const tecProRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 });
  const tecProWhite = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.55 });
  for (let i = 6; i < sampleCount - 6; i += 3) {
    if (samples[i].curvature > 0.14) {
      const f = samples[i];
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 1.15, 2.4),
        i % 6 === 0 ? tecProRed : tecProWhite
      );
      block.position.copy(f.point).addScaledVector(f.right, barrierOffset - 0.65);
      block.position.y = f.point.y + 0.58;
      block.rotation.y = Math.atan2(-f.tangent.x, -f.tangent.z);
      block.castShadow = true;
      group.add(block);
    }
  }

  // 6. Trackside Sponsor Hoardings, LED Marshal Panels, Arch Bridges & Braking Boards
  const sponsorMat = new THREE.MeshStandardMaterial({
    map: textures.sponsorBoardMap,
    roughness: 0.4,
    metalness: 0.18,
  });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.68, roughness: 0.32 });
  for (let i = 10; i < sampleCount; i += 34) {
    const f = samples[i];
    const side = i % 68 === 10 ? 1 : -1;
    const board = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.5, 0.25), sponsorMat);
    board.position.copy(f.point).addScaledVector(f.right, side * (barrierOffset + 1.1));
    board.position.y = f.point.y + 1.65;
    board.rotation.y = Math.atan2(-f.tangent.x, -f.tangent.z) + Math.PI / 2;
    board.castShadow = true;
    group.add(board);
  }

  // Electronic FIA LED Marshal Light Panels
  const marshalMat = new THREE.MeshStandardMaterial({
    map: textures.marshalPanelMap,
    emissiveMap: textures.marshalPanelMap,
    emissive: 0xffffff,
    emissiveIntensity: isNight ? 1.85 : 1.05,
    roughness: 0.3,
  });
  for (let i = 15; i < sampleCount; i += 30) {
    const f = samples[i];
    const mGroup = new THREE.Group();
    mGroup.position.copy(f.point).addScaledVector(f.right, -(halfW + 2.6));
    mGroup.rotation.y = Math.atan2(-f.tangent.x, -f.tangent.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8), postMat);
    pole.position.y = 1.1;
    mGroup.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.16), marshalMat);
    panel.position.y = 2.4;
    mGroup.add(panel);
    group.add(mGroup);
  }

  // Overhead Sector Sponsor Arch Bridges
  const bridgeMat = new THREE.MeshStandardMaterial({
    map: textures.bridgeBannerMap,
    emissive: isNight ? envCfg.trackside.ledSecondaryHex : 0x000000,
    emissiveIntensity: isNight ? 0.52 : 0,
    roughness: 0.35,
  });
  for (const frac of [0.3, 0.68]) {
    const f = samples[Math.floor(sampleCount * frac)];
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.copy(f.point);
    bridgeGroup.rotation.y = Math.atan2(-f.tangent.x, -f.tangent.z);
    const span = track.trackWidth + 5.2;
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 6.4, 0.7), postMat);
      leg.position.set(s * (span * 0.5), 3.2, 0);
      leg.castShadow = true;
      bridgeGroup.add(leg);
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(span + 0.7, 1.85, 0.85), bridgeMat);
    header.position.set(0, 6.2, 0);
    header.castShadow = true;
    bridgeGroup.add(header);
    group.add(bridgeGroup);
  }

  // Braking Distance Marker Boards before corners
  for (let i = 18; i < sampleCount - 12; i += 14) {
    if (samples[i].curvature > 0.14 && samples[i - 8].curvature < 0.08) {
      [6, 4, 2].forEach((offsetIdx, bIdx) => {
        const bf = samples[(i - offsetIdx + sampleCount) % sampleCount];
        const bGroup = new THREE.Group();
        bGroup.position.copy(bf.point).addScaledVector(bf.right, halfW + 2.4);
        bGroup.rotation.y = Math.atan2(-bf.tangent.x, -bf.tangent.z);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), postMat);
        leg.position.y = 0.55;
        bGroup.add(leg);
        const sign = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.9, 0.12),
          new THREE.MeshStandardMaterial({ map: textures.brakeBoardTextures[bIdx], roughness: 0.4 })
        );
        sign.position.y = 1.25;
        bGroup.add(sign);
        group.add(bGroup);
      });
    }
  }

  // 6b. Official Circuit DRS Detection & Activation Zone Boards + Painted Asphalt DRS Line
  const trackDisposables: Array<{ dispose: () => void }> = [];
  const drsZones = getCircuitDrsZones(track);
  const drsBoardMat = new THREE.MeshStandardMaterial({
    map: textures.drsBoardMap,
    emissive: 0x10b981,
    emissiveMap: textures.drsBoardMap,
    emissiveIntensity: isNight ? 1.45 : 0.72,
    roughness: 0.35,
  });
  const drsDetMat = new THREE.MeshStandardMaterial({
    map: textures.drsDetBoardMap,
    emissive: 0x38bdf8,
    emissiveMap: textures.drsDetBoardMap,
    emissiveIntensity: isNight ? 1.25 : 0.55,
    roughness: 0.35,
  });
  const drsLineMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: isNight ? 0.9 : 0.28,
    roughness: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const drsDetLineMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const drsBoardGeo = new THREE.BoxGeometry(1.7, 0.9, 0.14);
  const drsPostGeo = new THREE.BoxGeometry(0.12, 1.5, 0.12);
  const drsLineGeo = new THREE.PlaneGeometry(track.trackWidth - 0.6, 0.42);
  trackDisposables.push(drsBoardMat, drsDetMat, drsLineMat, drsDetLineMat, drsBoardGeo, drsPostGeo, drsLineGeo);

  const drsShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDrsAvailable: { value: 0 },
      uDrsActive: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uDrsAvailable;
      uniform float uDrsActive;

      void main() {
        float stripe = sin((vUv.y * 42.0 - uTime * 14.0));
        float chevronMask = smoothstep(0.35, 0.9, stripe);

        vec3 colCyan = vec3(0.18, 0.92, 0.98);
        vec3 colGreen = vec3(0.08, 0.96, 0.42);
        vec3 colDim = vec3(0.06, 0.28, 0.18);

        vec3 baseCol = colDim;
        float alpha = 0.18 * chevronMask;

        if (uDrsActive > 0.5) {
          baseCol = colGreen;
          alpha = (0.78 + 0.22 * sin(uTime * 28.0)) * chevronMask;
        } else if (uDrsAvailable > 0.5) {
          baseCol = colCyan;
          alpha = (0.52 + 0.22 * sin(uTime * 18.0)) * chevronMask;
        }

        gl_FragColor = vec4(baseCol, alpha * (0.65 + 0.35 * vUv.x));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  trackDisposables.push(drsShaderMat);

  const drsShaderMats: THREE.ShaderMaterial[] = [];
  for (const dz of drsZones) {
    const startT = dz.startT;
    const endT = dz.endT;
    const span = startT <= endT ? endT - startT : 1 - startT + endT;
    const steps = 48;
    const stripSamples: TrackSample[] = [];
    for (let k = 0; k <= steps; k++) {
      const tPos = (startT + (span * k) / steps) % 1;
      const point = curve.getPointAt(tPos);
      const tangent = curve.getTangentAt(tPos).normalize();
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
      stripSamples.push({ t: tPos, point, tangent, right, curvature: 0 });
    }
    const ribbonHalfW = track.trackWidth * 0.42;
    const shaderMat = drsShaderMat.clone();
    drsShaderMats.push(shaderMat);
    trackDisposables.push(shaderMat);
    const drsOverlayMesh = createRibbonMesh(stripSamples, -ribbonHalfW, ribbonHalfW, 0.035, shaderMat, 6);
    drsOverlayMesh.receiveShadow = false;
    group.add(drsOverlayMesh);
  }

  for (const dz of drsZones) {
    // Activation line + board on trackside
    const actPt = curve.getPointAt(((dz.startT % 1) + 1) % 1);
    const actTan = curve.getTangentAt(((dz.startT % 1) + 1) % 1).normalize();
    const actRight = new THREE.Vector3().crossVectors(actTan, up).normalize();
    const actYaw = Math.atan2(-actTan.x, -actTan.z);

    const actLine = new THREE.Mesh(drsLineGeo, drsLineMat);
    actLine.rotation.x = -Math.PI / 2;
    actLine.rotation.z = actYaw;
    actLine.position.copy(actPt).setY(actPt.y + 0.041);
    group.add(actLine);

    for (const sideSign of [-1, 1]) {
      const boardGrp = new THREE.Group();
      boardGrp.position.copy(actPt).addScaledVector(actRight, sideSign * (halfW + 2.35));
      boardGrp.rotation.y = actYaw;
      const pLeg = new THREE.Mesh(drsPostGeo, postMat);
      pLeg.position.y = 0.75;
      boardGrp.add(pLeg);
      const bPanel = new THREE.Mesh(drsBoardGeo, drsBoardMat);
      bPanel.position.y = 1.65;
      boardGrp.add(bPanel);
      group.add(boardGrp);
    }

    // Detection line + board on trackside
    const detPt = curve.getPointAt(((dz.detectionT % 1) + 1) % 1);
    const detTan = curve.getTangentAt(((dz.detectionT % 1) + 1) % 1).normalize();
    const detRight = new THREE.Vector3().crossVectors(detTan, up).normalize();
    const detYaw = Math.atan2(-detTan.x, -detTan.z);

    const detLine = new THREE.Mesh(drsLineGeo, drsDetLineMat);
    detLine.rotation.x = -Math.PI / 2;
    detLine.rotation.z = detYaw;
    detLine.position.copy(detPt).setY(detPt.y + 0.04);
    group.add(detLine);

    const detGrp = new THREE.Group();
    detGrp.position.copy(detPt).addScaledVector(detRight, halfW + 2.35);
    detGrp.rotation.y = detYaw;
    const detLeg = new THREE.Mesh(drsPostGeo, postMat);
    detLeg.position.y = 0.75;
    detGrp.add(detLeg);
    const detPanel = new THREE.Mesh(drsBoardGeo, drsDetMat);
    detPanel.position.y = 1.65;
    detGrp.add(detPanel);
    group.add(detGrp);
  }

  // 7. Chequered Start/Finish Strip + 6 Painted Starting Grid Boxes + Gantry
  const startFrame = samples[0];
  const startYaw = Math.atan2(-startFrame.tangent.x, -startFrame.tangent.z);

  const finishStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(track.trackWidth - 0.4, 3.2),
    new THREE.MeshStandardMaterial({
      map: textures.gridFinishMap,
      roughness: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  finishStrip.rotation.x = -Math.PI / 2;
  finishStrip.rotation.z = startYaw;
  finishStrip.position.copy(startFrame.point).setY(startFrame.point.y + 0.042);
  finishStrip.receiveShadow = true;
  group.add(finishStrip);

  const gridBoxMat = new THREE.MeshStandardMaterial({
    map: textures.gridBoxMap,
    transparent: true,
    roughness: 0.7,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  for (let slot = 0; slot < 6; slot++) {
    const row = Math.floor(slot / 2);
    const side = slot % 2 === 0 ? -3.1 : 3.1;
    const slotT = 1 - (0.012 + row * 0.011);
    const slotPt = curve.getPointAt(slotT);
    const slotTan = curve.getTangentAt(slotT).normalize();
    const slotRight = new THREE.Vector3().crossVectors(slotTan, up).normalize();
    const boxMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 4.8), gridBoxMat);
    boxMesh.rotation.x = -Math.PI / 2;
    boxMesh.rotation.z = Math.atan2(-slotTan.x, -slotTan.z);
    boxMesh.position.copy(slotPt).addScaledVector(slotRight, side).setY(slotPt.y + 0.036);
    group.add(boxMesh);
  }

  const gantryGroup = new THREE.Group();
  gantryGroup.position.copy(startFrame.point);
  gantryGroup.rotation.y = startYaw;

  const gantryMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.68, roughness: 0.3 });
  const spanWidth = track.trackWidth + 3.2;

  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.65, 6.2, 0.65), gantryMat);
    pillar.position.set(s * (spanWidth * 0.5), 3.1, 0);
    pillar.castShadow = true;
    gantryGroup.add(pillar);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(spanWidth + 0.65, 1.15, 0.85), gantryMat);
  bridge.position.set(0, 5.8, 0);
  bridge.castShadow = true;
  gantryGroup.add(bridge);

  const startLights: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 5; i++) {
    const podHousing = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.85, 0.95),
      new THREE.MeshStandardMaterial({ color: 0x090b0f, roughness: 0.5 })
    );
    podHousing.position.set((i - 2) * 1.35, 5.15, 0);
    gantryGroup.add(podHousing);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0x2a0808,
      emissive: 0xef4444,
      emissiveIntensity: 0,
      roughness: 0.2,
    });
    startLights.push(bulbMat);
    const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.98, 16), bulbMat);
    bulb.rotation.x = Math.PI / 2;
    bulb.position.set((i - 2) * 1.35, 5.15, 0);
    gantryGroup.add(bulb);
  }
  if (isSunset || isNight || isRain) {
    const gantryBeamMat = new THREE.MeshBasicMaterial({
      color: isSunset ? 0xfed7aa : isNight ? envCfg.lighting.nightFloodlightColor : 0xe0f2fe,
      transparent: true,
      opacity: isNight ? 0.055 : 0.038,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const gantryBeamGeo = new THREE.ConeGeometry(4.6, 6.8, 14, 1, true);
    for (const bx of [-spanWidth * 0.25, spanWidth * 0.25]) {
      const beam = new THREE.Mesh(gantryBeamGeo, gantryBeamMat);
      beam.position.set(bx, 2.7, 0);
      gantryGroup.add(beam);
    }
  }
  group.add(gantryGroup);

  // 8. Pit Complex, Pit Lane Apron, Illuminated Team Garages, Pit Crews, Timing Tower & Crowd Grandstands
  const pitStraightSamples = [...samples.slice(sampleCount - 20), ...samples.slice(0, 22)];
  const pitApronMat = new THREE.MeshPhysicalMaterial({
    map: textures.asphaltMap,
    normalMap: textures.asphaltNormalMap,
    normalScale: new THREE.Vector2(0.32, 0.32),
    color: isNight ? 0x161b24 : 0x2a2f3a,
    roughness: isRain ? 0.22 : 0.68,
    metalness: isRain ? 0.28 : 0.1,
    clearcoat: isRain ? 0.88 : 0.12,
  });
  const pitApron = createRibbonMesh(pitStraightSamples, -(halfW + 9.2), -(halfW + 1.2), 0.022, pitApronMat, 6);
  pitApron.receiveShadow = true;
  group.add(pitApron);

  // Pit wall separating main track and pit lane
  const pitWall = createWallRibbon(pitStraightSamples, -(halfW + 1.15), 0.92, barrierMat);
  group.add(pitWall);
  const pitWallAccent = createWallRibbon(pitStraightSamples, -(halfW + 1.1), 0.28, barrierAccentMat, 0.64);
  group.add(pitWallAccent);

  const pitBuilding = buildPitComplex(isNight, isSunset, envCfg.trackside.ledRibbonHex, textures);
  pitBuilding.position
    .copy(startFrame.point)
    .addScaledVector(startFrame.right, -(halfW + 13))
    .addScaledVector(startFrame.tangent, -18);
  pitBuilding.rotation.y = startYaw;
  group.add(pitBuilding);

  // Illuminated FIA Live 2026 LED Timing Tower beside start/finish straight
  const timingTower = new THREE.Group();
  const towerBaseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.78, roughness: 0.26 });
  const towerPlinth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 2.2), towerBaseMat);
  towerPlinth.position.y = 0.9;
  timingTower.add(towerPlinth);

  const towerFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 14.8, 1.15), towerBaseMat);
  towerFrame.position.y = 9.2;
  towerFrame.castShadow = true;
  timingTower.add(towerFrame);

  const towerCrown = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.55, 1.45),
    new THREE.MeshStandardMaterial({
      color: envCfg.trackside.ledRibbonHex,
      emissive: envCfg.trackside.ledRibbonHex,
      emissiveIntensity: 1.45,
    })
  );
  towerCrown.position.y = 16.75;
  timingTower.add(towerCrown);

  const ledTowerMat = new THREE.MeshStandardMaterial({
    map: textures.timingTowerMap,
    emissive: 0xffffff,
    emissiveMap: textures.timingTowerMap,
    emissiveIntensity: isNight || isSunset ? 1.35 : 0.95,
    roughness: 0.18,
  });
  for (const faceZ of [-0.6, 0.6]) {
    const ledFace = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 13.8), ledTowerMat);
    ledFace.position.set(0, 9.2, faceZ);
    if (faceZ < 0) ledFace.rotation.y = Math.PI;
    timingTower.add(ledFace);
  }
  timingTower.position
    .copy(startFrame.point)
    .addScaledVector(startFrame.right, -(halfW + 5.8))
    .addScaledVector(startFrame.tangent, 10.5);
  timingTower.rotation.y = startYaw;
  group.add(timingTower);

  const gsLed = envCfg.trackside.ledRibbonHex;
  const gsCanopy = envCfg.trackside.canopyTintHex;

  const mainGrandstand = buildGrandstand(86, isNight, isSunset, gsLed, gsCanopy, textures);
  mainGrandstand.position
    .copy(startFrame.point)
    .addScaledVector(startFrame.right, halfW + 14)
    .addScaledVector(startFrame.tangent, -15);
  mainGrandstand.rotation.y = startYaw + Math.PI;
  group.add(mainGrandstand);

  const turn1Grandstand = buildGrandstand(70, isNight, isSunset, gsLed, gsCanopy, textures);
  const t1Frame = samples[Math.floor(sampleCount * 0.14)];
  const t1Yaw = Math.atan2(-t1Frame.tangent.x, -t1Frame.tangent.z);
  turn1Grandstand.position.copy(t1Frame.point).addScaledVector(t1Frame.right, halfW + 16);
  turn1Grandstand.rotation.y = t1Yaw + Math.PI;
  group.add(turn1Grandstand);

  const secondGrandstand = buildGrandstand(64, isNight, isSunset, gsLed, gsCanopy, textures);
  const midTurnFrame = samples[Math.floor(sampleCount * 0.36)];
  const midYaw = Math.atan2(-midTurnFrame.tangent.x, -midTurnFrame.tangent.z);
  secondGrandstand.position.copy(midTurnFrame.point).addScaledVector(midTurnFrame.right, halfW + 16);
  secondGrandstand.rotation.y = midYaw + Math.PI;
  group.add(secondGrandstand);

  const finalStadiumGrandstand = buildGrandstand(64, isNight, isSunset, gsLed, gsCanopy, textures);
  const finalFrame = samples[Math.floor(sampleCount * 0.82)];
  const finalYaw = Math.atan2(-finalFrame.tangent.x, -finalFrame.tangent.z);
  finalStadiumGrandstand.position.copy(finalFrame.point).addScaledVector(finalFrame.right, halfW + 16);
  finalStadiumGrandstand.rotation.y = finalYaw + Math.PI;
  group.add(finalStadiumGrandstand);

  // Additional Hillside Forest Grandstand overlooking the steep elevation climb
  const crestGrandstand = buildGrandstand(58, isNight, isSunset, gsLed, gsCanopy, textures);
  const crestFrame = samples[Math.floor(sampleCount * 0.24)];
  const crestYaw = Math.atan2(-crestFrame.tangent.x, -crestFrame.tangent.z);
  crestGrandstand.position.copy(crestFrame.point).addScaledVector(crestFrame.right, -(halfW + 16.5));
  crestGrandstand.rotation.y = crestYaw;
  group.add(crestGrandstand);

  // Dramatic Stadium Floodlight Towers (Per-circuit density, floodlight hue & dusk/night illumination)
  const isActualSunset = effTod === 'sunset' || weather === 'sunset';
  const lightsLit =
    isNight ||
    isActualSunset ||
    weather === 'heavy_rain' ||
    weather === 'rain' ||
    weather === 'cloudy' ||
    weather === 'fog' ||
    (effTod === 'golden_hour' && envCfg.lighting.alwaysFloodlitAtNightOrDusk);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.82, roughness: 0.28 });
  const floodHex = envCfg.lighting.nightFloodlightColor;
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: isNight ? floodHex : isSunset ? 0xffedd5 : 0xe0f2fe,
    emissiveIntensity: isNight ? 4.4 : isSunset ? 3.2 : lightsLit ? 1.85 : 0.35,
  });
  const coneMat = new THREE.MeshBasicMaterial({
    color: isNight ? floodHex : isSunset ? 0xfed7aa : 0xe0f2fe,
    transparent: true,
    opacity: isNight ? 0.08 : isSunset ? 0.054 : 0.03,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const coneGeo = new THREE.ConeGeometry(7.2, 13.5, 14, 1, true);
  const towerStep = envCfg.lighting.alwaysFloodlitAtNightOrDusk ? 15 : 24;
  for (let i = 0; i < sampleCount; i += towerStep) {
    const f = samples[i];
    const tower = new THREE.Group();
    tower.position.copy(f.point).addScaledVector(f.right, halfW + 8.8);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 13.2, 8), poleMat);
    pole.position.y = 6.6;
    tower.add(pole);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.22), poleMat);
    boom.position.set(-0.55, 13.0, 0);
    tower.add(boom);
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.56, 0.82), lampMat);
    head.position.set(-0.85, 12.85, 0);
    tower.add(head);

    if (lightsLit) {
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(-3.4, 6.4, 0);
      cone.rotation.z = -0.35;
      tower.add(cone);
    }

    tower.rotation.y = Math.atan2(-f.tangent.x, -f.tangent.z);
    group.add(tower);
  }

  // 8b. Broadcast Trackside Jumbotrons, Animated Flagpoles & TV Camera Cranes

  // Giant Trackside Broadcast LED Jumbotrons facing grandstands & braking zones
  const jumboFrameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.78, roughness: 0.28 });
  const jumboScreenMat = new THREE.MeshStandardMaterial({
    map: textures.jumbotronMap,
    emissive: 0xffffff,
    emissiveMap: textures.jumbotronMap,
    emissiveIntensity: isNight ? 1.55 : isSunset ? 1.1 : 0.85,
    roughness: 0.2,
  });
  const jumboLegGeo = new THREE.CylinderGeometry(0.24, 0.34, 8.5, 8);
  const jumboHousingGeo = new THREE.BoxGeometry(10.8, 5.6, 0.65);
  const jumboFaceGeo = new THREE.PlaneGeometry(10.2, 5.1);
  trackDisposables.push(jumboFrameMat, jumboScreenMat, jumboLegGeo, jumboHousingGeo, jumboFaceGeo);

  for (const [frac, side] of [
    [0.06, -(halfW + 10.5)],
    [0.34, -(halfW + 11.5)],
    [0.64, -(halfW + 11.5)],
  ] as const) {
    const jf = samples[Math.floor(sampleCount * frac)];
    const jGroup = new THREE.Group();
    jGroup.position.copy(jf.point).addScaledVector(jf.right, side);
    jGroup.rotation.y = Math.atan2(-jf.tangent.x, -jf.tangent.z) + (side > 0 ? -0.45 : 0.45);
    const jLeg = new THREE.Mesh(jumboLegGeo, jumboFrameMat);
    jLeg.position.y = 4.25;
    jGroup.add(jLeg);
    const jBox = new THREE.Mesh(jumboHousingGeo, jumboFrameMat);
    jBox.position.y = 9.4;
    jGroup.add(jBox);
    const jFaceFront = new THREE.Mesh(jumboFaceGeo, jumboScreenMat);
    jFaceFront.position.set(0, 9.4, 0.35);
    jGroup.add(jFaceFront);
    const jFaceBack = new THREE.Mesh(jumboFaceGeo, jumboScreenMat);
    jFaceBack.position.set(0, 9.4, -0.35);
    jFaceBack.rotation.y = Math.PI;
    jGroup.add(jFaceBack);
    group.add(jGroup);
  }

  // Trackside Broadcast TV Camera Cranes along key corners
  const craneArmGeo = new THREE.BoxGeometry(0.28, 0.28, 7.2);
  const camPodGeo = new THREE.BoxGeometry(0.65, 0.48, 0.85);
  for (const frac of [0.18, 0.48, 0.78]) {
    const cf = samples[Math.floor(sampleCount * frac)];
    const craneGroup = new THREE.Group();
    craneGroup.position.copy(cf.point).addScaledVector(cf.right, halfW + 10.2);
    craneGroup.rotation.y = Math.atan2(-cf.tangent.x, -cf.tangent.z);
    const cPost = new THREE.Mesh(jumboLegGeo, jumboFrameMat);
    cPost.position.y = 4.25;
    craneGroup.add(cPost);
    const cArm = new THREE.Mesh(craneArmGeo, jumboFrameMat);
    cArm.position.set(-2.4, 8.4, 0);
    cArm.rotation.y = Math.PI * 0.5;
    craneGroup.add(cArm);
    const cPod = new THREE.Mesh(camPodGeo, jumboFrameMat);
    cPod.position.set(-5.8, 8.2, 0);
    craneGroup.add(cPod);
    group.add(craneGroup);
  }
  trackDisposables.push(craneArmGeo, camPodGeo);

  // Instanced Animated Circuit Flagpoles lining straight & stadium sectors
  const flagCount = 24;
  const flagPoleGeo = new THREE.CylinderGeometry(0.06, 0.09, 7.4, 6);
  flagPoleGeo.translate(0, 3.7, 0);
  const flagClothGeo = new THREE.PlaneGeometry(2.1, 1.05, 4, 1);
  flagClothGeo.translate(1.05, 6.75, 0);
  const flagPoleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.75, roughness: 0.3 });
  const flagClothMat = new THREE.MeshStandardMaterial({
    map: textures.flagBannerMap,
    side: THREE.DoubleSide,
    roughness: 0.65,
  });
  const flagPoleInst = new THREE.InstancedMesh(flagPoleGeo, flagPoleMat, flagCount);
  const flagClothInst = new THREE.InstancedMesh(flagClothGeo, flagClothMat, flagCount);
  const flagTransforms: Array<{ x: number; y: number; z: number; baseYaw: number; phase: number }> = [];
  const fDummy = new THREE.Object3D();

  for (let i = 0; i < flagCount; i++) {
    const idx = Math.floor((i / flagCount) * sampleCount);
    const ff = samples[idx];
    const side = i % 2 === 0 ? 1 : -1;
    const fx = ff.point.x + ff.right.x * side * (barrierOffset + 2.4);
    const fz = ff.point.z + ff.right.z * side * (barrierOffset + 2.4);
    const fy = ff.point.y;
    const baseYaw = Math.atan2(-ff.tangent.x, -ff.tangent.z);
    flagTransforms.push({ x: fx, y: fy, z: fz, baseYaw, phase: i * 0.65 });

    fDummy.position.set(fx, fy, fz);
    fDummy.rotation.set(0, baseYaw, 0);
    fDummy.scale.set(1, 1, 1);
    fDummy.updateMatrix();
    flagPoleInst.setMatrixAt(i, fDummy.matrix);
    flagClothInst.setMatrixAt(i, fDummy.matrix);
  }
  flagPoleInst.instanceMatrix.needsUpdate = true;
  flagClothInst.instanceMatrix.needsUpdate = true;
  flagPoleInst.computeBoundingSphere();
  flagClothInst.computeBoundingSphere();
  group.add(flagPoleInst, flagClothInst);
  trackDisposables.push(flagPoleGeo, flagClothGeo, flagPoleMat, flagClothMat);

  // 9. Biome vegetation & circuit surroundings are populated inside builtEnv above.

  // 10. Mini-Map Path & Coordinate Mapper
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of samples) {
    if (s.point.x < minX) minX = s.point.x;
    if (s.point.x > maxX) maxX = s.point.x;
    if (s.point.z < minZ) minZ = s.point.z;
    if (s.point.z > maxZ) maxZ = s.point.z;
  }
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const maxSpan = Math.max(spanX, spanZ);
  const pad = 10;
  const usable = 100 - pad * 2;
  const offsetX = pad + (usable - (spanX / maxSpan) * usable) * 0.5;
  const offsetY = pad + (usable - (spanZ / maxSpan) * usable) * 0.5;

  const worldToMiniMap = (x: number, z: number) => ({
    x: offsetX + ((x - minX) / maxSpan) * usable,
    y: offsetY + ((z - minZ) / maxSpan) * usable,
  });

  const miniPts: string[] = [];
  for (let i = 0; i < sampleCount; i += 3) {
    const p = worldToMiniMap(samples[i].point.x, samples[i].point.z);
    miniPts.push(`${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  miniPts.push('Z');
  const miniMapPath = miniPts.join(' ');
  const miniMapStart = worldToMiniMap(samples[0].point.x, samples[0].point.z);

  // Build Sector 1 / 2 / 3 SVG paths and High-Grip Racing Line paths for the MiniMap heatmap
  const sectorThird = Math.floor(sampleCount / 3);
  const miniMapSectorPaths: [string, string, string] = ['', '', ''];
  const miniMapRacingLinePaths: [string, string, string] = ['', '', ''];
  for (let sec = 0; sec < 3; sec++) {
    const startIdx = sec * sectorThird;
    const endIdx = sec === 2 ? sampleCount : (sec + 1) * sectorThird;
    const secTrackPts: string[] = [];
    const secLinePts: string[] = [];
    for (let i = startIdx; i <= endIdx; i += 2) {
      const idx = i % sampleCount;
      const s = samples[idx];
      const pCenter = worldToMiniMap(s.point.x, s.point.z);
      const cmd = i === startIdx ? 'M' : 'L';
      secTrackPts.push(`${cmd}${pCenter.x.toFixed(1)},${pCenter.y.toFixed(1)}`);

      // Compute apex-hugging high-grip racing line offset (outside -> inside apex -> outside exit)
      const nextS = samples[(idx + 7) % sampleCount];
      const prevS = samples[(idx - 5 + sampleCount) % sampleCount];
      const turnCross =
        (s.tangent.x * nextS.tangent.z - s.tangent.z * nextS.tangent.x) * 0.65 +
        (prevS.tangent.x * s.tangent.z - prevS.tangent.z * s.tangent.x) * 0.35;
      const racingOffset = THREE.MathUtils.clamp(turnCross * halfW * 4.2, -halfW * 0.85, halfW * 0.85);
      const lineWorldX = s.point.x + s.right.x * racingOffset;
      const lineWorldZ = s.point.z + s.right.z * racingOffset;
      const pLine = worldToMiniMap(lineWorldX, lineWorldZ);
      secLinePts.push(`${cmd}${pLine.x.toFixed(1)},${pLine.y.toFixed(1)}`);
    }
    miniMapSectorPaths[sec] = secTrackPts.join(' ');
    miniMapRacingLinePaths[sec] = secLinePts.join(' ');
  }

  // Build SVG path strips for each circuit DRS zone on the MiniMap
  const miniMapDrsZones: Omit<MiniMapDrsZone, 'active'>[] = drsZones.map((dz) => {
    const segPts: string[] = [];
    const steps = 28;
    const s = ((dz.startT % 1) + 1) % 1;
    const e = ((dz.endT % 1) + 1) % 1;
    const span = s <= e ? e - s : 1 - s + e;
    for (let k = 0; k <= steps; k++) {
      const tPos = (s + (span * k) / steps) % 1;
      const wp = curve.getPointAt(tPos);
      const mp = worldToMiniMap(wp.x, wp.z);
      segPts.push(`${k === 0 ? 'M' : 'L'}${mp.x.toFixed(1)},${mp.y.toFixed(1)}`);
    }
    return {
      id: dz.id,
      zoneNumber: dz.zoneNumber,
      path: segPts.join(' '),
    };
  });

  const findClosestSample = (pos: THREE.Vector3, hintIndex?: number) => {
    let bestIdx = 0;
    let bestDistSq = Infinity;

    if (hintIndex !== undefined) {
      const windowRadius = 28;
      for (let offset = -windowRadius; offset <= windowRadius; offset++) {
        const idx = (hintIndex + offset + sampleCount) % sampleCount;
        const p = samples[idx].point;
        const dSq = (pos.x - p.x) * (pos.x - p.x) + (pos.z - p.z) * (pos.z - p.z);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = idx;
        }
      }
      if (bestDistSq > 45 * 45) {
        for (let idx = 0; idx < sampleCount; idx++) {
          const p = samples[idx].point;
          const dSq = (pos.x - p.x) * (pos.x - p.x) + (pos.z - p.z) * (pos.z - p.z);
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestIdx = idx;
          }
        }
      }
    } else {
      for (let idx = 0; idx < sampleCount; idx++) {
        const p = samples[idx].point;
        const dSq = (pos.x - p.x) * (pos.x - p.x) + (pos.z - p.z) * (pos.z - p.z);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = idx;
        }
      }
    }

    const s = samples[bestIdx];
    const dx = pos.x - s.point.x;
    const dz = pos.z - s.point.z;
    const lateralOffset = dx * s.right.x + dz * s.right.z;

    return {
      index: bestIdx,
      t: s.t,
      point: s.point,
      tangent: s.tangent,
      right: s.right,
      lateralOffset,
      idealLateralOffset: s.idealLateralOffset ?? 0,
    };
  };

  const getFrameAtT = (t: number) => {
    const wrapped = ((t % 1) + 1) % 1;
    const point = curve.getPointAt(wrapped);
    const tangent = curve.getTangentAt(wrapped).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    return { point, tangent, right };
  };

  const dryRoadColor = new THREE.Color(0xffffff);
  const wetRoadColor = new THREE.Color(0x141922);

  return {
    group,
    curve,
    samples,
    totalLength,
    trackWidth: track.trackWidth,
    sectorCurvatureLoad,
    startLights,
    drsZones,
    miniMapPath,
    miniMapSectorPaths,
    miniMapRacingLinePaths,
    miniMapStart,
    miniMapDrsZones,
    updateTime: (elapsedSec: number) => {
      rainUniform.value = elapsedSec;
      builtEnv.updateTime(elapsedSec);
      for (let i = 0; i < flagTransforms.length; i++) {
        const ft = flagTransforms[i];
        fDummy.position.set(ft.x, ft.y, ft.z);
        fDummy.rotation.set(
          Math.sin(elapsedSec * 3.1 + ft.phase) * 0.04,
          ft.baseYaw + Math.sin(elapsedSec * 2.4 + ft.phase) * 0.18,
          Math.cos(elapsedSec * 2.8 + ft.phase) * 0.04
        );
        fDummy.updateMatrix();
        flagClothInst.setMatrixAt(i, fDummy.matrix);
      }
      flagClothInst.instanceMatrix.needsUpdate = true;
    },
    updateDrsOverlays: (elapsedSec: number, drsAvailable: boolean, drsActive: boolean) => {
      for (const mat of drsShaderMats) {
        mat.uniforms.uTime.value = elapsedSec;
        mat.uniforms.uDrsAvailable.value = drsAvailable ? 1 : 0;
        mat.uniforms.uDrsActive.value = drsActive ? 1 : 0;
      }
    },
    updateAtmosphereState: (state: AtmosphereRuntimeState) => {
      builtEnv.updateAtmosphere(state);
    },
    setSurfaceWetness: (wetness: number) => {
      const w = THREE.MathUtils.clamp(wetness, 0, 1);
      wetnessUniform.value = w;
      roadMat.color.lerpColors(dryRoadColor, wetRoadColor, w);
      roadMat.roughness = THREE.MathUtils.lerp(isSunset ? 0.44 : 0.82, 0.12, w);
      roadMat.metalness = THREE.MathUtils.lerp(isSunset ? 0.16 : 0.06, 0.36, w);
      roadMat.clearcoat = THREE.MathUtils.lerp(isSunset ? 0.28 : 0.06, 0.96, w);
      roadMat.clearcoatRoughness = THREE.MathUtils.lerp(isSunset ? 0.24 : 0.44, 0.04, w);
      roadMat.envMapIntensity = THREE.MathUtils.lerp(isSunset ? 1.58 : 1.05, 2.35, w);
      kerbMat.roughness = THREE.MathUtils.lerp(0.56, 0.22, w);
      kerbMat.clearcoat = THREE.MathUtils.lerp(0.14, 0.78, w);
    },
    setSurfaceRubbering: (rubberLevel: number, sectorRubber?: [number, number, number]) => {
      rubberLevelUniform.value = THREE.MathUtils.clamp(rubberLevel, 0, 1);
      if (sectorRubber) {
        sectorRubberUniform.value.set(
          THREE.MathUtils.clamp(sectorRubber[0], 0, 1),
          THREE.MathUtils.clamp(sectorRubber[1], 0, 1),
          THREE.MathUtils.clamp(sectorRubber[2], 0, 1)
        );
      } else {
        const r = rubberLevelUniform.value;
        sectorRubberUniform.value.set(r, r, r);
      }
    },
    setRacingLineMode: (mode: 'off' | 'corners' | 'full') => {
      racingLineFullMesh.visible = mode === 'full';
      racingLineCornersMesh.visible = mode === 'corners';
    },
    worldToMiniMap,
    findClosestSample,
    getFrameAtT,
    dispose: () => {
      builtEnv.dispose();
      for (let i = 0; i < trackDisposables.length; i++) {
        trackDisposables[i].dispose();
      }
      racingLineMat.dispose();
      racingLineFullMesh.geometry.dispose();
      racingLineCornersMesh.geometry.dispose();
    },
  };
}

function createDynamicRacingLineRibbon(
  samples: TrackSample[],
  halfW: number,
  material: THREE.Material,
  cornersOnly: boolean
): THREE.Mesh {
  const n = samples.length;
  const positions = new Float32Array((n + 1) * 2 * 3);
  const colors = new Float32Array((n + 1) * 2 * 3);
  const indices: number[] = [];
  const colGreen = new THREE.Color(0x22c55e);
  const colAmber = new THREE.Color(0xfacc15);
  const colRed = new THREE.Color(0xef4444);
  const tmpCol = new THREE.Color();

  for (let i = 0; i <= n; i++) {
    const idxSample = i % n;
    const s = samples[idxSample];
    // Look ahead 4..14 samples to detect upcoming corner braking zone
    let aheadCurv = s.curvature;
    for (let k = 2; k <= 14; k++) {
      const c = samples[(idxSample + k) % n].curvature;
      if (c > aheadCurv) aheadCurv = c;
    }
    const brakeIntensity = THREE.MathUtils.clamp((aheadCurv - 0.055) / 0.14, 0, 1);
    if (brakeIntensity < 0.45) {
      tmpCol.lerpColors(colGreen, colAmber, brakeIntensity / 0.45);
    } else {
      tmpCol.lerpColors(colAmber, colRed, (brakeIntensity - 0.45) / 0.55);
    }

    // Use the sample's smoothed apex-hugging lateral racing line offset so 3D guide & rubber groove match
    const idealOffset =
      s.idealLateralOffset !== undefined
        ? s.idealLateralOffset
        : THREE.MathUtils.clamp(
            (s.tangent.x * samples[(idxSample + 6) % n].tangent.z -
              s.tangent.z * samples[(idxSample + 6) % n].tangent.x) *
              halfW *
              1.6,
            -halfW * 0.48,
            halfW * 0.48
          );

    const ribbonHalfWidth = 0.46;
    const pL = s.point.clone().addScaledVector(s.right, idealOffset - ribbonHalfWidth);
    const pR = s.point.clone().addScaledVector(s.right, idealOffset + ribbonHalfWidth);

    const vIdx = i * 2;
    positions[vIdx * 3] = pL.x;
    positions[vIdx * 3 + 1] = s.point.y + 0.044;
    positions[vIdx * 3 + 2] = pL.z;

    positions[(vIdx + 1) * 3] = pR.x;
    positions[(vIdx + 1) * 3 + 1] = s.point.y + 0.044;
    positions[(vIdx + 1) * 3 + 2] = pR.z;

    colors[vIdx * 3] = tmpCol.r;
    colors[vIdx * 3 + 1] = tmpCol.g;
    colors[vIdx * 3 + 2] = tmpCol.b;
    colors[(vIdx + 1) * 3] = tmpCol.r;
    colors[(vIdx + 1) * 3 + 1] = tmpCol.g;
    colors[(vIdx + 1) * 3 + 2] = tmpCol.b;

    if (i < n) {
      const showSegment = !cornersOnly || brakeIntensity > 0.16 || s.curvature > 0.07;
      if (showSegment) {
        const a = vIdx;
        const b = vIdx + 1;
        const c = vIdx + 2;
        const d = vIdx + 3;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return new THREE.Mesh(geo, material);
}

function createRibbonMesh(
  samples: TrackSample[],
  offsetStart: number,
  offsetEnd: number,
  yHeight: number,
  material: THREE.Material,
  vRepeat: number
): THREE.Mesh {
  const n = samples.length;
  const spanWidth = Math.max(0.5, offsetEnd - offsetStart);
  const positions = new Float32Array((n + 1) * 2 * 3);
  const normals = new Float32Array((n + 1) * 2 * 3);
  const uvs = new Float32Array((n + 1) * 2 * 2);
  const idealLineUs = new Float32Array((n + 1) * 2);
  const trackProgressTs = new Float32Array((n + 1) * 2);
  const indices: number[] = [];

  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    const v = (i / n) * vRepeat;
    const idealU = THREE.MathUtils.clamp(((s.idealLateralOffset ?? 0) - offsetStart) / spanWidth, 0.14, 0.86);
    const progT = (i % n) / n;

    const pL = s.point.clone().addScaledVector(s.right, offsetStart);
    const pR = s.point.clone().addScaledVector(s.right, offsetEnd);

    const idx = i * 2;
    positions[idx * 3] = pL.x;
    positions[idx * 3 + 1] = s.point.y + yHeight;
    positions[idx * 3 + 2] = pL.z;

    positions[(idx + 1) * 3] = pR.x;
    positions[(idx + 1) * 3 + 1] = s.point.y + yHeight;
    positions[(idx + 1) * 3 + 2] = pR.z;

    normals[idx * 3 + 1] = 1;
    normals[(idx + 1) * 3 + 1] = 1;

    uvs[idx * 2] = 0;
    uvs[idx * 2 + 1] = v;
    uvs[(idx + 1) * 2] = 1;
    uvs[(idx + 1) * 2 + 1] = v;

    idealLineUs[idx] = idealU;
    idealLineUs[idx + 1] = idealU;
    trackProgressTs[idx] = progT;
    trackProgressTs[idx + 1] = progT;

    if (i < n) {
      const a = idx;
      const b = idx + 1;
      const c = idx + 2;
      const d = idx + 3;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aIdealLineU', new THREE.BufferAttribute(idealLineUs, 1));
  geo.setAttribute('aTrackProgressT', new THREE.BufferAttribute(trackProgressTs, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function createWallRibbon(
  samples: TrackSample[],
  lateralOffset: number,
  height: number,
  material: THREE.Material,
  yBottom = 0
): THREE.Mesh {
  const n = samples.length;
  const isClosed = samples.length >= 300;
  const positions = new Float32Array((isClosed ? n + 1 : n) * 2 * 3);
  const uvs = new Float32Array((isClosed ? n + 1 : n) * 2 * 2);
  const indices: number[] = [];

  const limit = isClosed ? n : n - 1;
  for (let i = 0; i <= limit; i++) {
    const s = samples[i % n];
    const p = s.point.clone().addScaledVector(s.right, lateralOffset);
    const idx = i * 2;
    positions[idx * 3] = p.x;
    positions[idx * 3 + 1] = s.point.y + yBottom;
    positions[idx * 3 + 2] = p.z;

    positions[(idx + 1) * 3] = p.x;
    positions[(idx + 1) * 3 + 1] = s.point.y + yBottom + height;
    positions[(idx + 1) * 3 + 2] = p.z;

    uvs[idx * 2] = i / 8;
    uvs[idx * 2 + 1] = 0;
    uvs[(idx + 1) * 2] = i / 8;
    uvs[(idx + 1) * 2 + 1] = 1;

    if (i < limit) {
      const a = idx;
      const b = idx + 1;
      const c = idx + 2;
      const d = idx + 3;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = material.clone();
  mat.side = THREE.DoubleSide;
  return new THREE.Mesh(geo, mat);
}

function buildPitComplex(
  isNight: boolean,
  isSunset: boolean,
  accentHex: number,
  textures: ProceduralTextureSet
): THREE.Group {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.58, metalness: 0.34 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.36, metalness: 0.5 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    emissive: isNight ? accentHex : isSunset ? 0xfdba74 : 0x38bdf8,
    emissiveIntensity: isNight ? 1.65 : isSunset ? 1.25 : 0.35,
    roughness: 0.05,
    metalness: 0.9,
    ior: 1.52,
    reflectivity: 1.0,
    envMapIntensity: 2.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  });

  const mainBlock = new THREE.Mesh(new THREE.BoxGeometry(7.5, 5.6, 48), wallMat);
  mainBlock.position.y = 2.8;
  mainBlock.castShadow = true;
  mainBlock.receiveShadow = true;
  g.add(mainBlock);

  const garageDoors = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 2.7),
    new THREE.MeshStandardMaterial({
      map: textures.pitGarageMap,
      emissiveMap: textures.pitGarageMap,
      emissive: isNight || isSunset ? 0xffffff : 0x334155,
      emissiveIntensity: isNight ? 0.85 : isSunset ? 0.52 : 0.2,
      roughness: 0.4,
    })
  );
  garageDoors.rotation.y = Math.PI / 2;
  garageDoors.position.set(3.78, 1.4, 0);
  g.add(garageDoors);

  const roofOverhang = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.5, 50), roofMat);
  roofOverhang.position.set(0.8, 5.7, 0);
  g.add(roofOverhang);

  const controlWindows = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.7, 42), glassMat);
  controlWindows.position.set(3.8, 4.1, 0);
  g.add(controlWindows);

  const mullionMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.24 });
  for (let mz = -20; mz <= 20; mz += 4) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.78, 0.1), mullionMat);
    mullion.position.set(3.81, 4.1, mz);
    g.add(mullion);
  }

  const tower = new THREE.Mesh(new THREE.BoxGeometry(4.2, 14.5, 4.2), wallMat);
  tower.position.set(-1.5, 7.25, -18);
  tower.castShadow = true;
  g.add(tower);

  const towerCrown = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.4, 5.0), glassMat);
  towerCrown.position.set(-1.5, 13.8, -18);
  g.add(towerCrown);

  // Pit Crew Mechanics, Pit Stop Gantries & Stacked Tyres in front of Pit Bays
  const teamSuits = [0xdc2626, 0x0ea5e9, 0xf97316, 0x10b981];
  const visorDarkMat = new THREE.MeshStandardMaterial({ color: 0x090b0f, roughness: 0.15, metalness: 0.85 });
  const tyreStackMat = new THREE.MeshStandardMaterial({ color: 0x151820, roughness: 0.82 });
  const gantrySteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.78, roughness: 0.3 });

  for (let b = 0; b < 4; b++) {
    const bz = -15 + b * 10;
    const suitHex = teamSuits[b];
    const crewSuitMat = new THREE.MeshStandardMaterial({ color: suitHex, roughness: 0.72 });
    const crewHelmetMat = new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.18, clearcoat: 0.9 });
    const gantryLedMat = new THREE.MeshStandardMaterial({
      color: suitHex,
      emissive: suitHex,
      emissiveIntensity: isNight ? 2.4 : 1.15,
    });

    // Overhead Pit Gantry Boom
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.2, 0.24), gantrySteelMat);
    post.position.set(3.9, 1.6, bz - 2.6);
    g.add(post);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.18, 0.22), gantrySteelMat);
    boom.position.set(5.7, 3.1, bz - 2.6);
    g.add(boom);
    const ledBar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.26), gantryLedMat);
    ledBar.position.set(5.7, 2.98, bz - 2.6);
    g.add(ledBar);

    // Painted Pit Box Marking
    const boxFrame = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 5.2),
      new THREE.MeshBasicMaterial({ color: suitHex, transparent: true, opacity: 0.22 })
    );
    boxFrame.rotation.x = -Math.PI / 2;
    boxFrame.position.set(6.2, 0.032, bz);
    g.add(boxFrame);

    // 3 Pit Crew Mechanics per Bay
    for (let m = 0; m < 3; m++) {
      const mech = new THREE.Group();
      mech.position.set(4.5 + (m % 2) * 0.45, 0, bz - 1.4 + m * 1.4);
      mech.rotation.y = Math.PI * 0.5;
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.84, 0.22), crewSuitMat);
      legs.position.y = 0.42;
      mech.add(legs);
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.58, 0.24), crewSuitMat);
      torso.position.y = 1.12;
      mech.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), crewHelmetMat);
      head.position.y = 1.56;
      mech.add(head);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.12), visorDarkMat);
      visor.position.set(0, 1.57, 0.1);
      mech.add(visor);
      g.add(mech);
    }

    // Stacked Spare Tyres
    for (let t = 0; t < 2; t++) {
      const tyreStack = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.65, 16), tyreStackMat);
      tyreStack.position.set(4.15, 0.33, bz + 2.2 + t * 0.72);
      g.add(tyreStack);
    }
  }

  // Team Hospitality Paddock Motorhomes parked neatly behind the Pit Complex
  const trailerBodyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.35, roughness: 0.32 });
  const trailerRoofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45 });
  for (let b = 0; b < 4; b++) {
    const bz = -15 + b * 10;
    const suitHex = teamSuits[b];
    const mh = new THREE.Group();
    mh.position.set(-9.5, 0, bz);
    const body = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.6, 3.2), trailerBodyMat);
    body.position.y = 1.8;
    mh.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.25, 3.3), trailerRoofMat);
    roof.position.y = 3.7;
    mh.add(roof);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: suitHex,
      emissive: isNight ? suitHex : 0x000000,
      emissiveIntensity: isNight ? 0.65 : 0,
    });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(7.25, 0.45, 3.25), stripeMat);
    stripe.position.y = 2.4;
    mh.add(stripe);
    g.add(mh);
  }

  return g;
}

function buildGrandstand(
  length: number,
  isNight: boolean,
  isSunset: boolean,
  ledHex: number,
  canopyTintHex: number,
  textures: ProceduralTextureSet
): THREE.Group {
  const g = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.78, roughness: 0.32 });
  const crowdMat = new THREE.MeshStandardMaterial({
    map: textures.crowdMap,
    roughness: 0.72,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: isNight ? 0x0f172a : canopyTintHex,
    roughness: 0.34,
    metalness: 0.38,
  });
  const ledRibbonMat = new THREE.MeshStandardMaterial({
    color: ledHex,
    emissive: isSunset ? 0xf59e0b : ledHex,
    emissiveIntensity: isNight ? 2.1 : isSunset ? 1.65 : 0.85,
  });

  const tierCount = 7;
  for (let tier = 0; tier < tierCount; tier++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8 + tier * 0.72, length), concreteMat);
    step.position.set(tier * 1.35, (0.8 + tier * 0.72) * 0.5, 0);
    step.castShadow = true;
    step.receiveShadow = true;
    g.add(step);

    const seats = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, length - 1.5), crowdMat);
    seats.position.set(tier * 1.35 - 0.15, 0.94 + tier * 0.72, 0);
    g.add(seats);
  }

  // Rear Stadium Concourse Wall
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 6.2, length), steelMat);
  backWall.position.set(tierCount * 1.35 - 0.45, 3.1, 0);
  g.add(backWall);

  // Thousands of individually visible 3D Spectators across all 7 stadium tiers (zero-overhead InstancedMesh)
  const spacingZ = 0.62;
  const cols = Math.max(12, Math.floor((length - 2.0) / spacingZ));
  const totalSpectators = tierCount * cols;
  const specBodyGeo = new THREE.BoxGeometry(0.24, 0.46, 0.34);
  const specHeadGeo = new THREE.SphereGeometry(0.11, 8, 6);
  const specMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.05 });
  const specBodies = new THREE.InstancedMesh(specBodyGeo, specMat, totalSpectators);
  const specHeads = new THREE.InstancedMesh(specHeadGeo, specMat, totalSpectators);
  const specDummy = new THREE.Object3D();
  const specColor = new THREE.Color();
  const teamShirtPalette = [0xdc2626, 0x0ea5e9, 0xf97316, 0x10b981, 0xe2e8f0, 0xfacc15, 0x1e293b];
  const headPalette = [0xf1c27d, 0xc68642, 0x8d5524, 0xdc2626, 0x0ea5e9, 0xf8fafc];
  let idx = 0;

  for (let tier = 0; tier < tierCount; tier++) {
    const baseX = tier * 1.35 - 0.22;
    const baseY = 1.24 + tier * 0.72;
    for (let c = 0; c < cols; c++) {
      const z = -((cols - 1) * spacingZ) * 0.5 + c * spacingZ + (Math.random() - 0.5) * 0.16;
      const standing = Math.random() > 0.72 ? 0.14 : 0;
      const yawJitter = (Math.random() - 0.5) * 0.45;
      specDummy.position.set(baseX + (Math.random() - 0.5) * 0.1, baseY + standing, z);
      specDummy.rotation.set(0, yawJitter, 0);
      specDummy.scale.set(1, 0.92 + Math.random() * 0.18, 0.9 + Math.random() * 0.22);
      specDummy.updateMatrix();
      specBodies.setMatrixAt(idx, specDummy.matrix);
      specColor.setHex(teamShirtPalette[Math.floor(Math.random() * teamShirtPalette.length)]);
      specBodies.setColorAt(idx, specColor);

      specDummy.position.y = baseY + 0.34 + standing;
      specDummy.scale.set(1, 1, 1);
      specDummy.updateMatrix();
      specHeads.setMatrixAt(idx, specDummy.matrix);
      specColor.setHex(headPalette[Math.floor(Math.random() * headPalette.length)]);
      specHeads.setColorAt(idx, specColor);
      idx++;
    }
  }
  specBodies.instanceMatrix.needsUpdate = true;
  specHeads.instanceMatrix.needsUpdate = true;
  if (specBodies.instanceColor) specBodies.instanceColor.needsUpdate = true;
  if (specHeads.instanceColor) specHeads.instanceColor.needsUpdate = true;
  specBodies.computeBoundingSphere();
  specHeads.computeBoundingSphere();
  g.add(specBodies);
  g.add(specHeads);

  // Front LED Fascia Ribbon + Towering Stadium Steel Truss Pillars & Cantilever Roof
  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, length - 0.5), ledRibbonMat);
  ribbon.position.set(-0.72, 0.65, 0);
  g.add(ribbon);

  const upperRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, length - 0.5), ledRibbonMat);
  upperRibbon.position.set(-0.8, 9.0, 0);
  g.add(upperRibbon);

  for (let z = -length * 0.46; z <= length * 0.46; z += length * 0.23) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 9.4, 0.32), steelMat);
    pillar.position.set(8.8, 4.7, z);
    g.add(pillar);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.38, length + 2), canopyMat);
  roof.position.set(4.1, 9.4, 0);
  roof.rotation.z = -0.13;
  g.add(roof);

  return g;
}
