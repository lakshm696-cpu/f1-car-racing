import {
  ContactPatchState,
  PlannedPitStop,
  PlannedStopHudStatus,
  PreRacePitStrategy,
  TimeOfDayMode,
  TyreCompound,
  TyreContactPatchTelemetry,
  WeatherMode,
} from '../types/racing';

export interface GForceVector {
  gLat: number; // Positive = turn left / force right, Negative = turn right / force left
  gLong: number; // Positive = acceleration, Negative = braking deceleration
  gTotal: number;
}

export interface CockpitCameraOffsets {
  pitch: number; // Radians to tilt camera down/up
  roll: number; // Radians to tilt camera sideways
  yaw: number; // Radians to pan camera (look to apex / cornering inertia)
  offsetFwd: number; // Meters displacement along forward axis (head moving fwd under braking)
  offsetRight: number; // Meters displacement along right axis (head swaying in corner)
  offsetY: number; // Meters vertical displacement (chassis compression / curb jolt)
  buffetShake: number; // High-speed aerodynamic turbulence intensity
}

export interface CockpitHeadPhysicsState {
  offsetFwd: number;
  offsetRight: number;
  offsetY: number;
  pitch: number;
  roll: number;
  yaw: number;
  velFwd: number;
  velRight: number;
  velY: number;
  velPitch: number;
  velRoll: number;
  velYaw: number;
  buffetShake: number;
}

