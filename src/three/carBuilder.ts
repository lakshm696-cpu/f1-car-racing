import * as THREE from 'three';
import { TyreCompound, WheelFinish } from '../types/racing';
import { createNumberDecalTexture, createPirelliSidewallTexture } from './textures';

export interface FormulaCarModel {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  wheels: THREE.Group[];
  drsFlap: THREE.Mesh;
  rainLightMat: THREE.MeshStandardMaterial;
  rivalIndicator: THREE.Group;
  setRival: (isRival: boolean) => void;
  setBodyEnvMap: (envMap: THREE.Texture | null) => void;
  applyLivery: (
    primaryHex: string,
    secondaryHex: string,
    accentHex: string,
    helmetHex: string,
    wheelFinish: WheelFinish,
    compound: TyreCompound,
    carNumber?: string,
    skinToneHex?: string
  ) => void;
  updateVisuals: (
    wheelSpinDelta: number,
    steerAngle: number,
    drsOpen: boolean,
    braking: boolean,
    rollAngle: number,
    pitchAngle: number,
    shiftFlash?: number,
    headlightsOn?: boolean,
    exhaustLoad?: number,
    tyreLoad?: number,
    damagePct?: number,
    brakeTempC?: number,
    grainingSeverityPct?: number,
    microSlipRatio?: number,
    tyreSurfaceTempC?: number
  ) => void;
}

const COMPOUND_COLORS: Record<TyreCompound, string> = {
  soft: '#EF4444',
  medium: '#F59E0B',
  hard: '#F8FAFC',
  wet: '#38BDF8',
};

const _heatCol = new THREE.Color();

function createSculptedTyreGeometry(outerR: number, innerR: number, width: number): THREE.BufferGeometry {
  const hw = width * 0.5;
  const shoulderW = hw * 0.82;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(innerR, -hw * 0.94),
    new THREE.Vector2(outerR * 0.86, -hw),
    new THREE.Vector2(outerR * 0.985, -shoulderW),
    new THREE.Vector2(outerR, -shoulderW * 0.45),
    new THREE.Vector2(outerR, shoulderW * 0.45),
    new THREE.Vector2(outerR * 0.985, shoulderW),
    new THREE.Vector2(outerR * 0.86, hw),
    new THREE.Vector2(innerR, hw * 0.94),
  ];
  const geo = new THREE.LatheGeometry(pts, 56);
  geo.computeVertexNormals();
  geo.computeTangents();
  return geo;
}

