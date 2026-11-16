import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ONLINE_GAMEPLAY_SETTINGS,
  GameSettings,
} from '../types/racing';
import {
  applyOnlineAssistCapPreset,
  buildDefaultPitStrategy,
  calculate2026ActiveAero,
  calculate2026PowerUnitDeployment,
  calculateGForces,
  calculateCockpitGOffset,
  calculatePitStrategy,
  calculateTrackSurfaceEvolution,
  calculateWheelWearDeltas,
  evaluateAiPitStrategy,
  evaluateDynamicWeatherTyreImpact,
  evaluateOnlineMatchmakingProfile,
  evaluateRacingLineSurfaceGrip,
  normalizePitStrategyPlan,
  resolveEffectiveSessionAssists,
  simulateStrategyProjection,
} from './simulationCalculus';

test('calculateGForces calculates longitudinal braking G-force correctly', () => {
  // Speed drops from 80 m/s (~288 km/h) to 40 m/s (~144 km/h) in 1.0 second
  const result = calculateGForces(40, 80, 0, 1.0);
  assert.ok(result.gLong < 0, 'Longitudinal G should be negative under braking');
  // -40 / 9.80665 = -4.08 G
  assert.equal(result.gLong, -4.08);
  assert.equal(result.gLat, 0);
  assert.equal(result.gTotal, 4.08);
});

test('calculateGForces calculates lateral cornering G-force correctly', () => {
  // High-speed bend at 70 m/s (~252 km/h) turning at 0.5 rad/sec
  const result = calculateGForces(70, 70, 0.5, 0.016);
  assert.equal(result.gLong, 0);
  // a = 70 * 0.5 = 35 m/s^2, 35 / 9.80665 = 3.57 G
  assert.equal(result.gLat, 3.57);
  assert.equal(result.gTotal, 3.57);
});

test('calculateGForces clamps extreme forces to physical F1 limits', () => {
  // Catastrophic deceleration clamp
  const result = calculateGForces(0, 100, 0, 0.1);
  assert.equal(result.gLong, -5.5);
});

test('calculateCockpitGOffset shifts camera forward and pitches down under braking', () => {
  const offsets = calculateCockpitGOffset(-4.5, 0, 150, false, 1.0);
  assert.ok(offsets.pitch > 0, 'Camera should pitch forward/down under braking');
  assert.ok(offsets.offsetFwd > 0, 'Head should translate forward under braking');
  assert.ok(offsets.offsetY < 0, 'Torso compresses downward');
});

test('calculateCockpitGOffset introduces aerodynamic buffeting shake above 230 km/h', () => {
  const lowSpeed = calculateCockpitGOffset(0, 0, 180, false, 1.0);
  const highSpeed = calculateCockpitGOffset(0, 0, 310, false, 1.0);
  assert.equal(lowSpeed.buffetShake, 0);
  assert.ok(highSpeed.buffetShake > 0.02, 'High speed should trigger aero buffet shake');
});

test('calculatePitStrategy determines pit window and undercut viability', () => {
  // In a 5-lap race, lap 2 should be in pit window
  const strat = calculatePitStrategy(
    2,
    5,
    'medium',
    72,
    10, // Dry track
    1.2, // Within 1.2s of car ahead -> undercut viable!
    2, // P2 chasing P1
    20
  );

  assert.equal(strat.isWindowOpen, true);
  assert.equal(strat.undercutViable, true);
  assert.ok(strat.undercutDeltaSec !== null && strat.undercutDeltaSec > 0);
  assert.ok(strat.tacticalRadioCall?.includes('UNDERCUT'));
});

test('calculatePitStrategy warns when tyre wear reaches cliff phase', () => {
  const strat = calculatePitStrategy(
    4,
    5,
    'soft',
    22, // Critical tyre wear (< 28%)
    5,
    null,
    1,
    20
  );

  assert.equal(strat.tyreDegradationStage, 'cliff');
  assert.ok(strat.tacticalRadioCall?.includes('BOX THIS LAP'));
});