export interface StrategyCalculationResult {
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

export interface StintLapPoint {
  lap: number;
  compound: TyreCompound;
  tyreWearStartPct: number;
  tyreWearEndPct: number;
  fuelStartPct: number;
  fuelEndPct: number;
  isPitLap: boolean;
  pitToCompound?: TyreCompound;
  refuelTargetPct?: number;
}

export interface StrategyProjection {
  lapPoints: StintLapPoint[];
  fuelBurnPerLapPct: number;
  fuelMarginLaps: number;
  runsOutOfFuelLap: number | null;
  minTyreWearPct: number;
  fuelWeightDeltaSecPerLap: number;
  estimatedPitTimeTotalSec: number;
  stints: Array<{
    stintNumber: number;
    startLap: number;
    endLap: number;
    compound: TyreCompound;
    laps: number;
  }>;
}

const GRAVITY = 9.80665;
const PIT_STOP_TRANSIT_LOSS = 20.5; // Average F1 pit lane delta in seconds
export const BASE_FUEL_BURN_PER_LAP_PCT = 14.5; // ~14.5% per race lap (so >6 laps requires fuel planning or 1-stop refuel)

export function getCompoundWearPerLap(compound: TyreCompound, weather: WeatherMode | 'wet' = 'day'): number {
  const isWetWeather = weather === 'rain' || weather === 'heavy_rain' || weather === 'wet';
  if (compound === 'soft') return isWetWeather ? 26 : 18.5;
  if (compound === 'medium') return isWetWeather ? 23 : 12.2;
  if (compound === 'hard') return isWetWeather ? 20 : 8.1;
  return isWetWeather ? 11.5 : 22.0; // wet tyre wears fast on dry track
}

export function buildDefaultPitStrategy(
  totalLaps: number,
  weather: WeatherMode,
  preferredStartingCompound?: TyreCompound
): PreRacePitStrategy {
  const laps = Math.max(1, Math.round(totalLaps));
  const isWet = weather === 'rain' || weather === 'heavy_rain';
  const startCmp: TyreCompound = isWet
    ? 'wet'
    : preferredStartingCompound && preferredStartingCompound !== 'wet'
      ? preferredStartingCompound
      : laps <= 4
        ? 'soft'
        : 'medium';

  if (laps <= 3) {
    return {
      totalLaps: laps,
      startingCompound: startCmp,
      startingFuelPct: Math.min(100, Math.max(55, Math.round(laps * BASE_FUEL_BURN_PER_LAP_PCT + 14))),
      stops: [],
    };
  }

  if (laps <= 8) {
    const pitLap = Math.max(1, Math.min(laps - 1, Math.round(laps * 0.45)));
    const nextCmp: TyreCompound = isWet ? 'wet' : startCmp === 'soft' ? 'medium' : 'hard';
    const secondStintLaps = laps - pitLap;
    return {
      totalLaps: laps,
      startingCompound: startCmp,
      startingFuelPct: Math.min(100, Math.max(50, Math.round(pitLap * BASE_FUEL_BURN_PER_LAP_PCT + 15))),
      stops: [
        {
          id: 'stop_1',
          stopNumber: 1,
          pitLap,
          compound: nextCmp,
          fuelLoadPct: Math.min(100, Math.max(45, Math.round(secondStintLaps * BASE_FUEL_BURN_PER_LAP_PCT + 16))),
        },
      ],
    };
  }

  // 9+ lap races default to balanced 2-stop or 1-stop long strategy
  const stop1Lap = Math.max(1, Math.min(laps - 2, Math.round(laps * 0.34)));
  const stop2Lap = Math.max(stop1Lap + 1, Math.min(laps - 1, Math.round(laps * 0.68)));
  return {
    totalLaps: laps,
    startingCompound: startCmp,
    startingFuelPct: Math.min(100, Math.max(55, Math.round(stop1Lap * BASE_FUEL_BURN_PER_LAP_PCT + 15))),
    stops: [
      {
        id: 'stop_1',
        stopNumber: 1,
        pitLap: stop1Lap,
        compound: isWet ? 'wet' : 'hard',
        fuelLoadPct: Math.min(100, Math.max(50, Math.round((stop2Lap - stop1Lap) * BASE_FUEL_BURN_PER_LAP_PCT + 16))),
      },
      {
        id: 'stop_2',
        stopNumber: 2,
        pitLap: stop2Lap,
        compound: isWet ? 'wet' : 'soft',
        fuelLoadPct: Math.min(100, Math.max(45, Math.round((laps - stop2Lap) * BASE_FUEL_BURN_PER_LAP_PCT + 16))),
      },
    ],
  };
}

export function normalizePitStrategyPlan(plan: PreRacePitStrategy): PreRacePitStrategy {
  const totalLaps = Math.max(1, Math.min(30, Math.round(plan.totalLaps)));
  const sortedStops = [...plan.stops]
    .filter((s) => totalLaps >= 2)
    .map((s) => ({
      ...s,
      pitLap: Math.max(1, Math.min(totalLaps - 1, Math.round(s.pitLap))),
      fuelLoadPct: Math.max(30, Math.min(100, Math.round(s.fuelLoadPct))),
    }))
    .sort((a, b) => a.pitLap - b.pitLap);

  // Deduplicate same-lap stops by nudging subsequent stops forward when possible
  const deduped: PlannedPitStop[] = [];
  for (const s of sortedStops) {
    let lap = s.pitLap;
    while (deduped.some((d) => d.pitLap === lap) && lap < totalLaps - 1) {
      lap++;
    }
    if (!deduped.some((d) => d.pitLap === lap)) {
      deduped.push({
        ...s,
        stopNumber: deduped.length + 1,
        pitLap: lap,
      });
    }
  }

  return {
    totalLaps,
    startingCompound: plan.startingCompound,
    startingFuelPct: Math.max(35, Math.min(100, Math.round(plan.startingFuelPct))),
    stops: deduped.slice(0, 3),
  };
}

export function simulateStrategyProjection(
  rawPlan: PreRacePitStrategy,
  weather: WeatherMode = 'day'
): StrategyProjection {
  const plan = normalizePitStrategyPlan(rawPlan);
  const fuelBurnPerLapPct = Number(
    Math.min(26, Math.max(8, (100 / Math.max(5.5, plan.totalLaps * 0.72)))).toFixed(1)
  );
  // Real-race alignment: shorter races still burn realistic noticeable % per lap
  const effectiveBurn = Math.max(7.5, Math.min(24, plan.totalLaps <= 5 ? 16 : fuelBurnPerLapPct));

  const lapPoints: StintLapPoint[] = [];
  const stints: StrategyProjection['stints'] = [];

  let curCompound: TyreCompound = plan.startingCompound;
  let curWear = 100;
  let curFuel = plan.startingFuelPct;
  let minWear = 100;
  let runsOutOfFuelLap: number | null = null;
  let stintStartLap = 1;
  let stintCount = 1;
  let pitTimeTotal = 0;

  for (let lap = 1; lap <= plan.totalLaps; lap++) {
    const startWear = curWear;
    const startFuel = curFuel;
    const wearLoss = getCompoundWearPerLap(curCompound, weather);
    curWear = Math.max(0, Number((curWear - wearLoss).toFixed(1)));
    curFuel = Math.max(0, Number((curFuel - effectiveBurn).toFixed(1)));
    if (curWear < minWear) minWear = curWear;
    if (curFuel <= 0.1 && runsOutOfFuelLap === null) {
      runsOutOfFuelLap = lap;
    }

    const stopOnLap = plan.stops.find((s) => s.pitLap === lap);
    lapPoints.push({
      lap,
      compound: curCompound,
      tyreWearStartPct: startWear,
      tyreWearEndPct: curWear,
      fuelStartPct: startFuel,
      fuelEndPct: curFuel,
      isPitLap: Boolean(stopOnLap),
      pitToCompound: stopOnLap?.compound,
      refuelTargetPct: stopOnLap?.fuelLoadPct,
    });

    if (stopOnLap) {
      stints.push({
        stintNumber: stintCount++,
        startLap: stintStartLap,
        endLap: lap,
        compound: curCompound,
        laps: lap - stintStartLap + 1,
      });
      const fuelAdded = Math.max(0, stopOnLap.fuelLoadPct - curFuel);
      pitTimeTotal += PIT_STOP_TRANSIT_LOSS + fuelAdded * 0.035;
      curCompound = stopOnLap.compound;
      curWear = 100;
      curFuel = Math.max(curFuel, stopOnLap.fuelLoadPct);
      stintStartLap = lap + 1;
    }
  }

  stints.push({
    stintNumber: stintCount,
    startLap: stintStartLap,
    endLap: plan.totalLaps,
    compound: curCompound,
    laps: Math.max(1, plan.totalLaps - stintStartLap + 1),
  });

  const endFuel = lapPoints[lapPoints.length - 1]?.fuelEndPct ?? 0;
  const fuelMarginLaps = Number((endFuel / effectiveBurn).toFixed(1));
  const fuelWeightDeltaSecPerLap = Number((((plan.startingFuelPct - 50) / 50) * 0.24).toFixed(2));

  return {
    lapPoints,
    fuelBurnPerLapPct: effectiveBurn,
    fuelMarginLaps,
    runsOutOfFuelLap,
    minTyreWearPct: Math.round(minWear),
    fuelWeightDeltaSecPerLap,
    estimatedPitTimeTotalSec: Number(pitTimeTotal.toFixed(1)),
    stints,
  };
}

/**
 * Calculates authentic instantaneous G-forces acting on car and driver.
 */
export function calculateGForces(
  currentSpeedMs: number,
  prevSpeedMs: number,
  turnRateRadPerSec: number,
  dt: number
): GForceVector {
  const safeDt = Math.max(0.001, dt);
  const accelMs2 = (currentSpeedMs - prevSpeedMs) / safeDt;
  const gLongRaw = accelMs2 / GRAVITY;
  // F1 longitudinal Gs: Braking can reach ~ -5.5G, Acceleration ~ +2.0G
  const gLong = Math.max(-5.5, Math.min(2.2, gLongRaw));

  // Centripetal acceleration: a = v * w
  const centripetalMs2 = currentSpeedMs * turnRateRadPerSec;
  const gLatRaw = centripetalMs2 / GRAVITY;
  // F1 lateral Gs: Up to ~ 5.2G in high speed sweepers
  const gLat = Math.max(-5.2, Math.min(5.2, gLatRaw));

  const gTotal = Math.sqrt(gLong * gLong + gLat * gLat);

  return {
    gLat: Number(gLat.toFixed(2)),
    gLong: Number(gLong.toFixed(2)),
    gTotal: Number(gTotal.toFixed(2)),
  };
}

/**
 * Calculates viscoelastic driver head movement and cockpit camera response
 * to longitudinal braking/acceleration Gs, lateral cornering Gs, and serrated curb impacts.
 */
export function calculateCockpitGOffset(
  gLong: number,
  gLat: number,
  speedKmh: number,
  onKerb: boolean,
  timeSec: number
): CockpitCameraOffsets {
  // Progressive HANS-collar & 6-point harness saturation (linear at low G, tethered at >3.8G)
  const effGLong = gLong * 0.55 + Math.tanh(gLong / 3.8) * 3.8 * 0.45;
  const effGLat = gLat * 0.58 + Math.tanh(gLat / 3.6) * 3.6 * 0.42;

  // Longitudinal pitch & forward helmet surge (braking gLong < 0 pitches head down > 0 and forward > 0)
  const kerbFreq = Math.max(35, Math.min(115, speedKmh * 0.36));
  const kerbSawtooth = onKerb
    ? Math.sin(timeSec * kerbFreq) * 0.65 + Math.sin(timeSec * kerbFreq * 2.0) * 0.35
    : 0;
  const kerbIntensity = onKerb ? Math.min(1.0, Math.max(0.25, speedKmh / 220)) : 0;

  const pitch = -effGLong * 0.024 + kerbSawtooth * kerbIntensity * 0.012;
  const offsetFwd = -effGLong * 0.046;
  const offsetY =
    -Math.abs(effGLong) * 0.018 -
    Math.abs(effGLat) * 0.008 +
    kerbSawtooth * kerbIntensity * 0.022;

  // Lateral cornering head tilt (roll), lateral sway, and inertial yaw
  const roll = -effGLat * 0.026 + Math.cos(timeSec * kerbFreq * 0.85) * kerbIntensity * 0.016;
  const offsetRight = -effGLat * 0.036;
  const yaw = -effGLat * 0.019;

  let buffetShake = 0;
  if (speedKmh > 230) {
    const speedFactor = Math.min(1.0, (speedKmh - 230) / 100);
    buffetShake = speedFactor * 0.038;
  }

  if (onKerb) {
    buffetShake += 0.045;
  }

  return {
    pitch,
    roll,
    yaw,
    offsetFwd,
    offsetRight,
    offsetY,
    buffetShake,
  };
}

export function createInitialCockpitHeadState(): CockpitHeadPhysicsState {
  return {
    offsetFwd: 0,
    offsetRight: 0,
    offsetY: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    velFwd: 0,
    velRight: 0,
    velY: 0,
    velPitch: 0,
    velRoll: 0,
    velYaw: 0,
    buffetShake: 0,
  };
}

/**
 * Steps a 6-DOF viscoelastic mass-spring-damper model for the driver's head and helmet inside the cockpit.
 * Simulates neck muscle bracing, HANS collar rebound, gear-shift kick, and curb impact impulses.
 */
export function stepCockpitHeadPhysics(
  state: CockpitHeadPhysicsState,
  target: CockpitCameraOffsets,
  steerAngleRad: number,
  shiftFlash: number,
  onKerb: boolean,
  offTrack: boolean,
  dt: number
): CockpitHeadPhysicsState {
  const safeDt = Math.max(0.001, Math.min(0.05, dt));

  const stepSpring = (
    pos: number,
    vel: number,
    goal: number,
    omega: number,
    zeta: number,
    minVal: number,
    maxVal: number
  ): [number, number] => {
    const stiffness = omega * omega;
    const damping = 2 * zeta * omega;
    const accel = stiffness * (goal - pos) - damping * vel;
    const nextVel = vel + accel * safeDt;
    const nextPos = Math.max(minVal, Math.min(maxVal, pos + nextVel * safeDt));
    return [nextPos, nextVel];
  };

  // Gear-shift longitudinal jolt (brief rearward impulse during upshift torque interruption/re-engagement)
  const shiftKickFwd = shiftFlash > 0.35 ? -shiftFlash * 0.022 : 0;
  const shiftKickPitch = shiftFlash > 0.35 ? -shiftFlash * 0.014 : 0;

  // Off-track gravel/grass vertical & roll roughness
  const offTrackBumpY = offTrack ? Math.sin(performance.now() * 0.042) * 0.016 : 0;
  const offTrackRoll = offTrack ? Math.cos(performance.now() * 0.036) * 0.012 : 0;

  // Anticipatory neck yaw into the corner combined with lateral G inertial yaw
  const apexSteerYaw = steerAngleRad * 0.14;

  const [offsetFwd, velFwd] = stepSpring(
    state.offsetFwd,
    state.velFwd,
    target.offsetFwd + shiftKickFwd,
    15.5,
    0.82,
    -0.09,
    0.16
  );

  const [offsetRight, velRight] = stepSpring(
    state.offsetRight,
    state.velRight,
    target.offsetRight,
    13.2,
    0.76,
    -0.11,
    0.11
  );

  const [offsetY, velY] = stepSpring(
    state.offsetY,
    state.velY,
    target.offsetY + offTrackBumpY,
    onKerb ? 22.0 : 17.5,
    onKerb ? 0.65 : 0.78,
    -0.08,
    0.06
  );

  const [pitch, velPitch] = stepSpring(
    state.pitch,
    state.velPitch,
    target.pitch + shiftKickPitch,
    14.5,
    0.80,
    -0.14,
    0.16
  );

  const [roll, velRoll] = stepSpring(
    state.roll,
    state.velRoll,
    target.roll + offTrackRoll,
    13.8,
    0.75,
    -0.16,
    0.16
  );

  const [yaw, velYaw] = stepSpring(
    state.yaw,
    state.velYaw,
    target.yaw + apexSteerYaw,
    12.5,
    0.84,
    -0.22,
    0.22
  );

  return {
    offsetFwd,
    offsetRight,
    offsetY,
    pitch,
    roll,
    yaw,
    velFwd,
    velRight,
    velY,
    velPitch,
    velRoll,
    velYaw,
    buffetShake: target.buffetShake,
  };
}

/**
 * Calculates hardcore race strategy, optimal pit window, tyre degradation, undercut potential,
 * and evaluates live progress against the pre-planned race pit strategy.
 */
export function calculatePitStrategy(
  currentLap: number,
  totalLaps: number,
  tyreCompound: TyreCompound,
  tyreWearPct: number,
  trackWetnessPct: number,
  gapAheadSeconds: number | null,
  playerPosition: number,
  totalRacers: number,
  fuelPct = 100,
  strategyPlan?: PreRacePitStrategy,
  completedStopIds?: ReadonlySet<string>
): StrategyCalculationResult {
  const windowStart = Math.max(1, Math.floor(totalLaps * 0.35));
  const windowEnd = Math.max(windowStart, Math.min(totalLaps - 1, Math.ceil(totalLaps * 0.65)));
  const isWindowOpen = currentLap >= windowStart && currentLap <= windowEnd;

  let tyreDegradationStage: 'fresh' | 'optimal' | 'degrading' | 'cliff';
  if (tyreWearPct > 80) {
    tyreDegradationStage = 'fresh';
  } else if (tyreWearPct > 55) {
    tyreDegradationStage = 'optimal';
  } else if (tyreWearPct > 28) {
    tyreDegradationStage = 'degrading';
  } else {
    tyreDegradationStage = 'cliff';
  }

  let recommendedCompound: TyreCompound;
  const remainingLaps = Math.max(1, totalLaps - currentLap);

  if (trackWetnessPct > 45) {
    recommendedCompound = 'wet';
  } else if (remainingLaps <= 2) {
    recommendedCompound = 'soft';
  } else if (remainingLaps <= 5) {
    recommendedCompound = tyreCompound === 'medium' ? 'soft' : 'medium';
  } else {
    recommendedCompound = 'hard';
  }

  const undercutViable =
    isWindowOpen &&
    gapAheadSeconds !== null &&
    gapAheadSeconds > 0 &&
    gapAheadSeconds <= 2.8 &&
    playerPosition > 1;

  const undercutDeltaSec = undercutViable ? Number((1.4 + Math.random() * 0.6).toFixed(1)) : null;

  const estimatedPlacesLost = Math.round(PIT_STOP_TRANSIT_LOSS / 2.8);
  const predictedExitPosition = Math.min(totalRacers, playerPosition + estimatedPlacesLost);

  const plannedStops: PlannedStopHudStatus[] = (strategyPlan?.stops ?? []).map((stop) => ({
    ...stop,
    completed: Boolean(completedStopIds?.has(stop.id)),
  }));
  const nextPlannedStop = plannedStops.find((s) => !s.completed) ?? null;

  const burnPerLap = Math.max(7.5, Math.min(24, totalLaps <= 5 ? 16 : 100 / Math.max(5.5, totalLaps * 0.72)));
  const estimatedFuelLapsRemaining = Number((fuelPct / burnPerLap).toFixed(1));

  let tacticalRadioCall: string | null = null;
  if (trackWetnessPct > 50 && tyreCompound !== 'wet') {
    tacticalRadioCall = 'BOX BOX: Track wetness critical. Inters/Wets standing by!';
  } else if (tyreDegradationStage === 'cliff') {
    tacticalRadioCall = 'BOX THIS LAP: Tyres at critical cliff. Box now for fresh compound!';
  } else if (nextPlannedStop && currentLap === nextPlannedStop.pitLap) {
    tacticalRadioCall = `SCHEDULED STOP L${nextPlannedStop.pitLap}: Box this lap for ${nextPlannedStop.compound.toUpperCase()} + ${nextPlannedStop.fuelLoadPct}% fuel.`;
  } else if (undercutViable) {
    tacticalRadioCall = `UNDERCUT WINDOW OPEN: Gap ahead ${gapAheadSeconds?.toFixed(1)}s. Box this lap to jump them!`;
  } else if (isWindowOpen && currentLap === windowStart) {
    tacticalRadioCall = `PIT WINDOW OPEN: Optimal pit window active (Laps ${windowStart}-${windowEnd}).`;
  }

  return {
    pitWindowStartLap: windowStart,
    pitWindowEndLap: windowEnd,
    isWindowOpen,
    recommendedCompound: nextPlannedStop?.compound ?? recommendedCompound,
    estimatedPitLossSec: PIT_STOP_TRANSIT_LOSS,
    undercutViable,
    undercutDeltaSec,
    predictedExitPosition,
    tyreDegradationStage,
    tacticalRadioCall,
    startingCompound: strategyPlan?.startingCompound ?? tyreCompound,
    startingFuelPct: strategyPlan?.startingFuelPct ?? 100,
    plannedStops,
    nextPlannedStop,
    estimatedFuelLapsRemaining,
  };
}

/**
 * Calculates live asphalt track surface temperature (°C) from weather, solar elevation (time of day),
 * evaporative cooling from track wetness, and frictional heat from rubbering-in progression.
 */
export function calculateTrackTemperatureC(
  weather: WeatherMode,
  timeOfDay: TimeOfDayMode | undefined,
  trackWetnessRatio: number,
  trackRubberLevel: number,
  elapsedSec: number
): number {
  const baseByWeather: Record<WeatherMode, number> = {
    day: 38,
    partly_cloudy: 33,
    sunset: 27,
    cloudy: 25,
    rain: 19,
    heavy_rain: 16,
    fog: 20,
    night: 22,
  };

  const solarDeltaByTime: Record<TimeOfDayMode, number> = {
    morning: -4.5,
    midday: +5.5,
    afternoon: +3.5,
    golden_hour: -1.5,
    sunset: -4.0,
    night: -7.5,
  };

  const weatherBase = baseByWeather[weather] ?? 32;
  const solarOffset = timeOfDay ? (solarDeltaByTime[timeOfDay] ?? 0) : 0;
  // Evaporative cooling from standing water / dampness (-8.5°C at 100% wetness)
  const wetCooling = Math.max(0, Math.min(1, trackWetnessRatio)) * -8.5;
  // Frictional energy deposited into racing line rubber (+3.2°C at full rubbering-in)
  const rubberHeating = Math.max(0, Math.min(1, trackRubberLevel)) * 3.2;
  // Subtle micro-thermal wind/cloud fluctuation
  const microWave = Math.sin(elapsedSec * 0.08) * 0.6;

  const tempC = Math.max(11, Math.min(56, weatherBase + solarOffset + wetCooling + rubberHeating + microWave));
  return Number(tempC.toFixed(1));
}

export interface ContactPatchPhysicsInput {
  speedMs: number;
  lateralVelMs: number;
  steerAngleRad: number;
  throttleIn: number;
  brakeIn: number;
  gLat: number;
  gLong: number;
  compound: TyreCompound;
  tyreWearPct: number;
  sectorGripPct: number; // Current sector surface grip (0..100)
  trackTemperatureC: number; // Current asphalt temperature (°C)
  trackWetnessRatio: number; // 0..1
  absAssist: boolean;
  tcMode: 'off' | 'medium' | 'full';
  prevGrainingSeverityPct: number;
  prevWheelSurfaceTempC?: [number, number, number, number];
  prevWheelCoreTempC?: [number, number, number, number];
  dt: number;
}

/**
 * Hardcore Pro Simulation: Microscopic Brush-Model Tyre Contact Patch Calculus.
 *
 * Models elastomeric tread bristles entering the contact patch leading edge:
 * - Adhesion Zone: Bristles deflect elastically with road micro-asperities.
 * - Micro-Slip Zone: Trailing-edge bristles exceed local static friction limit (governed by `sectorGripPct`
 *   and vertical aero/mechanical load) and begin microscopic sliding prior to full macro-skid.
 * - Graining Probability: Calculated from the interaction of high micro-slip shearing with suboptimal
 *   `trackTemperatureC` (cold/green tearing where rubber surface shears before viscoelastic bulk compliance)
 *   and reduced `sectorGripPct` (surface micro-sliding across low-grip asphalt).
 */
export function calculateTyreContactPatchPhysics(
  input: ContactPatchPhysicsInput
): TyreContactPatchTelemetry {
  const safeDt = Math.max(0.001, Math.min(0.1, input.dt));
  const absSpeed = Math.abs(input.speedMs);
  const speedKmh = absSpeed * 3.6;

  // 1. Compound Viscoelastic Operating Windows (Track Temp °C & Tread Surface Temp °C)
  const compoundSpecs: Record<
    TyreCompound,
    {
      optTrackMin: number;
      optTrackMax: number;
      optSurfMin: number;
      optSurfMax: number;
      bristleStiffness: number;
      grainSensitivity: number;
    }
  > = {
    soft: {
      optTrackMin: 26,
      optTrackMax: 42,
      optSurfMin: 85,
      optSurfMax: 104,
      bristleStiffness: 1.18,
      grainSensitivity: 1.32,
    },
    medium: {
      optTrackMin: 29,
      optTrackMax: 46,
      optSurfMin: 90,
      optSurfMax: 110,
      bristleStiffness: 1.0,
      grainSensitivity: 1.0,
    },
    hard: {
      optTrackMin: 33,
      optTrackMax: 52,
      optSurfMin: 96,
      optSurfMax: 116,
      bristleStiffness: 0.86,
      grainSensitivity: 0.78,
    },
    wet: {
      optTrackMin: 12,
      optTrackMax: 29,
      optSurfMin: 58,
      optSurfMax: 84,
      bristleStiffness: 1.08,
      grainSensitivity: 1.15,
    },
  };

  const spec = compoundSpecs[input.compound];

  // 2. Vertical Aero Load & Effective Contact Patch Footprint Area Ratio (0.55..1.15)
  const aeroDownforceNorm = Math.min(1.0, (speedKmh / 315) * (speedKmh / 315));
  const sectorMicroAsperity = Math.max(0.4, Math.min(1.05, input.sectorGripPct / 100));
  const grainingFootprintLoss = (input.prevGrainingSeverityPct / 100) * 0.14;
  const contactAreaRatio = Number(
    Math.max(
      0.55,
      Math.min(
        1.15,
        0.74 + aeroDownforceNorm * 0.34 + (sectorMicroAsperity - 0.85) * 0.25 - grainingFootprintLoss
      )
    ).toFixed(3)
  );

  // 3. Per-Wheel Normal Load Distribution [FL, FR, RL, RR] from gLong & gLat weight transfer
  // Braking (gLong < 0) shifts load forward; Turning left (gLat > 0) shifts load to right-side tyres
  const pitchTransfer = Math.max(-0.32, Math.min(0.32, -input.gLong * 0.065));
  const rollTransfer = Math.max(-0.34, Math.min(0.34, input.gLat * 0.068));

  const wheelLoads: [number, number, number, number] = [
    Math.max(0.25, 1.0 + pitchTransfer - rollTransfer), // FL
    Math.max(0.25, 1.0 + pitchTransfer + rollTransfer), // FR
    Math.max(0.25, 1.0 - pitchTransfer - rollTransfer), // RL
    Math.max(0.25, 1.0 - pitchTransfer + rollTransfer), // RR
  ];

  // 4. Longitudinal & Lateral Bristle Shear Demand vs Sector Grip Capacity
  const lateralSlipAngleNorm =
    absSpeed > 2.5
      ? Math.min(1.2, Math.abs(input.lateralVelMs) / Math.max(8.5, absSpeed * 0.19) + Math.abs(input.steerAngleRad) * 0.85)
      : 0;

  const tcFactor = input.tcMode === 'full' ? 0.58 : input.tcMode === 'medium' ? 0.8 : 1.15;
  const absFactor = input.absAssist ? 0.64 : 1.18;

  const tractionDemand =
    input.throttleIn *
    (absSpeed < 58 ? 0.55 : 0.26) *
    tcFactor *
    (1.0 + (1.0 - sectorMicroAsperity) * 0.85);
  const brakingDemand =
    input.brakeIn *
    (absSpeed > 25 ? 0.52 : 0.24) *
    absFactor *
    (1.0 + (1.0 - sectorMicroAsperity) * 0.75);

  // Available local boundary friction μ_local directly scaled by sectorGripPct & track temperature match
  const coldTrackDelta = Math.max(0, spec.optTrackMin - input.trackTemperatureC);
  const hotTrackDelta = Math.max(0, input.trackTemperatureC - spec.optTrackMax);
  const thermalGripEfficiency = Math.max(
    0.68,
    1.0 - coldTrackDelta * 0.014 - hotTrackDelta * 0.011
  );
  const effectiveMuCapacity = Math.max(
    0.35,
    sectorMicroAsperity * thermalGripEfficiency * (0.78 + (input.tyreWearPct / 100) * 0.22)
  );

  // Brush Model dimensionless slip parameter θ * σ (ratio of shear stress to max static adhesion)
  const wheelMicroSlipPct: [number, number, number, number] = [0, 0, 0, 0];
  const prevTemps = input.prevWheelSurfaceTempC ?? [
    input.trackTemperatureC + 52,
    input.trackTemperatureC + 52,
    input.trackTemperatureC + 55,
    input.trackTemperatureC + 55,
  ];
  const prevCoreTemps = input.prevWheelCoreTempC ?? [
    prevTemps[0] + 2,
    prevTemps[1] + 2,
    prevTemps[2] + 3,
    prevTemps[3] + 3,
  ];
  const wheelSurfaceTempC: [number, number, number, number] = [0, 0, 0, 0];
  const wheelCoreTempC: [number, number, number, number] = [0, 0, 0, 0];

  let sumMicroSlip = 0;
  for (let i = 0; i < 4; i++) {
    const isFront = i < 2;
    const load = wheelLoads[i];
    // Load sensitivity: higher normal load slightly reduces normalized friction coefficient (tyre load sensitivity)
    const loadEfficiency = Math.max(0.75, 1.08 - (load - 1.0) * 0.18);
    const wheelLongDemand = isFront ? brakingDemand * 1.18 : tractionDemand * 1.24 + brakingDemand * 0.72;
    const wheelLatDemand = lateralSlipAngleNorm * (isFront ? 1.08 + Math.abs(input.steerAngleRad) * 0.45 : 0.96);

    const combinedDemand = Math.sqrt(wheelLongDemand * wheelLongDemand + wheelLatDemand * wheelLatDemand);
    // Brush model trailing-edge micro-slip fraction: s_micro = 1 - (1 - min(1, demand / (3 * mu)))^3
    const normalizedStress = Math.min(
      1.0,
      (combinedDemand * spec.bristleStiffness) / Math.max(0.32, effectiveMuCapacity * loadEfficiency * 1.45)
    );
    const bristleSlipRatio = Math.min(1.0, 1.0 - Math.pow(1.0 - normalizedStress, 2.4));
    const wheelPct = Math.round(bristleSlipRatio * 100);
    wheelMicroSlipPct[i] = wheelPct;
    sumMicroSlip += bristleSlipRatio;

    // Flash surface temperature thermodynamics driven by trackTemperatureC + frictional micro-slip power
    const ambientTarget =
      input.trackTemperatureC +
      (input.compound === 'wet' ? 34 : 52) +
      (speedKmh / 330) * 16 -
      input.trackWetnessRatio * 14;
    const frictionFlashHeat = bristleSlipRatio * (absSpeed / 75) * 42 * load;
    const targetWheelTemp = Math.max(
      input.trackTemperatureC + 10,
      Math.min(142, ambientTarget + frictionFlashHeat)
    );
    const prevT = prevTemps[i] ?? targetWheelTemp;
    const alpha = Math.min(1, safeDt * 3.8);
    const surfTemp = Math.round(prevT + (targetWheelTemp - prevT) * alpha);
    wheelSurfaceTempC[i] = surfTemp;

    // Bulk carcass/core temperature thermodynamics: slower thermal inertia driven by conduction from surface,
    // internal sidewall flexing hysteresis under vertical/cornering load, and carbon brake drum radiant heat
    const carcassHysteresisHeat =
      (load - 0.85) * 14 +
      (Math.abs(input.gLat) * 2.4 + Math.abs(input.gLong) * 1.9) * (absSpeed / 68);
    const brakeDrumRadiation = input.brakeIn * (isFront ? 9.5 : 6.2);
    const targetCoreTemp = Math.max(
      input.trackTemperatureC + 14,
      Math.min(
        138,
        surfTemp * 0.68 +
          ambientTarget * 0.32 +
          carcassHysteresisHeat +
          brakeDrumRadiation
      )
    );
    const prevCoreT = prevCoreTemps[i] ?? targetCoreTemp;
    const alphaCore = Math.min(1, safeDt * 0.72);
    wheelCoreTempC[i] = Math.round(prevCoreT + (targetCoreTemp - prevCoreT) * alphaCore);
  }

  const microSlipRatio = Number(Math.max(0, Math.min(1, sumMicroSlip / 4)).toFixed(3));
  const microSlipPct = Math.round(microSlipRatio * 100);
  // Brush model static adhesion zone fraction (complement of trailing-edge micro-slip zone)
  const adhesionRatio = Number(Math.max(0, Math.min(1, 1 - microSlipRatio * 0.88)).toFixed(3));

  // 5. Real-time Graining Probability Calculus based on sectorGripPct & trackTemperatureC
  // Graining occurs when:
  // (a) Track temperature is cooler than compound optimal window (cold tearing of surface rubber over cool carcass)
  // (b) Sector surface grip is low (car slides micro-laterally across abrasive asperities instead of keying in)
  // (c) High micro-slip shear stress is applied across the tread bristles
  // (d) Or slick tyres are run on a damp/cooling surface or wet tyres on a hot dry track
  const avgSurfTemp =
    (wheelSurfaceTempC[0] + wheelSurfaceTempC[1] + wheelSurfaceTempC[2] + wheelSurfaceTempC[3]) * 0.25;
  const coldSurfaceDeficit = Math.max(0, spec.optSurfMin - avgSurfTemp);
  const trackColdFactor = Math.min(1.0, coldTrackDelta / 12 + coldSurfaceDeficit / 22);
  const sectorLowGripFactor = Math.max(0, Math.min(1.0, (96 - input.sectorGripPct) / 38));
  const wrongCompoundThermalMismatch =
    input.compound === 'wet' && input.trackWetnessRatio < 0.22
      ? 0.55 + Math.max(0, input.trackTemperatureC - 24) * 0.025
      : input.compound !== 'wet' && input.trackWetnessRatio > 0.28
        ? 0.48
        : 0;

  // Instantaneous graining probability combines micro-slip energy with thermal/surface susceptibility
  const slipExcitation = Math.max(0, microSlipRatio - 0.08) * 1.35;
  const thermalSurfaceSusceptibility =
    0.22 +
    trackColdFactor * 0.62 +
    sectorLowGripFactor * 0.58 +
    wrongCompoundThermalMismatch;
  const rawGrainingProb =
    slipExcitation * thermalSurfaceSusceptibility * spec.grainSensitivity * 100 +
    (trackColdFactor * sectorLowGripFactor * 24) +
    input.prevGrainingSeverityPct * 0.22;

  const grainingProbabilityPct = Math.round(Math.max(0, Math.min(100, rawGrainingProb)));

  // Accumulated Graining Severity: builds up when grainingProbabilityPct > 38%, cleans up when driven smoothly in optimal window
  let grainingDelta = 0;
  if (grainingProbabilityPct > 38 && absSpeed > 15) {
    grainingDelta = ((grainingProbabilityPct - 38) / 62) * 2.6 * safeDt;
  } else if (
    microSlipPct < 24 &&
    avgSurfTemp >= spec.optSurfMin &&
    avgSurfTemp <= spec.optSurfMax
  ) {
    // Smooth driving in optimal temperature window scrubs away surface graining ribbons
    grainingDelta = -1.4 * safeDt;
  } else {
    grainingDelta = -0.35 * safeDt;
  }
  const grainingSeverityPct = Number(
    Math.max(0, Math.min(100, input.prevGrainingSeverityPct + grainingDelta)).toFixed(1)
  );

  // 6. Determine Microscopic Contact Patch State
  let patchState: ContactPatchState = 'stick';
  if (microSlipPct >= 68) {
    patchState = 'macro_slide';
  } else if (avgSurfTemp > spec.optSurfMax + 8 && microSlipPct >= 30) {
    patchState = 'thermal_blister';
  } else if (grainingProbabilityPct >= 48 || grainingSeverityPct >= 35) {
    patchState = 'graining_risk';
  } else if (microSlipPct >= 18) {
    patchState = 'micro_slip';
  }

  // 7. Physical Feedback Multipliers for RacingEngine
  // Optimal bristle deflection (~8-18% micro-slip) yields peak cornering bite (1.03x);
  // excessive micro-slip or graining degrades effective road grip down to 0.84x
  const optimalSlipBonus =
    microSlipPct >= 6 && microSlipPct <= 22 && grainingSeverityPct < 25 ? 0.03 : 0;
  const excessSlipPenalty = Math.max(0, (microSlipRatio - 0.32) * 0.16);
  const grainingGripLoss = (grainingSeverityPct / 100) * 0.11 + (grainingProbabilityPct > 65 ? 0.03 : 0);
  const gripPenaltyMultiplier = Number(
    Math.max(0.84, Math.min(1.04, 1.0 + optimalSlipBonus - excessSlipPenalty - grainingGripLoss)).toFixed(3)
  );

  const wearRateMultiplier = Number(
    Math.max(
      0.9,
      Math.min(
        1.85,
        0.94 + microSlipRatio * 0.48 + (grainingProbabilityPct / 100) * 0.35 + (grainingSeverityPct / 100) * 0.28
      )
    ).toFixed(3)
  );

  return {
    trackTemperatureC: input.trackTemperatureC,
    contactAreaRatio,
    adhesionRatio,
    microSlipRatio,
    microSlipPct,
    grainingProbabilityPct,
    grainingSeverityPct: Math.round(grainingSeverityPct),
    wheelMicroSlipPct,
    wheelSurfaceTempC,
    wheelCoreTempC,
    patchState,
    gripPenaltyMultiplier,
    wearRateMultiplier,
  };
}

export interface TrackSurfaceEvolutionInput {
  completedRaceLaps: number;
  gridCount: number;
  playerTotalProgress: number;
  totalLaps: number;
  sectorDepositionAccum: [number, number, number]; // Normalized per-sector rubber deposition from active cars
  sectorCurvatureLoad?: [number, number, number]; // Relative cornering/braking shear factor per sector (0.8..1.25)
  trackWetnessRatio: number; // 0..1 rain washout factor
  compound: TyreCompound;
  sectorHazardMultipliers?: [number, number, number]; // Active oil/debris grip multipliers per sector
}

export interface TrackSurfaceEvolutionResult {
  trackRubberLevel: number; // 0..1 overall track rubbering-in level
  sectorRubberLevels: [number, number, number]; // 0..1 per-sector rubbering-in progression [S1, S2, S3]
  sectorGripPct: [number, number, number]; // 0..100 surfaceGripPct along the racing line in [S1, S2, S3]
  offLineSlipMultiplier: number; // 0.78..0.96 grip multiplier in off-line marble zones
}

/**
 * Progressive Track Surface Evolution & Racing Line Rubbering-In Calculus.
 *
 * Models how Formula cars lay down heated vulcanized tyre polymer along the optimal racing line
 * as laps progress while sweeping dust and shedding rubber marbles ("clag") toward the off-line edges:
 * - As laps progress, `sectorRubberLevels` and `trackRubberLevel` increase non-linearly (with rain washout).
 * - Updates the racing-line `surfaceGripPct` values in the `sectorGripPct` array (`[S1, S2, S3]`),
 *   climbing from a "green" track baseline (~87–90% dry) up to 99–100% when fully rubbered-in.
 * - Simultaneously computes the off-line marble slipperiness multiplier as shed rubber clag accumulates.
 */
export function calculateTrackSurfaceEvolution(
  input: TrackSurfaceEvolutionInput
): TrackSurfaceEvolutionResult {
  const safeGrid = Math.max(1, input.gridCount);
  const safeTotalLaps = Math.max(1, input.totalLaps);
  const wet = Math.max(0, Math.min(1, input.trackWetnessRatio));

  // Rain progressively washes away laid-down surface polymer while dampness slows deposition
  const rainWashoutFactor = Math.max(0.18, 1.0 - wet * 0.72);

  const lapUnits = Math.max(0, input.completedRaceLaps) / safeGrid;
  const rawLapRatio = Math.max(lapUnits, Math.max(0, input.playerTotalProgress)) / safeTotalLaps;
  // Asymptotic saturation curve so early laps rapidly build a visible & physical groove that matures toward 1.0
  const lapEvolutionCurve = 1.0 - Math.exp(-2.35 * Math.min(1.5, rawLapRatio));

  const curvLoads = input.sectorCurvatureLoad ?? [1.0, 1.12, 1.04];
  const hazardMults = input.sectorHazardMultipliers ?? [1.0, 1.0, 1.0];

  // Baseline green-track racing line grip offsets per sector (S2 typically has tighter technical corners)
  const greenSectorOffsets: [number, number, number] = [0, -3, -1];
  const baseGreenDryGrip = 90;
  const baseWetGrip =
    input.compound === 'wet'
      ? 88 + wet * 4 // 88..92% with full wet tread evacuation
      : 90 - wet * 36; // 90..54% on slicks in standing water

  const sectorRubberLevels: [number, number, number] = [0, 0, 0];
  const sectorGripPct: [number, number, number] = [90, 87, 89];

  for (let s = 0; s < 3; s++) {
    const depAccum = Math.max(0, input.sectorDepositionAccum[s] ?? 0);
    const shearMult = Math.max(0.8, Math.min(1.3, curvLoads[s] ?? 1.0));
    const depCurve = 1.0 - Math.exp(-1.85 * depAccum * shearMult);

    const rawSectorRubber = (lapEvolutionCurve * 0.68 + depCurve * 0.32) * shearMult * rainWashoutFactor;
    const clampedRubber = Number(Math.max(0, Math.min(1, rawSectorRubber)).toFixed(4));
    sectorRubberLevels[s] = clampedRubber;

    // Racing line grip evolution: green track (~87-90% dry) -> rubbered-in racing groove (up to 100% dry)
    const dryLineGrip = baseGreenDryGrip + greenSectorOffsets[s] + clampedRubber * 10.5;
    const blendedWeatherGrip =
      wet > 0.01
        ? dryLineGrip * (1 - wet) + (baseWetGrip + greenSectorOffsets[s] * 0.5 + clampedRubber * 2.5) * wet
        : dryLineGrip;

    const hzMult = Math.max(0.4, Math.min(1.0, hazardMults[s] ?? 1.0));
    const finalSectorGrip = Math.round(Math.max(40, Math.min(100, blendedWeatherGrip * hzMult)));
    sectorGripPct[s] = finalSectorGrip;
  }

  const trackRubberLevel = Number(
    Math.max(
      0,
      Math.min(1, (sectorRubberLevels[0] + sectorRubberLevels[1] + sectorRubberLevels[2]) / 3)
    ).toFixed(4)
  );

  // Off-line areas accumulate shed tyre marbles ("clag") and swept dust as laps progress, becoming more slippery
  const offLineSlipMultiplier = Number(
    Math.max(0.76, Math.min(0.97, 0.965 - trackRubberLevel * 0.155 * (1.0 - wet * 0.55))).toFixed(3)
  );

  return {
    trackRubberLevel,
    sectorRubberLevels,
    sectorGripPct,
    offLineSlipMultiplier,
  };
}

export interface RacingLineGripEvaluation {
  onLineRatio: number; // 1.0 directly in the rubbered racing groove -> 0.0 off-line
  offLineRatio: number; // 0.0 on the racing line -> 1.0 in the outer marble zone
  lineEvolutionGripMultiplier: number; // Physical grip multiplier (>1 on rubbered dry line, <1 off-line on marbles)
  localSurfaceGripPct: number; // Effective asphalt surfaceGripPct at the car's current lateral position
}

/**
 * Evaluates the car's lateral position relative to the rubbered-in racing line:
 * - On the racing line (`offLineRatio ~ 0`): applies progressive polymer adhesion grip bonus
 *   and matches the sector's rubbered-in `sectorGripPct`.
 * - Off the racing line (`offLineRatio -> 1`): applies progressive slipperiness from loose rubber
 *   marbles ("clag") and dust that build up outside the racing groove as laps progress.
 */
export function evaluateRacingLineSurfaceGrip(
  lateralOffsetMeters: number,
  idealLateralOffsetMeters: number,
  trackHalfWidthMeters: number,
  sectorRubberLevel: number,
  sectorRacingLineGripPct: number,
  trackWetnessRatio: number,
  compound: TyreCompound
): RacingLineGripEvaluation {
  const safeHalfW = Math.max(4.0, trackHalfWidthMeters);
  const rubber = Math.max(0, Math.min(1, sectorRubberLevel));
  const wet = Math.max(0, Math.min(1, trackWetnessRatio));

  const deviation = Math.abs(lateralOffsetMeters - idealLateralOffsetMeters);
  // Core rubbered-in groove is ~1.55m half-width; marble transition completes by ~4.2m off the ideal line
  const innerGrooveRadius = Math.max(1.15, safeHalfW * 0.19);
  const outerMarbleRadius = Math.max(2.85, safeHalfW * 0.58);
  const tRaw = Math.max(
    0,
    Math.min(1, (deviation - innerGrooveRadius) / Math.max(0.5, outerMarbleRadius - innerGrooveRadius))
  );
  // Smoothstep transition between high-grip rubbered groove and slippery off-line marble zone
  const offLineRatio = Number((tRaw * tRaw * (3 - 2 * tRaw)).toFixed(3));
  const onLineRatio = Number((1 - offLineRatio).toFixed(3));

  // On-line rubber bonus: up to +9.2% mechanical/adhesive grip on dry slicks as track rubbers in.
  // In heavy rain, polished rubber on the racing line becomes slightly slicker than off-line aggregate.
  const onLinePolymerBonus =
    compound !== 'wet' && wet < 0.45
      ? rubber * 0.092 * (1 - wet * 1.5)
      : wet >= 0.45
        ? -rubber * 0.035 * wet
        : rubber * 0.025;

  // Off-line marble penalty: starts at -3.5% on a green track (dust) and deepens up to -18.5%
  // as laps progress and shredded tyre marbles ("clag") pile up outside the racing line.
  const offLineMarblePenalty = (0.035 + rubber * 0.15) * (1.0 - wet * 0.5);

  const lineEvolutionGripMultiplier = Number(
    Math.max(
      0.76,
      Math.min(1.12, 1.0 + onLineRatio * onLinePolymerBonus - offLineRatio * offLineMarblePenalty)
    ).toFixed(3)
  );

  // Local asphalt surfaceGripPct equals `sectorRacingLineGripPct` on the racing line,
  // and drops progressively when driving off-line over loose rubber marbles
  const offLineGripDropPct = offLineRatio * (4 + rubber * 16) * (1 - wet * 0.45);
  const localSurfaceGripPct = Math.round(
    Math.max(35, Math.min(100, sectorRacingLineGripPct - offLineGripDropPct))
  );

  return {
    onLineRatio,
    offLineRatio,
    lineEvolutionGripMultiplier,
    localSurfaceGripPct,
  };
}


