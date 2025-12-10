// src/core/generator/generator.ts

/**
 * Constraints used by the generator.
 * These are mirrored on the iOS client.
 */
export type Focus = 'aerobic' | 'threshold' | 'sprint' | 'technique';
export type Profile = 'novice' | 'intermediate' | 'elite';

export interface GenerateConstraints {
  poolLengthMeters: number;              // 25 or 50, but we don't strictly enforce
  targetDistanceMeters?: number;         // e.g., 3000
  targetDurationMinutes?: number;        // e.g., 90 (not heavily used yet)
  focus: Focus;
  profile: Profile;
  title?: string;
}

/**
 * A small helper for building blocks.
 */
interface Block {
  dsl: string;
  distanceMeters: number;
}

/**
 * Main entry point: build DSL text for a workout from constraints.
 *
 * The strategy:
 * - Choose an approximate total distance from targetDistance/profile.
 * - Build warmup + cooldown blocks with predictable distances.
 * - Compute remaining distance for main and choose a main template based on focus.
 * - Scale main-set reps to get close to the remaining distance.
 */
export function generateWorkoutDSL(goal: GenerateConstraints): string {
  const lines: string[] = [];

  // Header
  lines.push(`pool ${goal.poolLengthMeters}m`);
  if (goal.targetDurationMinutes) {
    lines.push(`duration ${goal.targetDurationMinutes}min`);
  }
  if (goal.title) {
    lines.push(`title ${goal.title}`);
  }
  lines.push(`focus ${goal.focus}`);
  lines.push(`profile ${goal.profile}`);
  lines.push(''); // blank line

  const approxTotal = chooseTargetDistance(goal);

  const warmup = buildWarmupBlock(goal);
  const cooldown = buildCooldownBlock(goal);

  const remainingForMain = Math.max(
    approxTotal - warmup.distanceMeters - cooldown.distanceMeters,
    0
  );

  const main = buildMainBlock(goal, remainingForMain);

  lines.push(warmup.dsl, '');
  lines.push(main.dsl, '');
  lines.push(cooldown.dsl);

  return lines.join('\n');
}

/**
 * Choose a reasonable total distance if the coach didn't specify one.
 */
function chooseTargetDistance(goal: GenerateConstraints): number {
  if (goal.targetDistanceMeters && goal.targetDistanceMeters > 0) {
    return goal.targetDistanceMeters;
  }

  // Simple defaults based on profile.
  switch (goal.profile) {
    case 'novice':
      return 2200;
    case 'intermediate':
      return 3200;
    case 'elite':
      return 4200;
    default:
      return 3000;
  }
}

/**
 * Build a warmup block with a predictable distance.
 *
 * We keep this pretty simple for v1: a single easy swim + a short drill set.
 */
function buildWarmupBlock(goal: GenerateConstraints): Block {
  const pool = goal.poolLengthMeters;

  // Slightly larger warmup for better profiles.
  const baseEasy =
    goal.profile === 'elite'
      ? pool * 12 // e.g., 300m in 25m pool, 600m in 50m pool
      : goal.profile === 'intermediate'
      ? pool * 8
      : pool * 6;

  const drillReps = 4;
  const drillDistance = drillReps * pool;

  const total = baseEasy + drillDistance;

  const lines: string[] = [
    'warmup:',
    `  ${baseEasy} FR easy`,
    `  ${drillReps}x${pool} drill @0:55`
  ];

  return {
    dsl: lines.join('\n'),
    distanceMeters: total
  };
}

/**
 * Build a cooldown block.
 */
function buildCooldownBlock(goal: GenerateConstraints): Block {
  const pool = goal.poolLengthMeters;

  // Short but not trivial cooldown.
  const distance = goal.profile === 'elite' ? pool * 8 : pool * 4;

  const lines: string[] = [
    'cooldown:',
    `  ${distance} choice easy`
  ];

  return {
    dsl: lines.join('\n'),
    distanceMeters: distance
  };
}

/**
 * Build the main-set block based on focus and remaining distance.
 */
function buildMainBlock(goal: GenerateConstraints, targetMainDistance: number): Block {
  const pool = goal.poolLengthMeters;

  // If remaining distance is tiny, just create a short aerobic main.
  const effectiveTarget = Math.max(targetMainDistance, pool * 8);

  switch (goal.focus) {
    case 'threshold':
      return buildThresholdMain(goal, effectiveTarget);
    case 'sprint':
      return buildSprintMain(goal, effectiveTarget);
    case 'technique':
      return buildTechniqueMain(goal, effectiveTarget);
    case 'aerobic':
    default:
      return buildAerobicMain(goal, effectiveTarget);
  }
}