export function buildFormulaCar(
  carbonMap: THREE.Texture,
  carbonNormalMap: THREE.Texture,
  paintFlakeNormalMap: THREE.Texture,
  tyreTreadNormalMap: THREE.Texture,
  brakeDiscMap: THREE.Texture,
  contactShadowMap: THREE.Texture,
  primaryHex: string,
  secondaryHex: string,
  accentHex: string,
  helmetHex: string,
  wheelFinish: WheelFinish,
  compound: TyreCompound = 'soft',
  carNumber = '16',
  skinToneHex = '#E8B89A',
  bodyRoughnessMap?: THREE.Texture,
  carAoMap?: THREE.Texture
): FormulaCarModel {
  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);

  const isStealthCarbon = (hex: string) => {
    const c = new THREE.Color(hex);
    return c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722 < 0.14;
  };
  const initStealth = isStealthCarbon(primaryHex);

  const primaryMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(initStealth ? '#2A303D' : primaryHex),
    map: initStealth ? carbonMap : null,
    normalMap: initStealth ? carbonNormalMap : paintFlakeNormalMap,
    normalScale: new THREE.Vector2(initStealth ? 0.72 : 0.065, initStealth ? 0.72 : 0.065),
    roughnessMap: bodyRoughnessMap ?? null,
    aoMap: carAoMap ?? null,
    aoMapIntensity: 0.82,
    metalness: initStealth ? 0.56 : 0.7,
    roughness: initStealth ? 0.17 : 0.13,
    clearcoat: 1.0,
    clearcoatRoughness: 0.025,
    clearcoatNormalMap: paintFlakeNormalMap,
    clearcoatNormalScale: new THREE.Vector2(0.04, 0.04),
    ior: 1.52,
    specularIntensity: 1.0,
    sheen: 0.16,
    sheenRoughness: 0.28,
    iridescence: 0.16,
    iridescenceIOR: 1.38,
    iridescenceThicknessMinimum: 120,
    iridescenceThicknessMaximum: 260,
    envMapIntensity: 2.35,
  });

  const secondaryMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(secondaryHex),
    map: initStealth ? carbonMap : null,
    normalMap: initStealth ? carbonNormalMap : paintFlakeNormalMap,
    normalScale: new THREE.Vector2(initStealth ? 0.58 : 0.045, initStealth ? 0.58 : 0.045),
    roughnessMap: bodyRoughnessMap ?? null,
    aoMap: carAoMap ?? null,
    aoMapIntensity: 0.78,
    metalness: 0.64,
    roughness: 0.2,
    clearcoat: 0.96,
    clearcoatRoughness: 0.038,
    clearcoatNormalMap: paintFlakeNormalMap,
    clearcoatNormalScale: new THREE.Vector2(0.03, 0.03),
    ior: 1.5,
    specularIntensity: 0.95,
    envMapIntensity: 2.05,
  });

  const accentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(accentHex),
    aoMap: carAoMap ?? null,
    aoMapIntensity: 0.65,
    metalness: 0.58,
    roughness: 0.22,
    clearcoat: 0.86,
    clearcoatRoughness: 0.055,
    ior: 1.48,
    envMapIntensity: 1.85,
  });

  const carbonMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e232e,
    map: carbonMap,
    normalMap: carbonNormalMap,
    normalScale: new THREE.Vector2(0.82, 0.82),
    roughnessMap: bodyRoughnessMap ?? null,
    aoMap: carAoMap ?? null,
    aoMapIntensity: 0.85,
    metalness: 0.42,
    roughness: 0.26,
    clearcoat: 0.76,
    clearcoatRoughness: 0.11,
    ior: 1.52,
    specularIntensity: 0.92,
    envMapIntensity: 1.95,
  });

  const tyrePatchUniforms = {
    uGrainingSeverity: { value: 0.0 },
    uBlisterIntensity: { value: 0.0 },
    uMicroSlip: { value: 0.06 },
    uSpinPhase: { value: 0.0 },
  };

  const rubberMat = new THREE.MeshPhysicalMaterial({
    color: 0x12151b,
    normalMap: tyreTreadNormalMap,
    normalScale: new THREE.Vector2(compound === 'wet' ? 0.95 : 0.72, compound === 'wet' ? 0.95 : 0.72),
    metalness: 0.05,
    roughness: compound === 'wet' ? 0.42 : 0.72,
    clearcoat: compound === 'wet' ? 0.52 : 0.22,
    clearcoatRoughness: compound === 'wet' ? 0.24 : 0.48,
    sheen: 0.22,
    sheenRoughness: 0.68,
    envMapIntensity: compound === 'wet' ? 1.45 : 1.12,
  });

  rubberMat.onBeforeCompile = (shader) => {
    shader.uniforms.uGrainingSeverity = tyrePatchUniforms.uGrainingSeverity;
    shader.uniforms.uBlisterIntensity = tyrePatchUniforms.uBlisterIntensity;
    shader.uniforms.uMicroSlip = tyrePatchUniforms.uMicroSlip;
    shader.uniforms.uSpinPhase = tyrePatchUniforms.uSpinPhase;

    shader.vertexShader =
      `varying vec3 vTyreLocalPos;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vTyreLocalPos = position;`
    );

    shader.fragmentShader =
      `uniform float uGrainingSeverity;
      uniform float uBlisterIntensity;
      uniform float uMicroSlip;
      uniform float uSpinPhase;
      varying vec3 vTyreLocalPos;

      float tyreHash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float tyreNoise2D(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = tyreHash21(i);
        float b = tyreHash21(i + vec2(1.0, 0.0));
        float c = tyreHash21(i + vec2(0.0, 1.0));
        float d = tyreHash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      vec2 tyreBlisterVoronoi(vec2 x) {
        vec2 n = floor(x);
        vec2 f = fract(x);
        float dMin = 8.0;
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = vec2(tyreHash21(n + g), tyreHash21(n + g + vec2(17.0, 31.0)));
            vec2 r = g - f + (0.25 + 0.5 * o);
            float d = dot(r, r);
            if (d < dMin) dMin = d;
          }
        }
        return vec2(sqrt(dMin), tyreHash21(n));
      }\n` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float rOuter = length(vTyreLocalPos.xz) / 0.34;
      float treadCrownMask = smoothstep(0.92, 0.975, rOuter) * (1.0 - smoothstep(0.13, 0.19, abs(vTyreLocalPos.y)));
      if (treadCrownMask > 0.01 && (uGrainingSeverity > 0.01 || uBlisterIntensity > 0.01)) {
        float theta = atan(vTyreLocalPos.z, vTyreLocalPos.x);
        float axial = vTyreLocalPos.y * 6.5;
        vec2 patchUv = vec2(theta * 5.5, axial * 4.2);

        // Procedural Graining: Diagonal sheared rubber ribbons & micro-tearing ridges
        float shearAngle = theta * 42.0 + axial * 28.0 + sin(theta * 12.0 + axial * 9.0) * 1.6;
        float grainWave = 0.5 + 0.5 * sin(shearAngle);
        float fineGrain = tyreNoise2D(patchUv * 6.5 + vec2(grainWave * 1.4, -grainWave));
        float tornRibbonMask = smoothstep(0.38, 0.78, grainWave * 0.65 + fineGrain * 0.55) * uGrainingSeverity * treadCrownMask;
        float troughMask = smoothstep(0.65, 0.22, grainWave * 0.6 + fineGrain * 0.4) * uGrainingSeverity * treadCrownMask;

        vec3 grainedRibbonCol = vec3(0.27, 0.28, 0.32);
        vec3 abradedTroughCol = vec3(0.035, 0.038, 0.045);
        diffuseColor.rgb = mix(diffuseColor.rgb, abradedTroughCol, troughMask * 0.68);
        diffuseColor.rgb = mix(diffuseColor.rgb, grainedRibbonCol, tornRibbonMask * 0.74);

        // Procedural Blistering: Cellular erupted rubber craters from sub-surface overheating
        float effBlister = clamp(uBlisterIntensity + max(0.0, uGrainingSeverity - 0.35) * 0.75, 0.0, 1.0);
        if (effBlister > 0.02) {
          vec2 vor = tyreBlisterVoronoi(vec2(theta * 9.0, axial * 5.2));
          float blisterThreshold = mix(0.12, 0.46, effBlister);
          if (vor.y < effBlister * 0.85) {
            float pitCore = 1.0 - smoothstep(0.0, blisterThreshold * 0.58, vor.x);
            float pitRim = smoothstep(blisterThreshold * 0.45, blisterThreshold * 0.75, vor.x) *
                           (1.0 - smoothstep(blisterThreshold * 0.75, blisterThreshold, vor.x));
            vec3 moltenCoreCol = vec3(0.018, 0.018, 0.022);
            vec3 scorchedRimCol = vec3(0.34, 0.25, 0.19);
            diffuseColor.rgb = mix(diffuseColor.rgb, scorchedRimCol, pitRim * effBlister * treadCrownMask * 0.85);
            diffuseColor.rgb = mix(diffuseColor.rgb, moltenCoreCol, pitCore * effBlister * treadCrownMask * 0.92);
          }
        }
      }`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      float rOuterR = length(vTyreLocalPos.xz) / 0.34;
      float treadMaskR = smoothstep(0.92, 0.975, rOuterR) * (1.0 - smoothstep(0.13, 0.19, abs(vTyreLocalPos.y)));
      if (treadMaskR > 0.01 && (uGrainingSeverity > 0.01 || uBlisterIntensity > 0.01)) {
        float thetaR = atan(vTyreLocalPos.z, vTyreLocalPos.x);
        float axialR = vTyreLocalPos.y * 6.5;
        float grainR = tyreNoise2D(vec2(thetaR * 36.0 + axialR * 22.0, axialR * 18.0));
        roughnessFactor = clamp(roughnessFactor + (grainR - 0.3) * uGrainingSeverity * 0.34 * treadMaskR, 0.18, 0.98);
      }`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float rOuterE = length(vTyreLocalPos.xz) / 0.34;
      float treadMaskE = smoothstep(0.93, 0.98, rOuterE) * (1.0 - smoothstep(0.12, 0.18, abs(vTyreLocalPos.y)));
      float thermalScrub = clamp((uGrainingSeverity * 0.55 + uBlisterIntensity * 0.65) * uMicroSlip, 0.0, 1.0);
      if (treadMaskE > 0.01 && thermalScrub > 0.08) {
        float thetaE = atan(vTyreLocalPos.z, vTyreLocalPos.x);
        float bandStreak = 0.6 + 0.4 * sin(thetaE * 28.0 + vTyreLocalPos.y * 95.0);
        vec3 blisterHeatCol = mix(vec3(0.42, 0.08, 0.02), vec3(0.95, 0.32, 0.05), clamp(uBlisterIntensity + uGrainingSeverity * 0.4, 0.0, 1.0));
        totalEmissiveRadiance += blisterHeatCol * thermalScrub * bandStreak * treadMaskE * 0.55;
      }`
    );
  };

  // Procedural Dynamic Tyre Contact Patch Footprint Shader (Adhesion vs Micro-Slip + Graining & Blistering)
  const contactPatchShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uGrainingSeverity: tyrePatchUniforms.uGrainingSeverity,
      uBlisterIntensity: tyrePatchUniforms.uBlisterIntensity,
      uMicroSlip: tyrePatchUniforms.uMicroSlip,
      uSpinPhase: tyrePatchUniforms.uSpinPhase,
    },
    vertexShader: `
      varying vec2 vPatchUv;
      void main() {
        vPatchUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uGrainingSeverity;
      uniform float uBlisterIntensity;
      uniform float uMicroSlip;
      uniform float uSpinPhase;
      varying vec2 vPatchUv;

      float cpHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.5);
        return fract(p.x * p.y);
      }

      float cpNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(cpHash(i), cpHash(i + vec2(1.0, 0.0)), f.x),
          mix(cpHash(i + vec2(0.0, 1.0)), cpHash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        vec2 centered = (vPatchUv - 0.5) * 2.0;
        // Rounded contact patch footprint envelope
        float roundedBox = length(max(abs(centered) - vec2(0.46, 0.52), 0.0));
        float footprintMask = 1.0 - smoothstep(0.0, 0.34, roundedBox);
        if (footprintMask <= 0.01) discard;

        // Leading-edge static adhesion vs trailing-edge micro-slip zone (vPatchUv.y: 0=leading, 1=trailing)
        float transitionY = clamp(1.0 - uMicroSlip * 0.88, 0.12, 0.92);
        float trailingSlipZone = smoothstep(transitionY - 0.14, transitionY + 0.14, vPatchUv.y);

        // Procedural Graining Ripples scrolling with tyre rotation
        vec2 scrolledUv = vec2(vPatchUv.x * 18.0, vPatchUv.y * 22.0 - uSpinPhase * 2.5);
        float diagonalWave = 0.5 + 0.5 * sin(scrolledUv.x * 2.6 + scrolledUv.y * 3.4 + cpNoise(scrolledUv) * 2.8);
        float grainPattern = smoothstep(0.32, 0.82, diagonalWave) * uGrainingSeverity;

        // Procedural Blistering Craters
        float cellNoise = cpNoise(scrolledUv * 0.85 + vec2(4.2, 9.1));
        float blisterSpots = smoothstep(0.76 - uBlisterIntensity * 0.28, 0.92, cellNoise) *
                             clamp(uBlisterIntensity + uGrainingSeverity * 0.5, 0.0, 1.0);

        vec3 stickCol = vec3(0.06, 0.68, 0.48);
        vec3 slipCol = vec3(0.96, 0.58, 0.08);
        vec3 grainCol = vec3(0.95, 0.36, 0.06);
        vec3 blisterCol = vec3(0.98, 0.14, 0.08);

        vec3 patchCol = mix(stickCol, slipCol, trailingSlipZone);
        patchCol = mix(patchCol, grainCol, grainPattern * 0.85);
        patchCol = mix(patchCol, blisterCol, blisterSpots * 0.95);

        float activityAlpha = clamp(0.18 + uMicroSlip * 0.42 + uGrainingSeverity * 0.48 + uBlisterIntensity * 0.35, 0.18, 0.88);
        float edgeGlow = footprintMask * (0.55 + 0.45 * grainPattern + 0.5 * blisterSpots);
        gl_FragColor = vec4(patchCol * (1.1 + uGrainingSeverity * 0.8 + blisterSpots * 0.9), edgeGlow * activityAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });

  const treadGrooveMat = new THREE.MeshStandardMaterial({
    color: 0x07090d,
    roughness: compound === 'wet' ? 0.22 : 0.82,
    metalness: compound === 'wet' ? 0.25 : 0.04,
  });

  const rimMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(wheelFinish.rimColor),
    metalness: wheelFinish.metalness,
    roughness: wheelFinish.roughness,
    anisotropy: 0.86,
    clearcoat: 0.65,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.85,
  });

  const compoundRingMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(COMPOUND_COLORS[compound]),
    metalness: 0.15,
    roughness: 0.34,
  });

  let pirelliSidewallTex = createPirelliSidewallTexture(compound);
  const pirelliSidewallMat = new THREE.MeshStandardMaterial({
    map: pirelliSidewallTex,
    roughness: 0.52,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const brakeThermalUniforms = {
    uBrakeHeat: { value: 0.0 },
    uBrakeTempC: { value: 280.0 },
    uDiscSpinPhase: { value: 0.0 },
  };

  const brakeDiscMat = new THREE.MeshStandardMaterial({
    color: 0x454a54,
    map: brakeDiscMap,
    emissive: 0xff4500,
    emissiveIntensity: 0,
    metalness: 0.88,
    roughness: 0.26,
  });

  brakeDiscMat.onBeforeCompile = (shader) => {
    shader.uniforms.uBrakeHeat = brakeThermalUniforms.uBrakeHeat;
    shader.uniforms.uBrakeTempC = brakeThermalUniforms.uBrakeTempC;
    shader.uniforms.uDiscSpinPhase = brakeThermalUniforms.uDiscSpinPhase;
    shader.vertexShader = 'varying vec3 vDiscLocalPos;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vDiscLocalPos = position;`
    );
    shader.fragmentShader =
      `uniform float uBrakeHeat;
      uniform float uBrakeTempC;
      uniform float uDiscSpinPhase;
      varying vec3 vDiscLocalPos;\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      if (uBrakeHeat > 0.01) {
        float rNorm = clamp(length(vDiscLocalPos.xz) / 0.1666, 0.0, 1.0);
        float theta = atan(vDiscLocalPos.z, vDiscLocalPos.x) + uDiscSpinPhase;
        float sweptBand = smoothstep(0.34, 0.50, rNorm) * (1.0 - smoothstep(0.90, 0.99, rNorm));
        float scoreGrooves = 0.80 + 0.20 * sin(rNorm * 118.0 + cos(theta * 6.0) * 1.4);
        float vaneHotspots = 0.84 + 0.16 * sin(theta * 24.0 + rNorm * 16.0);
        float tempFactor = clamp((uBrakeTempC - 300.0) / 800.0, 0.0, 1.0);
        float localHeat = clamp(mix(uBrakeHeat, tempFactor, 0.5) * (0.62 + 0.58 * sweptBand) * scoreGrooves * vaneHotspots, 0.0, 1.0);
        vec3 dullRed = vec3(0.46, 0.022, 0.004);
        vec3 cherryRed = vec3(0.88, 0.085, 0.012);
        vec3 brightOrange = vec3(1.0, 0.36, 0.035);
        vec3 incandescentAmber = vec3(1.0, 0.68, 0.16);
        vec3 thermalColor = mix(dullRed, cherryRed, smoothstep(0.04, 0.42, localHeat));
        thermalColor = mix(thermalColor, brightOrange, smoothstep(0.42, 0.78, localHeat));
        thermalColor = mix(thermalColor, incandescentAmber, smoothstep(0.78, 1.0, localHeat));
        float glowMask = smoothstep(0.03, 0.18, uBrakeHeat) * sweptBand;
        totalEmissiveRadiance += thermalColor * (uBrakeHeat * uBrakeHeat * 7.6 + uBrakeHeat * 1.8) * glowMask;
      }`
    );
  };

  const brakeHeatRingMat = new THREE.ShaderMaterial({
    uniforms: {
      uBrakeHeat: brakeThermalUniforms.uBrakeHeat,
      uBrakeTempC: brakeThermalUniforms.uBrakeTempC,
      uDiscSpinPhase: brakeThermalUniforms.uDiscSpinPhase,
    },
    vertexShader: `
      varying vec3 vRingPos;
      void main() {
        vRingPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uBrakeHeat;
      uniform float uBrakeTempC;
      uniform float uDiscSpinPhase;
      varying vec3 vRingPos;
      void main() {
        if (uBrakeHeat <= 0.015) discard;
        float angle = atan(vRingPos.y, vRingPos.x);
        float caliperWave = 0.78 + 0.22 * cos(angle - 0.6 + sin(uDiscSpinPhase * 0.5) * 0.2);
        float ventPulse = 0.88 + 0.12 * sin(angle * 18.0 + uDiscSpinPhase * 2.0);
        float tempNorm = clamp((uBrakeTempC - 300.0) / 800.0, 0.0, 1.0);
        float intensity = clamp(mix(uBrakeHeat, tempNorm, 0.45) * caliperWave * ventPulse, 0.0, 1.0);
        vec3 dullRed = vec3(0.52, 0.03, 0.008);
        vec3 deepRed = vec3(0.92, 0.11, 0.02);
        vec3 brightOrange = vec3(1.0, 0.46, 0.06);
        vec3 hotCore = vec3(1.0, 0.72, 0.22);
        vec3 col = mix(dullRed, deepRed, smoothstep(0.05, 0.45, intensity));
        col = mix(col, brightOrange, smoothstep(0.45, 0.82, intensity));
        col = mix(col, hotCore, smoothstep(0.82, 1.0, intensity));
        float alpha = clamp(uBrakeHeat * 0.94 * caliperWave, 0.0, 0.95);
        gl_FragColor = vec4(col * (1.2 + uBrakeHeat * 2.4), alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const spokeBlurMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(wheelFinish.rimColor),
    metalness: 0.88,
    roughness: 0.16,
    anisotropy: 0.95,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const caliperMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(accentHex),
    metalness: 0.5,
    roughness: 0.22,
    clearcoat: 0.8,
  });

  const helmetMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(helmetHex),
    metalness: 0.48,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  });

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x090d14,
    metalness: 0.78,
    roughness: 0.04,
    clearcoat: 1.0,
    iridescence: 0.9,
    iridescenceIOR: 1.4,
    transparent: true,
    opacity: 0.62,
  });

  const driverSkinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(skinToneHex),
    roughness: 0.52,
    metalness: 0.04,
  });
  const balaclavaMat = new THREE.MeshStandardMaterial({
    color: 0x0c0f16,
    roughness: 0.85,
  });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x181512 });

  const titaniumMat = new THREE.MeshPhysicalMaterial({
    color: 0x444b5a,
    metalness: 0.92,
    roughness: 0.18,
    anisotropy: 0.78,
    envMapIntensity: 1.45,
  });

  const exhaustBlueMat = new THREE.MeshPhysicalMaterial({
    color: 0x525b6e,
    metalness: 0.94,
    roughness: 0.16,
    iridescence: 0.85,
    iridescenceIOR: 1.35,
    iridescenceThicknessMinimum: 180,
    iridescenceThicknessMaximum: 420,
  });

  let decalTex = createNumberDecalTexture(carNumber, accentHex);
  const decalMat = new THREE.MeshStandardMaterial({
    map: decalTex,
    transparent: true,
    roughness: 0.22,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  // Contact shadow grounded flush at y = 0.015
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 6.5),
    new THREE.MeshBasicMaterial({
      map: contactShadowMap,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.set(0, 0.015, 0.05);
  root.add(shadowPlane);

  // 1. Carbon Floor, Bargeboard Strakes & Venturi Diffuser
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.04, 4.25), carbonMat);
  floorMesh.position.set(0, 0.14, 0.1);
  floorMesh.castShadow = true;
  floorMesh.receiveShadow = true;
  chassisGroup.add(floorMesh);

  for (const side of [-1, 1]) {
    const floorEdgeWing = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 1.98), accentMat);
    floorEdgeWing.position.set(side * 0.92, 0.18, 0.38);
    chassisGroup.add(floorEdgeWing);

    // Venturi floor-edge vortex strakes
    for (let k = 0; k < 3; k++) {
      const strake = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.18), carbonMat);
      strake.position.set(side * 0.88, 0.18, -0.35 + k * 0.38);
      strake.rotation.y = side * 0.32;
      chassisGroup.add(strake);
    }
  }

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.16, 0.6), carbonMat);
  diffuser.position.set(0, 0.21, 2.08);
  diffuser.rotation.x = 0.22;
  chassisGroup.add(diffuser);

  // Diffuser vertical splitter fins
  for (const fx of [-0.36, -0.12, 0.12, 0.36]) {
    const dFin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.42), carbonMat);
    dFin.position.set(fx, 0.2, 2.16);
    chassisGroup.add(dFin);
  }

  // 2. Central Monocoque Survival Cell (Beveled Extrude)
  const tubShape = new THREE.Shape();
  tubShape.moveTo(-0.34, -0.16);
  tubShape.lineTo(0.34, -0.16);
  tubShape.lineTo(0.38, 0.16);
  tubShape.lineTo(0.28, 0.22);
  tubShape.lineTo(-0.28, 0.22);
  tubShape.lineTo(-0.38, 0.16);
  tubShape.closePath();

  const tubGeo = new THREE.ExtrudeGeometry(tubShape, {
    depth: 2.2,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.03,
    bevelThickness: 0.03,
  });
  tubGeo.translate(0, 0.38, -1.18);
  const tub = new THREE.Mesh(tubGeo, primaryMat);
  tub.castShadow = true;
  chassisGroup.add(tub);

  // 3. Sculpted Nose Cone + Nose Number Decal + Pitot Probe
  const noseShape = new THREE.Shape();
  noseShape.moveTo(0, 0.24);
  noseShape.lineTo(1.48, 0.13);
  noseShape.lineTo(1.54, 0.03);
  noseShape.lineTo(0, -0.05);
  noseShape.closePath();

  const noseGeo = new THREE.ExtrudeGeometry(noseShape, {
    depth: 0.36,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.05,
    bevelThickness: 0.05,
  });
  noseGeo.rotateY(Math.PI / 2);
  noseGeo.translate(-0.18, 0.34, -1.14);
  const noseMesh = new THREE.Mesh(noseGeo, primaryMat);
  noseMesh.castShadow = true;
  chassisGroup.add(noseMesh);

  const noseStripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 1.38), accentMat);
  noseStripe.position.set(0, 0.53, -1.78);
  noseStripe.rotation.x = 0.08;
  chassisGroup.add(noseStripe);

  const noseDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), decalMat);
  noseDecal.rotation.x = -Math.PI / 2 + 0.09;
  noseDecal.position.set(0, 0.57, -1.62);
  chassisGroup.add(noseDecal);

  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.18, 6), titaniumMat);
  pitot.rotation.x = Math.PI / 2;
  pitot.position.set(0, 0.62, -1.25);
  chassisGroup.add(pitot);

  // 4. Multi-Element Front Wing + Cascade Winglets + Endplate Diveplanes
  const frontWingGroup = new THREE.Group();
  frontWingGroup.position.set(0, 0.16, -2.55);

  const mainPlane = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.032, 0.36), carbonMat);
  mainPlane.castShadow = true;
  frontWingGroup.add(mainPlane);

  const midFlap = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.026, 0.22), secondaryMat);
  midFlap.position.set(0, 0.034, 0.08);
  midFlap.rotation.x = 0.16;
  frontWingGroup.add(midFlap);

  const upperFlap = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.026, 0.2), primaryMat);
  upperFlap.position.set(0, 0.068, 0.15);
  upperFlap.rotation.x = 0.28;
  frontWingGroup.add(upperFlap);

  const flapAccent = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.02, 0.09), accentMat);
  flapAccent.position.set(0, 0.105, 0.23);
  flapAccent.rotation.x = 0.38;
  frontWingGroup.add(flapAccent);

  for (const side of [-1, 1]) {
    const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.29, 0.58), secondaryMat);
    endplate.position.set(side * 1.05, 0.11, 0.03);
    endplate.castShadow = true;
    frontWingGroup.add(endplate);

    const diveplane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.24), accentMat);
    diveplane.position.set(side * 1.09, 0.16, 0.08);
    diveplane.rotation.x = 0.32;
    frontWingGroup.add(diveplane);

    const cascade = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.14), carbonMat);
    cascade.position.set(side * 0.72, 0.14, 0.05);
    cascade.rotation.x = 0.28;
    frontWingGroup.add(cascade);

    // Front wing titanium flap adjuster, slot-gap separator brackets, footplate & fasteners
    const stay = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.11, 8), titaniumMat);
    stay.position.set(side * 0.44, 0.06, 0.13);
    stay.rotation.x = -0.35;
    frontWingGroup.add(stay);

    for (const bx of [0.34, 0.68, 0.88]) {
      const slotBracket = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.075, 0.045), titaniumMat);
      slotBracket.position.set(side * bx, 0.048, 0.11);
      frontWingGroup.add(slotBracket);
    }

    const footplate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.56), carbonMat);
    footplate.position.set(side * 1.07, -0.025, 0.04);
    frontWingGroup.add(footplate);

    for (let f = 0; f < 3; f++) {
      const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.046, 6), titaniumMat);
      rivet.rotation.z = Math.PI / 2;
      rivet.position.set(side * 1.052, 0.04 + f * 0.065, -0.14 + f * 0.14);
      frontWingGroup.add(rivet);
    }
  }
  chassisGroup.add(frontWingGroup);

  // 4b. Sleek LED DRL Headlight Blades + Volumetric Light Beams (Sunset / Night / Rain showcase)
  const ledHeadlightMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0xe0f2fe,
    emissiveIntensity: 3.4,
    roughness: 0.1,
  });
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xf0f9ff,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const headlightBeamGroup = new THREE.Group();
  for (const side of [-1, 1]) {
    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.024, 0.24), ledHeadlightMat);
    ledStrip.position.set(side * 0.165, 0.46, -1.78);
    ledStrip.rotation.y = side * -0.08;
    chassisGroup.add(ledStrip);

    const endplateLed = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.022, 0.16), ledHeadlightMat);
    endplateLed.position.set(side * 1.05, 0.26, -2.58);
    chassisGroup.add(endplateLed);

    const beamCone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 6.4, 12, 1, true), beamMat);
    beamCone.rotation.x = Math.PI / 2;
    beamCone.position.set(side * 0.22, 0.34, -5.0);
    headlightBeamGroup.add(beamCone);
  }
  chassisGroup.add(headlightBeamGroup);

  // 5. Sculpted Ground-Effect Sidepods, Cooling Louvers, Undercut & Mirrors
  const sidepodShape = new THREE.Shape();
  sidepodShape.moveTo(0, 0.06);
  sidepodShape.lineTo(1.75, 0.02);
  sidepodShape.lineTo(1.88, 0.18);
  sidepodShape.lineTo(1.25, 0.34);
  sidepodShape.lineTo(0.12, 0.35);
  sidepodShape.lineTo(-0.04, 0.22);
  sidepodShape.closePath();

  const sidepodGeo = new THREE.ExtrudeGeometry(sidepodShape, {
    depth: 0.4,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.045,
    bevelThickness: 0.045,
  });
  sidepodGeo.rotateY(Math.PI / 2);

  for (const side of [-1, 1]) {
    const sidepod = new THREE.Mesh(sidepodGeo, primaryMat);
    sidepod.position.set(side === -1 ? -0.79 : 0.39, 0.19, 1.3);
    sidepod.rotation.y = side * -0.06;
    sidepod.castShadow = true;
    chassisGroup.add(sidepod);

    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.14), carbonMat);
    intake.position.set(side * 0.58, 0.39, -0.53);
    chassisGroup.add(intake);

    // Sidepod cooling gill louvers
    for (let g = 0; g < 5; g++) {
      const gill = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.015, 0.05), carbonMat);
      gill.position.set(side * 0.57, 0.56, 0.12 + g * 0.13);
      gill.rotation.y = side * -0.15;
      chassisGroup.add(gill);
    }

    const sideAccent = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 1.48), accentMat);
    sideAccent.position.set(side * 0.83, 0.39, 0.38);
    sideAccent.rotation.y = side * -0.06;
    chassisGroup.add(sideAccent);

    // Sidepod undercut bargeboard turning vanes (futuristic 2026 aero cascade)
    for (let v = 0; v < 3; v++) {
      const vane = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.22 - v * 0.03, 0.16), carbonMat);
      vane.position.set(side * (0.72 + v * 0.045), 0.26, -0.78 + v * 0.14);
      vane.rotation.y = side * 0.28;
      chassisGroup.add(vane);
    }

    const mirrorStalk = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.04), carbonMat);
    mirrorStalk.position.set(side * 0.44, 0.62, -0.45);
    chassisGroup.add(mirrorStalk);

    const mirrorPod = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.09), primaryMat);
    mirrorPod.position.set(side * 0.55, 0.64, -0.45);
    chassisGroup.add(mirrorPod);
  }

  // Sculpted tinted polycarbonate cockpit aero windscreen
  const windscreenMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.55,
    transparent: true,
    opacity: 0.72,
    ior: 1.49,
    clearcoat: 1.0,
  });
  const windscreen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.26, 0.08, 16, 1, true, -Math.PI * 0.42, Math.PI * 0.84),
    windscreenMat
  );
  windscreen.position.set(0, 0.62, -0.34);
  windscreen.rotation.y = Math.PI;
  windscreen.rotation.x = 0.35;
  chassisGroup.add(windscreen);

  // 6. Tapered Engine Cover, Airbox, T-Cam, Shark Fin + Number Decal, Twin Exhaust & Shift Flame
  const engineCoverGeo = new THREE.CylinderGeometry(0.18, 0.27, 1.54, 16);
  engineCoverGeo.computeTangents();
  const engineCover = new THREE.Mesh(engineCoverGeo, secondaryMat);
  engineCover.rotation.x = Math.PI / 2;
  engineCover.scale.set(0.95, 1, 1.35);
  engineCover.position.set(0, 0.54, 0.94);
  engineCover.castShadow = true;
  chassisGroup.add(engineCover);

  const airbox = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 0.44, 14), primaryMat);
  airbox.rotation.x = Math.PI / 2;
  airbox.position.set(0, 0.81, 0.24);
  chassisGroup.add(airbox);

  const tcamStem = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.08), carbonMat);
  tcamStem.position.set(0, 0.98, 0.22);
  chassisGroup.add(tcamStem);
  const tcamBar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.045, 0.12), carbonMat);
  tcamBar.position.set(0, 1.07, 0.22);
  chassisGroup.add(tcamBar);

  const sharkFin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 1.18), primaryMat);
  sharkFin.position.set(0, 0.84, 1.08);
  chassisGroup.add(sharkFin);

  // Heat-blued titanium central exhaust + twin wastegates
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.072, 0.36, 16), exhaustBlueMat);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0, 0.44, 2.04);
  chassisGroup.add(exhaust);

  for (const ws of [-0.085, 0.085]) {
    const wastegate = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.28, 10), exhaustBlueMat);
    wastegate.rotation.x = Math.PI / 2;
    wastegate.position.set(ws, 0.41, 2.02);
    chassisGroup.add(wastegate);
  }

  const exhaustFlameMat = new THREE.MeshBasicMaterial({
    color: 0xff8c1a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const exhaustFlame = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.42, 10), exhaustFlameMat);
  exhaustFlame.rotation.x = Math.PI / 2;
  exhaustFlame.position.set(0, 0.44, 2.32);
  chassisGroup.add(exhaustFlame);

  const innerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.26, 8), innerFlameMat);
  innerFlame.rotation.x = Math.PI / 2;
  innerFlame.position.set(0, 0.44, 2.24);
  chassisGroup.add(innerFlame);

  // Translucent hot exhaust gas heat shimmer plume
  const heatPlumeMat = new THREE.MeshBasicMaterial({
    color: 0xffedd5,
    transparent: true,
    opacity: 0.05,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const heatPlume = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.35, 10, 1, true), heatPlumeMat);
  heatPlume.rotation.x = Math.PI / 2;
  heatPlume.position.set(0, 0.44, 2.86);
  chassisGroup.add(heatPlume);

  // 7. Cockpit, Seated 3D Formula Driver Character, Rotating Butterfly Steering Wheel & Titanium Halo
  const cockpitRecess = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.72), carbonMat);
  cockpitRecess.position.set(0, 0.54, -0.15);
  chassisGroup.add(cockpitRecess);

  const suitMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(secondaryHex),
    roughness: 0.78,
    metalness: 0.08,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentHex),
    roughness: 0.65,
    metalness: 0.1,
  });

  // Driver Torso, Shoulders, HANS Collar & 6-Point Harness
  const driverTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.36, 14), suitMat);
  driverTorso.position.set(0, 0.5, -0.05);
  driverTorso.rotation.x = 0.42;
  chassisGroup.add(driverTorso);

  const driverShoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.24, 6, 12), suitMat);
  driverShoulders.rotation.z = Math.PI / 2;
  driverShoulders.position.set(0, 0.56, -0.05);
  chassisGroup.add(driverShoulders);

  const hansCollar = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.028, 8, 18, Math.PI * 1.2), carbonMat);
  hansCollar.rotation.x = Math.PI / 2 + 0.25;
  hansCollar.rotation.z = -Math.PI * 0.1;
  hansCollar.position.set(0, 0.6, -0.04);
  chassisGroup.add(hansCollar);

  for (const s of [-1, 1]) {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.02, 0.24), gloveMat);
    belt.position.set(s * 0.085, 0.58, -0.11);
    belt.rotation.x = 0.55;
    chassisGroup.add(belt);
  }

  // Articulated Steering Column + Butterfly F1 Wheel + Hands/Arms
  const steeringWheelGroup = new THREE.Group();
  steeringWheelGroup.position.set(0, 0.61, -0.37);
  steeringWheelGroup.rotation.x = -0.28;
  chassisGroup.add(steeringWheelGroup);

  const steeringColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.22, 10), titaniumMat);
  steeringColumn.rotation.x = Math.PI / 2;
  steeringColumn.position.z = -0.11;
  steeringWheelGroup.add(steeringColumn);

  const wheelBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.03), carbonMat);
  steeringWheelGroup.add(wheelBody);

  const wheelDash = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.07, 0.036),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x38bdf8, emissiveIntensity: 1.75 })
  );
  wheelDash.position.set(0, 0.015, 0.004);
  steeringWheelGroup.add(wheelDash);

  const shiftLedColors = [0x22c55e, 0x22c55e, 0xef4444, 0xef4444, 0x38bdf8];
  const shiftLedMats: THREE.MeshStandardMaterial[] = [];
  for (let l = 0; l < 5; l++) {
    const lMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      emissive: shiftLedColors[l],
      emissiveIntensity: 1.6,
    });
    shiftLedMats.push(lMat);
    const ledDot = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.01, 0.038), lMat);
    ledDot.position.set((l - 2) * 0.024, 0.056, 0.004);
    steeringWheelGroup.add(ledDot);
  }

  // Steering wheel rotary encoders & rear carbon shift paddles
  for (const d of [-1, 0, 1]) {
    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.014, 10),
      d === 0 ? accentMat : titaniumMat
    );
    dial.rotation.x = Math.PI / 2;
    dial.position.set(d * 0.034, -0.032, 0.016);
    steeringWheelGroup.add(dial);
  }
  for (const s of [-1, 1]) {
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.024, 0.008), carbonMat);
    paddle.position.set(s * 0.078, 0.012, -0.024);
    paddle.rotation.y = s * -0.18;
    steeringWheelGroup.add(paddle);
  }

  for (const s of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.075, 4, 8), rubberMat);
    grip.position.set(s * 0.125, 0, 0.005);
    steeringWheelGroup.add(grip);

    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 10), gloveMat);
    glove.scale.set(0.95, 1.15, 1.2);
    glove.position.set(s * 0.132, 0, 0.022);
    steeringWheelGroup.add(glove);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.24, 10), suitMat);
    forearm.position.set(s * 0.165, -0.025, 0.14);
    forearm.rotation.x = Math.PI / 2 - 0.12;
    forearm.rotation.z = s * -0.22;
    steeringWheelGroup.add(forearm);
  }

  // Articulated Driver Head + Helmet + Focused Driver Eyes Behind Semi-Transparent Iridescent Visor
  const driverHeadGroup = new THREE.Group();
  driverHeadGroup.position.set(0, 0.67, -0.05);
  chassisGroup.add(driverHeadGroup);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 26), helmetMat);
  helmet.scale.set(0.95, 1.0, 1.12);
  driverHeadGroup.add(helmet);

  const helmetSpoiler = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.12), accentMat);
  helmetSpoiler.position.set(0, 0.09, 0.13);
  helmetSpoiler.rotation.x = -0.35;
  driverHeadGroup.add(helmetSpoiler);

  const innerBalaclava = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.078, 0.11), balaclavaMat);
  innerBalaclava.position.set(0, 0.02, -0.092);
  driverHeadGroup.add(innerBalaclava);

  const driverFaceBand = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.052, 0.024), driverSkinMat);
  driverFaceBand.position.set(0, 0.02, -0.142);
  driverHeadGroup.add(driverFaceBand);

  for (const side of [-1, 1]) {
    const eyeSclera = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.015, 0.01), eyeWhiteMat);
    eyeSclera.position.set(side * 0.042, 0.022, -0.153);
    driverHeadGroup.add(eyeSclera);

    const eyePupil = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.014, 0.012), eyePupilMat);
    eyePupil.position.set(side * 0.04, 0.022, -0.155);
    driverHeadGroup.add(eyePupil);

    const eyebrow = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.007, 0.012), balaclavaMat);
    eyebrow.position.set(side * 0.042, 0.034, -0.154);
    eyebrow.rotation.z = side * 0.14;
    driverHeadGroup.add(eyebrow);
  }

  const visorSponsorStrip = new THREE.Mesh(new THREE.BoxGeometry(0.242, 0.018, 0.142), accentMat);
  visorSponsorStrip.position.set(0, 0.054, -0.11);
  driverHeadGroup.add(visorSponsorStrip);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.085, 0.14), visorMat);
  visor.position.set(0, 0.02, -0.11);
  driverHeadGroup.add(visor);

  const haloCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.26, 0.61, 0.15),
    new THREE.Vector3(-0.24, 0.78, -0.22),
    new THREE.Vector3(0, 0.82, -0.45),
    new THREE.Vector3(0.24, 0.78, -0.22),
    new THREE.Vector3(0.26, 0.61, 0.15),
  ]);
  const haloMesh = new THREE.Mesh(new THREE.TubeGeometry(haloCurve, 36, 0.032, 18, false), titaniumMat);
  haloMesh.castShadow = true;
  chassisGroup.add(haloMesh);

  const haloStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.24, 14), titaniumMat);
  haloStem.position.set(0, 0.7, -0.47);
  haloStem.rotation.x = 0.45;
  chassisGroup.add(haloStem);

  // 8. Rear Wing + Beam Wing + DRS Actuator Pod + Articulated DRS Flap
  const rearWingGroup = new THREE.Group();
  rearWingGroup.position.set(0, 0.86, 2.02);

  const rearPylon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.46, 0.22), carbonMat);
  rearPylon.position.set(0, -0.2, 0.02);
  rearWingGroup.add(rearPylon);

  const drsPod = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.26), carbonMat);
  drsPod.position.set(0, 0.06, 0.02);
  rearWingGroup.add(drsPod);

  const beamWing = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.028, 0.2), carbonMat);
  beamWing.position.set(0, -0.34, 0.06);
  beamWing.rotation.x = 0.2;
  rearWingGroup.add(beamWing);

  const rearMainPlane = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.038, 0.34), secondaryMat);
  rearMainPlane.position.set(0, -0.02, 0);
  rearMainPlane.rotation.x = 0.22;
  rearMainPlane.castShadow = true;
  rearWingGroup.add(rearMainPlane);

  const drsFlap = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.032, 0.22), accentMat);
  drsFlap.position.set(0, 0.11, 0.12);
  drsFlap.rotation.x = 0.48;
  drsFlap.castShadow = true;
  rearWingGroup.add(drsFlap);

  for (const side of [-1, 1]) {
    const rwEnd = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.48, 0.5), primaryMat);
    rwEnd.position.set(side * 0.59, -0.04, 0.03);
    rwEnd.castShadow = true;
    rearWingGroup.add(rwEnd);

    // Endplate carbon cooling louvers & titanium DRS actuator link
    for (let lv = 0; lv < 3; lv++) {
      const louver = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.016, 0.14), carbonMat);
      louver.position.set(side * 0.59, 0.1 - lv * 0.045, 0.12);
      louver.rotation.x = 0.26;
      rearWingGroup.add(louver);
    }
    const drsStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), titaniumMat);
    drsStrut.position.set(side * 0.14, 0.06, 0.08);
    drsStrut.rotation.x = 0.55;
    rearWingGroup.add(drsStrut);
  }
  chassisGroup.add(rearWingGroup);

  const rainLightMat = new THREE.MeshStandardMaterial({
    color: 0xff1e2d,
    emissive: 0xff1122,
    emissiveIntensity: 6.5,
    roughness: 0.14,
  });
  const rainLight = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.125, 0.045), rainLightMat);
  rainLight.position.set(0, 0.29, 2.24);
  chassisGroup.add(rainLight);

  // Volumetric Red FIA Rain-Light Halo & Mist Beacon
  const rainHaloMat = new THREE.MeshBasicMaterial({
    color: 0xff1a2b,
    transparent: true,
    opacity: 0.58,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const rainHaloCore = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), rainHaloMat);
  rainHaloCore.scale.set(1.15, 1.35, 0.75);
  rainHaloCore.position.set(0, 0.29, 2.27);
  chassisGroup.add(rainHaloCore);

  const rainBeaconMat = new THREE.MeshBasicMaterial({
    color: 0xff2436,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const rainBeaconCone = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.65, 14, 1, true), rainBeaconMat);
  rainBeaconCone.rotation.x = -Math.PI / 2;
  rainBeaconCone.position.set(0, 0.29, 3.05);
  chassisGroup.add(rainBeaconCone);

  // Dual Rear Wing Endplate Red Rain Light Strips (2026 FIA Wet-Weather Spec)
  for (const side of [-1, 1]) {
    const rwLed = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.24, 0.024), rainLightMat);
    rwLed.position.set(side * 0.59, 0.82, 2.27);
    chassisGroup.add(rwLed);
  }

  // PS5 Ray-Traced Wet-Asphalt Red Rain-Light & Headlight Ground Reflection Pools
  const wetRoadRefCanvas = document.createElement('canvas');
  wetRoadRefCanvas.width = 128;
  wetRoadRefCanvas.height = 256;
  const wrCtx = wetRoadRefCanvas.getContext('2d');
  if (wrCtx) {
    const rGrad = wrCtx.createRadialGradient(64, 48, 4, 64, 132, 118);
    rGrad.addColorStop(0.0, 'rgba(255, 28, 45, 0.95)');
    rGrad.addColorStop(0.28, 'rgba(255, 18, 34, 0.52)');
    rGrad.addColorStop(0.65, 'rgba(220, 10, 24, 0.16)');
    rGrad.addColorStop(1.0, 'rgba(220, 10, 24, 0.0)');
    wrCtx.fillStyle = rGrad;
    wrCtx.fillRect(0, 0, 128, 256);
  }
  const wetRoadRefTex = new THREE.CanvasTexture(wetRoadRefCanvas);
  wetRoadRefTex.colorSpace = THREE.SRGBColorSpace;
  const wetRearReflectionMat = new THREE.MeshBasicMaterial({
    map: wetRoadRefTex,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const wetRearReflectionPool = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 3.6), wetRearReflectionMat);
  wetRearReflectionPool.rotation.x = -Math.PI / 2;
  wetRearReflectionPool.position.set(0, 0.022, 3.55);
  root.add(wetRearReflectionPool);

  // 9. Suspension Wishbones, Wheel Brow Winglets, Calipers & Sculpted Lathe Tyres
  const wheelRadius = 0.34;
  const frontZ = -1.62;
  const rearZ = 1.54;
  const frontTrackX = 0.88;
  const rearTrackX = 0.92;

  for (const side of [-1, 1]) {
    const fwUpper = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.026, 0.07), carbonMat);
    fwUpper.position.set(side * 0.52, 0.38, frontZ);
    fwUpper.rotation.z = side * 0.08;
    chassisGroup.add(fwUpper);

    const fwLower = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.024, 0.08), carbonMat);
    fwLower.position.set(side * 0.52, 0.25, frontZ);
    chassisGroup.add(fwLower);

    const fwPushrod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.66, 8), titaniumMat);
    fwPushrod.position.set(side * 0.52, 0.36, frontZ + 0.06);
    fwPushrod.rotation.z = side * 1.15;
    chassisGroup.add(fwPushrod);

    const fwTieRod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.62, 8), titaniumMat);
    fwTieRod.position.set(side * 0.52, 0.3, frontZ - 0.05);
    fwTieRod.rotation.z = Math.PI / 2;
    chassisGroup.add(fwTieRod);

    // Inboard titanium suspension pickup clevises on monocoque tub
    const fwClevis = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 0.11), titaniumMat);
    fwClevis.position.set(side * 0.23, 0.38, frontZ);
    chassisGroup.add(fwClevis);

    const rwUpper = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.028, 0.08), carbonMat);
    rwUpper.position.set(side * 0.54, 0.38, rearZ);
    chassisGroup.add(rwUpper);

    const rwLower = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.026, 0.09), carbonMat);
    rwLower.position.set(side * 0.54, 0.25, rearZ);
    chassisGroup.add(rwLower);

    const rwPullrod = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.68, 8), titaniumMat);
    rwPullrod.position.set(side * 0.54, 0.35, rearZ - 0.06);
    rwPullrod.rotation.z = side * 1.18;
    chassisGroup.add(rwPullrod);

    const rwClevis = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.048, 0.12), titaniumMat);
    rwClevis.position.set(side * 0.24, 0.38, rearZ);
    chassisGroup.add(rwClevis);

    const deflector = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.34, 0.32), carbonMat);
    deflector.position.set(side * 0.72, 0.36, frontZ + 0.18);
    chassisGroup.add(deflector);
  }

  const frontTyreGeo = createSculptedTyreGeometry(wheelRadius, wheelRadius * 0.62, 0.32);
  const rearTyreGeo = createSculptedTyreGeometry(wheelRadius, wheelRadius * 0.62, 0.4);

  const wheels: THREE.Group[] = [];
  const wetGrooveRings: THREE.Mesh[] = [];
  const createWheel = (width: number, tyreGeo: THREE.BufferGeometry): THREE.Group => {
    const wg = new THREE.Group();

    const tyre = new THREE.Mesh(tyreGeo, rubberMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    wg.add(tyre);

    // 3D Sculpted Circumferential Water-Evacuation Tread Grooves
    const grooveGeo = new THREE.TorusGeometry(wheelRadius * 0.996, 0.0055, 10, 48);
    for (const gOff of [-0.28, -0.1, 0.1, 0.28]) {
      const grooveRing = new THREE.Mesh(grooveGeo, treadGrooveMat);
      grooveRing.rotation.y = Math.PI / 2;
      grooveRing.position.x = gOff * width;
      grooveRing.visible = compound === 'wet';
      wg.add(grooveRing);
      wetGrooveRings.push(grooveRing);
    }

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelRadius * 0.62, wheelRadius * 0.62, width + 0.015, 36),
      rimMat
    );
    rim.rotation.z = Math.PI / 2;
    wg.add(rim);

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelRadius * 0.49, wheelRadius * 0.49, width + 0.024, 36),
      brakeDiscMat
    );
    disc.rotation.z = Math.PI / 2;
    wg.add(disc);

    const discHeatGlow = new THREE.Mesh(
      new THREE.TorusGeometry(wheelRadius * 0.44, 0.028, 10, 36),
      brakeHeatRingMat
    );
    discHeatGlow.rotation.y = Math.PI / 2;
    wg.add(discHeatGlow);

    const ringGeo = new THREE.TorusGeometry(wheelRadius * 0.78, 0.018, 10, 44);
    const sidewallDecalGeo = new THREE.RingGeometry(wheelRadius * 0.625, wheelRadius * 0.94, 48);
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(ringGeo, compoundRingMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = s * (width * 0.48);
      wg.add(ring);

      const sidewallDecal = new THREE.Mesh(sidewallDecalGeo, pirelliSidewallMat);
      sidewallDecal.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      sidewallDecal.position.x = s * (width * 0.488);
      wg.add(sidewallDecal);
    }

    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, width + 0.042, 16), accentMat);
    nut.rotation.z = Math.PI / 2;
    wg.add(nut);

    // Brushed titanium aero rim lip rings & twin-spar Y-spokes for sharp close-ups
    const lipGeo = new THREE.TorusGeometry(wheelRadius * 0.615, 0.012, 10, 44);
    for (const s of [-1, 1]) {
      const lip = new THREE.Mesh(lipGeo, titaniumMat);
      lip.rotation.y = Math.PI / 2;
      lip.position.x = s * (width * 0.49);
      wg.add(lip);
    }

    for (let i = 0; i < 6; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(width + 0.024, 0.026, wheelRadius * 1.18), rimMat);
      spoke.rotation.x = (i * Math.PI) / 6;
      wg.add(spoke);
    }

    // PS5 High-Speed Wheel Spoke Motion-Blur Specular Ring
    const blurRingGeo = new THREE.RingGeometry(wheelRadius * 0.26, wheelRadius * 0.6, 36);
    for (const s of [-1, 1]) {
      const blurDisc = new THREE.Mesh(blurRingGeo, spokeBlurMat);
      blurDisc.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      blurDisc.position.x = s * (width * 0.495);
      wg.add(blurDisc);
    }

    return wg;
  };

  const contactPatchMeshes: THREE.Mesh[] = [];
  const addWheelAssembly = (parent: THREE.Object3D, width: number, tyreGeo: THREE.BufferGeometry, sideSign: number, isFront: boolean) => {
    const wheel = createWheel(width, tyreGeo);
    parent.add(wheel);
    wheels.push(wheel);

    // Non-rotating ground-level dynamic tyre contact patch shader footprint pinned under the tyre crown
    const patchMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.96, wheelRadius * 0.88),
      contactPatchShaderMat
    );
    patchMesh.rotation.x = -Math.PI / 2;
    patchMesh.position.set(0, -wheelRadius + 0.008, 0);
    parent.add(patchMesh);
    contactPatchMeshes.push(patchMesh);

    // Stationary brake caliper + multi-piece carbon brake cooling scoop + titanium fasteners
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(width * 0.45, 0.13, 0.09), caliperMat);
    caliper.position.set(sideSign * 0.04, 0.02, 0.11);
    parent.add(caliper);

    const rotorBell = new THREE.Mesh(
      new THREE.CylinderGeometry(wheelRadius * 0.27, wheelRadius * 0.27, width * 0.6, 16),
      titaniumMat
    );
    rotorBell.rotation.z = Math.PI / 2;
    parent.add(rotorBell);

    const brakeDuct = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.18), carbonMat);
    brakeDuct.position.set(sideSign * -0.14, 0.01, -0.04);
    parent.add(brakeDuct);

    const brakeScoopLip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.04), titaniumMat);
    brakeScoopLip.position.set(sideSign * -0.15, 0.02, -0.13);
    parent.add(brakeScoopLip);

    // Over-wheel aero brow winglet on front uprights (2026 F1 detail)
    if (isFront) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.44), carbonMat);
      brow.position.set(sideSign * -0.1, 0.37, 0.02);
      brow.rotation.z = sideSign * 0.25;
      parent.add(brow);
    }
  };

  const frontLeftPivot = new THREE.Group();
  frontLeftPivot.position.set(-frontTrackX, wheelRadius, frontZ);
  addWheelAssembly(frontLeftPivot, 0.32, frontTyreGeo, -1, true);
  root.add(frontLeftPivot);

  const frontRightPivot = new THREE.Group();
  frontRightPivot.position.set(frontTrackX, wheelRadius, frontZ);
  addWheelAssembly(frontRightPivot, 0.32, frontTyreGeo, 1, true);
  root.add(frontRightPivot);

  const rearLeftHub = new THREE.Group();
  rearLeftHub.position.set(-rearTrackX, wheelRadius, rearZ);
  addWheelAssembly(rearLeftHub, 0.4, rearTyreGeo, -1, false);
  root.add(rearLeftHub);

  const rearRightHub = new THREE.Group();
  rearRightHub.position.set(rearTrackX, wheelRadius, rearZ);
  addWheelAssembly(rearRightHub, 0.4, rearTyreGeo, 1, false);
  root.add(rearRightHub);

  const applyLivery = (
    pHex: string,
    sHex: string,
    aHex: string,
    hHex: string,
    wFinish: WheelFinish,
    cmp: TyreCompound,
    num?: string,
    skinHex?: string
  ) => {
    const stealth = isStealthCarbon(pHex);
    primaryMat.color.set(stealth ? '#2A303D' : pHex);
    primaryMat.map = stealth ? carbonMap : null;
    primaryMat.normalMap = stealth ? carbonNormalMap : paintFlakeNormalMap;
    primaryMat.normalScale.set(stealth ? 0.68 : 0.06, stealth ? 0.68 : 0.06);
    primaryMat.metalness = stealth ? 0.54 : 0.68;
    primaryMat.roughness = stealth ? 0.18 : 0.14;
    primaryMat.needsUpdate = true;

    secondaryMat.color.set(sHex);
    secondaryMat.map = stealth ? carbonMap : null;
    secondaryMat.normalMap = stealth ? carbonNormalMap : paintFlakeNormalMap;
    secondaryMat.normalScale.set(stealth ? 0.55 : 0.04, stealth ? 0.55 : 0.04);
    secondaryMat.needsUpdate = true;

    suitMat.color.set(sHex);
    accentMat.color.set(aHex);
    gloveMat.color.set(aHex);
    caliperMat.color.set(aHex);
    helmetMat.color.set(hHex);
    if (skinHex) driverSkinMat.color.set(skinHex);
    rimMat.color.set(wFinish.rimColor);
    rimMat.metalness = wFinish.metalness;
    rimMat.roughness = wFinish.roughness;
    compoundRingMat.color.set(COMPOUND_COLORS[cmp]);
    const isWetTyre = cmp === 'wet';
    rubberMat.normalScale.set(isWetTyre ? 0.95 : 0.72, isWetTyre ? 0.95 : 0.72);
    rubberMat.roughness = isWetTyre ? 0.42 : 0.72;
    rubberMat.clearcoat = isWetTyre ? 0.52 : 0.22;
    rubberMat.clearcoatRoughness = isWetTyre ? 0.24 : 0.48;
    rubberMat.envMapIntensity = isWetTyre ? 1.45 : 1.12;
    for (const gr of wetGrooveRings) {
      gr.visible = isWetTyre;
    }
    pirelliSidewallTex.dispose();
    pirelliSidewallTex = createPirelliSidewallTexture(cmp);
    pirelliSidewallMat.map = pirelliSidewallTex;
    pirelliSidewallMat.needsUpdate = true;
    if (num) {
      decalTex.dispose();
      decalTex = createNumberDecalTexture(num, aHex);
      decalMat.map = decalTex;
      decalMat.needsUpdate = true;
    }
  };

  // 11. Floating 3D Rival Indicator Above Airbox (Visible Only for Active Rival Car)
  const rivalIndicator = new THREE.Group();
  rivalIndicator.position.set(0, 1.62, 0.15);
  rivalIndicator.visible = false;

  const rivalBeaconMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.92,
  });
  const rivalChevron = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), rivalBeaconMat);
  rivalChevron.rotation.x = Math.PI;
  rivalIndicator.add(rivalChevron);

  const rivalRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.02, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xfca5a5, transparent: true, opacity: 0.85 })
  );
  rivalRing.rotation.x = Math.PI / 2;
  rivalRing.position.y = 0.22;
  rivalIndicator.add(rivalRing);

  const badgeCanvas = document.createElement('canvas');
  badgeCanvas.width = 256;
  badgeCanvas.height = 96;
  const bCtx = badgeCanvas.getContext('2d');
  if (bCtx) {
    bCtx.fillStyle = 'rgba(12, 14, 20, 0.88)';
    bCtx.beginPath();
    bCtx.roundRect(14, 14, 228, 68, 14);
    bCtx.fill();
    bCtx.lineWidth = 4;
    bCtx.strokeStyle = '#EF4444';
    bCtx.stroke();
    bCtx.fillStyle = '#FFFFFF';
    bCtx.font = 'bold 38px "Chakra Petch", sans-serif';
    bCtx.textAlign = 'center';
    bCtx.textBaseline = 'middle';
    bCtx.fillText('RIVAL', 128, 49);
  }
  const badgeTex = new THREE.CanvasTexture(badgeCanvas);
  badgeTex.colorSpace = THREE.SRGBColorSpace;
  const rivalSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: badgeTex, transparent: true, depthTest: false })
  );
  rivalSprite.position.set(0, 0.56, 0);
  rivalSprite.scale.set(1.25, 0.47, 1);
  rivalIndicator.add(rivalSprite);
  root.add(rivalIndicator);

  const setRival = (isRival: boolean) => {
    rivalIndicator.visible = isRival;
  };

  let activeBodyEnv: THREE.Texture | null = null;
  const setBodyEnvMap = (envMap: THREE.Texture | null) => {
    if (activeBodyEnv === envMap) return;
    activeBodyEnv = envMap;
    const mats = [
      primaryMat,
      secondaryMat,
      carbonMat,
      rimMat,
      helmetMat,
      visorMat,
      titaniumMat,
      exhaustBlueMat,
    ];
    for (const m of mats) {
      m.envMap = envMap;
      m.needsUpdate = true;
    }
  };

  let brakeHeat = 0;
  let discSpinPhase = 0;
  let rivalPhase = 0;
  let plumePhase = 0;
  let smoothSquash = 0;
  let smoothHeadPitch = 0;
  let smoothHeadRoll = 0;
  let smoothHeadYaw = 0;
  let smoothHeadFwd = 0;
  let smoothHeadLat = 0;
  const updateVisuals = (
    wheelSpinDelta: number,
    steerAngle: number,
    drsOpen: boolean,
    braking: boolean,
    rollAngle: number,
    pitchAngle: number,
    shiftFlash = 0,
    headlightsOn = true,
    exhaustLoad = 0.55,
    tyreLoad = 0.2,
    damagePct = 0,
    brakeTempC?: number,
    grainingSeverityPct = 0,
    microSlipRatio = 0.06,
    tyreSurfaceTempC = 92
  ) => {
    const dmgNorm = Math.min(1, Math.max(0, damagePct / 100));
    if (dmgNorm > 0.05) {
      frontWingGroup.rotation.x = dmgNorm * 0.28;
      frontWingGroup.rotation.z = dmgNorm * 0.16 * Math.sin(performance.now() * 0.012);
      frontWingGroup.position.y = 0.16 - dmgNorm * 0.14;
      primaryMat.roughness = THREE.MathUtils.lerp(0.18, 0.88, dmgNorm);
      primaryMat.metalness = THREE.MathUtils.lerp(0.92, 0.45, dmgNorm);
    } else {
      frontWingGroup.rotation.set(0, 0, 0);
      frontWingGroup.position.y = 0.16;
      primaryMat.roughness = 0.18;
      primaryMat.metalness = 0.92;
    }
    frontLeftPivot.rotation.y = steerAngle;
    frontRightPivot.rotation.y = steerAngle;
    steeringWheelGroup.rotation.z = -steerAngle * 2.1;

    // Viscoelastic 3D driver helmet reaction to braking pitch, cornering roll, and gear-shift kick
    const targetHeadPitch = (braking ? 0.11 : 0) + pitchAngle * 1.45 - shiftFlash * 0.06;
    const targetHeadRoll = -steerAngle * 0.18 + rollAngle * 1.85;
    const targetHeadYaw = steerAngle * 0.48 + rollAngle * 0.45;
    const targetHeadFwd = (braking ? -0.028 : 0.006) - pitchAngle * 0.35 + shiftFlash * 0.015;
    const targetHeadLat = rollAngle * 0.42;

    smoothHeadPitch += (targetHeadPitch - smoothHeadPitch) * 0.18;
    smoothHeadRoll += (targetHeadRoll - smoothHeadRoll) * 0.18;
    smoothHeadYaw += (targetHeadYaw - smoothHeadYaw) * 0.22;
    smoothHeadFwd += (targetHeadFwd - smoothHeadFwd) * 0.18;
    smoothHeadLat += (targetHeadLat - smoothHeadLat) * 0.18;

    driverHeadGroup.rotation.set(smoothHeadPitch, smoothHeadYaw, smoothHeadRoll);
    driverHeadGroup.position.set(smoothHeadLat, 0.67 - Math.abs(smoothHeadPitch) * 0.04, -0.05 + smoothHeadFwd);

    for (const w of wheels) {
      w.rotation.x -= wheelSpinDelta;
    }
    discSpinPhase += wheelSpinDelta;

    // Update Procedural Tyre Contact Patch Graining & Blistering Shader Uniforms
    const grainNorm = THREE.MathUtils.clamp(grainingSeverityPct / 100, 0, 1);
    const overheatBlister = THREE.MathUtils.clamp((tyreSurfaceTempC - 106) / 28, 0, 1);
    const blisterNorm = THREE.MathUtils.clamp(Math.max(overheatBlister, (grainNorm - 0.32) * 0.85), 0, 1);
    const slipNorm = THREE.MathUtils.clamp(microSlipRatio, 0, 1);
    tyrePatchUniforms.uGrainingSeverity.value = grainNorm;
    tyrePatchUniforms.uBlisterIntensity.value = blisterNorm;
    tyrePatchUniforms.uMicroSlip.value = slipNorm;
    tyrePatchUniforms.uSpinPhase.value = discSpinPhase;

    const patchScaleZ = 0.85 + tyreLoad * 0.35 + grainNorm * 0.12;
    for (const pm of contactPatchMeshes) {
      pm.scale.set(1.0 + tyreLoad * 0.12, patchScaleZ, 1);
    }

    // Temporally smoothed aerodynamic downforce suspension heave (keeps wheels 100% circular & undistorted)
    const targetSquash = Math.min(0.045, Math.abs(rollAngle) * 0.45 + Math.abs(pitchAngle) * 0.35 + tyreLoad * 0.02);
    smoothSquash += (targetSquash - smoothSquash) * 0.22;
    chassisGroup.position.y = -smoothSquash * 0.36;

    const targetFlap = drsOpen ? 0.05 : 0.48;
    drsFlap.rotation.x += (targetFlap - drsFlap.rotation.x) * 0.25;

    const rainPulse = 0.88 + Math.sin(plumePhase * 0.45) * 0.12;
    rainLightMat.emissiveIntensity = braking ? 9.5 : headlightsOn ? 7.2 * rainPulse : 2.2;
    rainHaloMat.opacity = braking ? 0.85 : headlightsOn ? 0.62 * rainPulse : 0.16;
    rainBeaconMat.opacity = braking ? 0.38 : headlightsOn ? 0.26 * rainPulse : 0.06;
    wetRearReflectionMat.opacity = braking ? 0.68 : headlightsOn ? 0.46 * rainPulse : 0.08;
    wetRearReflectionPool.scale.set(
      0.94 + Math.sin(plumePhase * 0.8) * 0.06,
      1.0 + (braking ? 0.22 : 0.0) + Math.cos(plumePhase * 0.65) * 0.05,
      1
    );

    // PS5 high-speed wheel rim motion blur
    const spinBlur = Math.min(0.58, Math.abs(wheelSpinDelta) * 0.85);
    spokeBlurMat.opacity = spinBlur;

    ledHeadlightMat.emissiveIntensity = headlightsOn ? 3.8 : 1.1;
    headlightBeamGroup.visible = headlightsOn;

    const revFrac = Math.min(1, Math.abs(wheelSpinDelta) * 1.45 + shiftFlash * 0.45);
    for (let l = 0; l < shiftLedMats.length; l++) {
      shiftLedMats[l].emissiveIntensity = revFrac >= (l + 1) / 5.4 ? 2.4 : 0.25;
    }

    const speedKineticFactor = Math.min(1.25, 0.35 + Math.abs(wheelSpinDelta) * 1.15);
    const targetUsageHeat = braking ? Math.min(1.0, 0.72 * speedKineticFactor + 0.28) : 0.0;
    const tempDerivedHeat =
      brakeTempC !== undefined ? THREE.MathUtils.clamp((brakeTempC - 310) / 760, 0, 1) : targetUsageHeat;
    const combinedTargetHeat =
      brakeTempC !== undefined ? Math.max(tempDerivedHeat, targetUsageHeat * 0.85) : targetUsageHeat;
    brakeHeat += (combinedTargetHeat - brakeHeat) * (braking ? 0.24 : 0.065);

    const effectiveTempC =
      brakeTempC !== undefined ? brakeTempC : 280 + brakeHeat * 820;
    brakeThermalUniforms.uBrakeHeat.value = brakeHeat;
    brakeThermalUniforms.uBrakeTempC.value = effectiveTempC;
    brakeThermalUniforms.uDiscSpinPhase.value = discSpinPhase;

    // Fallback base emissive progression from dull red to bright orange
    if (brakeHeat < 0.45) {
      const tLow = brakeHeat / 0.45;
      _heatCol.setRGB(
        THREE.MathUtils.lerp(0.45, 0.92, tLow),
        THREE.MathUtils.lerp(0.02, 0.09, tLow),
        THREE.MathUtils.lerp(0.005, 0.015, tLow)
      );
    } else {
      const tHigh = (brakeHeat - 0.45) / 0.55;
      _heatCol.setRGB(
        1.0,
        THREE.MathUtils.lerp(0.09, 0.56, tHigh),
        THREE.MathUtils.lerp(0.015, 0.11, tHigh)
      );
    }
    brakeDiscMat.emissive.copy(_heatCol);
    brakeDiscMat.emissiveIntensity = brakeHeat * 3.2;
    exhaustFlameMat.opacity = Math.min(0.95, shiftFlash);
    innerFlameMat.opacity = Math.min(0.98, shiftFlash * 1.15);

    plumePhase += 0.38;
    const plumePulse = 0.86 + Math.sin(plumePhase) * 0.14;
    heatPlume.scale.set(plumePulse, 0.75 + exhaustLoad * 0.6, plumePulse);
    heatPlumeMat.opacity = 0.015 + exhaustLoad * 0.065;

    if (rivalIndicator.visible) {
      rivalPhase += 0.06;
      rivalIndicator.position.y = 1.62 + Math.sin(rivalPhase) * 0.09;
      rivalChevron.rotation.y = rivalPhase * 0.85;
    }

    chassisGroup.rotation.z = rollAngle;
    chassisGroup.rotation.x = pitchAngle;
  };

  return {
    root,
    chassisGroup,
    frontLeftPivot,
    frontRightPivot,
    wheels,
    drsFlap,
    rainLightMat,
    rivalIndicator,
    setRival,
    setBodyEnvMap,
    applyLivery,
    updateVisuals,
  };
}
