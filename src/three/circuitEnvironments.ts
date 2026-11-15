import { CircuitBiome, CircuitTrack, DrsZoneConfig, TimeOfDayMode, WeatherMode } from '../types/racing';

export type VegetationSpecies = 'pine' | 'palm' | 'oak' | 'sakura' | 'eucalyptus';
export type TerrainGroundStyle = 'grass' | 'desert' | 'park' | 'coastal';

export type HdrSkySignature =
  | 'marine_coast'
  | 'neon_skyline'
  | 'overcast_countryside'
  | 'misty_forest'
  | 'royal_parkland'
  | 'sakura_mountain'
  | 'desert_neon'
  | 'marina_twilight'
  | 'desert_dunes'
  | 'lusail_floodlit'
  | 'lakeside_cbd'
  | 'alpine_snow';

export interface CircuitEnvironmentConfig {
  biome: CircuitBiome;
  displayLabel: string;
  defaultWeather: WeatherMode;
  defaultTimeOfDay: TimeOfDayMode;
  sky: {
    zenithHex: number;
    horizonHex: number;
    cityGlowHex: number;
    baseCloudCover: number;
    cloudTintHex: number;
    windSpeed: number;
  };
  lighting: {
    sunAzimuthDeg: number;
    sunElevationOffsetDeg: number;
    sunColorTempK: number;
    sunColorHex: number;
    sunIntensityMult: number;
    hemiSkyHex: number;
    hemiGroundHex: number;
    hemiIntensityMult: number;
    rimLightHex: number;
    rimIntensityMult: number;
    envIntensity: number;
    exposureBias: number;
    nightFloodlightColor: number;
    alwaysFloodlitAtNightOrDusk: boolean;
  };
  fog: {
    hex: number;
    densityMult: number;
  };
  reflection: {
    hdrSignature: HdrSkySignature;
    skyHex: number;
    groundHex: number;
    keyPanelHex: number;
    rimPanelHex: number;
    bounceFloorHex: number;
    horizonStripHex: number;
    hdrSunRadiance: number;
    hdrSkyLuminance: number;
    hdrKeyPanelGlow: number;
    hdrRimPanelGlow: number;
    hdrHorizonGlow: number;
    hdrGroundBounce: number;
    waterSpecularBoost: number;
    bloomBias: number;
  };
  terrain: {
    groundStyle: TerrainGroundStyle;
    groundTintHex: number;
    ridgeAmp: number;
    snowCap: boolean;
    mountainNearLow: number;
    mountainNearHigh: number;
    mountainFarLow: number;
    mountainFarHigh: number;
  };
  water: {
    enabled: boolean;
    colorHex: number;
    harborEast: boolean;
    infieldLake: boolean;
  };
  vegetation: {
    species: VegetationSpecies;
    densityCount: number;
    cypressAccents: boolean;
  };
  trackside: {
    ledRibbonHex: number;
    ledSecondaryHex: number;
    canopyTintHex: number;
  };
}

/**
 * Physically based Planckian color-temperature approximation (1600K..12000K)
 * returning a packed 24-bit sRGB hex value for solar/floodlight temperature tinting.
 */
