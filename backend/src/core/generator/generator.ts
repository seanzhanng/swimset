import { GenerateConstraints } from '../models/WorkoutTypes';

/**
 * Generate a workout in DSL form from high-level constraints.
 *
 * This function:
 *  - Builds header lines (pool, duration, title, focus, profile)
 *  - Assembles warmup, main, and cooldown blocks
 *  - Uses targetDistanceMeters (if provided) to roughly scale main set volume
 *
 * The DSL output is later interpreted by interpretShorthand().
 */
export function generateWorkoutDSL(constraints: GenerateConstraints): string {
  const targetDistance =
    constraints.targetDistanceMeters ?? getDefaultTargetDistance(constraints.profile);

  const warmupBlock = buildWarmupBlock(constraints);
  const cooldownBlock = buildCooldownBlock(constraints);

  const warmupDistance = estimateBlockDistanceMeters(warmupBlock);
  const cooldownDistance = estimateBlockDistanceMeters(cooldownBlock);

  const remainingForMain = Math.max(targetDistance - warmupDistance - cooldownDistance, 0);

  const mainBlock = buildMainBlock(constraints, remainingForMain);

  const lines: string[] = [];

  // Header
  lines.push(`pool ${constraints.poolLengthMeters}m`);
  if (constraints.targetDurationMinutes) {
    lines.push(`duration ${constraints.targetDurationMinutes}min`);
  }
  if (constraints.title) {
    lines.push(`title ${constraints.title}`);
  }
  lines.push(`focus ${constraints.focus}`);
  lines.push(`profile ${constraints.profile}`);
  lines.push(''); // blank line before sections

  // Sections
  lines.push(warmupBlock);
  lines.push('');
  lines.push(mainBlock);
  lines.push('');
  lines.push(cooldownBlock);

  return lines.join('\n');
}

/**
 * Default total distance when no targetDistanceMeters is provided.
 * Tuned loosely by profile.
 */
function getDefaultTargetDistance(profile: GenerateConstraints['profile']): number {
  switch (profile) {
    case 'novice':
      return 2000;
    case 'intermediate':
      return 3000;
    case 'elite':
      return 4000;
    default:
      return 3000;
  }
}

/**
 * Build a simple warmup block.
 */
function buildWarmupBlock(constraints: GenerateConstraints): string {
  const baseDistance = constraints.poolLengthMeters === 25 ? 200 : 300;
  const drillDistancePerRep = constraints.poolLengthMeters;
  const drillReps = 4;

  return [
    'warmup:',
    `  ${baseDistance} FR easy`,
    `  ${drillReps}x${drillDistancePerRep} drill @1:00`
  ].join('\n');
}

/**
 * Build a simple cooldown block.
 */
function buildCooldownBlock(constraints: GenerateConstraints): string {
  const distance = constraints.poolLengthMeters * 4; // e.g. 100m in 25m pool
  return [
    'cooldown:',
    `  ${distance} choice easy`
  ].join('\n');
}

/**
 * Build a main set block based on focus and remaining distance.
 *
 * The goal is to:
 *  - Choose a reasonable repeat distance
 *  - Scale reps so total ~= remainingForMain
 */
function buildMainBlock(constraints: GenerateConstraints, remainingForMain: number): string {
  // Ensure we have *some* main set distance
  const minMainDistance = constraints.poolLengthMeters * 8; // e.g. 200m or 400m
  const targetMainDistance = Math.max(remainingForMain, minMainDistance);

  // Choose a base repeat distance and label based on focus
  let repeatDistance: number;
  let stroke: string;
  let intensity: string;
  let sendOffSecondsGuess: number;

  switch (constraints.focus) {
    case 'threshold':
      repeatDistance = 100;
      stroke = 'FR';
      intensity = 'thresh';
      sendOffSecondsGuess = constraints.poolLengthMeters === 25 ? 95 : 110; // rough guesses
      break;
    case 'sprint':
      repeatDistance = 25;
      stroke = 'FR';
      intensity = 'sprint';
      sendOffSecondsGuess = 35;
      break;
    case 'technique':
      repeatDistance = 50;
      stroke = 'drill';
      intensity = 'easy';
      sendOffSecondsGuess = 60;
      break;
    case 'aerobic':
    default:
      repeatDistance = 100;
      stroke = 'FR';
      intensity = 'moderate';
      sendOffSecondsGuess = constraints.poolLengthMeters === 25 ? 105 : 120;
      break;
  }

  // Compute reps to approximate the target main distance
  const rawReps = Math.round(targetMainDistance / repeatDistance);
  const reps = Math.max(rawReps, 4); // at least a few reps

  // Convert send-off guess to "M:SS" string
  const minutes = Math.floor(sendOffSecondsGuess / 60);
  const seconds = sendOffSecondsGuess % 60;
  const secondsPadded = seconds.toString().padStart(2, '0');
  const sendOffStr = `${minutes}:${secondsPadded}`;

  return [
    'main:',
    `  ${reps}x${repeatDistance} ${stroke} @${sendOffStr} ${intensity}`
  ].join('\n');
}

/**
 * Very rough distance estimation for a DSL block.
 * We only support the simple patterns we generate ourselves:
 *   "<distance> ..."
 *   "<reps>x<distance> ..."
 */
function estimateBlockDistanceMeters(block: string): number {
  const lines = block.split(/\r?\n/);
  let total = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.endsWith(':') || trimmed.startsWith('#')) {
      continue;
    }

    // Try to match "repsxdistance" or "distance"
    const match = trimmed.match(/^(?:(\d+)x)?(\d+)\b/);
    if (!match) continue;

    const [, repsStr, distanceStr] = match;
    const reps = repsStr ? Number.parseInt(repsStr, 10) : 1;
    const distance = Number.parseInt(distanceStr, 10);

    if (Number.isFinite(reps) && reps > 0 && Number.isFinite(distance) && distance > 0) {
      total += reps * distance;
    }
  }

  return total;
}