test('simulateStrategyProjection computes stint splits and detects fuel risk on underfueled races', () => {
  const plan = normalizePitStrategyPlan({
    totalLaps: 10,
    startingCompound: 'soft',
    startingFuelPct: 70,
    stops: [
      { id: 's1', stopNumber: 1, pitLap: 4, compound: 'hard', fuelLoadPct: 95 },
    ],
  });
  const projection = simulateStrategyProjection(plan, 'day');
  assert.equal(projection.stints.length, 2);
  assert.equal(projection.stints[0].startLap, 1);
  assert.equal(projection.stints[0].endLap, 4);
  assert.equal(projection.stints[1].startLap, 5);
  assert.equal(projection.stints[1].endLap, 10);
  assert.equal(projection.runsOutOfFuelLap, null);

  const underfueled = simulateStrategyProjection(
    normalizePitStrategyPlan({
      totalLaps: 10,
      startingCompound: 'soft',
      startingFuelPct: 50,
      stops: [],
    }),
    'day'
  );
  assert.equal(underfueled.runsOutOfFuelLap, 4);

  const defaultFiveLap = buildDefaultPitStrategy(5, 'day', 'soft');
  assert.equal(defaultFiveLap.stops.length, 1);
  assert.equal(defaultFiveLap.startingCompound, 'soft');
});

test('calculatePitStrategy tracks nextPlannedStop and completedStopIds', () => {
  const plan = normalizePitStrategyPlan({
    totalLaps: 8,
    startingCompound: 'soft',
    startingFuelPct: 65,
    stops: [
      { id: 's1', stopNumber: 1, pitLap: 3, compound: 'medium', fuelLoadPct: 85 },
      { id: 's2', stopNumber: 2, pitLap: 6, compound: 'soft', fuelLoadPct: 55 },
    ],
  });

  const beforeStop1 = calculatePitStrategy(3, 8, 'soft', 60, 0, null, 3, 22, 40, plan, new Set());
  assert.equal(beforeStop1.nextPlannedStop?.id, 's1');
  assert.equal(beforeStop1.recommendedCompound, 'medium');
  assert.ok(beforeStop1.tacticalRadioCall?.includes('SCHEDULED STOP L3'));

  const afterStop1 = calculatePitStrategy(4, 8, 'medium', 92, 0, null, 5, 22, 82, plan, new Set(['s1']));
  assert.equal(afterStop1.nextPlannedStop?.id, 's2');
  assert.equal(afterStop1.plannedStops?.[0].completed, true);
  assert.equal(afterStop1.plannedStops?.[1].completed, false);
});

test('calculateTrackSurfaceEvolution and evaluateRacingLineSurfaceGrip model racing line rubbering-in and off-line marbles', () => {
  const greenTrack = calculateTrackSurfaceEvolution({
    completedRaceLaps: 0,
    gridCount: 20,
    playerTotalProgress: 0,
    totalLaps: 5,
    sectorDepositionAccum: [0, 0, 0],
    trackWetnessRatio: 0,
    compound: 'soft',
  });
  const rubberedTrack = calculateTrackSurfaceEvolution({
    completedRaceLaps: 80,
    gridCount: 20,
    playerTotalProgress: 4.5,
    totalLaps: 5,
    sectorDepositionAccum: [1.4, 1.6, 1.5],
    trackWetnessRatio: 0,
    compound: 'soft',
  });

  assert.ok(rubberedTrack.trackRubberLevel > greenTrack.trackRubberLevel);
  assert.ok(rubberedTrack.sectorGripPct[0] > greenTrack.sectorGripPct[0]);
  assert.ok(rubberedTrack.sectorGripPct[1] > greenTrack.sectorGripPct[1]);
  assert.ok(rubberedTrack.sectorGripPct[2] > greenTrack.sectorGripPct[2]);
  assert.ok(rubberedTrack.offLineSlipMultiplier < greenTrack.offLineSlipMultiplier);

  const onLine = evaluateRacingLineSurfaceGrip(
    1.2,
    1.2,
    7.0,
    rubberedTrack.sectorRubberLevels[0],
    rubberedTrack.sectorGripPct[0],
    0,
    'soft'
  );
  const offLine = evaluateRacingLineSurfaceGrip(
    6.2,
    1.2,
    7.0,
    rubberedTrack.sectorRubberLevels[0],
    rubberedTrack.sectorGripPct[0],
    0,
    'soft'
  );

  assert.ok(onLine.lineEvolutionGripMultiplier > 1.0, 'On-line rubbered groove should boost grip');
  assert.ok(offLine.lineEvolutionGripMultiplier < 0.9, 'Off-line marbles should reduce grip');
  assert.ok(offLine.localSurfaceGripPct < onLine.localSurfaceGripPct);
});

