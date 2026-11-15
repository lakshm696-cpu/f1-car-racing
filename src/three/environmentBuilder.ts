import * as THREE from 'three';
import { CircuitTrack, GraphicsQuality, TimeOfDayMode, WeatherMode } from '../types/racing';
import {
  getCircuitEnvironmentConfig,
  getTimeOfDayProfile,
  getWeatherAtmosphereProfile,
  resolveCircuitBiome,
} from './circuitEnvironments';
import { ProceduralTextureSet } from './textures';

export { resolveCircuitBiome };

export interface TrackSampleLite {
  t: number;
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  curvature: number;
}

export interface AtmosphereRuntimeState {
  sunDir: THREE.Vector3;
  fogColor: THREE.Color;
  skyColor: THREE.Color;
  cloudCover: number; // 0.08 (clear) -> 1.0 (overcast/storm)
  rainFactor: number; // 0..1
  sunsetFactor: number; // 0..1
  nightFactor: number; // 0..1
  lightningFlash: number; // 0..1
  cityGlowColor?: THREE.Color;
  cloudTint?: THREE.Color;
}

export interface BuiltEnvironment {
  group: THREE.Group;
  updateTime: (elapsedSec: number) => void;
  updateAtmosphere: (state: AtmosphereRuntimeState) => void;
  dispose: () => void;
}

const _cloudDayCol = new THREE.Color(0xf8fafc);
const _cloudWeatherCol = new THREE.Color(0x334155);

