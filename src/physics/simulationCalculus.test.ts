import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultPitStrategy,
  calculateGForces,
  calculateCockpitGOffset,
  calculatePitStrategy,
  calculateTrackSurfaceEvolution,
  evaluateRacingLineSurfaceGrip,
  normalizePitStrategyPlan,
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