test('calculate2026PowerUnitDeployment tapers standard 350kW MGU-K above 290 km/h while MOM sustains high-speed deployment', () => {
  const standardHighSpeed = calculate2026PowerUnitDeployment({
    speedKmh: 332,
    throttleIn: 1,
    brakeIn: 0,
    ersCharge: 85,
    overrideRequested: false,
    overrideAvailable: true,
  });
  const momHighSpeed = calculate2026PowerUnitDeployment({
    speedKmh: 332,
    throttleIn: 1,
    brakeIn: 0,
    ersCharge: 85,
    overrideRequested: true,
    overrideAvailable: true,
  });
  assert.ok(momHighSpeed.mgukPowerKw > standardHighSpeed.mgukPowerKw);
  assert.equal(momHighSpeed.mgukPowerKw, 350);
  assert.ok(momHighSpeed.driveBoostMultiplier > standardHighSpeed.driveBoostMultiplier);
});

test('calculate2026ActiveAero engages X-Mode on straights and Z-Mode in corners', () => {
  const straightAero = calculate2026ActiveAero({
    inAeroZone: true,
    disabledByWeather: false,
    speedKmh: 280,
    absSteerRad: 0.04,
  });
  const cornerAero = calculate2026ActiveAero({
    inAeroZone: false,
    disabledByWeather: false,
    speedKmh: 165,
    absSteerRad: 0.35,
  });
  const lockedZMode = calculate2026ActiveAero({
    inAeroZone: true,
    disabledByWeather: false,
    speedKmh: 280,
    absSteerRad: 0.04,
    manualZModeLock: true,
  });
  assert.equal(straightAero.mode, 'x_mode');
  assert.ok(straightAero.dragMultiplier < cornerAero.dragMultiplier);
  assert.equal(cornerAero.mode, 'z_mode');
  assert.ok(cornerAero.downforceGripMultiplier > straightAero.downforceGripMultiplier);
  assert.equal(lockedZMode.mode, 'z_mode');
  assert.equal(lockedZMode.downforceGripMultiplier, cornerAero.downforceGripMultiplier);
});

test('calculateWheelWearDeltas loads outer front tyres harder under left-hand cornering & braking', () => {
  const deltas = calculateWheelWearDeltas({
    lateralVelMs: 4.5,
    gLat: 3.4, // Left turn -> loads outer right side (FR, RR)
    gLong: -3.2, // Braking -> loads fronts (FL, FR)
    speedMs: 55,
    offTrack: false,
    lockupWear: 0.3,
    debrisAbrasion: 0,
    compound: 'soft',
    trackWetnessRatio: 0,
    wheelWearPct: [80, 80, 80, 80],
    wheelSurfaceTempC: [98, 109, 94, 102],
    contactPatchWearMult: 1.0,
    tyreVerticalLoadFactor: 1.04,
    dt: 0.05,
  });
  assert.ok(deltas[1] > deltas[0], 'FR tyre should degrade faster than FL under left-hand cornering');
  assert.ok(deltas[1] > deltas[2], 'FR outer front under braking+cornering should degrade faster than inner rear');
});

test('evaluateAiPitStrategy triggers weather crossover and strategic undercut stops', () => {
  const rainSwitch = evaluateAiPitStrategy({
    archetype: 'overcut_long',
    currentLap: 3,
    totalLaps: 6,
    tyreWearPct: 82,
    currentCompound: 'medium',
    trackWetnessRatio: 0.55,
    pitStopsCompleted: 0,
    gapAheadSec: null,
  });
  assert.equal(rainSwitch.shouldPit, true);
  assert.equal(rainSwitch.nextCompound, 'wet');
  assert.equal(rainSwitch.reason, 'weather_crossover');

  const undercutStop = evaluateAiPitStrategy({
    archetype: 'undercut_1stop',
    currentLap: 3,
    totalLaps: 8,
    tyreWearPct: 68,
    currentCompound: 'soft',
    trackWetnessRatio: 0.05,
    pitStopsCompleted: 0,
    gapAheadSec: 1.1,
  });
  assert.equal(undercutStop.shouldPit, true);
  assert.equal(undercutStop.reason, 'undercut');
});