export function buildCircuitEnvironment(
  track: CircuitTrack,
  samples: TrackSampleLite[],
  textures: ProceduralTextureSet,
  weather: WeatherMode,
  quality: GraphicsQuality = 'extreme',
  timeOfDay?: TimeOfDayMode
): BuiltEnvironment {
  const envCfg = getCircuitEnvironmentConfig(track);
  const biome = envCfg.biome;
  const effTod: TimeOfDayMode =
    timeOfDay ??
    (weather === 'night'
      ? 'night'
      : weather === 'sunset'
        ? 'sunset'
        : envCfg.defaultTimeOfDay);
  const todProfile = getTimeOfDayProfile(effTod);
  const weatherProfile = getWeatherAtmosphereProfile(weather);

  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const halfW = track.trackWidth * 0.5;
  const sampleCount = samples.length;

  const isLow = quality === 'low';
  const isMedium = quality === 'medium';
  const foliageMult = isLow
    ? 0.35
    : isMedium
      ? 0.6
      : quality === 'high'
        ? 0.85
        : quality === 'extreme' || quality === 'cinematic'
          ? 1.4
          : 1.0;

  const isNight = effTod === 'night' || weather === 'night';
  const isSunset = effTod === 'sunset' || effTod === 'golden_hour' || weather === 'sunset';
  const isRain = weather === 'rain' || weather === 'heavy_rain';
  const isCloudy = weather === 'cloudy' || weather === 'partly_cloudy' || weather === 'fog';

  const centerOffset = new THREE.Vector3(110, 0, 0);

  // Helper: nearest track distance squared & elevation
  const nearestTrackInfo = (x: number, z: number) => {
    let minD2 = Infinity;
    let nearestY = 0;
    for (let i = 0; i < sampleCount; i += 2) {
      const p = samples[i].point;
      const dx = x - p.x;
      const dz = z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD2) {
        minD2 = d2;
        nearestY = p.y;
      }
    }
    return { dist: Math.sqrt(minD2), nearestY };
  };

  const isClearOfTrack = (x: number, z: number, radius: number) => {
    const req = halfW + 11.5 + radius;
    const req2 = req * req;
    for (let i = 0; i < sampleCount; i += 2) {
      const p = samples[i].point;
      const dx = x - p.x;
      const dz = z - p.z;
      if (dx * dx + dz * dz < req2) return false;
    }
    return true;
  };

  // ============================================================================
  // 1. RAYLEIGH + MIE ATMOSPHERIC SCATTERING SKY DOME (GLSL ShaderMaterial)
  // ============================================================================
  const initAzRad = ((envCfg.lighting.sunAzimuthDeg + todProfile.azimuthShiftDeg) * Math.PI) / 180;
  const initElRad = (Math.max(7, todProfile.elevationDeg + envCfg.lighting.sunElevationOffsetDeg) * Math.PI) / 180;
  const initSunDir = new THREE.Vector3(
    Math.cos(initElRad) * Math.cos(initAzRad),
    Math.sin(initElRad),
    Math.cos(initElRad) * Math.sin(initAzRad)
  ).normalize();

  const initCloudCover =
    weatherProfile.cloudOverride ??
    Math.min(1.0, envCfg.sky.baseCloudCover + weatherProfile.cloudCoverAdd);

  const skyUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: initSunDir },
    uHorizonColor: {
      value: new THREE.Color(envCfg.sky.horizonHex).lerp(
        new THREE.Color(todProfile.horizonBlendHex),
        isNight ? 0.92 : isSunset ? 0.68 : 0.28
      ),
    },
    uZenithColor: {
      value: new THREE.Color(envCfg.sky.zenithHex).lerp(
        new THREE.Color(todProfile.zenithBlendHex),
        isNight ? 0.95 : isSunset ? 0.65 : 0.25
      ),
    },
    uCityGlowColor: { value: new THREE.Color(envCfg.sky.cityGlowHex) },
    uCloudCover: { value: initCloudCover },
    uRainFactor: { value: weatherProfile.rainFactor },
    uSunsetFactor: { value: todProfile.sunsetFactor },
    uNightFactor: { value: todProfile.nightFactor },
    uLightning: { value: 0.0 },
    uCenter: { value: centerOffset.clone() },
  };

  const skyGeo = new THREE.SphereGeometry(890, 48, 32);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uHorizonColor;
      uniform vec3 uZenithColor;
      uniform vec3 uCityGlowColor;
      uniform float uCloudCover;
      uniform float uRainFactor;
      uniform float uSunsetFactor;
      uniform float uNightFactor;
      uniform float uLightning;
      uniform vec3 uCenter;
      varying vec3 vWorldPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(234.34, 435.345));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }

      float hgPhase(float cosTheta, float g) {
        float g2 = g * g;
        return (1.0 - g2) / (4.0 * 3.14159265 * pow(max(0.05, 1.0 + g2 - 2.0 * g * cosTheta), 1.5));
      }

      void main() {
        vec3 dir = normalize(vWorldPos - uCenter);
        vec3 sunDir = normalize(uSunDir);
        float elev = clamp(dir.y, -0.1, 1.0);
        float h = pow(1.0 - clamp(elev, 0.0, 1.0), 2.2);

        // Dual-scattering Rayleigh sky gradient + twilight ozone belt
        vec3 skyCol = mix(uZenithColor, uHorizonColor, h);
        float ozoneBand = exp(-pow((elev - 0.16) * 4.5, 2.0));
        skyCol = mix(skyCol, vec3(0.28, 0.24, 0.56), ozoneBand * 0.26 * uSunsetFactor * (1.0 - uNightFactor));

        // Warm sunset ozone & horizon scattering arc
        float sunCos = max(dot(dir, sunDir), 0.0);
        float rawSunCos = dot(dir, sunDir);
        float horizonBand = exp(-abs(elev) * 8.2);
        vec3 sunsetGlow = mix(vec3(0.98, 0.42, 0.12), vec3(1.0, 0.85, 0.45), pow(sunCos, 3.0));
        skyCol += sunsetGlow * horizonBand * (0.30 + 0.68 * uSunsetFactor) * (1.0 - uNightFactor * 0.9);

        // Henyey-Greenstein Mie forward scattering aureole & crisp HDR solar disc
        float miePhase = hgPhase(rawSunCos, 0.72) * 0.52 + pow(sunCos, 6.0) * 0.34;
        float sunCore = smoothstep(0.9991, 0.99985, sunCos);
        float sunVis = (1.0 - uRainFactor * 0.85) * (1.0 - uNightFactor * 0.95) * (1.0 - uCloudCover * 0.42);
        skyCol += mix(vec3(1.0, 0.94, 0.82), vec3(1.0, 0.62, 0.25), uSunsetFactor) * miePhase * (0.55 + 0.55 * uSunsetFactor) * sunVis;
        skyCol += vec3(1.75, 1.60, 1.38) * sunCore * sunVis;

        // Storm darkening + sheet lightning illumination
        vec3 stormCol = mix(vec3(0.14, 0.18, 0.24), vec3(0.07, 0.10, 0.15), uRainFactor);
        skyCol = mix(skyCol, stormCol, uRainFactor * 0.65);
        skyCol += vec3(0.65, 0.78, 1.0) * uLightning * (0.28 + 0.58 * (1.0 - elev));

        // Night starfield + subtle diagonal Milky Way band + urban horizon dome
        if (uNightFactor > 0.05 && elev > 0.03) {
          float mwBand = exp(-pow((dir.x * 0.65 + dir.z * 0.45 - dir.y * 0.55) * 3.8, 2.0));
          skyCol += vec3(0.06, 0.09, 0.16) * mwBand * uNightFactor * (1.0 - uCloudCover * 0.8);

          vec2 starUv = dir.xz / (elev + 0.28) * 145.0;
          vec2 id = floor(starUv);
          vec2 gv = fract(starUv) - 0.5;
          float rnd = hash21(id);
          if (rnd > 0.97) {
            float twinkle = 0.55 + 0.45 * sin(uTime * (2.0 + rnd * 5.0) + rnd * 40.0);
            float starDot = smoothstep(0.28, 0.02, length(gv));
            skyCol += mix(vec3(0.85, 0.92, 1.0), vec3(1.0, 0.90, 0.78), fract(rnd * 37.0)) *
              starDot * twinkle * uNightFactor * smoothstep(0.03, 0.25, elev) * (1.0 - uRainFactor);
          }
        }
        skyCol += uCityGlowColor * horizonBand * (0.26 * uNightFactor + 0.08 * uSunsetFactor);

        gl_FragColor = vec4(skyCol, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.position.copy(centerOffset);
  group.add(skyDome);
  disposables.push(skyGeo, skyMat);

  // ============================================================================
  // 2. DUAL-LAYER VOLUMETRIC FBM CLOUD DECK DOME (Cumulus + High Cirrus)
  // ============================================================================
  const cloudOctaves = isLow ? 2 : isMedium ? 3 : 5;
  const cloudUniforms = {
    uTime: { value: 0 },
    uSunDir: skyUniforms.uSunDir,
    uCloudCover: skyUniforms.uCloudCover,
    uRainFactor: skyUniforms.uRainFactor,
    uSunsetFactor: skyUniforms.uSunsetFactor,
    uNightFactor: skyUniforms.uNightFactor,
    uLightning: skyUniforms.uLightning,
    uCloudTint: { value: new THREE.Color(envCfg.sky.cloudTintHex) },
    uWindSpeed: { value: envCfg.sky.windSpeed },
    uCenter: skyUniforms.uCenter,
  };
  const cloudDomeGeo = new THREE.SphereGeometry(780, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.49);
  const cloudDomeMat = new THREE.ShaderMaterial({
    uniforms: cloudUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    fog: false,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform float uCloudCover;
      uniform float uRainFactor;
      uniform float uSunsetFactor;
      uniform float uNightFactor;
      uniform float uLightning;
      uniform vec3 uCloudTint;
      uniform float uWindSpeed;
      uniform vec3 uCenter;
      varying vec3 vWorldPos;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < ${cloudOctaves}; i++) {
          v += a * noise(p);
          p = rot * p * 2.04;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldPos - uCenter);
        vec3 sunDir = normalize(uSunDir);
        float elev = dir.y;
        if (elev < 0.015) discard;

        // Layer 1: Low-mid billowing cumulus deck with Beer-Lambert directional shadowing
        vec2 uv = dir.xz / (elev + 0.14);
        float wind = max(0.35, uWindSpeed);
        vec2 windA = vec2(uTime * 0.016 * wind, uTime * 0.007 * wind);
        vec2 windB = vec2(-uTime * 0.009 * wind, uTime * 0.013 * wind);

        float n1 = fbm(uv * 0.55 + windA);
        float n2 = fbm(uv * 1.15 + windB + vec2(n1 * 0.45));
        float density = mix(n1, n2, 0.45);

        // Sample slightly toward sun for realistic directional cloud self-shadowing
        vec2 sunStep = normalize(sunDir.xz + vec2(0.001, 0.001)) * 0.16;
        float sunSample = mix(fbm((uv + sunStep) * 0.55 + windA), n2, 0.35);
        float selfShadow = clamp((sunSample - density) * 2.6 + 0.5, 0.0, 1.0);

        float threshold = mix(0.64, 0.27, clamp(uCloudCover, 0.0, 1.0));
        float cumulusAlpha = smoothstep(threshold, threshold + 0.23, density) * smoothstep(0.015, 0.16, elev);

        // Layer 2: High-altitude wispy cirrus streaks drifting on independent upper wind
        vec2 cirrusUv = vec2(uv.x * 0.32 + uv.y * 0.12, uv.y * 0.95) + vec2(uTime * 0.009 * wind, -uTime * 0.005 * wind);
        float cirrusRaw = fbm(cirrusUv * 1.35);
        float cirrusAlpha = smoothstep(0.54, 0.82, cirrusRaw) * (1.0 - uRainFactor * 0.85) * 0.36 * smoothstep(0.04, 0.26, elev);

        float combinedAlpha = clamp(max(cumulusAlpha, cirrusAlpha * (1.0 - cumulusAlpha * 0.5)), 0.0, 1.0);
        if (combinedAlpha < 0.01) discard;

        // Directional Henyey-Greenstein silver lining toward sun
        float sunCos = max(dot(dir, sunDir), 0.0);
        float edgeHighlight = pow(1.0 - cumulusAlpha, 1.7) * pow(sunCos, 4.5);
        float topShade = clamp(smoothstep(0.24, 0.86, density) * 0.65 + selfShadow * 0.45, 0.0, 1.0);

        vec3 dayBright = mix(vec3(0.98, 0.99, 1.0), uCloudTint, 0.35);
        vec3 dayShadow = mix(vec3(0.52, 0.60, 0.72), uCloudTint * 0.62, 0.4);
        vec3 sunsetBright = vec3(1.0, 0.74, 0.46);
        vec3 sunsetShadow = vec3(0.36, 0.20, 0.34);
        vec3 stormCol = vec3(0.14, 0.18, 0.26);
        vec3 nightCol = vec3(0.07, 0.11, 0.19);

        vec3 bright = mix(dayBright, sunsetBright, uSunsetFactor);
        vec3 dark = mix(dayShadow, sunsetShadow, uSunsetFactor);
        vec3 col = mix(bright, dark, topShade * 0.74);
        // Subtle glowing white/rose high cirrus layer
        vec3 cirrusCol = mix(vec3(0.95, 0.97, 1.0), vec3(1.0, 0.76, 0.56), uSunsetFactor);
        cirrusCol = mix(cirrusCol, nightCol * 1.5, uNightFactor * 0.86);
        col = mix(cirrusCol, col, clamp(cumulusAlpha / max(combinedAlpha, 0.001), 0.0, 1.0));

        col = mix(col, stormCol, uRainFactor * 0.78);
        col = mix(col, nightCol, uNightFactor * 0.88);
        col += mix(vec3(1.0, 0.96, 0.88), vec3(1.0, 0.55, 0.22), uSunsetFactor) * edgeHighlight * (1.0 - uNightFactor * 0.85) * 0.92;
        col += vec3(0.75, 0.86, 1.0) * uLightning * (0.48 + 0.52 * (1.0 - topShade));

        float maxAlpha = mix(0.78, 0.94, uRainFactor);
        gl_FragColor = vec4(col, combinedAlpha * maxAlpha);
      }
    `,
  });
  const cloudDome = new THREE.Mesh(cloudDomeGeo, cloudDomeMat);
  cloudDome.position.copy(centerOffset);
  group.add(cloudDome);
  disposables.push(cloudDomeGeo, cloudDomeMat);

  // Subtle 3D volumetric cloud puff ring below the high cirrus/cumulus deck for parallax depth
  const cloudSpriteGroup = new THREE.Group();
  cloudSpriteGroup.position.copy(centerOffset);
  const cloudSpriteMat = new THREE.SpriteMaterial({
    map: textures.smokeSpriteMap,
    color: weather === 'night' ? 0x1e293b : isSunset ? 0xfdba74 : isRain ? 0x334155 : envCfg.sky.cloudTintHex,
    transparent: true,
    opacity: weather === 'night' ? 0.14 : isRain ? 0.34 : 0.22,
    depthWrite: false,
    fog: false,
  });
  const puffCount = isLow ? 16 : 34;
  for (let c = 0; c < puffCount; c++) {
    const ang = (c / puffCount) * Math.PI * 2 + (c % 3) * 0.08;
    const rad = 355 + (c % 4) * 78;
    const sp = new THREE.Sprite(cloudSpriteMat);
    sp.position.set(Math.cos(ang) * rad, 134 + (c % 5) * 16, Math.sin(ang) * rad);
    const wScale = 165 + (c % 4) * 52;
    sp.scale.set(wScale, wScale * 0.38, 1);
    cloudSpriteGroup.add(sp);
  }
  group.add(cloudSpriteGroup);
  disposables.push(cloudSpriteMat);

  // ============================================================================
  // 3. SCULPTED VERTEX-COLORED 3D TERRAIN & RIDGED MULTIFRACTAL MOUNTAIN RINGS
  // ============================================================================
  const isDesert = envCfg.terrain.groundStyle === 'desert';
  const hasHarborWater = envCfg.water.enabled && envCfg.water.harborEast;
  const hasInfieldLake = envCfg.water.enabled && envCfg.water.infieldLake;

  const terrainHeightAt = (vx: number, vz: number, dist?: number, nearestY?: number) => {
    let d = dist;
    let ny = nearestY;
    if (d === undefined || ny === undefined) {
      const info = nearestTrackInfo(vx, vz);
      d = info.dist;
      ny = info.nearestY;
    }
    if (d < halfW + 13.5) {
      return Math.min(0, ny - 0.32);
    }
    const blend = THREE.MathUtils.smoothstep(d, halfW + 13.5, halfW + 78);
    if (hasHarborWater && vx > 268 && vz > -260 && vz < 380) {
      const bayBlend = THREE.MathUtils.smoothstep(vx, 268, 295);
      return THREE.MathUtils.lerp(0, -1.8, bayBlend);
    }
    if (
      hasInfieldLake &&
      d > halfW + 18 &&
      ((vx - 125) * (vx - 125)) / (66 * 66) + ((vz + 5) * (vz + 5)) / (115 * 115) < 1.0
    ) {
      const lakeRad = Math.sqrt(
        ((vx - 125) * (vx - 125)) / (66 * 66) + ((vz + 5) * (vz + 5)) / (115 * 115)
      );
      return THREE.MathUtils.smoothstep(1.0 - lakeRad, 0, 0.25) * -1.85;
    }
    const ridgeAmp = envCfg.terrain.ridgeAmp;
    const hill =
      (Math.sin(vx * 0.011 + vz * 0.008) * 0.5 +
        Math.cos(vx * 0.006 - vz * 0.013) * 0.35 +
        Math.sin((vx + vz) * 0.019) * 0.15) *
        ridgeAmp +
      (biome === 'monaco' && vx < -35 ? THREE.MathUtils.smoothstep(-vx, 35, 220) * 34 : 0);
    const distRise = THREE.MathUtils.smoothstep(d, 120, 540) * (isDesert ? 16 : 22);
    return Math.max(-0.2, ny * (1 - blend * 0.5) + Math.max(0, hill) * blend + distRise);
  };

  const terrainSegs = isLow ? 72 : 120;
  const terrainGeo = new THREE.PlaneGeometry(1760, 1760, terrainSegs, terrainSegs);
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(110, 0, 0);

  const tPos = terrainGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tPos.count; i++) {
    const vx = tPos.getX(i);
    const vz = tPos.getZ(i);
    const { dist, nearestY } = nearestTrackInfo(vx, vz);
    tPos.setY(i, terrainHeightAt(vx, vz, dist, nearestY));
  }
  terrainGeo.computeVertexNormals();

  // Slope, altitude, and biome-driven vertex coloring for natural terrain shading
  const tNorm = terrainGeo.attributes.normal as THREE.BufferAttribute;
  const tColors = new Float32Array(tPos.count * 3);
  const cVerge = new THREE.Color(isDesert ? 0xebcf9f : 0xa3b899);
  const cMid = new THREE.Color(0xffffff);
  const cRock = new THREE.Color(isDesert ? 0x9c7b58 : 0x5c636e);
  const cShore = new THREE.Color(isDesert ? 0x7c6348 : 0x6b7280);
  const cTmp = new THREE.Color();
  for (let i = 0; i < tPos.count; i++) {
    const vy = tPos.getY(i);
    const ny = tNorm.getY(i);
    const slope = THREE.MathUtils.clamp((1.0 - ny) * 3.6, 0, 1);
    cTmp.copy(cMid);
    if (vy < 0.35) {
      cTmp.lerp(cShore, THREE.MathUtils.clamp((0.35 - vy) * 1.4, 0, 0.72));
    } else if (vy < 2.8) {
      cTmp.lerp(cVerge, 0.14);
    }
    if (slope > 0.12 || vy > 18) {
      const rockMix = Math.max(slope * 0.85, THREE.MathUtils.smoothstep(vy, 18, 42) * 0.65);
      cTmp.lerp(cRock, THREE.MathUtils.clamp(rockMix, 0, 0.82));
    }
    tColors[i * 3] = cTmp.r;
    tColors[i * 3 + 1] = cTmp.g;
    tColors[i * 3 + 2] = cTmp.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(tColors, 3));

  const groundTintCol = new THREE.Color(envCfg.terrain.groundTintHex);
  if (isNight) groundTintCol.multiplyScalar(isDesert ? 0.32 : 0.36);
  else if (isSunset) groundTintCol.lerp(new THREE.Color(0x523420), 0.38);
  else if (isRain) groundTintCol.multiplyScalar(0.65);

  const groundMat = new THREE.MeshStandardMaterial({
    map: isDesert ? textures.desertSandMap : textures.groundGrassMap,
    color: groundTintCol,
    vertexColors: true,
    roughness: isDesert ? 0.96 : isRain ? 0.72 : 0.92,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, groundMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);
  disposables.push(terrainGeo, groundMat);

  // 3-Tier Ridged Multifractal Mountain & Horizon Ranges (LOD scaled)
  const ridgeSegs = isLow ? 84 : 156;
  const buildMountainRing = (
    radius: number,
    basePeak: number,
    amp: number,
    lowHex: number,
    peakHex: number,
    snowCap = false
  ) => {
    const ridgeGeo = new THREE.CylinderGeometry(radius, radius + 36, 118, ridgeSegs, 5, true);
    const rPos = ridgeGeo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(rPos.count * 3);
    const lowCol = new THREE.Color(lowHex);
    const peakCol = new THREE.Color(peakHex);
    if (isNight) {
      lowCol.multiplyScalar(0.32);
      peakCol.multiplyScalar(0.38);
    } else if (isSunset) {
      lowCol.lerp(new THREE.Color(0x3b1f2e), 0.45);
      peakCol.lerp(new THREE.Color(0x9a4b32), 0.45);
    }
    const snowCol = new THREE.Color(isNight ? 0x64748b : isSunset ? 0xfed7aa : 0xf1f5f9);
    const tmpCol = new THREE.Color();

    for (let i = 0; i < rPos.count; i++) {
      const rawY = rPos.getY(i);
      const fracY = (rawY + 59) / 118;
      const angle = Math.atan2(rPos.getZ(i), rPos.getX(i));
      const ridge1 = 1.0 - Math.abs(Math.sin(angle * 6.0 + radius * 0.015));
      const ridge2 = 1.0 - Math.abs(Math.cos(angle * 13.0 + 0.8));
      const ridge3 = Math.sin(angle * 27.0 + 1.4) * 0.5 + 0.5;
      const crest = basePeak + ridge1 * amp * 1.15 + ridge2 * amp * 0.65 + ridge3 * amp * 0.28;

      const yVal = -6 + fracY * (crest + 6);
      rPos.setY(i, yVal);

      tmpCol.lerpColors(lowCol, peakCol, Math.pow(fracY, 0.85));
      if (snowCap && fracY > 0.72) {
        tmpCol.lerp(snowCol, THREE.MathUtils.smoothstep(fracY, 0.72, 0.96));
      }
      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }
    ridgeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    ridgeGeo.computeVertexNormals();
    const ridgeMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      side: THREE.BackSide,
    });
    const ridgeMesh = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridgeMesh.position.copy(centerOffset);
    disposables.push(ridgeGeo, ridgeMat);
    return ridgeMesh;
  };

  group.add(
    buildMountainRing(445, 22, 16, envCfg.terrain.mountainNearLow, envCfg.terrain.mountainNearHigh, false)
  );
  group.add(
    buildMountainRing(
      590,
      42,
      26,
      envCfg.terrain.mountainNearHigh,
      envCfg.terrain.mountainFarHigh,
      envCfg.terrain.snowCap
    )
  );
  group.add(
    buildMountainRing(
      730,
      70,
      36,
      envCfg.terrain.mountainFarLow,
      envCfg.terrain.mountainFarHigh,
      envCfg.terrain.snowCap
    )
  );

  // ============================================================================
  // 4. ANIMATED FRESNEL REFLECTIVE HARBOR & PARK LAKE WATER + BUOYS
  // ============================================================================
  const waterTimeUniform = { value: 0 };
  if (hasHarborWater || hasInfieldLake) {
    const waterGeo = hasInfieldLake
      ? new THREE.PlaneGeometry(148, 250, 36, 36)
      : new THREE.PlaneGeometry(520, 720, 56, 56);
    waterGeo.rotateX(-Math.PI / 2);
    const baseWaterCol = new THREE.Color(envCfg.water.colorHex);
    if (isNight) baseWaterCol.multiplyScalar(0.32);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: baseWaterCol,
      roughness: isRain ? 0.14 : 0.055,
      metalness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      ior: 1.333,
      envMapIntensity: isNight ? 2.5 : 2.35,
    });
    waterMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWaterTime = waterTimeUniform;
      shader.vertexShader = 'uniform float uWaterTime;\nvarying vec3 vWaterPos;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed.y += sin(transformed.x * 0.18 + uWaterTime * 1.9) * 0.085 + cos(transformed.z * 0.22 - uWaterTime * 1.6) * 0.075;
        vWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
      shader.fragmentShader =
        'uniform float uWaterTime;\nvarying vec3 vWaterPos;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float rWaveA = sin(vWaterPos.x * 0.85 + uWaterTime * 2.4) * cos(vWaterPos.z * 0.9 - uWaterTime * 2.1);
        float rWaveB = cos(vWaterPos.x * 1.7 - uWaterTime * 3.1) * sin(vWaterPos.z * 1.45 + uWaterTime * 2.7);
        roughnessFactor = clamp(roughnessFactor + (rWaveA * 0.65 + rWaveB * 0.35) * 0.032, 0.018, 0.35);`
      );
    };
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    if (hasInfieldLake) {
      waterMesh.position.set(125, -0.45, -5);
    } else {
      waterMesh.position.set(530, -0.42, 45);
    }
    waterMesh.receiveShadow = true;
    group.add(waterMesh);
    disposables.push(waterGeo, waterMat);

    // Instanced Harbor / Lake Marker Buoys
    const buoyCount = hasInfieldLake ? 8 : 14;
    const buoyGeo = new THREE.CylinderGeometry(0.32, 0.48, 1.15, 8);
    const buoyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      emissive: isNight ? 0xf59e0b : 0x000000,
      emissiveIntensity: isNight ? 1.4 : 0,
    });
    const buoyInst = new THREE.InstancedMesh(buoyGeo, buoyMat, buoyCount);
    const bDummy = new THREE.Object3D();
    const bCol = new THREE.Color();
    for (let b = 0; b < buoyCount; b++) {
      if (hasInfieldLake) {
        const ang = (b / buoyCount) * Math.PI * 2;
        bDummy.position.set(125 + Math.cos(ang) * 42, -0.15, -5 + Math.sin(ang) * 78);
      } else {
        bDummy.position.set(282 + (b % 3) * 28, -0.15, -140 + b * 24);
      }
      bDummy.updateMatrix();
      buoyInst.setMatrixAt(b, bDummy.matrix);
      bCol.setHex(b % 2 === 0 ? 0xef4444 : 0xfacc15);
      buoyInst.setColorAt(b, bCol);
    }
    buoyInst.instanceMatrix.needsUpdate = true;
    if (buoyInst.instanceColor) buoyInst.instanceColor.needsUpdate = true;
    buoyInst.computeBoundingSphere();
    group.add(buoyInst);
    disposables.push(buoyGeo, buoyMat);

    if (hasHarborWater) {
      // Coastal Marina Quayside Wall bordering the harbor water + Harbor Bollard Lamps
      const quayGeo = new THREE.BoxGeometry(5.5, 2.2, 660);
      const quayMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.72 });
      const quayWall = new THREE.Mesh(quayGeo, quayMat);
      quayWall.position.set(270, 0.1, 45);
      quayWall.receiveShadow = true;
      group.add(quayWall);
      disposables.push(quayGeo, quayMat);

      const qLampGeo = new THREE.BoxGeometry(0.45, 0.65, 0.45);
      const qLampMat = new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xfde68a,
        emissiveIntensity: isNight || isSunset ? 2.4 : 0.2,
      });
      const qLampInst = new THREE.InstancedMesh(qLampGeo, qLampMat, 22);
      for (let ql = 0; ql < 22; ql++) {
        bDummy.position.set(270, 1.55, -240 + ql * 24);
        bDummy.updateMatrix();
        qLampInst.setMatrixAt(ql, bDummy.matrix);
      }
      qLampInst.instanceMatrix.needsUpdate = true;
      qLampInst.computeBoundingSphere();
      group.add(qLampInst);
      disposables.push(qLampGeo, qLampMat);
    }
  }

  // ============================================================================
  // 5. HIGH-DETAIL BIOME-SPECIFIC INSTANCED VEGETATION & TREES (LOD)
  // ============================================================================
  const buildBiomeVegetation = () => {
    const species = envCfg.vegetation.species;
    const isPalmBiome = species === 'palm';
    const isSakuraBiome = species === 'sakura';
    const isBroadleafBiome = species === 'oak' || species === 'eucalyptus';
    const isEucalyptus = species === 'eucalyptus';
    const treeCount = Math.floor(envCfg.vegetation.densityCount * foliageMult);

    if (treeCount <= 0) return;

    const trunkMat = new THREE.MeshStandardMaterial({
      color: isEucalyptus ? 0x9ca3af : isPalmBiome ? 0x6b4f35 : 0x3d2b1d,
      roughness: 0.92,
    });
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.84,
      metalness: 0.02,
    });
    disposables.push(trunkMat, canopyMat);

    const trunkGeo = isPalmBiome
      ? new THREE.CylinderGeometry(0.18, 0.34, 6.2, 7)
      : isEucalyptus
        ? new THREE.CylinderGeometry(0.28, 0.54, 5.4, 7)
        : new THREE.CylinderGeometry(0.24, 0.46, 4.0, 7);
    trunkGeo.translate(0, isPalmBiome ? 3.1 : isEucalyptus ? 2.7 : 2.0, 0);

    let lowerGeo: THREE.BufferGeometry;
    let upperGeo: THREE.BufferGeometry;
    if (isPalmBiome) {
      lowerGeo = new THREE.ConeGeometry(2.8, 1.4, 6);
      lowerGeo.translate(0, 6.1, 0);
      upperGeo = new THREE.DodecahedronGeometry(1.45, 0);
      upperGeo.scale(1.65, 0.48, 1.65);
      upperGeo.translate(0, 6.45, 0);
    } else if (isEucalyptus) {
      lowerGeo = new THREE.DodecahedronGeometry(3.2, 1);
      lowerGeo.scale(1.25, 0.92, 1.25);
      lowerGeo.translate(0, 6.4, 0);
      upperGeo = new THREE.DodecahedronGeometry(2.3, 1);
      upperGeo.translate(0.7, 8.2, -0.45);
    } else if (isSakuraBiome || isBroadleafBiome) {
      lowerGeo = new THREE.DodecahedronGeometry(2.6, 1);
      lowerGeo.scale(1.15, 0.85, 1.15);
      lowerGeo.translate(0, 4.8, 0);
      upperGeo = new THREE.DodecahedronGeometry(1.9, 1);
      upperGeo.translate(0.5, 6.4, -0.35);
    } else {
      // Multi-tiered European Pine / Alpine Spruce
      lowerGeo = new THREE.ConeGeometry(3.2, 5.2, 8);
      lowerGeo.translate(0, 4.5, 0);
      upperGeo = new THREE.ConeGeometry(2.2, 5.0, 8);
      upperGeo.translate(0, 7.6, 0);
    }
    disposables.push(trunkGeo, lowerGeo, upperGeo);

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const lowCrowns = new THREE.InstancedMesh(lowerGeo, canopyMat, treeCount);
    const upCrowns = new THREE.InstancedMesh(upperGeo, canopyMat, treeCount);
    lowCrowns.castShadow = !isLow;
    upCrowns.castShadow = !isLow;

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    let placed = 0;

    // Pass 1: Track corridor border trees
    const corridorLimit = Math.floor(treeCount * 0.52);
    for (let s = 14; s < sampleCount - 12 && placed < corridorLimit; s += 2) {
      const f = samples[s];
      for (const side of [-1, 1]) {
        if (placed >= corridorLimit) break;
        const distOut = halfW + 14 + ((s * 17 + (side > 0 ? 7 : 3)) % 18) * 1.45;
        const cx = f.point.x + f.right.x * side * distOut + Math.sin(s * 3.1) * 2.2;
        const cz = f.point.z + f.right.z * side * distOut + Math.cos(s * 2.7) * 2.2;
        if (hasHarborWater && cx > 266) continue;
        if (
          hasInfieldLake &&
          ((cx - 125) * (cx - 125)) / (72 * 72) + ((cz + 5) * (cz + 5)) / (122 * 122) < 1.0
        ) {
          continue;
        }
        if (!isClearOfTrack(cx, cz, 3.2)) continue;

        const dropY = Math.max(0, (distOut - (halfW + 12)) * 0.25);
        const ty = Math.max(0, f.point.y - dropY);
        dummy.position.set(cx, ty, cz);
        const sc = 0.92 + ((s * 13) % 10) * 0.065;
        dummy.scale.set(sc, sc * (1.02 + ((s * 7) % 5) * 0.06), sc);
        dummy.rotation.y = (s * 1.37 + side) % (Math.PI * 2);
        dummy.updateMatrix();
        trunks.setMatrixAt(placed, dummy.matrix);
        lowCrowns.setMatrixAt(placed, dummy.matrix);
        upCrowns.setMatrixAt(placed, dummy.matrix);

        if (isSakuraBiome && s % 3 === 0) {
          col.setHSL(0.93, 0.72, isNight ? 0.36 : 0.74);
        } else if (isPalmBiome) {
          col.setHSL(0.28 + (s % 4) * 0.015, 0.52, isNight ? 0.16 : 0.28);
        } else {
          col.setHSL(
            0.34 + (((s * 11) % 9) - 4) * 0.008,
            0.44,
            isNight ? 0.12 : isRain ? 0.17 + (s % 5) * 0.018 : 0.22 + (s % 5) * 0.02
          );
        }
        lowCrowns.setColorAt(placed, col);
        upCrowns.setColorAt(placed, col);
        placed++;
      }
    }

    // Pass 2: Outer landscape forest / valley groves
    let attempts = 0;
    while (placed < treeCount && attempts < Math.max(2400, treeCount * 8)) {
      attempts++;
      const x = (Math.random() - 0.5) * 740 + 95;
      const z = (Math.random() - 0.5) * 740;
      if (hasHarborWater && x > 266) continue;
      if (
        hasInfieldLake &&
        ((x - 125) * (x - 125)) / (72 * 72) + ((z + 5) * (z + 5)) / (122 * 122) < 1.0
      ) {
        continue;
      }
      if (!isClearOfTrack(x, z, 4.5)) continue;
      const { dist, nearestY } = nearestTrackInfo(x, z);
      const ty = terrainHeightAt(x, z, dist, nearestY);
      dummy.position.set(x, Math.max(-0.1, ty), z);
      const sc = 0.9 + Math.random() * 0.7;
      dummy.scale.set(sc, sc * (1.0 + Math.random() * 0.32), sc);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);
      lowCrowns.setMatrixAt(placed, dummy.matrix);
      upCrowns.setMatrixAt(placed, dummy.matrix);

      if (isSakuraBiome && placed % 4 === 0) {
        col.setHSL(0.93, 0.7, weather === 'night' ? 0.34 : 0.72);
      } else {
        col.setHSL(
          0.33 + (Math.random() - 0.5) * 0.06,
          0.42,
          weather === 'night' ? 0.12 : isRain ? 0.16 + Math.random() * 0.08 : 0.2 + Math.random() * 0.1
        );
      }
      lowCrowns.setColorAt(placed, col);
      upCrowns.setColorAt(placed, col);
      placed++;
    }

    trunks.count = placed;
    lowCrowns.count = placed;
    upCrowns.count = placed;
    trunks.instanceMatrix.needsUpdate = true;
    lowCrowns.instanceMatrix.needsUpdate = true;
    upCrowns.instanceMatrix.needsUpdate = true;
    if (lowCrowns.instanceColor) lowCrowns.instanceColor.needsUpdate = true;
    if (upCrowns.instanceColor) upCrowns.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    lowCrowns.computeBoundingSphere();
    upCrowns.computeBoundingSphere();
    group.add(trunks, lowCrowns, upCrowns);

    // Extra Mediterranean Cypress accents for Monza & Monaco
    if ((biome === 'monza' || biome === 'monaco') && !isLow) {
      const cypCount = 48;
      const cypGeo = new THREE.ConeGeometry(0.95, 11.5, 7);
      cypGeo.translate(0, 5.75, 0);
      const cypMat = new THREE.MeshStandardMaterial({
        color: weather === 'night' ? 0x0f2419 : 0x1e4228,
        roughness: 0.88,
      });
      const cypMesh = new THREE.InstancedMesh(cypGeo, cypMat, cypCount);
      let cPlaced = 0;
      for (let i = 0; i < cypCount * 3 && cPlaced < cypCount; i++) {
        const s = samples[(i * 11) % sampleCount];
        const side = i % 2 === 0 ? -1 : 1;
        const cx = s.point.x + s.right.x * side * (halfW + 17 + (i % 5) * 3);
        const cz = s.point.z + s.right.z * side * (halfW + 17 + (i % 5) * 3);
        if (hasHarborWater && cx > 266) continue;
        if (!isClearOfTrack(cx, cz, 2.5)) continue;
        dummy.position.set(cx, terrainHeightAt(cx, cz), cz);
        dummy.scale.set(1, 0.88 + (i % 4) * 0.14, 1);
        dummy.rotation.y = i * 0.7;
        dummy.updateMatrix();
        cypMesh.setMatrixAt(cPlaced++, dummy.matrix);
      }
      cypMesh.count = cPlaced;
      cypMesh.instanceMatrix.needsUpdate = true;
      cypMesh.computeBoundingSphere();
      group.add(cypMesh);
      disposables.push(cypGeo, cypMat);
    }

    // Trackside Low Shrubs & Hedges (foreground depth via InstancedMesh)
    const shrubCount = Math.floor((isDesert ? 60 : 140) * foliageMult);
    if (shrubCount > 0) {
      const shrubGeo = new THREE.DodecahedronGeometry(1.15, 0);
      shrubGeo.scale(1.35, 0.72, 1.2);
      shrubGeo.translate(0, 0.48, 0);
      const shrubMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
      });
      const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubCount);
      let sPlaced = 0;
      for (let i = 0; i < shrubCount * 3 && sPlaced < shrubCount; i++) {
        const s = samples[(i * 5) % sampleCount];
        const side = i % 2 === 0 ? -1 : 1;
        const sx = s.point.x + s.right.x * side * (halfW + 9.5 + (i % 7) * 2.6);
        const sz = s.point.z + s.right.z * side * (halfW + 9.5 + (i % 7) * 2.6);
        if (hasHarborWater && sx > 266) continue;
        if (
          hasInfieldLake &&
          ((sx - 125) * (sx - 125)) / (72 * 72) + ((sz + 5) * (sz + 5)) / (122 * 122) < 1.0
        ) {
          continue;
        }
        if (!isClearOfTrack(sx, sz, 1.2)) continue;
        dummy.position.set(sx, terrainHeightAt(sx, sz), sz);
        const ssc = 0.65 + (i % 5) * 0.18;
        dummy.scale.set(ssc, ssc * 0.9, ssc);
        dummy.rotation.y = (i * 0.9) % (Math.PI * 2);
        dummy.updateMatrix();
        shrubs.setMatrixAt(sPlaced, dummy.matrix);
        if (isDesert) {
          col.setHSL(0.14, 0.32, isNight ? 0.14 : 0.28);
        } else if (isSakuraBiome && i % 5 === 0) {
          col.setHSL(0.93, 0.62, isNight ? 0.28 : 0.68);
        } else {
          col.setHSL(0.32 + (i % 4) * 0.02, 0.45, isNight ? 0.11 : 0.22 + (i % 3) * 0.04);
        }
        shrubs.setColorAt(sPlaced, col);
        sPlaced++;
      }
      shrubs.count = sPlaced;
      shrubs.instanceMatrix.needsUpdate = true;
      if (shrubs.instanceColor) shrubs.instanceColor.needsUpdate = true;
      shrubs.computeBoundingSphere();
      group.add(shrubs);
      disposables.push(shrubGeo, shrubMat);
    }
  };
  buildBiomeVegetation();

  // Instanced Biome Rocky Outcrops & Cliff Boulders
  const rockCount = Math.floor(85 * foliageMult);
  if (rockCount > 0) {
    const rockGeo = new THREE.DodecahedronGeometry(2.2, 0);
    rockGeo.scale(1.4, 0.72, 1.15);
    const rockMat = new THREE.MeshStandardMaterial({
      color: isNight ? 0x28303d : isDesert ? 0xb8966e : 0x646e78,
      roughness: 0.94,
    });
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    const rDummy = new THREE.Object3D();
    let rPlaced = 0;
    for (let i = 0; i < rockCount * 4 && rPlaced < rockCount; i++) {
      const s = samples[(i * 7) % sampleCount];
      const side = i % 2 === 0 ? 1 : -1;
      const rx = s.point.x + s.right.x * side * (halfW + 18 + (i % 9) * 5.2);
      const rz = s.point.z + s.right.z * side * (halfW + 18 + (i % 9) * 5.2);
      if (hasHarborWater && rx > 266) continue;
      if (!isClearOfTrack(rx, rz, 3.0)) continue;
      const ry = terrainHeightAt(rx, rz);
      rDummy.position.set(rx, ry - 0.35, rz);
      const rsc = 0.7 + (i % 5) * 0.36;
      rDummy.scale.set(rsc, rsc * (0.7 + (i % 3) * 0.25), rsc);
      rDummy.rotation.set((i % 3) * 0.2, i * 1.1, (i % 4) * 0.18);
      rDummy.updateMatrix();
      rockInst.setMatrixAt(rPlaced++, rDummy.matrix);
    }
    rockInst.count = rPlaced;
    rockInst.instanceMatrix.needsUpdate = true;
    rockInst.computeBoundingSphere();
    group.add(rockInst);
    disposables.push(rockGeo, rockMat);
  }

  // ============================================================================
  // 5b. WIND-SWAYED TRACKSIDE GRASS TUFTS (instanced crossed blades, 1 draw call)
  // ============================================================================
  const grassTimeUniform = { value: 0 };
  if (!isDesert && !isLow) {
    const tuftCount = Math.floor((isMedium ? 1800 : 4200) * foliageMult);
    const bladeGeo = (() => {
      // Three crossed tapered blade quads per tuft, vertex-coloured root->tip gradient
      const pos: number[] = [];
      const colr: number[] = [];
      const idx: number[] = [];
      const bladesPerTuft = 3;
      for (let b = 0; b < bladesPerTuft; b++) {
        const a = (b / bladesPerTuft) * Math.PI;
        const cx = Math.cos(a);
        const cz = Math.sin(a);
        const h = 0.62 + b * 0.09;
        const w = 0.11;
        const base = pos.length / 3;
        pos.push(-cx * w, 0, -cz * w, cx * w, 0, cz * w, -cx * w * 0.25, h, -cz * w * 0.25, cx * w * 0.25, h, cz * w * 0.25);
        colr.push(0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 1.15, 1.15, 1.15, 1.15, 1.15, 1.15);
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    })();
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.86,
      side: THREE.DoubleSide,
    });
    bladeMat.onBeforeCompile = (shader) => {
      shader.uniforms.uGrassTime = grassTimeUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uGrassTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float gSway = position.y * position.y;
          float gPhase = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;
          transformed.x += sin(uGrassTime * 1.7 + gPhase) * 0.09 * gSway;
          transformed.z += cos(uGrassTime * 1.3 + gPhase * 1.4) * 0.06 * gSway;`
        );
    };
    const tufts = new THREE.InstancedMesh(bladeGeo, bladeMat, tuftCount);
    const gDummy = new THREE.Object3D();
    const gCol = new THREE.Color();
    let gPlaced = 0;
    for (let i = 0; i < tuftCount * 3 && gPlaced < tuftCount; i++) {
      const s = samples[(i * 3) % sampleCount];
      const side = i % 2 === 0 ? -1 : 1;
      // Pseudo-random but deterministic lateral offset from just beyond the kerb/gravel to the tree line
      const lateral = halfW + 5.2 + ((i * 37) % 100) * 0.12;
      const gx = s.point.x + s.right.x * side * lateral + (((i * 13) % 17) - 8) * 0.18;
      const gz = s.point.z + s.right.z * side * lateral + (((i * 29) % 19) - 9) * 0.18;
      if (hasHarborWater && gx > 266) continue;
      if (
        hasInfieldLake &&
        ((gx - 125) * (gx - 125)) / (72 * 72) + ((gz + 5) * (gz + 5)) / (122 * 122) < 1.0
      ) {
        continue;
      }
      if (!isClearOfTrack(gx, gz, 0.4)) continue;
      gDummy.position.set(gx, terrainHeightAt(gx, gz), gz);
      const gs = 0.8 + ((i * 7) % 10) * 0.07;
      gDummy.scale.set(gs, gs * (0.85 + ((i * 11) % 6) * 0.1), gs);
      gDummy.rotation.y = (i * 1.7) % (Math.PI * 2);
      gDummy.updateMatrix();
      tufts.setMatrixAt(gPlaced, gDummy.matrix);
      gCol.setHSL(0.24 + ((i * 3) % 6) * 0.012, 0.42, isNight ? 0.1 : 0.2 + ((i * 5) % 5) * 0.025);
      tufts.setColorAt(gPlaced, gCol);
      gPlaced++;
    }
    tufts.count = gPlaced;
    tufts.instanceMatrix.needsUpdate = true;
    if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
    tufts.computeBoundingSphere();
    tufts.castShadow = false;
    tufts.receiveShadow = true;
    group.add(tufts);
    disposables.push(bladeGeo, bladeMat);
  }

  // ============================================================================
  // 6. CIRCUIT-SPECIFIC 3D LANDMARKS & CITY / HARBOR / COUNTRYSIDE ARCHITECTURE
  // ============================================================================
  const animatedSpinners: THREE.Object3D[] = [];
  const animatedYachts: Array<{ obj: THREE.Object3D; baseY: number; phase: number }> = [];
  const mistPlanes: Array<{ obj: THREE.Object3D; baseX: number; phase: number }> = [];
  let vegasSphereMat: THREE.MeshStandardMaterial | null = null;

  // Shared modern skyscraper builder helper
  const addSkyscraperCluster = (
    count: number,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    minH: number,
    maxH: number,
    neonTrims: boolean
  ) => {
    const bMat = new THREE.MeshPhysicalMaterial({
      map: textures.skyscraperGlassMap,
      emissiveMap: textures.skyscraperEmissiveMap,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: isNight ? 1.55 : isSunset ? 0.85 : 0.25,
      roughness: 0.14,
      metalness: 0.72,
      clearcoat: 0.85,
      envMapIntensity: 1.85,
    });
    disposables.push(bMat);
    const neonCols = [0x38bdf8, 0xf43f5e, 0xa855f7, 0xf59e0b, 0x10b981];

    for (let i = 0; i < count; i++) {
      const bx = minX + ((i * 73) % Math.max(10, maxX - minX));
      const bz = minZ + ((i * 137) % Math.max(10, maxZ - minZ));
      const bw = 11 + (i % 4) * 3.5;
      const bd = 11 + ((i + 2) % 4) * 3.5;
      const bh = minH + ((i * 29) % Math.max(12, maxH - minH));
      if (!isClearOfTrack(bx, bz, Math.max(bw, bd) * 0.75)) continue;

      const bGroup = new THREE.Group();
      bGroup.position.set(bx, 0, bz);
      const bGeo = new THREE.BoxGeometry(bw, bh, bd);
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.position.y = bh * 0.5;
      bMesh.castShadow = !isLow;
      bGroup.add(bMesh);
      disposables.push(bGeo);

      // Crown & spire detail
      const crownGeo = new THREE.BoxGeometry(bw * 0.72, 3.2, bd * 0.72);
      const crown = new THREE.Mesh(crownGeo, bMat);
      crown.position.y = bh + 1.6;
      bGroup.add(crown);
      disposables.push(crownGeo);

      if (neonTrims) {
        const nCol = neonCols[i % neonCols.length];
        const trimMat = new THREE.MeshStandardMaterial({
          color: nCol,
          emissive: nCol,
          emissiveIntensity: isNight ? 2.4 : 0.9,
        });
        const trimGeo = new THREE.BoxGeometry(bw + 0.4, 0.75, bd + 0.4);
        const trim = new THREE.Mesh(trimGeo, trimMat);
        trim.position.y = bh - 0.5;
        bGroup.add(trim);
        disposables.push(trimGeo, trimMat);
      }
      group.add(bGroup);
    }
  };

  // Shared Yacht builder (Monaco & Abu Dhabi)
  const addSuperyacht = (x: number, z: number, yaw: number, scale: number, phase: number) => {
    const yg = new THREE.Group();
    yg.position.set(x, -0.35, z);
    yg.rotation.y = yaw;
    yg.scale.setScalar(scale);

    const hullMat = new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.16, clearcoat: 0.9 });
    const darkGlassMat = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, roughness: 0.08, metalness: 0.88 });
    const teakMat = new THREE.MeshStandardMaterial({ color: 0x9a6b42, roughness: 0.72 });
    const deckGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: isNight || isSunset ? 1.8 : 0.4,
    });
    disposables.push(hullMat, darkGlassMat, teakMat, deckGlowMat);

    // Sculpted hull + pointed bow
    const hullGeo = new THREE.BoxGeometry(4.2, 1.5, 16);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.75;
    yg.add(hull);
    const bowGeo = new THREE.ConeGeometry(2.15, 4.8, 4);
    bowGeo.rotateX(Math.PI / 2);
    bowGeo.rotateZ(Math.PI / 4);
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.position.set(0, 0.85, 10.2);
    yg.add(bow);

    // Teak foredeck + Main & Upper superstructure cabins
    const deckGeo = new THREE.BoxGeometry(3.8, 0.15, 14.5);
    const deck = new THREE.Mesh(deckGeo, teakMat);
    deck.position.set(0, 1.52, -0.2);
    yg.add(deck);

    const cabin1Geo = new THREE.BoxGeometry(3.4, 1.4, 9.5);
    const cabin1 = new THREE.Mesh(cabin1Geo, hullMat);
    cabin1.position.set(0, 2.2, -1.2);
    yg.add(cabin1);

    const winGeo = new THREE.BoxGeometry(3.52, 0.65, 8.2);
    const winBand = new THREE.Mesh(winGeo, darkGlassMat);
    winBand.position.set(0, 2.3, -1.0);
    yg.add(winBand);

    const bridgeGeo = new THREE.BoxGeometry(2.6, 1.05, 5.2);
    const bridge = new THREE.Mesh(bridgeGeo, hullMat);
    bridge.position.set(0, 3.4, -1.6);
    yg.add(bridge);

    const mastGeo = new THREE.CylinderGeometry(0.08, 0.14, 3.2, 8);
    const mast = new THREE.Mesh(mastGeo, hullMat);
    mast.position.set(0, 5.1, -1.8);
    yg.add(mast);

    const navLightGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const navLight = new THREE.Mesh(navLightGeo, deckGlowMat);
    navLight.position.set(0, 6.7, -1.8);
    yg.add(navLight);

    disposables.push(hullGeo, bowGeo, deckGeo, cabin1Geo, winGeo, bridgeGeo, mastGeo, navLightGeo);
    group.add(yg);
    animatedYachts.push({ obj: yg, baseY: -0.35, phase });
  };

  // Shared Illuminated Observation Ferris Wheel (Singapore Flyer / Suzuka Wheel)
  const addFerrisWheel = (x: number, z: number, yaw: number, radius: number, rimColor: number) => {
    const fwGroup = new THREE.Group();
    fwGroup.position.set(x, 0, z);
    fwGroup.rotation.y = yaw;

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
    const neonRimMat = new THREE.MeshStandardMaterial({
      color: rimColor,
      emissive: rimColor,
      emissiveIntensity: isNight || isSunset ? 2.4 : 0.9,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xbae6fd,
      emissiveIntensity: isNight ? 1.5 : 0.4,
    });
    disposables.push(steelMat, neonRimMat, capMat);

    // Support A-frame legs
    const legGeo = new THREE.CylinderGeometry(0.55, 0.85, radius * 1.35, 8);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, steelMat);
      leg.position.set(s * radius * 0.42, radius * 0.58, 0);
      leg.rotation.z = s * 0.36;
      fwGroup.add(leg);
    }

    const spinner = new THREE.Group();
    spinner.position.set(0, radius * 1.15, 0);

    const rimGeo = new THREE.TorusGeometry(radius, 0.55, 10, 48);
    const rim = new THREE.Mesh(rimGeo, neonRimMat);
    spinner.add(rim);

    const innerRimGeo = new THREE.TorusGeometry(radius * 0.72, 0.32, 8, 36);
    const innerRim = new THREE.Mesh(innerRimGeo, steelMat);
    spinner.add(innerRim);

    const spokeGeo = new THREE.CylinderGeometry(0.18, 0.18, radius * 2, 6);
    for (let k = 0; k < 12; k++) {
      const sp = new THREE.Mesh(spokeGeo, steelMat);
      sp.rotation.z = (k / 12) * Math.PI;
      spinner.add(sp);
    }

    const capGeo = new THREE.BoxGeometry(1.6, 1.5, 2.2);
    for (let c = 0; c < 18; c++) {
      const a = (c / 18) * Math.PI * 2;
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      spinner.add(cap);
    }

    fwGroup.add(spinner);
    group.add(fwGroup);
    animatedSpinners.push(spinner);
    disposables.push(legGeo, rimGeo, innerRimGeo, spokeGeo, capGeo);
  };

  // Biome-specific signature structures
  if (biome === 'singapore') {
    // Marina Bay Sands 3-Tower SkyPark Landmark
    const mbsGroup = new THREE.Group();
    mbsGroup.position.set(320, 0, -40);
    mbsGroup.rotation.y = -0.35;
    const towerMat = new THREE.MeshPhysicalMaterial({
      map: textures.skyscraperGlassMap,
      emissiveMap: textures.skyscraperEmissiveMap,
      emissive: 0xffffff,
      emissiveIntensity: isNight ? 1.5 : 0.45,
      roughness: 0.14,
      metalness: 0.75,
    });
    const skyparkMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0x38bdf8,
      emissiveIntensity: isNight ? 0.9 : 0.25,
      metalness: 0.65,
      roughness: 0.25,
    });
    const towerGeo = new THREE.BoxGeometry(12, 86, 14);
    for (let t = -1; t <= 1; t++) {
      const tw = new THREE.Mesh(towerGeo, towerMat);
      tw.position.set(0, 43, t * 24);
      tw.rotation.z = 0.08;
      mbsGroup.add(tw);
    }
    const deckGeo = new THREE.BoxGeometry(18, 4.2, 84);
    const skyDeck = new THREE.Mesh(deckGeo, skyparkMat);
    skyDeck.position.set(-3.2, 87, 0);
    mbsGroup.add(skyDeck);
    group.add(mbsGroup);
    disposables.push(towerMat, skyparkMat, towerGeo, deckGeo);

    addFerrisWheel(315, 110, Math.PI * 0.4, 34, 0x38bdf8);
    addSkyscraperCluster(26, -155, -55, -245, 225, 36, 94, true);
    addSkyscraperCluster(18, 280, 420, -240, 220, 32, 88, true);
    addSuperyacht(305, 55, 0.35, 1.35, 0.5);
    addSuperyacht(325, 15, -0.25, 1.15, 2.1);

    // Helix Glowing Double-Spiral Pedestrian Bridge & Gardens Supertrees
    const helixMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0xa855f7,
      emissiveIntensity: isNight ? 2.2 : 0.7,
      metalness: 0.75,
      roughness: 0.22,
    });
    const helixGeo = new THREE.TorusGeometry(6.5, 0.45, 8, 28);
    for (let h = 0; h < 5; h++) {
      const hx = new THREE.Mesh(helixGeo, helixMat);
      hx.position.set(282 + h * 9, 4.2, 130);
      hx.rotation.y = Math.PI * 0.5;
      group.add(hx);
    }
    const supertreeGeo = new THREE.ConeGeometry(8.5, 26, 8, 1, true);
    supertreeGeo.rotateX(Math.PI);
    const supertreeMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0xec4899,
      emissiveIntensity: isNight ? 1.85 : 0.45,
      side: THREE.DoubleSide,
    });
    for (const [sx, sz] of [
      [295, -145],
      [325, -165],
      [345, -135],
    ]) {
      const st = new THREE.Mesh(supertreeGeo, supertreeMat);
      st.position.set(sx, 16, sz);
      group.add(st);
    }
    disposables.push(helixMat, helixGeo, supertreeGeo, supertreeMat);
  } else if (biome === 'monaco') {
    // Monte Carlo Terraced Mediterranean Riviera Apartments climbing the cliffside
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.78 });
    disposables.push(roofMat);
    const tints = [0xfde68a, 0xfed7aa, 0xfecaca, 0xf8fafc, 0xe7d5bc];

    for (let i = 0; i < 34; i++) {
      const bx = -78 - (i % 4) * 24;
      const bz = -205 + i * 13.5;
      if (!isClearOfTrack(bx, bz, 12)) continue;
      const w = 14 + (i % 3) * 4;
      const d = 11 + (i % 2) * 3;
      const h = 18 + (i % 5) * 6;
      const tint = new THREE.MeshStandardMaterial({
        map: textures.rivieraFacadeMap,
        color: tints[i % tints.length],
        roughness: 0.65,
      });
      const bGeo = new THREE.BoxGeometry(w, h, d);
      const bMesh = new THREE.Mesh(bGeo, tint);
      bMesh.position.set(bx, h * 0.5 + (i % 4) * 3.5, bz);
      group.add(bMesh);

      const rfGeo = new THREE.BoxGeometry(w + 0.8, 1.4, d + 0.8);
      const rfMesh = new THREE.Mesh(rfGeo, roofMat);
      rfMesh.position.set(bx, h + 0.7 + (i % 4) * 3.5, bz);
      group.add(rfMesh);
      disposables.push(tint, bGeo, rfGeo);
    }

    // Casino Monte-Carlo Belle Epoque Pavilion overlooking the circuit
    const casGroup = new THREE.Group();
    casGroup.position.set(-55, 4, -85);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xf5e8d0, roughness: 0.58 });
    const copperMat = new THREE.MeshStandardMaterial({ color: 0x3f8f7b, roughness: 0.42, metalness: 0.35 });
    const cBodyGeo = new THREE.BoxGeometry(28, 12, 18);
    const cBody = new THREE.Mesh(cBodyGeo, stoneMat);
    cBody.position.y = 6;
    casGroup.add(cBody);
    const domeGeo = new THREE.SphereGeometry(6.5, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const dome = new THREE.Mesh(domeGeo, copperMat);
    dome.position.y = 12;
    casGroup.add(dome);
    group.add(casGroup);

    // Sainte-Devote Hillside Viaduct Arches + Port Hercule Lighthouse
    const archPierGeo = new THREE.BoxGeometry(4, 14, 12);
    for (let a = 0; a < 5; a++) {
      const pier = new THREE.Mesh(archPierGeo, stoneMat);
      pier.position.set(-64, 7, 130 + a * 18);
      group.add(pier);
    }
    const viaductDeckGeo = new THREE.BoxGeometry(8, 2.5, 84);
    const viaductDeck = new THREE.Mesh(viaductDeckGeo, stoneMat);
    viaductDeck.position.set(-64, 14.5, 166);
    group.add(viaductDeck);

    const lhMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
    const lhRedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: isNight || isSunset ? 2.4 : 0.4,
    });
    const lhGeo = new THREE.CylinderGeometry(1.4, 2.1, 14, 12);
    const lhMesh = new THREE.Mesh(lhGeo, lhMat);
    lhMesh.position.set(276, 7, 210);
    group.add(lhMesh);
    const lhCapGeo = new THREE.CylinderGeometry(1.6, 1.6, 2.2, 12);
    const lhCap = new THREE.Mesh(lhCapGeo, lhRedMat);
    lhCap.position.set(276, 15, 210);
    group.add(lhCap);

    disposables.push(
      stoneMat,
      copperMat,
      cBodyGeo,
      domeGeo,
      archPierGeo,
      viaductDeckGeo,
      lhMat,
      lhRedMat,
      lhGeo,
      lhCapGeo
    );

    // 8 Luxury Superyachts moored in Port Hercule Harbor
    const yachtSpots: Array<[number, number, number, number]> = [
      [295, -80, 0.25, 1.4],
      [318, -32, -0.15, 1.65],
      [300, 18, 0.45, 1.25],
      [330, 68, -0.3, 1.8],
      [298, 120, 0.1, 1.45],
      [338, 165, -0.22, 1.55],
      [360, -5, 0.08, 1.75],
      [365, 105, -0.38, 1.35],
    ];
    yachtSpots.forEach(([yx, yz, yyaw, ysc], idx) => addSuperyacht(yx, yz, yyaw, ysc, idx * 0.9));
  } else if (biome === 'las_vegas') {
    // Giant Glowing Neon Sphere Arena
    const sphGroup = new THREE.Group();
    sphGroup.position.set(125, 0, -90);
    vegasSphereMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      emissive: 0xa855f7,
      emissiveIntensity: 2.35,
      roughness: 0.25,
    });
    const sphGeo = new THREE.SphereGeometry(32, 32, 24);
    const sphMesh = new THREE.Mesh(sphGeo, vegasSphereMat);
    sphMesh.position.y = 26;
    sphGroup.add(sphMesh);
    group.add(sphGroup);
    disposables.push(vegasSphereMat, sphGeo);

    // Illuminated Vegas Pyramid + Skybeam
    const pyrMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.18, metalness: 0.85 });
    const pyrGeo = new THREE.ConeGeometry(34, 48, 4);
    const pyr = new THREE.Mesh(pyrGeo, pyrMat);
    pyr.position.set(-105, 24, 95);
    pyr.rotation.y = Math.PI / 4;
    group.add(pyr);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const beamGeo = new THREE.CylinderGeometry(1.2, 4.5, 260, 12, 1, true);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(-105, 172, 95);
    group.add(beam);

    // Illuminated Eiffel-style Lattice Tower + Glowing Strip Neon Archways
    const eiffelMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: isNight ? 1.4 : 0.35,
      wireframe: true,
    });
    const eiffelGeo = new THREE.ConeGeometry(16, 98, 4, 8);
    const eiffel = new THREE.Mesh(eiffelGeo, eiffelMat);
    eiffel.position.set(305, 49, -65);
    eiffel.rotation.y = Math.PI / 4;
    group.add(eiffel);

    const neonArchMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      emissive: 0xec4899,
      emissiveIntensity: isNight ? 2.5 : 0.9,
    });
    const neonArchGeo = new THREE.TorusGeometry(22, 1.1, 8, 28, Math.PI);
    const neonArch = new THREE.Mesh(neonArchGeo, neonArchMat);
    neonArch.position.set(-85, 0, -145);
    neonArch.rotation.y = Math.PI * 0.5;
    group.add(neonArch);

    disposables.push(pyrMat, pyrGeo, beamMat, beamGeo, eiffelMat, eiffelGeo, neonArchMat, neonArchGeo);

    // Neon Strip Skyscraper Canyon flanking both sides
    addSkyscraperCluster(30, -140, -52, -230, 220, 42, 108, true);
    addSkyscraperCluster(24, 295, 390, -220, 220, 46, 114, true);
  } else if (biome === 'abu_dhabi') {
    // Iconic Yas Viceroy / W Hotel Curved Luminous Lattice Canopy
    const wGroup = new THREE.Group();
    wGroup.position.set(298, 0, -20);
    const wCoreMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.12,
      metalness: 0.85,
    });
    const wGridMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x06b6d4,
      emissiveIntensity: isNight || isSunset ? 2.1 : 0.75,
      wireframe: true,
    });
    const wDomeGeo = new THREE.SphereGeometry(28, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
    wDomeGeo.scale(1.2, 0.55, 1.8);
    const wDome = new THREE.Mesh(wDomeGeo, wGridMat);
    wDome.position.y = 4;
    wGroup.add(wDome);
    const wInnerGeo = new THREE.BoxGeometry(24, 14, 42);
    const wInner = new THREE.Mesh(wInnerGeo, wCoreMat);
    wInner.position.y = 7;
    wGroup.add(wInner);
    group.add(wGroup);

    // Yas Marina Glowing Beacon Towers
    const beaconGeo = new THREE.CylinderGeometry(1.5, 3.2, 44, 10);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0x38bdf8,
      emissiveIntensity: isNight || isSunset ? 1.8 : 0.35,
    });
    for (const [bx, bz] of [
      [278, -125],
      [278, 165],
    ]) {
      const bcn = new THREE.Mesh(beaconGeo, beaconMat);
      bcn.position.set(bx, 22, bz);
      group.add(bcn);
    }
    disposables.push(wCoreMat, wGridMat, wDomeGeo, wInnerGeo, beaconGeo, beaconMat);

    addSkyscraperCluster(14, 300, 390, -210, 190, 34, 78, true);
    addSuperyacht(312, 75, 0.2, 1.45, 0.4);
    addSuperyacht(338, 130, -0.35, 1.65, 1.8);
  } else if (biome === 'suzuka') {
    // Iconic Suzuka Observation Ferris Wheel + Japanese Pagoda + Crimson Torii Gate + Distant Mt. Fuji
    addFerrisWheel(-72, -135, 0.35, 30, 0xef4444);

    const pagGroup = new THREE.Group();
    pagGroup.position.set(-68, 0, 55);
    const redWoodMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.55 });
    const slateRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.48 });
    const wallWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 });
    disposables.push(redWoodMat, slateRoofMat, wallWhiteMat);

    for (let tier = 0; tier < 3; tier++) {
      const sz = 14 - tier * 3;
      const bodyGeo = new THREE.BoxGeometry(sz, 4.5, sz);
      const body = new THREE.Mesh(bodyGeo, wallWhiteMat);
      body.position.y = 2.25 + tier * 5.2;
      pagGroup.add(body);
      const roofGeo = new THREE.ConeGeometry(sz * 0.95, 2.4, 4);
      roofGeo.rotateY(Math.PI / 4);
      const roof = new THREE.Mesh(roofGeo, slateRoofMat);
      roof.position.y = 5.3 + tier * 5.2;
      pagGroup.add(roof);
      disposables.push(bodyGeo, roofGeo);
    }
    group.add(pagGroup);

    // Traditional Crimson Torii Shrine Gate beside the Pagoda
    const toriiGroup = new THREE.Group();
    toriiGroup.position.set(-54, 0, 38);
    toriiGroup.rotation.y = Math.PI * 0.35;
    const tColGeo = new THREE.CylinderGeometry(0.65, 0.85, 12, 10);
    for (const sx of [-4.2, 4.2]) {
      const tc = new THREE.Mesh(tColGeo, redWoodMat);
      tc.position.set(sx, 6, 0);
      toriiGroup.add(tc);
    }
    const kasagiGeo = new THREE.BoxGeometry(13.5, 1.15, 1.35);
    const kasagi = new THREE.Mesh(kasagiGeo, redWoodMat);
    kasagi.position.y = 12.2;
    toriiGroup.add(kasagi);
    const nukiGeo = new THREE.BoxGeometry(11.0, 0.8, 0.9);
    const nuki = new THREE.Mesh(nukiGeo, redWoodMat);
    nuki.position.y = 9.8;
    toriiGroup.add(nuki);
    group.add(toriiGroup);

    // Distant Volcanic Snow-Capped Mt. Fuji Peak Silhouette
    const fujiMat = new THREE.MeshStandardMaterial({
      color: isNight ? 0x1e293b : isSunset ? 0x6b4c5e : 0x4b5d73,
      roughness: 0.92,
    });
    const fujiSnowMat = new THREE.MeshStandardMaterial({
      color: isNight ? 0x475569 : isSunset ? 0xfed7aa : 0xf8fafc,
      roughness: 0.85,
    });
    const fujiGeo = new THREE.ConeGeometry(145, 118, 24);
    const fuji = new THREE.Mesh(fujiGeo, fujiMat);
    fuji.position.set(-460, 56, -340);
    group.add(fuji);
    const fujiCapGeo = new THREE.ConeGeometry(54, 42, 24);
    const fujiCap = new THREE.Mesh(fujiCapGeo, fujiSnowMat);
    fujiCap.position.set(-460, 96, -340);
    group.add(fujiCap);

    disposables.push(tColGeo, kasagiGeo, nukiGeo, fujiMat, fujiSnowMat, fujiGeo, fujiCapGeo);
  } else if (biome === 'silverstone') {
    // Futuristic Silverstone Wing Paddock Pavilion + Historic Aviation Hangars & Countryside Barns
    const wingGroup = new THREE.Group();
    wingGroup.position.set(-72, 0, -25);
    const silverMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.72, roughness: 0.24 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, metalness: 0.88, roughness: 0.08 });
    const baseGeo = new THREE.BoxGeometry(16, 7, 74);
    const base = new THREE.Mesh(baseGeo, glassMat);
    base.position.y = 3.5;
    wingGroup.add(base);
    const roofGeo = new THREE.BoxGeometry(22, 1.4, 82);
    const roof = new THREE.Mesh(roofGeo, silverMat);
    roof.position.set(1.5, 8.2, 0);
    roof.rotation.z = -0.09;
    wingGroup.add(roof);
    group.add(wingGroup);

    // Classic British Airfield Arch Hangars + Stone Countryside Farmhouses
    const hangarGeo = new THREE.CylinderGeometry(14, 14, 34, 16, 1, false, 0, Math.PI);
    hangarGeo.rotateZ(Math.PI / 2);
    const hangarMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.65, metalness: 0.45 });
    for (const [hx, hz] of [
      [310, -90],
      [310, -45],
    ]) {
      const hg = new THREE.Mesh(hangarGeo, hangarMat);
      hg.position.set(hx, 0, hz);
      group.add(hg);
    }
    const barnWallMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.85 });
    const barnRoofMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.82 });
    const barnWallGeo = new THREE.BoxGeometry(12, 6, 9);
    const barnRoofGeo = new THREE.ConeGeometry(8.5, 4.2, 4);
    barnRoofGeo.rotateY(Math.PI / 4);
    for (const [bx, bz] of [
      [-115, 130],
      [295, 145],
    ]) {
      const bw = new THREE.Mesh(barnWallGeo, barnWallMat);
      bw.position.set(bx, terrainHeightAt(bx, bz) + 3, bz);
      group.add(bw);
      const br = new THREE.Mesh(barnRoofGeo, barnRoofMat);
      br.position.set(bx, terrainHeightAt(bx, bz) + 8.1, bz);
      group.add(br);
    }
    disposables.push(
      silverMat,
      glassMat,
      baseGeo,
      roofGeo,
      hangarGeo,
      hangarMat,
      barnWallMat,
      barnRoofMat,
      barnWallGeo,
      barnRoofGeo
    );
  } else if (biome === 'monza') {
    // Historic Italian Villa / Royal Park Colonnade Pavilion + Old Sopraelevata Banked Oval Monument
    const villaGroup = new THREE.Group();
    villaGroup.position.set(-72, 0, -105);
    const ochreMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.78 });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.72 });
    const tileMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.82 });
    const vBodyGeo = new THREE.BoxGeometry(24, 9.5, 16);
    const vBody = new THREE.Mesh(vBodyGeo, creamMat);
    vBody.position.y = 4.75;
    villaGroup.add(vBody);
    const vRoofGeo = new THREE.ConeGeometry(16, 4.2, 4);
    vRoofGeo.rotateY(Math.PI / 4);
    const vRoof = new THREE.Mesh(vRoofGeo, tileMat);
    vRoof.position.y = 11.4;
    villaGroup.add(vRoof);
    const colGeo = new THREE.CylinderGeometry(0.45, 0.5, 7.5, 10);
    for (let c = -8; c <= 8; c += 4) {
      const colMesh = new THREE.Mesh(colGeo, ochreMat);
      colMesh.position.set(12.6, 3.75, c);
      villaGroup.add(colMesh);
    }
    group.add(villaGroup);

    // Historic Monza Old Oval Concrete Banking Sweeping behind the Parkland
    const bankGeo = new THREE.CylinderGeometry(95, 112, 16, 28, 1, true, 0, Math.PI * 0.75);
    const bankMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9, side: THREE.DoubleSide });
    const bank = new THREE.Mesh(bankGeo, bankMat);
    bank.position.set(220, 7, -145);
    group.add(bank);

    disposables.push(ochreMat, creamMat, tileMat, vBodyGeo, vRoofGeo, colGeo, bankGeo, bankMat);
  } else if (biome === 'spa') {
    // Ardennes Ridge Stone Abbey Ruins + Timber Forest Chalets
    const abbeyGroup = new THREE.Group();
    abbeyGroup.position.set(-85, 12, -165);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    const keepGeo = new THREE.BoxGeometry(10, 18, 10);
    const keep = new THREE.Mesh(keepGeo, stoneMat);
    keep.position.y = 9;
    abbeyGroup.add(keep);
    const wingGeo = new THREE.BoxGeometry(22, 10, 8);
    const wing = new THREE.Mesh(wingGeo, stoneMat);
    wing.position.set(10, 5, 0);
    abbeyGroup.add(wing);
    group.add(abbeyGroup);

    const chWoodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.85 });
    const chRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72 });
    const chGeo = new THREE.BoxGeometry(10, 5.5, 8);
    const chRfGeo = new THREE.ConeGeometry(8, 3.8, 4);
    chRfGeo.rotateY(Math.PI / 4);
    for (const [cx, cz] of [
      [-105, 85],
      [295, -95],
      [285, 125],
    ]) {
      const cy = terrainHeightAt(cx, cz);
      const cw = new THREE.Mesh(chGeo, chWoodMat);
      cw.position.set(cx, cy + 2.75, cz);
      group.add(cw);
      const cr = new THREE.Mesh(chRfGeo, chRoofMat);
      cr.position.set(cx, cy + 7.4, cz);
      group.add(cr);
    }
    disposables.push(stoneMat, keepGeo, wingGeo, chWoodMat, chRoofMat, chGeo, chRfGeo);
  } else if (biome === 'alpine') {
    // Iconic Steel Red Bull Monument Sculpture & Styrian Timber Alpine Chalets
    const bullGroup = new THREE.Group();
    bullGroup.position.set(110, 8, -95);
    const steelRedMat = new THREE.MeshPhysicalMaterial({
      color: 0xdc2626,
      metalness: 0.85,
      roughness: 0.22,
      clearcoat: 0.8,
    });
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 });
    const plinthGeo = new THREE.BoxGeometry(14, 4, 6);
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = 2;
    bullGroup.add(plinth);
    const bodyGeo = new THREE.BoxGeometry(10, 5.2, 4.2);
    const body = new THREE.Mesh(bodyGeo, steelRedMat);
    body.position.y = 6.6;
    bullGroup.add(body);
    const hornGeo = new THREE.ConeGeometry(0.6, 4.2, 8);
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(hornGeo, steelRedMat);
      horn.position.set(5.4, 9.2, s * 1.4);
      horn.rotation.z = -0.8;
      bullGroup.add(horn);
    }
    group.add(bullGroup);

    const alpWoodMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.82 });
    const alpRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78 });
    const alpBoxGeo = new THREE.BoxGeometry(11, 5.5, 9);
    const alpRoofGeo = new THREE.ConeGeometry(8.5, 4.0, 4);
    alpRoofGeo.rotateY(Math.PI / 4);
    for (const [ax, az] of [
      [-95, -75],
      [290, 95],
      [285, -120],
    ]) {
      const ay = terrainHeightAt(ax, az);
      const ab = new THREE.Mesh(alpBoxGeo, alpWoodMat);
      ab.position.set(ax, ay + 2.75, az);
      group.add(ab);
      const ar = new THREE.Mesh(alpRoofGeo, alpRoofMat);
      ar.position.set(ax, ay + 7.5, az);
      group.add(ar);
    }
    disposables.push(
      steelRedMat,
      plinthMat,
      plinthGeo,
      bodyGeo,
      hornGeo,
      alpWoodMat,
      alpRoofMat,
      alpBoxGeo,
      alpRoofGeo
    );
  } else if (biome === 'bahrain') {
    // Iconic Sakhir Angled White-and-Glass VIP Track Tower + Desert Sand Dunes + Floodlight Pylons
    const sakhirGroup = new THREE.Group();
    sakhirGroup.position.set(115, 0, -105);
    const towerStoneMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
    const towerGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      emissive: 0xf59e0b,
      emissiveIntensity: isNight || isSunset ? 1.1 : 0.25,
      metalness: 0.85,
      roughness: 0.1,
    });
    const basePlinthGeo = new THREE.BoxGeometry(22, 6, 18);
    const basePlinth = new THREE.Mesh(basePlinthGeo, towerStoneMat);
    basePlinth.position.y = 3;
    sakhirGroup.add(basePlinth);
    const shaftGeo = new THREE.BoxGeometry(11, 36, 11);
    const shaft = new THREE.Mesh(shaftGeo, towerStoneMat);
    shaft.position.set(0, 22, 0);
    shaft.rotation.z = -0.14;
    sakhirGroup.add(shaft);
    const crownPodGeo = new THREE.CylinderGeometry(8.5, 6.2, 8.5, 8);
    const crownPod = new THREE.Mesh(crownPodGeo, towerGlassMat);
    crownPod.position.set(3.2, 41, 0);
    sakhirGroup.add(crownPod);
    group.add(sakhirGroup);
    disposables.push(towerStoneMat, towerGlassMat, basePlinthGeo, shaftGeo, crownPodGeo);

    // Sweeping desert sand dunes framing outer perimeter
    const duneMat = new THREE.MeshStandardMaterial({
      map: textures.desertSandMap,
      color: isNight ? 0x3b2f21 : 0xdcb985,
      roughness: 0.96,
    });
    const duneGeo = new THREE.ConeGeometry(42, 16, 16);
    duneGeo.scale(1.8, 0.7, 1.1);
    disposables.push(duneMat, duneGeo);
    const duneCoords: Array<[number, number, number]> = [
      [-125, -180, 0.3],
      [-140, 120, 1.2],
      [325, -150, -0.5],
      [335, 110, 0.8],
      [120, 320, 2.1],
    ];
    for (const [dx, dz, ry] of duneCoords) {
      const dm = new THREE.Mesh(duneGeo, duneMat);
      dm.position.set(dx, 5.5, dz);
      dm.rotation.y = ry;
      group.add(dm);
    }

    // Sakhir Tall Stadium Floodlight Pylons
    const pylonMastGeo = new THREE.CylinderGeometry(0.4, 0.75, 36, 8);
    const pylonRackGeo = new THREE.BoxGeometry(6.5, 2.2, 1.2);
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.72, roughness: 0.3 });
    const pylonLampMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffedd5,
      emissiveIntensity: isNight || isSunset ? 3.5 : 0.45,
    });
    for (const [px, pz, pyaw] of [
      [-95, -90, 0.6],
      [290, -85, -0.7],
      [290, 115, -2.3],
      [-95, 120, 2.4],
    ]) {
      const pg = new THREE.Group();
      pg.position.set(px, terrainHeightAt(px, pz), pz);
      pg.rotation.y = pyaw;
      const pm = new THREE.Mesh(pylonMastGeo, pylonMat);
      pm.position.y = 18;
      pg.add(pm);
      const pr = new THREE.Mesh(pylonRackGeo, pylonLampMat);
      pr.position.y = 36;
      pg.add(pr);
      group.add(pg);
    }
    disposables.push(pylonMastGeo, pylonRackGeo, pylonMat, pylonLampMat);
  } else if (biome === 'qatar') {
    // Lusail Iconic Crescent Twin Towers + Sweeping Futuristic Stadium Roof Canopy + Halo Ring
    const lusailGroup = new THREE.Group();
    lusailGroup.position.set(325, 0, -45);
    const lusailGlassMat = new THREE.MeshPhysicalMaterial({
      map: textures.skyscraperGlassMap,
      emissiveMap: textures.skyscraperEmissiveMap,
      emissive: 0xfef08a,
      emissiveIntensity: isNight || isSunset ? 1.45 : 0.4,
      metalness: 0.85,
      roughness: 0.12,
    });
    const crescentGeo = new THREE.CylinderGeometry(7.5, 11.5, 78, 12);
    for (const side of [-1, 1]) {
      const tw = new THREE.Mesh(crescentGeo, lusailGlassMat);
      tw.position.set(0, 38, side * 18);
      tw.rotation.x = side * 0.22;
      lusailGroup.add(tw);
    }
    const bridgeGeo = new THREE.BoxGeometry(10, 4.5, 24);
    const bridge = new THREE.Mesh(bridgeGeo, lusailGlassMat);
    bridge.position.set(0, 32, 0);
    lusailGroup.add(bridge);
    group.add(lusailGroup);
    disposables.push(lusailGlassMat, crescentGeo, bridgeGeo);

    // Modern Lusail Paddock Hospitality Arch Canopy + Gold Stadium Halo Ring
    const archGroup = new THREE.Group();
    archGroup.position.set(-85, 0, -25);
    const goldCanopyMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4af37,
      emissive: 0xf59e0b,
      emissiveIntensity: isNight ? 0.45 : 0.1,
      metalness: 0.78,
      roughness: 0.22,
    });
    const archGeo = new THREE.TorusGeometry(32, 2.2, 8, 28, Math.PI);
    const arch = new THREE.Mesh(archGeo, goldCanopyMat);
    arch.rotation.y = Math.PI / 2;
    archGroup.add(arch);
    group.add(archGroup);

    const haloGeo = new THREE.TorusGeometry(38, 3.2, 8, 36);
    haloGeo.rotateX(Math.PI / 2);
    const halo = new THREE.Mesh(haloGeo, goldCanopyMat);
    halo.position.set(320, 14, 130);
    group.add(halo);
    disposables.push(goldCanopyMat, archGeo, haloGeo);

    addSkyscraperCluster(14, -155, -75, -220, 210, 28, 68, true);
  } else if (biome === 'melbourne') {
    // Albert Park Lake Sailboats & Lakeside Boathouse + Melbourne CBD Skyscraper Skyline (Eureka Spire)
    const boatGroup = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.55, side: THREE.DoubleSide });
    const hullGeo = new THREE.BoxGeometry(1.4, 0.7, 4.2);
    const mastGeo = new THREE.CylinderGeometry(0.05, 0.07, 4.5, 6);
    const sailGeo = new THREE.ConeGeometry(1.6, 3.8, 3);
    disposables.push(hullMat, sailMat, hullGeo, mastGeo, sailGeo);

    const boatSpots: Array<[number, number, number]> = [
      [112, -45, 0.4],
      [142, 12, -0.5],
      [108, 48, 0.9],
      [136, -15, -0.2],
    ];
    boatSpots.forEach(([bx, bz, yaw], idx) => {
      const sb = new THREE.Group();
      sb.position.set(bx, -0.35, bz);
      sb.rotation.y = yaw;
      const h = new THREE.Mesh(hullGeo, hullMat);
      h.position.y = 0.25;
      sb.add(h);
      const m = new THREE.Mesh(mastGeo, hullMat);
      m.position.y = 2.6;
      sb.add(m);
      const s = new THREE.Mesh(sailGeo, sailMat);
      s.position.set(0, 2.7, 0.25);
      s.scale.set(0.12, 1, 1);
      sb.add(s);
      boatGroup.add(sb);
      animatedYachts.push({ obj: sb, baseY: -0.35, phase: idx * 1.1 });
    });

    // Albert Park Timber Lakeside Boathouse & Jetty
    const dockMat = new THREE.MeshStandardMaterial({ color: 0x7c5338, roughness: 0.84 });
    const dockGeo = new THREE.BoxGeometry(11, 0.45, 6.5);
    const dock = new THREE.Mesh(dockGeo, dockMat);
    dock.position.set(82, -0.1, -6);
    boatGroup.add(dock);
    const bhGeo = new THREE.BoxGeometry(8, 4.2, 5.5);
    const bh = new THREE.Mesh(bhGeo, hullMat);
    bh.position.set(78, 2.1, -6);
    boatGroup.add(bh);
    disposables.push(dockMat, dockGeo, bhGeo);
    group.add(boatGroup);

    // Melbourne CBD Skyline across the north/east horizon + Iconic Gold-Crowned Eureka Tower
    addSkyscraperCluster(26, -165, -75, -245, 225, 34, 92, false);
    addSkyscraperCluster(18, 295, 415, -235, 215, 38, 102, false);

    const eurekaGroup = new THREE.Group();
    eurekaGroup.position.set(-125, 0, -145);
    const eurekaBlueMat = new THREE.MeshPhysicalMaterial({
      map: textures.skyscraperGlassMap,
      color: 0x38bdf8,
      metalness: 0.82,
      roughness: 0.14,
    });
    const eurekaGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: isNight ? 1.3 : 0.35,
      metalness: 0.9,
      roughness: 0.16,
    });
    const eBodyGeo = new THREE.BoxGeometry(16, 104, 16);
    const eBody = new THREE.Mesh(eBodyGeo, eurekaBlueMat);
    eBody.position.y = 52;
    eurekaGroup.add(eBody);
    const eCrownGeo = new THREE.BoxGeometry(16.6, 18, 16.6);
    const eCrown = new THREE.Mesh(eCrownGeo, eurekaGoldMat);
    eCrown.position.y = 95;
    eurekaGroup.add(eCrown);
    const eSpireGeo = new THREE.CylinderGeometry(0.25, 0.8, 22, 8);
    const eSpire = new THREE.Mesh(eSpireGeo, eurekaGoldMat);
    eSpire.position.y = 115;
    eurekaGroup.add(eSpire);
    group.add(eurekaGroup);
    disposables.push(eurekaBlueMat, eurekaGoldMat, eBodyGeo, eCrownGeo, eSpireGeo);
  }

  // ============================================================================
  // 6b. GLOBAL DYNAMIC ATMOSPHERIC VALLEY MIST, 3D LIGHTNING BOLTS & BROADCAST BLIMP
  // ============================================================================
  const biomeBaseMist =
    biome === 'spa' ? 0.18 : biome === 'silverstone' || biome === 'suzuka' || biome === 'singapore' ? 0.11 : 0.05;
  const mistMat = new THREE.SpriteMaterial({
    map: textures.smokeSpriteMap,
    color: 0xe2e8f0,
    transparent: true,
    opacity: isRain ? 0.24 : isCloudy ? 0.14 : biomeBaseMist,
    depthWrite: false,
  });
  disposables.push(mistMat);
  const mistCount = isLow ? 10 : 18;
  for (let m = 0; m < mistCount; m++) {
    const sp = new THREE.Sprite(mistMat);
    const bx = -95 + (m % 5) * 95;
    const bz = -200 + Math.floor(m / 5) * 115;
    sp.position.set(bx, 14 + (m % 3) * 6, bz);
    sp.scale.set(110, 26, 1);
    group.add(sp);
    mistPlanes.push({ obj: sp, baseX: bx, phase: m * 0.7 });
  }

  // 3D Jagged Thunderstorm Lightning Bolts along distant horizon
  const lightningMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  disposables.push(lightningMat);
  const lightningBolts: THREE.Mesh[] = [];
  for (let b = 0; b < 4; b++) {
    const ang = (b / 4) * Math.PI * 2 + 0.45;
    const boltPts = [
      new THREE.Vector3(0, 175, 0),
      new THREE.Vector3(7, 132, 4),
      new THREE.Vector3(-9, 92, -3),
      new THREE.Vector3(5, 52, 6),
      new THREE.Vector3(-4, 6, 0),
    ];
    const boltCurve = new THREE.CatmullRomCurve3(boltPts);
    const boltGeo = new THREE.TubeGeometry(boltCurve, 12, 1.35, 5, false);
    const boltMesh = new THREE.Mesh(boltGeo, lightningMat);
    boltMesh.position.set(
      centerOffset.x + Math.cos(ang) * 420,
      0,
      centerOffset.z + Math.sin(ang) * 420
    );
    boltMesh.visible = false;
    group.add(boltMesh);
    lightningBolts.push(boltMesh);
    disposables.push(boltGeo);
  }

  // Animated Aerial Broadcast Blimp slowly circling high over the circuit
  const blimpGroup = new THREE.Group();
  const blimpHullGeo = new THREE.SphereGeometry(9.5, 18, 12);
  blimpHullGeo.scale(1.0, 0.95, 2.6);
  const blimpHullMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.2,
    clearcoat: 0.7,
  });
  const blimpHull = new THREE.Mesh(blimpHullGeo, blimpHullMat);
  blimpGroup.add(blimpHull);

  const blimpLedGeo = new THREE.BoxGeometry(10.2, 2.8, 16);
  const blimpLedMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: envCfg.trackside.ledRibbonHex,
    emissiveIntensity: isNight || isSunset ? 1.85 : 0.75,
  });
  const blimpLed = new THREE.Mesh(blimpLedGeo, blimpLedMat);
  blimpGroup.add(blimpLed);

  const blimpFinGeo = new THREE.BoxGeometry(0.4, 7.5, 6);
  const blimpFinMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
  const finV = new THREE.Mesh(blimpFinGeo, blimpFinMat);
  finV.position.set(0, 4.5, -18);
  blimpGroup.add(finV);
  group.add(blimpGroup);
  disposables.push(blimpHullGeo, blimpHullMat, blimpLedGeo, blimpLedMat, blimpFinGeo, blimpFinMat);

  // ============================================================================
  // 7. UPDATE & DISPOSAL API
  // ============================================================================
  const _vegasColor = new THREE.Color();
  const _mistRainTint = new THREE.Color(0x94a3b8);
  const _mistSunsetTint = new THREE.Color(0xfdba74);
  const _mistDayTint = new THREE.Color(0xe2e8f0);

  return {
    group,
    updateTime: (elapsedSec: number) => {
      skyUniforms.uTime.value = elapsedSec;
      cloudUniforms.uTime.value = elapsedSec;
      waterTimeUniform.value = elapsedSec;
      grassTimeUniform.value = elapsedSec;
      cloudSpriteGroup.rotation.y = elapsedSec * 0.008 * Math.max(0.4, envCfg.sky.windSpeed);

      for (let i = 0; i < animatedSpinners.length; i++) {
        animatedSpinners[i].rotation.z = elapsedSec * 0.09;
      }
      for (let i = 0; i < animatedYachts.length; i++) {
        const y = animatedYachts[i];
        y.obj.position.y = y.baseY + Math.sin(elapsedSec * 1.2 + y.phase) * 0.09;
        y.obj.rotation.z = Math.sin(elapsedSec * 0.9 + y.phase) * 0.015;
      }
      for (let i = 0; i < mistPlanes.length; i++) {
        const mp = mistPlanes[i];
        mp.obj.position.x = mp.baseX + Math.sin(elapsedSec * 0.14 + mp.phase) * 22;
      }
      if (vegasSphereMat) {
        _vegasColor.setHSL((elapsedSec * 0.05) % 1.0, 0.85, 0.52);
        vegasSphereMat.color.copy(_vegasColor);
        vegasSphereMat.emissive.copy(_vegasColor);
      }

      // Orbit broadcast blimp gently high above circuit
      const bAng = elapsedSec * 0.045;
      const bX = centerOffset.x + Math.cos(bAng) * 220;
      const bZ = centerOffset.z + Math.sin(bAng) * 190;
      blimpGroup.position.set(bX, 118 + Math.sin(elapsedSec * 0.4) * 2.5, bZ);
      blimpGroup.rotation.y = -bAng;
    },
    updateAtmosphere: (state: AtmosphereRuntimeState) => {
      skyUniforms.uSunDir.value.copy(state.sunDir).normalize();
      skyUniforms.uHorizonColor.value.copy(state.fogColor);
      skyUniforms.uZenithColor.value.copy(state.skyColor);
      if (state.cityGlowColor) {
        skyUniforms.uCityGlowColor.value.copy(state.cityGlowColor);
      }
      if (state.cloudTint) {
        cloudUniforms.uCloudTint.value.copy(state.cloudTint);
      }
      skyUniforms.uCloudCover.value = state.cloudCover;
      skyUniforms.uRainFactor.value = state.rainFactor;
      skyUniforms.uSunsetFactor.value = state.sunsetFactor;
      skyUniforms.uNightFactor.value = state.nightFactor;
      skyUniforms.uLightning.value = state.lightningFlash;

      cloudSpriteMat.opacity =
        state.nightFactor > 0.5
          ? 0.14
          : state.rainFactor > 0.2
            ? 0.34
            : 0.16 + state.cloudCover * 0.18;
      _cloudWeatherCol.setHex(state.sunsetFactor > 0.3 ? 0xfdba74 : 0x334155);
      cloudSpriteMat.color.lerpColors(
        _cloudDayCol,
        _cloudWeatherCol,
        Math.max(state.rainFactor, state.sunsetFactor)
      );

      // Update global valley mist opacity & tint dynamically
      const mistTarget = THREE.MathUtils.clamp(
        biomeBaseMist + state.rainFactor * 0.18 + Math.max(0, state.cloudCover - 0.5) * 0.12,
        0.02,
        0.3
      );
      mistMat.opacity = state.nightFactor > 0.5 ? mistTarget * 0.45 : mistTarget;
      mistMat.color.copy(_mistDayTint);
      if (state.sunsetFactor > 0.1) mistMat.color.lerp(_mistSunsetTint, state.sunsetFactor * 0.6);
      if (state.rainFactor > 0.1) mistMat.color.lerp(_mistRainTint, state.rainFactor * 0.7);

      // Show 3D jagged lightning bolts during thunderstorm flashes
      const showBolt = state.lightningFlash > 0.06;
      lightningMat.opacity = state.lightningFlash * 0.95;
      for (let i = 0; i < lightningBolts.length; i++) {
        lightningBolts[i].visible = showBolt;
      }
    },
    dispose: () => {
      for (let i = 0; i < disposables.length; i++) {
        disposables[i].dispose();
      }
    },
  };
}