/**
 * Aerobic main = longer repeats at moderate effort.
 */
function buildAerobicMain(goal: GenerateConstraints, target: number): Block {
  const pool = goal.poolLengthMeters;

  // Use 200s or 400s depending on profile.
  const baseRepeat =
    goal.profile === 'elite'
      ? 400
      : goal.profile === 'intermediate'
      ? 300
      : 200;

  const repeatDistance = normalizeToPool(baseRepeat, pool);

  let reps = Math.max(Math.round(target / repeatDistance), 3);
  const distance = reps * repeatDistance;

  const sendOff = pool === 25 ? '3:00' : '4:30';

  const lines: string[] = [
    'main:',
    `  ${reps}x${repeatDistance} FR @${sendOff} moderate`,
    `  4x${pool} backstroke @1:00 easy`
  ];

  return {
    dsl: lines.join('\n'),
    distanceMeters: distance + 4 * pool
  };
}

/**
 * Threshold main = 100s/200s at threshold, maybe grouped as sets.
 */
function buildThresholdMain(goal: GenerateConstraints, target: number): Block {
  const pool = goal.poolLengthMeters;

  const repeatDistance = 100;
  let reps = Math.max(Math.round(target / repeatDistance), 6);

  // Round reps to multiple of 4 for nicer sets.
  reps = Math.max(4, Math.round(reps / 4) * 4);

  const distance = reps * repeatDistance;

  // Simple sendoff logic
  const baseSendOff = goal.profile === 'elite' ? '1:25' : goal.profile === 'intermediate' ? '1:35' : '1:45';

  const lines: string[] = [
    'main:',
    `  # Threshold 100s`,
    `  ${reps}x100 FR @${baseSendOff} thresh`,
    `  ${pool * 4} FR easy`
  ];

  return {
    dsl: lines.join('\n'),
    distanceMeters: distance + pool * 4
  };
}

/**
 * Sprint main = 25s/50s fast with plenty of rest and some easy swimming.
 */
function buildSprintMain(goal: GenerateConstraints, target: number): Block {
  const pool = goal.poolLengthMeters;

  const repeatDistance = pool; // 25 or 50
  let reps = Math.max(Math.round(target / (repeatDistance * 2)), 8); // half distance fast, half easy
  // Keep reps in a reasonable range
  reps = Math.min(Math.max(reps, 8), 24);

  const fastDistance = reps * repeatDistance;
  const easyDistance = reps * repeatDistance; // same volume of easy

  const sendFast = pool === 25 ? '0:40' : '1:00';

  const lines: string[] = [
    'main:',
    `  # Sprint 25s/50s`,
    `  ${reps}x${repeatDistance} FR @${sendFast} sprint`,
    `  ${reps}x${repeatDistance} FR easy`
  ];

  return {
    dsl: lines.join('\n'),
    distanceMeters: fastDistance + easyDistance
  };
}

/**
 * Technique main = shorter aerobic swimming plus drills.
 */
function buildTechniqueMain(goal: GenerateConstraints, target: number): Block {
  const pool = goal.poolLengthMeters;

  const aerobicRepeat = normalizeToPool(100, pool);
  let aerobicReps = Math.max(Math.round(target * 0.6 / aerobicRepeat), 4);

  const drillRepeat = pool;
  let drillReps = Math.max(Math.round(target * 0.4 / drillRepeat), 4);

  const aerobicDistance = aerobicReps * aerobicRepeat;
  const drillDistance = drillReps * drillRepeat;

  const lines: string[] = [
    'main:',
    `  # Technique-focused main`,
    `  ${aerobicReps}x${aerobicRepeat} FR @2:00 aerobic`,
    `  ${drillReps}x${drillRepeat} drill @1:00`,
    `  ${pool * 4} choice easy`
  ];

  return {
    dsl: lines.join('\n'),
    distanceMeters: aerobicDistance + drillDistance + pool * 4
  };
}

/**
 * Ensure the repeat distance makes sense for the pool length.
 * e.g., for 50m pool, 100, 150, 200 are fine; for 25m, we keep multiples of 25.
 */
function normalizeToPool(distance: number, pool: number): number {
  const remainder = distance % pool;
  if (remainder === 0) return distance;
  return distance + (pool - remainder);
}