export function kelvinToHex(kelvin: number): number {
  const temp = Math.max(16, Math.min(120, kelvin / 100));
  let r: number;
  let g: number;
  let b: number;
  if (temp <= 66) {
    r = 255;
    g = Math.max(0, Math.min(255, 99.4708025861 * Math.log(temp) - 161.1195681661));
    b = temp <= 19 ? 0 : Math.max(0, Math.min(255, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
  } else {
    r = Math.max(0, Math.min(255, 329.698727446 * Math.pow(temp - 60, -0.1332047592)));
    g = Math.max(0, Math.min(255, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)));
    b = 255;
  }
  return ((Math.round(r) & 0xff) << 16) | ((Math.round(g) & 0xff) << 8) | (Math.round(b) & 0xff);
}

export const CIRCUIT_ENVIRONMENTS: Record<CircuitBiome, CircuitEnvironmentConfig> = {
  monaco: {
    biome: 'monaco',
    displayLabel: 'Mediterranean Riviera Coast & Port Hercule',
    defaultWeather: 'day',
    defaultTimeOfDay: 'midday',
    sky: {
      zenithHex: 0x0b5ed7,
      horizonHex: 0x8ad4ff,
      cityGlowHex: 0xf59e0b,
      baseCloudCover: 0.16,
      cloudTintHex: 0xffffff,
      windSpeed: 0.012,
    },
    lighting: {
      sunAzimuthDeg: 38,
      sunElevationOffsetDeg: 4,
      sunColorTempK: 5650,
      sunColorHex: 0xfff3d6,
      sunIntensityMult: 1.18,
      hemiSkyHex: 0x7dd3fc,
      hemiGroundHex: 0x3b4d3e,
      hemiIntensityMult: 1.06,
      rimLightHex: 0x7dd3fc,
      rimIntensityMult: 0.96,
      envIntensity: 1.22,
      exposureBias: 1.03,
      nightFloodlightColor: 0xfef3c7,
      alwaysFloodlitAtNightOrDusk: true,
    },
    fog: {
      hex: 0xa6dcff,
      densityMult: 0.72,
    },
    reflection: {
      hdrSignature: 'marine_coast',
      skyHex: 0x38bdf8,
      groundHex: 0x0e7490,
      keyPanelHex: 0xfffbeb,
      rimPanelHex: 0x7dd3fc,
      bounceFloorHex: 0x0c4a6e,
      horizonStripHex: 0xfde68a,
      hdrSunRadiance: 19.5,
      hdrSkyLuminance: 1.18,
      hdrKeyPanelGlow: 2.25,
      hdrRimPanelGlow: 1.35,
      hdrHorizonGlow: 1.28,
      hdrGroundBounce: 0.92,
      waterSpecularBoost: 1.25,
      bloomBias: 0.02,
    },
    terrain: {
      groundStyle: 'coastal',
      groundTintHex: 0x4b6b42,
      ridgeAmp: 34,
      snowCap: false,
      mountainNearLow: 0x3e523a,
      mountainNearHigh: 0x6f7c66,
      mountainFarLow: 0x5c7288,
      mountainFarHigh: 0x8ea3b8,
    },
    water: {
      enabled: true,
      colorHex: 0x0284c7,
      harborEast: true,
      infieldLake: false,
    },
    vegetation: {
      species: 'palm',
      densityCount: 420,
      cypressAccents: true,
    },
    trackside: {
      ledRibbonHex: 0xef4444,
      ledSecondaryHex: 0xf59e0b,
      canopyTintHex: 0xf8fafc,
    },
  },

  singapore: {
    biome: 'singapore',
    displayLabel: 'Marina Bay Tropical Night Skyline',
    defaultWeather: 'cloudy',
    defaultTimeOfDay: 'night',
    sky: {
      zenithHex: 0x050b1a,
      horizonHex: 0x102845,
      cityGlowHex: 0x0ea5e9,
      baseCloudCover: 0.56,
      cloudTintHex: 0x334155,
      windSpeed: 0.015,
    },
    lighting: {
      sunAzimuthDeg: 112,
      sunElevationOffsetDeg: 6,
      sunColorTempK: 6150,
      sunColorHex: 0xe0f2fe,
      sunIntensityMult: 1.12,
      hemiSkyHex: 0x38bdf8,
      hemiGroundHex: 0x0f172a,
      hemiIntensityMult: 1.14,
      rimLightHex: 0x22d3ee,
      rimIntensityMult: 1.28,
      envIntensity: 1.36,
      exposureBias: 1.14,
      nightFloodlightColor: 0xf8fafc,
      alwaysFloodlitAtNightOrDusk: true,
    },
    fog: {
      hex: 0x11243b,
      densityMult: 1.28,
    },
    reflection: {
      hdrSignature: 'neon_skyline',
      skyHex: 0x091326,
      groundHex: 0x082f49,
      keyPanelHex: 0xf8fafc,
      rimPanelHex: 0x38bdf8,
      bounceFloorHex: 0x0f172a,
      horizonStripHex: 0x22d3ee,
      hdrSunRadiance: 14.5,
      hdrSkyLuminance: 0.85,
      hdrKeyPanelGlow: 2.55,
      hdrRimPanelGlow: 2.15,
      hdrHorizonGlow: 1.95,
      hdrGroundBounce: 0.88,
      waterSpecularBoost: 1.15,
      bloomBias: 0.08,
    },
    terrain: {
      groundStyle: 'coastal',
      groundTintHex: 0x172b1f,
      ridgeAmp: 10,
      snowCap: false,
      mountainNearLow: 0x0b1524,
      mountainNearHigh: 0x1e293b,
      mountainFarLow: 0x0f172a,
      mountainFarHigh: 0x1e3a5f,
    },
    water: {
      enabled: true,
      colorHex: 0x0c1b2a,
      harborEast: true,
      infieldLake: false,
    },
    vegetation: {
      species: 'palm',
      densityCount: 380,
      cypressAccents: false,
    },
    trackside: {
      ledRibbonHex: 0x06b6d4,
      ledSecondaryHex: 0xec4899,
      canopyTintHex: 0x0f172a,
    },
  },

  silverstone: {
    biome: 'silverstone',
    displayLabel: 'British Countryside & Silverstone Wing',
    defaultWeather: 'cloudy',
    defaultTimeOfDay: 'afternoon',
    sky: {
      zenithHex: 0x4b637c,
      horizonHex: 0xaab8c6,
      cityGlowHex: 0x94a3b8,
      baseCloudCover: 0.72,
      cloudTintHex: 0xdbe3eb,
      windSpeed: 0.022,
    },
    lighting: {
      sunAzimuthDeg: 215,
      sunElevationOffsetDeg: -5,
      sunColorTempK: 6450,
      sunColorHex: 0xe6edf5,
      sunIntensityMult: 0.92,
      hemiSkyHex: 0xcbd5e1,
      hemiGroundHex: 0x283d25,
      hemiIntensityMult: 1.08,
      rimLightHex: 0xcbd5e1,
      rimIntensityMult: 0.68,
      envIntensity: 0.94,
      exposureBias: 0.98,
      nightFloodlightColor: 0xf1f5f9,
      alwaysFloodlitAtNightOrDusk: false,
    },
    fog: {
      hex: 0x9aa9b8,
      densityMult: 1.25,
    },
    reflection: {
      hdrSignature: 'overcast_countryside',
      skyHex: 0x94a3b8,
      groundHex: 0x2a4228,
      keyPanelHex: 0xe2e8f0,
      rimPanelHex: 0xcbd5e1,
      bounceFloorHex: 0x334155,
      horizonStripHex: 0xe2e8f0,
      hdrSunRadiance: 9.2,
      hdrSkyLuminance: 0.96,
      hdrKeyPanelGlow: 1.18,
      hdrRimPanelGlow: 0.95,
      hdrHorizonGlow: 0.85,
      hdrGroundBounce: 0.74,
      waterSpecularBoost: 0.0,
      bloomBias: -0.02,
    },
    terrain: {
      groundStyle: 'grass',
      groundTintHex: 0x3f6239,
      ridgeAmp: 9,
      snowCap: false,
      mountainNearLow: 0x2f472e,
      mountainNearHigh: 0x455f43,
      mountainFarLow: 0x4e6170,
      mountainFarHigh: 0x6a7c8c,
    },
    water: {
      enabled: false,
      colorHex: 0x1e3a8a,
      harborEast: false,
      infieldLake: false,
    },
    vegetation: {
      species: 'oak',
      densityCount: 520,
      cypressAccents: false,
    },
    trackside: {
      ledRibbonHex: 0x2563eb,
      ledSecondaryHex: 0xdc2626,
      canopyTintHex: 0xe2e8f0,
    },
  },

  spa: {
    biome: 'spa',
    displayLabel: 'Belgian Ardennes Forest & Misty Valley',
    defaultWeather: 'rain',
    defaultTimeOfDay: 'afternoon',
    sky: {
      zenithHex: 0x263445,
      horizonHex: 0x617283,
      cityGlowHex: 0x64748b,
      baseCloudCover: 0.84,
      cloudTintHex: 0x64748b,
      windSpeed: 0.025,
    },
    lighting: {
      sunAzimuthDeg: 185,
      sunElevationOffsetDeg: -4,
      sunColorTempK: 6750,
      sunColorHex: 0xdbeafe,
      sunIntensityMult: 0.88,
      hemiSkyHex: 0x94a3b8,
      hemiGroundHex: 0x1b2b1e,
      hemiIntensityMult: 0.98,
      rimLightHex: 0x94a3b8,
      rimIntensityMult: 0.64,
      envIntensity: 0.88,
      exposureBias: 0.96,
      nightFloodlightColor: 0xe2e8f0,
      alwaysFloodlitAtNightOrDusk: false,
    },
    fog: {
      hex: 0x526273,
      densityMult: 1.55,
    },
    reflection: {
      hdrSignature: 'misty_forest',
      skyHex: 0x475569,
      groundHex: 0x1b2e1f,
      keyPanelHex: 0xdbeafe,
      rimPanelHex: 0x94a3b8,
      bounceFloorHex: 0x1e293b,
      horizonStripHex: 0xcbd5e1,
      hdrSunRadiance: 7.8,
      hdrSkyLuminance: 0.78,
      hdrKeyPanelGlow: 0.95,
      hdrRimPanelGlow: 0.82,
      hdrHorizonGlow: 0.92,
      hdrGroundBounce: 0.62,
      waterSpecularBoost: 0.35,
      bloomBias: 0.01,
    },
    terrain: {
      groundStyle: 'grass',
      groundTintHex: 0x263f28,
      ridgeAmp: 28,
      snowCap: false,
      mountainNearLow: 0x1b2d21,
      mountainNearHigh: 0x2f4739,
      mountainFarLow: 0x334155,
      mountainFarHigh: 0x4b5d70,
    },
    water: {
      enabled: false,
      colorHex: 0x1e293b,
      harborEast: false,
      infieldLake: false,
    },
    vegetation: {
      species: 'pine',
      densityCount: 620,
      cypressAccents: false,
    },
    trackside: {
      ledRibbonHex: 0xeab308,
      ledSecondaryHex: 0xdc2626,
      canopyTintHex: 0x334155,
    },
  },

  monza: {
    biome: 'monza',
    displayLabel: 'Italian Royal Parkland & Temple of Speed',
    defaultWeather: 'day',
    defaultTimeOfDay: 'afternoon',
    sky: {
      zenithHex: 0x1453a8,
      horizonHex: 0x9dd5f7,
      cityGlowHex: 0xf59e0b,
      baseCloudCover: 0.22,
      cloudTintHex: 0xf8fafc,
      windSpeed: 0.011,
    },
    lighting: {
      sunAzimuthDeg: 52,
      sunElevationOffsetDeg: 2,
      sunColorTempK: 5450,
      sunColorHex: 0xfff5dc,
      sunIntensityMult: 1.14,
      hemiSkyHex: 0x93c5fd,
      hemiGroundHex: 0x2c422a,
      hemiIntensityMult: 1.02,
      rimLightHex: 0xbae6fd,
      rimIntensityMult: 0.84,
      envIntensity: 1.14,
      exposureBias: 1.01,
      nightFloodlightColor: 0xfef3c7,
      alwaysFloodlitAtNightOrDusk: false,
    },
    fog: {
      hex: 0xa6d2f2,
      densityMult: 0.84,
    },
    reflection: {
      hdrSignature: 'royal_parkland',
      skyHex: 0x60a5fa,
      groundHex: 0x28452a,
      keyPanelHex: 0xfffbeb,
      rimPanelHex: 0xbae6fd,
      bounceFloorHex: 0x3f4f3c,
      horizonStripHex: 0xfef08a,
      hdrSunRadiance: 17.0,
      hdrSkyLuminance: 1.1,
      hdrKeyPanelGlow: 1.85,
      hdrRimPanelGlow: 1.15,
      hdrHorizonGlow: 1.08,
      hdrGroundBounce: 0.78,
      waterSpecularBoost: 0.0,
      bloomBias: 0.0,
    },
    terrain: {
      groundStyle: 'park',
      groundTintHex: 0x385936,
      ridgeAmp: 12,
      snowCap: true,
      mountainNearLow: 0x2a452e,
      mountainNearHigh: 0x45634b,
      mountainFarLow: 0x465d75,
      mountainFarHigh: 0x6b849c,
    },
    water: {
      enabled: false,
      colorHex: 0x1e3a8a,
      harborEast: false,
      infieldLake: false,
    },
    vegetation: {
      species: 'pine',
      densityCount: 560,
      cypressAccents: true,
    },
    trackside: {
      ledRibbonHex: 0xdc2626,
      ledSecondaryHex: 0x16a34a,
      canopyTintHex: 0xe2e8f0,
    },
  },

  suzuka: {
    biome: 'suzuka',
    displayLabel: 'Japanese Countryside, Sakura & Mountain Peaks',
    defaultWeather: 'partly_cloudy',
    defaultTimeOfDay: 'morning',
    sky: {
      zenithHex: 0x1d68b8,
      horizonHex: 0xbde0fe,
      cityGlowHex: 0xf9a8d4,
      baseCloudCover: 0.34,
      cloudTintHex: 0xfff1f2,
      windSpeed: 0.013,
    },
    lighting: {
      sunAzimuthDeg: 78,
      sunElevationOffsetDeg: 3,
      sunColorTempK: 5250,
      sunColorHex: 0xffefd6,
      sunIntensityMult: 1.08,
      hemiSkyHex: 0xbae6fd,
      hemiGroundHex: 0x2b3f2b,
      hemiIntensityMult: 1.0,
      rimLightHex: 0xfbcfe8,
      rimIntensityMult: 0.86,
      envIntensity: 1.1,
      exposureBias: 1.02,
      nightFloodlightColor: 0xfef3c7,
      alwaysFloodlitAtNightOrDusk: false,
    },
    fog: {
      hex: 0xcbe4f9,
      densityMult: 0.95,
    },
    reflection: {
      hdrSignature: 'sakura_mountain',
      skyHex: 0x7dd3fc,
      groundHex: 0x2c4430,
      keyPanelHex: 0xfff5eb,
      rimPanelHex: 0xfbcfe8,
      bounceFloorHex: 0x374151,
      horizonStripHex: 0xfde68a,
      hdrSunRadiance: 15.8,
      hdrSkyLuminance: 1.08,
      hdrKeyPanelGlow: 1.75,
      hdrRimPanelGlow: 1.22,
      hdrHorizonGlow: 1.18,
      hdrGroundBounce: 0.76,
      waterSpecularBoost: 0.0,
      bloomBias: 0.01,
    },
    terrain: {
      groundStyle: 'grass',
      groundTintHex: 0x3b6138,
      ridgeAmp: 19,
      snowCap: true,
      mountainNearLow: 0x294230,
      mountainNearHigh: 0x456352,
      mountainFarLow: 0x475e78,
      mountainFarHigh: 0x758ca6,
    },
    water: {
      enabled: false,
      colorHex: 0x0284c7,
      harborEast: false,
      infieldLake: false,
    },
    vegetation: {
      species: 'sakura',
      densityCount: 540,
      cypressAccents: false,
    },
    trackside: {
      ledRibbonHex: 0xdc2626,
      ledSecondaryHex: 0xf8fafc,
      canopyTintHex: 0xf1f5f9,
    },
  },

  las_vegas: {
    biome: 'las_vegas',
    displayLabel: 'Neon Las Vegas Strip & Mojave Desert Night',
    defaultWeather: 'day',
    defaultTimeOfDay: 'night',
    sky: {
      zenithHex: 0x070514,
      horizonHex: 0x231138,
      cityGlowHex: 0xd946ef,
      baseCloudCover: 0.14,
      cloudTintHex: 0x3b1f54,
      windSpeed: 0.01,
    },
    lighting: {
      sunAzimuthDeg: 295,
      sunElevationOffsetDeg: 1,
      sunColorTempK: 4800,
      sunColorHex: 0xe9d5ff,
      sunIntensityMult: 1.06,
      hemiSkyHex: 0xa855f7,
      hemiGroundHex: 0x1c1426,
      hemiIntensityMult: 1.1,
      rimLightHex: 0xf472b6,
      rimIntensityMult: 1.38,
      envIntensity: 1.4,
      exposureBias: 1.16,
      nightFloodlightColor: 0xfef08a,
      alwaysFloodlitAtNightOrDusk: true,
    },
    fog: {
      hex: 0x1a102b,
      densityMult: 0.92,
    },
    reflection: {
      hdrSignature: 'desert_neon',
      skyHex: 0x130a26,
      groundHex: 0x1c1624,
      keyPanelHex: 0xf472b6,
      rimPanelHex: 0x38bdf8,
      bounceFloorHex: 0x2e1065,
      horizonStripHex: 0xc026d3,
      hdrSunRadiance: 13.8,
      hdrSkyLuminance: 0.88,
      hdrKeyPanelGlow: 2.65,
      hdrRimPanelGlow: 2.4,
      hdrHorizonGlow: 2.25,
      hdrGroundBounce: 0.94,
      waterSpecularBoost: 0.0,
      bloomBias: 0.1,
    },
    terrain: {
      groundStyle: 'desert',
      groundTintHex: 0x473629,
      ridgeAmp: 17,
      snowCap: false,
      mountainNearLow: 0x2b1f29,
      mountainNearHigh: 0x4a3142,
      mountainFarLow: 0x241930,
      mountainFarHigh: 0x452752,
    },
    water: {
      enabled: false,
      colorHex: 0x06b6d4,
      harborEast: false,
      infieldLake: false,
    },
    vegetation: {
      species: 'palm',
      densityCount: 130,
      cypressAccents: false,
    },
    trackside: {
      ledRibbonHex: 0xec4899,
      ledSecondaryHex: 0x38bdf8,
      canopyTintHex: 0x090d16,
    },
  },

  abu_dhabi: {
    biome: 'abu_dhabi',
    displayLabel: 'Yas Marina Waterfront & Arabian Twilight',
    defaultWeather: 'day',
    defaultTimeOfDay: 'sunset',
    sky: {
      zenithHex: 0x172554,
      horizonHex: 0xf97316,
      cityGlowHex: 0x06b6d4,
      baseCloudCover: 0.2,
      cloudTintHex: 0xfdba74,
      windSpeed: 0.011,
    },
    lighting: {
      sunAzimuthDeg: 252,
      sunElevationOffsetDeg: -3,
      sunColorTempK: 3450,
      sunColorHex: 0xffa94d,
      sunIntensityMult: 1.15,
      hemiSkyHex: 0x38bdf8,
      hemiGroundHex: 0x4d341c,
      hemiIntensityMult: 1.04,
      rimLightHex: 0x38bdf8,
      rimIntensityMult: 1.12,
      envIntensity: 1.28,
      exposureBias: 1.09,
      nightFloodlightColor: 0x38bdf8,
      alwaysFloodlitAtNightOrDusk: true,
    },
    fog: {
      hex: 0x8f4e38,
      densityMult: 0.88,
    },
    reflection: {
      hdrSignature: 'marina_twilight',
      skyHex: 0x1e3a8a,
      groundHex: 0x0e4f68,
      keyPanelHex: 0xffb347,
      rimPanelHex: 0x38bdf8,
      bounceFloorHex: 0x6b4f2d,
      horizonStripHex: 0xfb923c,
      hdrSunRadiance: 16.5,
      hdrSkyLuminance: 1.04,
      hdrKeyPanelGlow: 2.35,
      hdrRimPanelGlow: 1.95,
      hdrHorizonGlow: 1.78,
      hdrGroundBounce: 0.9,
      waterSpecularBoost: 1.2,
      bloomBias: 0.06,
    },
    terrain: {
      groundStyle: 'desert',
      groundTintHex: 0xc9a878,
      ridgeAmp: 13,
      snowCap: false,
      mountainNearLow: 0x6b4f34,
      mountainNearHigh: 0x99734d,
      mountainFarLow: 0x5c3a3e,
      mountainFarHigh: 0x9c624a,
    },
    water: {
      enabled: true,
      colorHex: 0x0891b2,
      harborEast: true,
      infieldLake: false,
    },
    vegetation: {
      species: 'palm',
      densityCount: 230,
      cypressAccents: false,
    },
    trackside: {
      ledRibbonHex: 0x06b6d4,
      ledSecondaryHex: 0xf59e0b,
      canopyTintHex: 0xf8fafc,
    },
  },

  bahrain: {
    biome: 'bahrain',
    displayLabel: 'Sakhir Desert Dunes & Floodlit Oasis',
    defaultWeather: 'day',
    defaultTimeOfDay: 'golden_hour',
    sky: {
      zenithHex: 0x1e4c8f,
      horizonHex: 0xf4b068,
      cityGlowHex: 0xf59e0b,
      baseCloudCover: 0.14,
      cloudTintHex: 0xfde68a,
      windSpeed: 0.014,
    },
    lighting: {
      sunAzimuthDeg: 232,
      sunElevationOffsetDeg: -2,
      sunColorTempK: 4250,
      sunColorHex: 0xffcf87,
      sunIntensityMult: 1.2,
      hemiSkyHex: 0xfcd34d,
      hemiGroundHex: 0x6e4f28,
      hemiIntensityMult: 1.02,
      rimLightHex: 0xfde68a,
      rimIntensityMult: 0.92,
      envIntensity: 1.18,
      exposureBias: 1.05,
      nightFloodlightColor: 0xfef3c7,
      alwaysFloodlitAtNightOrDusk: true,
    },
    fog: {
      hex: 0xd9a870,
      densityMult: 1.12,
    },
    reflection: {
      hdrSignature: 'desert_dunes',
      skyHex: 0x93c5fd,
      groundHex: 0x855e34,
      keyPanelHex: 0xffd28a,
      rimPanelHex: 0xfde68a,
      bounceFloorHex: 0x7c582e,
      horizonStripHex: 0xf59e0b,
      hdrSunRadiance: 18.2,
      hdrSkyLuminance: 1.12,
      hdrKeyPanelGlow: 2.15,
      hdrRimPanelGlow: 1.45,
      hdrHorizonGlow: 1.52,
      hdrGroundBounce: 1.08,
      waterSpecularBoost: 0.0,
      bloomBias: 0.03,
    },
    terrain: {
      groundStyle: 'desert',
      groundTintHex: 0xdcb985,
      ridgeAmp: 15,
      snowCap: false,
      mountainNearLow: 0x785838,
      mountainNearHigh: 0xb08758,
      mountainFarLow: 0x8f6e49,
      mountainFarHigh: 0xc9a374,
    },
    water: {
      enabled: false,
      colorHex: 0x0891b2,
      harborEast: false,
      infieldLake: false,
    },
    vegetation: {
      species: 'palm',
      densityCount: 180,
      cypressAccents: false,
    },
    trackside: {
      ledRibbonHex: 0xf59e0b,
      ledSecondaryHex: 0xef4444,
      canopyTintHex: 0xfef3c7,
    },
  },

  qatar: {
    biome: 'qatar',
    displayLabel: 'Lusail Desert Architecture & Night Floodlights',
    defaultWeather: 'day',
    defaultTimeOfDay: 'night',
    sky: {
      zenithHex: 0x060b1c,
      horizonHex: 0x1e2948,
      cityGlowHex: 0xf59e0b,
      baseCloudCover: 0.18,
      cloudTintHex: 0x334155,
      windSpeed: 0.012,
    },
    lighting: {
      sunAzimuthDeg: 145,
      sunElevationOffsetDeg: 2,
      sunColorTempK: 5100,
      sunColorHex: 0xfef3c7,
      sunIntensityMult: 1.16,
      hemiSkyHex: 0x60a5fa,
      hemiGroundHex: 0x332718,
      hemiIntensityMult: 1.08,
      rimLightHex: 0xfbbf24,
      rimIntensityMult: 1.2,
      envIntensity: 1.3,
      exposureBias: 1.12,
      nightFloodlightColor: 0xfef08a,
      alwaysFloodlitAtNightOrDusk: true,
    },
    fog: {
      hex: 0x1b233a,
      densityMult: 1.04,
    },
    reflection: {
      hdrSignature: 'lusail_floodlit',
      skyHex: 0x0b152b,
      groundHex: 0x382b1d,
      keyPanelHex: 0xfef08a,
      rimPanelHex: 0x38bdf8,
      bounceFloorHex: 0x2b2218,
      horizonStripHex: 0xfbbf24,
      hdrSunRadiance: 16.0,
      hdrSkyLuminance: 0.88,
      hdrKeyPanelGlow: 2.5,
      hdrRimPanelGlow: 1.85,
      hdrHorizonGlow: 1.72,
      hdrGroundBounce: 0.96,
      waterSpecularBoost: 0.0,
      bloomBias: 0.07,
    },
    terrain: {
      groundStyle: 'desert',
      groundTintHex: 0xc29e6c,
      ridgeAmp: 11,
      snowCap: false,
      mountainNearLow: 0x453422,
      mountainNearHigh: 0x6e5438,
      mountainFarLow: 0x26293d,
      mountainFarHigh: 0x4b4238,
    },
    water: {
      enabled: false,
      colorHex: 0x0891b2,
      harborEast: false,
      infieldLake: false,
    },
    vegetation: {
      species: 'palm',
      densityCount: 200,
      cypressAccents: false,
    },
    trackside: {
      ledRibbonHex: 0x8b5cf6,
      ledSecondaryHex: 0xf59e0b,
      canopyTintHex: 0xf1f5f9,
    },
  },

  melbourne: {
    biome: 'melbourne',
    displayLabel: 'Albert Park Lake, Eucalyptus Parkland & CBD Skyline',
    defaultWeather: 'partly_cloudy',
    defaultTimeOfDay: 'midday',
    sky: {
      zenithHex: 0x0c59c2,
      horizonHex: 0x99dcff,
      cityGlowHex: 0x38bdf8,
      baseCloudCover: 0.3,
      cloudTintHex: 0xffffff,
      windSpeed: 0.015,
    },
    lighting: {
      sunAzimuthDeg: 28,
      sunElevationOffsetDeg: 3,
      sunColorTempK: 5750,
      sunColorHex: 0xfff8eb,
      sunIntensityMult: 1.16,
      hemiSkyHex: 0x7dd3fc,
      hemiGroundHex: 0x294a2d,
      hemiIntensityMult: 1.07,
      rimLightHex: 0xbae6fd,
      rimIntensityMult: 0.88,
      envIntensity: 1.16,
      exposureBias: 1.03,
      nightFloodlightColor: 0xfef3c7,
      alwaysFloodlitAtNightOrDusk: false,
    },
    fog: {
      hex: 0xb2e1ff,
      densityMult: 0.78,
    },
    reflection: {
      hdrSignature: 'lakeside_cbd',
      skyHex: 0x38bdf8,
      groundHex: 0x1f523a,
      keyPanelHex: 0xfffbeb,
      rimPanelHex: 0xbae6fd,
      bounceFloorHex: 0x22543d,
      horizonStripHex: 0xe0f2fe,
      hdrSunRadiance: 17.8,
      hdrSkyLuminance: 1.14,
      hdrKeyPanelGlow: 1.9,
      hdrRimPanelGlow: 1.3,
      hdrHorizonGlow: 1.16,
      hdrGroundBounce: 0.86,
      waterSpecularBoost: 1.05,
      bloomBias: 0.01,
    },
    terrain: {
      groundStyle: 'park',
      groundTintHex: 0x416e3a,
      ridgeAmp: 7,
      snowCap: false,
      mountainNearLow: 0x2c4a31,
      mountainNearHigh: 0x496b4d,
      mountainFarLow: 0x56748f,
      mountainFarHigh: 0x7c98b0,
    },
    water: {
      enabled: true,
      colorHex: 0x0284c7,
      harborEast: false,
      infieldLake: true,
    },
    vegetation: {
      species: 'eucalyptus',
      densityCount: 540,
      cypressAccents: false,
    },
    trackside: {
      ledRibbonHex: 0x10b981,
      ledSecondaryHex: 0xfacc15,
      canopyTintHex: 0xf8fafc,
    },
  },

  alpine: {
    biome: 'alpine',
    displayLabel: 'Styrian Alps Snow Peaks & Spruce Valley',
    defaultWeather: 'partly_cloudy',
    defaultTimeOfDay: 'midday',
    sky: {
      zenithHex: 0x124fa1,
      horizonHex: 0xa2d6fc,
      cityGlowHex: 0x38bdf8,
      baseCloudCover: 0.36,
      cloudTintHex: 0xf8fafc,
      windSpeed: 0.014,
    },
    lighting: {
      sunAzimuthDeg: 45,
      sunElevationOffsetDeg: 4,
      sunColorTempK: 5950,
      sunColorHex: 0xfff5e4,
      sunIntensityMult: 1.14,
      hemiSkyHex: 0x93c5fd,
      hemiGroundHex: 0x243b27,
      hemiIntensityMult: 1.02,
      rimLightHex: 0xe0f2fe,
      rimIntensityMult: 0.94,
      envIntensity: 1.18,
      exposureBias: 1.01,
      nightFloodlightColor: 0xfef3c7,
      alwaysFloodlitAtNightOrDusk: false,
    },
    fog: {
      hex: 0xb2d8f5,
      densityMult: 0.85,
    },
    reflection: {
      hdrSignature: 'alpine_snow',
      skyHex: 0x60a5fa,
      groundHex: 0x233b27,
      keyPanelHex: 0xfffbeb,
      rimPanelHex: 0xbae6fd,
      bounceFloorHex: 0x334155,
      horizonStripHex: 0xfef9c3,
      hdrSunRadiance: 18.0,
      hdrSkyLuminance: 1.16,
      hdrKeyPanelGlow: 1.95,
      hdrRimPanelGlow: 1.38,
      hdrHorizonGlow: 1.24,
      hdrGroundBounce: 0.82,
      waterSpecularBoost: 0.0,
      bloomBias: 0.0,
    },
    terrain: {
      groundStyle: 'grass',
      groundTintHex: 0x345534,
      ridgeAmp: 26,
      snowCap: true,
      mountainNearLow: 0x263c2d,
      mountainNearHigh: 0x455b4e,
      mountainFarLow: 0x4c6278,
      mountainFarHigh: 0x7b93ab,
    },
    water: {
      enabled: false,
      colorHex: 0x0284c7,
      harborEast: false,
      infieldLake: false,
    },
    vegetation: {
      species: 'pine',
      densityCount: 580,
      cypressAccents: false,
    },
    trackside: {
      ledRibbonHex: 0xdc2626,
      ledSecondaryHex: 0xf8fafc,
      canopyTintHex: 0xe2e8f0,
    },
  },
};

export function resolveCircuitBiome(track: CircuitTrack): CircuitBiome {
  if (track.biome) return track.biome;
  const id = track.id.toLowerCase();
  if (id.includes('monaco')) return 'monaco';
  if (id.includes('marina') || id.includes('singapore')) return 'singapore';
  if (id.includes('silverstone')) return 'silverstone';
  if (id.includes('spa')) return 'spa';
  if (id.includes('suzuka')) return 'suzuka';
  if (id.includes('vegas')) return 'las_vegas';
  if (id.includes('yas') || id.includes('abu')) return 'abu_dhabi';
  if (id.includes('bahrain') || id.includes('sakhir')) return 'bahrain';
  if (id.includes('qatar') || id.includes('lusail')) return 'qatar';
  if (id.includes('melbourne') || id.includes('albert')) return 'melbourne';
  if (id.includes('alpine')) return 'alpine';
  return 'monza';
}

export function getCircuitEnvironmentConfig(track: CircuitTrack): CircuitEnvironmentConfig {
  return CIRCUIT_ENVIRONMENTS[resolveCircuitBiome(track)];
}

export interface TimeOfDayProfile {
  elevationDeg: number;
  azimuthShiftDeg: number;
  sunHex: number;
  sunIntensity: number;
  zenithBlendHex: number;
  horizonBlendHex: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  rimIntensityMult: number;
  reflectionMult: number;
  exposureMult: number;
  sunsetFactor: number;
  nightFactor: number;
  volumetricStrength: number;
}

export function getTimeOfDayProfile(tod: TimeOfDayMode): TimeOfDayProfile {
  switch (tod) {
    case 'morning':
      return {
        elevationDeg: 24,
        azimuthShiftDeg: -36,
        sunHex: 0xffe8c2,
        sunIntensity: 2.25,
        zenithBlendHex: 0x1d5db3,
        horizonBlendHex: 0xcbe8ff,
        hemiSkyHex: 0xbae6fd,
        hemiGroundHex: 0x2d3f2e,
        hemiIntensity: 0.94,
        rimIntensityMult: 0.92,
        reflectionMult: 0.98,
        exposureMult: 0.98,
        sunsetFactor: 0.25,
        nightFactor: 0.0,
        volumetricStrength: 0.28,
      };
    case 'midday':
      return {
        elevationDeg: 62,
        azimuthShiftDeg: 0,
        sunHex: 0xfff8ea,
        sunIntensity: 2.65,
        zenithBlendHex: 0x0b52b5,
        horizonBlendHex: 0x9ed8ff,
        hemiSkyHex: 0x93c5fd,
        hemiGroundHex: 0x2a3b2a,
        hemiIntensity: 0.98,
        rimIntensityMult: 0.85,
        reflectionMult: 1.04,
        exposureMult: 0.96,
        sunsetFactor: 0.0,
        nightFactor: 0.0,
        volumetricStrength: 0.18,
      };
    case 'afternoon':
      return {
        elevationDeg: 40,
        azimuthShiftDeg: 28,
        sunHex: 0xfff0d1,
        sunIntensity: 2.42,
        zenithBlendHex: 0x1754a8,
        horizonBlendHex: 0xaad6f5,
        hemiSkyHex: 0x93c5fd,
        hemiGroundHex: 0x2c3b29,
        hemiIntensity: 0.94,
        rimIntensityMult: 0.9,
        reflectionMult: 1.0,
        exposureMult: 1.0,
        sunsetFactor: 0.12,
        nightFactor: 0.0,
        volumetricStrength: 0.24,
      };
    case 'golden_hour':
      return {
        elevationDeg: 17,
        azimuthShiftDeg: 54,
        sunHex: 0xffc66e,
        sunIntensity: 2.75,
        zenithBlendHex: 0x1e3f7a,
        horizonBlendHex: 0xf4ae66,
        hemiSkyHex: 0xfcd34d,
        hemiGroundHex: 0x47331a,
        hemiIntensity: 0.95,
        rimIntensityMult: 1.06,
        reflectionMult: 1.12,
        exposureMult: 1.04,
        sunsetFactor: 0.62,
        nightFactor: 0.0,
        volumetricStrength: 0.44,
      };
    case 'sunset':
      return {
        elevationDeg: 9,
        azimuthShiftDeg: 74,
        sunHex: 0xff9a44,
        sunIntensity: 2.85,
        zenithBlendHex: 0x221b47,
        horizonBlendHex: 0xeb6a38,
        hemiSkyHex: 0x7dd3fc,
        hemiGroundHex: 0x3f1d0b,
        hemiIntensity: 0.92,
        rimIntensityMult: 1.15,
        reflectionMult: 1.16,
        exposureMult: 1.06,
        sunsetFactor: 1.0,
        nightFactor: 0.08,
        volumetricStrength: 0.58,
      };
    case 'night':
    default:
      return {
        elevationDeg: 32,
        azimuthShiftDeg: 110,
        sunHex: 0xcbd5e1,
        sunIntensity: 1.28,
        zenithBlendHex: 0x050914,
        horizonBlendHex: 0x101c33,
        hemiSkyHex: 0x38bdf8,
        hemiGroundHex: 0x0f172a,
        hemiIntensity: 0.88,
        rimIntensityMult: 1.24,
        reflectionMult: 1.22,
        exposureMult: 1.1,
        sunsetFactor: 0.0,
        nightFactor: 1.0,
        volumetricStrength: 0.0,
      };
  }
}

export interface WeatherAtmosphereProfile {
  cloudCoverAdd: number;
  cloudOverride: number | null;
  fogDensityMult: number;
  fogOverrideHex: number | null;
  sunDim: number;
  hemiDim: number;
  rimDim: number;
  reflectionMult: number;
  exposureMult: number;
  rainFactor: number;
  rainOpacity: number;
  rainSize: number;
  rainAudio: number;
  wetnessTarget: number;
}

export function getWeatherAtmosphereProfile(weather: WeatherMode): WeatherAtmosphereProfile {
  switch (weather) {
    case 'partly_cloudy':
      return {
        cloudCoverAdd: 0.16,
        cloudOverride: null,
        fogDensityMult: 1.05,
        fogOverrideHex: null,
        sunDim: 0.94,
        hemiDim: 1.0,
        rimDim: 0.96,
        reflectionMult: 0.98,
        exposureMult: 1.0,
        rainFactor: 0.0,
        rainOpacity: 0,
        rainSize: 0.65,
        rainAudio: 0,
        wetnessTarget: 0,
      };
    case 'cloudy':
      return {
        cloudCoverAdd: 0.35,
        cloudOverride: 0.74,
        fogDensityMult: 1.45,
        fogOverrideHex: 0x8fa0b3,
        sunDim: 0.68,
        hemiDim: 1.06,
        rimDim: 0.84,
        reflectionMult: 0.9,
        exposureMult: 0.97,
        rainFactor: 0.05,
        rainOpacity: 0,
        rainSize: 0.65,
        rainAudio: 0,
        wetnessTarget: 0.12,
      };
    case 'fog':
      return {
        cloudCoverAdd: 0.28,
        cloudOverride: 0.68,
        fogDensityMult: 3.1,
        fogOverrideHex: 0x9aa8b8,
        sunDim: 0.56,
        hemiDim: 1.08,
        rimDim: 0.78,
        reflectionMult: 0.84,
        exposureMult: 0.95,
        rainFactor: 0.12,
        rainOpacity: 0,
        rainSize: 0.65,
        rainAudio: 0,
        wetnessTarget: 0.25,
      };
    case 'rain':
      return {
        cloudCoverAdd: 0.45,
        cloudOverride: 0.86,
        fogDensityMult: 2.35,
        fogOverrideHex: 0x3b4859,
        sunDim: 0.54,
        hemiDim: 0.96,
        rimDim: 0.88,
        reflectionMult: 1.08,
        exposureMult: 1.02,
        rainFactor: 0.7,
        rainOpacity: 0.62,
        rainSize: 0.65,
        rainAudio: 0.06,
        wetnessTarget: 0.74,
      };
    case 'heavy_rain':
      return {
        cloudCoverAdd: 0.55,
        cloudOverride: 0.96,
        fogDensityMult: 3.55,
        fogOverrideHex: 0x263244,
        sunDim: 0.42,
        hemiDim: 0.86,
        rimDim: 0.82,
        reflectionMult: 1.12,
        exposureMult: 1.04,
        rainFactor: 1.0,
        rainOpacity: 0.84,
        rainSize: 0.86,
        rainAudio: 0.12,
        wetnessTarget: 1.0,
      };
    case 'snow':
      return {
        cloudCoverAdd: 0.50,
        cloudOverride: 0.90,
        fogDensityMult: 2.8,
        fogOverrideHex: 0xd8e2ec,
        sunDim: 0.65,
        hemiDim: 1.15,
        rimDim: 0.95,
        reflectionMult: 1.25,
        exposureMult: 1.08,
        rainFactor: 0.4,
        rainOpacity: 0.55,
        rainSize: 0.95,
        rainAudio: 0.04,
        wetnessTarget: 0.85,
      };
    case 'blizzard':
      return {
        cloudCoverAdd: 0.65,
        cloudOverride: 1.0,
        fogDensityMult: 4.8,
        fogOverrideHex: 0xc4d2e2,
        sunDim: 0.28,
        hemiDim: 0.92,
        rimDim: 0.85,
        reflectionMult: 1.35,
        exposureMult: 1.12,
        rainFactor: 0.9,
        rainOpacity: 0.88,
        rainSize: 1.2,
        rainAudio: 0.14,
        wetnessTarget: 1.0,
      };
    case 'sunset':
    case 'night':
    case 'day':
    default:
      return {
        cloudCoverAdd: 0,
        cloudOverride: null,
        fogDensityMult: 1.0,
        fogOverrideHex: null,
        sunDim: 1.0,
        hemiDim: 1.0,
        rimDim: 1.0,
        reflectionMult: 1.0,
        exposureMult: 1.0,
        rainFactor: 0.0,
        rainOpacity: 0,
        rainSize: 0.65,
        rainAudio: 0,
        wetnessTarget: 0,
      };
  }
}

const DEFAULT_FALLBACK_DRS_ZONES: DrsZoneConfig[] = [
  {
    id: 'default_drs_1',
    zoneNumber: 1,
    name: 'Main Pit Straight',
    realLengthMeters: 750,
    detectionT: 0.92,
    startT: 0.01,
    endT: 0.16,
  },
];

export function wrapTrackT(t: number): number {
  return ((t % 1) + 1) % 1;
}

export function isTrackTinDrsInterval(t: number, startT: number, endT: number): boolean {
  const nt = wrapTrackT(t);
  const s = wrapTrackT(startT);
  const e = wrapTrackT(endT);
  if (s <= e) {
    return nt >= s && nt <= e;
  }
  return nt >= s || nt <= e;
}

export function getDrsZoneSpanT(zone: DrsZoneConfig): number {
  const s = wrapTrackT(zone.startT);
  const e = wrapTrackT(zone.endT);
  return s <= e ? e - s : 1 - s + e;
}

export function getDrsZoneRemainingRatio(t: number, zone: DrsZoneConfig): number {
  const nt = wrapTrackT(t);
  const s = wrapTrackT(zone.startT);
  const e = wrapTrackT(zone.endT);
  const span = Math.max(0.001, getDrsZoneSpanT(zone));
  let remT = 0;
  if (s <= e) {
    remT = Math.max(0, e - nt);
  } else {
    remT = nt >= s ? 1 - nt + e : Math.max(0, e - nt);
  }
  return Math.max(0, Math.min(1, remT / span));
}

export function getTrackForwardDeltaT(fromT: number, toT: number): number {
  return wrapTrackT(wrapTrackT(toT) - wrapTrackT(fromT));
}

export function didCrossTrackT(prevT: number, curT: number, targetT: number): boolean {
  const p = wrapTrackT(prevT);
  const c = wrapTrackT(curT);
  const tgt = wrapTrackT(targetT);
  if (Math.abs(c - p) < 1e-6) return false;
  if (p < c) {
    // Only consider forward wrap < 0.5
    if (c - p > 0.5) return false;
    return p < tgt && tgt <= c;
  }
  // Crossed 0/1 boundary moving forward
  if (1 - p + c > 0.5) return false;
  return tgt > p || tgt <= c;
}

export function getCircuitDrsZones(track: CircuitTrack): DrsZoneConfig[] {
  if (track.drsZones && track.drsZones.length > 0) {
    return track.drsZones;
  }
  return DEFAULT_FALLBACK_DRS_ZONES;
}

export function findActiveDrsZoneAtT(zones: DrsZoneConfig[], t: number): DrsZoneConfig | null {
  for (let i = 0; i < zones.length; i++) {
    if (isTrackTinDrsInterval(t, zones[i].startT, zones[i].endT)) {
      return zones[i];
    }
  }
  return null;
}

export function findApproachingDrsZone(
  zones: DrsZoneConfig[],
  t: number,
  trackLengthKm: number
): { zone: DrsZoneConfig; metersToEntry: number } | null {
  let bestZone: DrsZoneConfig | null = null;
  let bestDeltaT = Infinity;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (isTrackTinDrsInterval(t, z.startT, z.endT)) continue;
    const dT = getTrackForwardDeltaT(t, z.startT);
    if (dT > 0 && dT < bestDeltaT) {
      bestDeltaT = dT;
      bestZone = z;
    }
  }
  if (!bestZone) return null;
  const metersToEntry = Math.round(bestDeltaT * Math.max(1000, trackLengthKm * 1000));
  if (metersToEntry > 260) return null;
  return { zone: bestZone, metersToEntry };
}