test('evaluateDynamicWeatherTyreImpact models rain crossover, extreme track heat, drying overheating, and cold asphalt', () => {
  // 1. Heavy rain hits slick tyres -> sharp grip drop + urgent wet crossover
  const slickInRain = evaluateDynamicWeatherTyreImpact({
    weather: 'heavy_rain',
    compound: 'medium',
    trackWetnessRatio: 0.68,
    trackTemperatureC: 17,
    prevTrackTemperatureC: 21,
    speedMs: 58,
    remainingLaps: 6,
  });
  assert.ok(slickInRain.gripMultiplier < 0.75, 'Dry slicks should lose major grip in heavy rain');
  assert.equal(slickInRain.optimalCompound, 'wet');
  assert.equal(slickInRain.regime, 'wet_crossover');
  assert.equal(slickInRain.crossoverUrgent, true);
  assert.equal(slickInRain.trackTempTrend, 'cooling');

  // 2. Wet tyres thrive in standing water with evaporative cooling
  const wetInRain = evaluateDynamicWeatherTyreImpact({
    weather: 'rain',
    compound: 'wet',
    trackWetnessRatio: 0.65,
    trackTemperatureC: 18,
    speedMs: 65,
    remainingLaps: 6,
  });
  assert.ok(wetInRain.gripMultiplier > 0.98);
  assert.ok(wetInRain.thermalOffsetC < 0, 'Wet spray cools tread surface');
  assert.equal(wetInRain.crossoverUrgent, false);

  // 3. Drying track overheats wet tyres rapidly -> switch back to slicks
  const wetOnDry = evaluateDynamicWeatherTyreImpact({
    weather: 'partly_cloudy',
    compound: 'wet',
    trackWetnessRatio: 0.05,
    trackTemperatureC: 34,
    prevTrackTemperatureC: 31,
    speedMs: 72,
    remainingLaps: 7,
  });
  assert.ok(wetOnDry.wearMultiplier > 1.8, 'Wet tyres degrade quickly on drying asphalt');
  assert.ok(wetOnDry.thermalOffsetC > 15);
  assert.equal(wetOnDry.regime, 'drying_crossover');
  assert.equal(wetOnDry.crossoverUrgent, true);
  assert.equal(wetOnDry.trackTempTrend, 'heating');

  // 4. Extreme 50°C asphalt heat accelerates soft wear & recommends Hard compound
  const softInHeat = evaluateDynamicWeatherTyreImpact({
    weather: 'day',
    compound: 'soft',
    trackWetnessRatio: 0,
    trackTemperatureC: 50,
    speedMs: 68,
    remainingLaps: 8,
  });
  assert.ok(softInHeat.wearMultiplier > 1.25);
  assert.equal(softInHeat.regime, 'extreme_heat');
  assert.equal(softInHeat.optimalCompound, 'hard');
  assert.equal(softInHeat.crossoverUrgent, true);

  // 5. Cold track drops hard tyre warm-up grip -> recommends Soft compound
  const hardOnCold = evaluateDynamicWeatherTyreImpact({
    weather: 'cloudy',
    compound: 'hard',
    trackWetnessRatio: 0,
    trackTemperatureC: 16,
    speedMs: 52,
    remainingLaps: 5,
  });
  assert.ok(hardOnCold.gripMultiplier < 0.9);
  assert.equal(hardOnCold.regime, 'cold_track');
  assert.equal(hardOnCold.optimalCompound, 'soft');
});

test('calculate2026PowerUnitDeployment respects harvest vs overtake ERS modes', () => {
  const harvest = calculate2026PowerUnitDeployment({
    speedKmh: 240,
    throttleIn: 1,
    brakeIn: 0,
    ersCharge: 55,
    overrideRequested: false,
    overrideAvailable: true,
    ersMode: 'harvest',
  });
  const overtake = calculate2026PowerUnitDeployment({
    speedKmh: 240,
    throttleIn: 1,
    brakeIn: 0,
    ersCharge: 55,
    overrideRequested: false,
    overrideAvailable: true,
    ersMode: 'overtake',
  });
  assert.ok(harvest.mgukPowerKw < overtake.mgukPowerKw, 'Harvest mode saves battery vs Overtake mode');
  assert.ok(harvest.ersDrainPerSec < overtake.ersDrainPerSec, 'Harvest mode drains substantially less ERS');
  assert.ok(overtake.driveBoostMultiplier > harvest.driveBoostMultiplier, 'Overtake delivers stronger drive boost');
});

test('evaluateOnlineMatchmakingProfile reflects cross-play pool, region ping, and ping cap checks', () => {
  const crossPlayAuto = evaluateOnlineMatchmakingProfile({
    ...DEFAULT_ONLINE_GAMEPLAY_SETTINGS,
    crossPlayEnabled: true,
    serverRegion: 'auto',
    maxPingMs: 90,
  });
  const lockedSinglePlatform = evaluateOnlineMatchmakingProfile({
    ...DEFAULT_ONLINE_GAMEPLAY_SETTINGS,
    crossPlayEnabled: false,
    serverRegion: 'oceania',
    maxPingMs: 50,
    allowRegionFailover: false,
  });

  assert.ok(crossPlayAuto.poolMultiplier > lockedSinglePlatform.poolMultiplier * 2);
  assert.ok(crossPlayAuto.estimatedPingMs < lockedSinglePlatform.estimatedPingMs);
  assert.equal(crossPlayAuto.pingWithinCap, true);
  assert.equal(lockedSinglePlatform.pingWithinCap, false);
  assert.equal(lockedSinglePlatform.readinessLabel, 'Ping Exceeds Max Cap');
  assert.ok(crossPlayAuto.estimatedQueueSec < lockedSinglePlatform.estimatedQueueSec);
});

test('applyOnlineAssistCapPreset and resolveEffectiveSessionAssists clamp assists when online rules are active', () => {
  const esportsCaps = applyOnlineAssistCapPreset('esports_no_assists');
  const fullPlayerSettings: GameSettings = {
    transmission: 'auto',
    steeringSensitivity: 1,
    difficulty: 'pro',
    touchControls: false,
    muted: false,
    cameraMode: 'chase',
    weather: 'day',
    dynamicWeather: false,
    totalLaps: 5,
    graphicsQuality: 'high',
    targetFps: 60,
    motionBlur: false,
    absAssist: true,
    tcAssist: true,
    steeringAssist: true,
    brakingAssist: 'high',
    tractionControlMode: 'full',
    racingLine: 'full',
    ersAssist: true,
    drsAssist: true,
    pitAssist: true,
    onlineGameplay: {
      ...DEFAULT_ONLINE_GAMEPLAY_SETTINGS,
      ...esportsCaps,
      applyOnlineRulesToSession: true,
    },
  };

  const enforced = resolveEffectiveSessionAssists(fullPlayerSettings);
  assert.equal(enforced.onlineEnforced, true);
  assert.equal(enforced.transmission, 'manual');
  assert.equal(enforced.brakingAssist, 'off');
  assert.equal(enforced.steeringAssist, false);
  assert.equal(enforced.absAssist, false);
  assert.equal(enforced.tractionControlMode, 'off');
  assert.equal(enforced.racingLine, 'off');
  assert.equal(enforced.ersAssist, false);
  assert.equal(enforced.drsAssist, false);
  assert.equal(enforced.pitAssist, false);

  const limitedPro = resolveEffectiveSessionAssists({
    ...fullPlayerSettings,
    onlineGameplay: {
      ...DEFAULT_ONLINE_GAMEPLAY_SETTINGS,
      ...applyOnlineAssistCapPreset('limited_pro'),
      applyOnlineRulesToSession: true,
    },
  });
  assert.equal(limitedPro.tractionControlMode, 'medium');
  assert.equal(limitedPro.racingLine, 'corners');
  assert.equal(limitedPro.absAssist, true);
  assert.equal(limitedPro.transmission, 'auto');

  const bypassed = resolveEffectiveSessionAssists({
    ...fullPlayerSettings,
    onlineGameplay: {
      ...DEFAULT_ONLINE_GAMEPLAY_SETTINGS,
      ...esportsCaps,
      applyOnlineRulesToSession: false,
    },
  });
  assert.equal(bypassed.onlineEnforced, false);
  assert.equal(bypassed.transmission, 'auto');
  assert.equal(bypassed.brakingAssist, 'high');
  assert.equal(bypassed.tractionControlMode, 'full');
  assert.equal(bypassed.racingLine, 'full');
});




