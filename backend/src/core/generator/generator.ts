// src/core/generator/generator.ts

export type Focus = 'aerobic' | 'threshold' | 'sprint' | 'technique';
export type Profile = 'novice' | 'intermediate' | 'elite';

export interface GenerateConstraints {
  poolLengthMeters: number;              // 25 or 50 typically
  targetDistanceMeters?: number;         // e.g. 3000
  targetDurationMinutes?: number;        // not heavily used yet
  focus: Focus;
  profile: Profile;
  title?: string;
}

/**
 * One logical line in the template.
 * We scale baseReps to hit the target total distance.
 */
interface TemplateLine {
  section: 'warmup' | 'preset' | 'main' | 'cooldown';
  baseReps: number;          // reps at baseline template size
  distance: number;          // per-rep distance in meters (for a 25m pool; normalized to pool)
  stroke: string;            // 'FR', 'kick', 'drill', 'choice', etc.
  sendOff?: string;          // "1:30", "0:40", ...
  intensity?: string;        // 'easy', 'aerobic', 'moderate', 'thresh', 'sprint', 'fast', 'build', ...
  comment?: string;          // optional comment line before the set
}

/**
 * Main generator entry point.
 * - Picks a template based on focus
 * - Scales reps to approximate targetDistanceMeters (or a sensible default)
 * - Emits DSL that looks like a real coach workout.
 */
export function generateWorkoutDSL(goal: GenerateConstraints): string {
  const pool = goal.poolLengthMeters;

  const template = TEMPLATES[goal.focus];
  const baseTotal = computeTemplateDistance(template, pool);

  const targetTotal = chooseTargetDistance(goal, baseTotal);
  const scale = targetTotal / baseTotal;

  // Accumulate lines per section
  const sections: Record<'warmup' | 'preset' | 'main' | 'cooldown', string[]> = {
    warmup: [],
    preset: [],
    main: [],
    cooldown: []
  };

  for (const line of template) {
    const sectionLines = sections[line.section];

    // Optional comment line above the set
    if (line.comment) {
      sectionLines.push(`# ${line.comment}`);
    }

    const effectiveDistance = normalizeToPool(line.distance, pool);

    // Scale reps, but keep within a sane range
    let scaledReps = Math.round(line.baseReps * scale);
    if (scaledReps < 1) scaledReps = 1;

    const maxReps = line.baseReps * 3; // don't explode to 40×100 just because someone put 6k
    if (scaledReps > maxReps) scaledReps = maxReps;

    const dsl = buildSetLine(
      scaledReps,
      effectiveDistance,
      line.stroke,
      line.sendOff,
      line.intensity
    );

    sectionLines.push(dsl);
  }

  // Build header
  const lines: string[] = [];
  lines.push(`pool ${pool}m`);
  if (goal.targetDurationMinutes) {
    lines.push(`duration ${goal.targetDurationMinutes}min`);
  }
  if (goal.title) {
    lines.push(`title ${goal.title}`);
  }
  lines.push(`focus ${goal.focus}`);
  lines.push(`profile ${goal.profile}`);
  lines.push('');

  // Output sections in a consistent order
  const order: Array<keyof typeof sections> = ['warmup', 'preset', 'main', 'cooldown'];

  for (const sectionName of order) {
    const content = sections[sectionName];
    if (!content || content.length === 0) continue;

    lines.push(`${sectionName}:`);
    for (const l of content) {
      lines.push(`  ${l}`);
    }
    lines.push('');
  }

  // Strip trailing blank lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  return lines.join('\n');
}

/**
 * Compute the baseline total distance of a template for a given pool length.
 */
function computeTemplateDistance(template: TemplateLine[], pool: number): number {
  let total = 0;
  for (const line of template) {
    const d = normalizeToPool(line.distance, pool);
    total += line.baseReps * d;
  }
  return total;
}

/**
 * Decide what total distance this workout should be.
 * - If coach gave targetDistanceMeters, honor it (clamped).
 * - Otherwise, use template size adjusted by profile.
 */
function chooseTargetDistance(goal: GenerateConstraints, baseTotal: number): number {
  let target = goal.targetDistanceMeters;
  if (!target || target <= 0) {
    const profileFactor =
      goal.profile === 'novice' ? 0.75 :
      goal.profile === 'elite' ? 1.25 :
      1.0;

    target = Math.round(baseTotal * profileFactor);
  }

  // Clamp to a realistic practice size
  target = clamp(target, 1500, 6000);
  return target;
}

/**
 * Build one DSL set line, honoring your grammar:
 * [reps]x? <distance> <stroke> [@time] [intensity]
 */
function buildSetLine(
  reps: number,
  distance: number,
  stroke: string,
  sendOff?: string,
  intensity?: string
): string {
  const repsPart = reps > 1 ? `${reps}x` : '';
  const sendOffPart = sendOff ? ` @${sendOff}` : '';
  const intensityPart = intensity ? ` ${intensity}` : '';
  return `${repsPart}${distance} ${stroke}${sendOffPart}${intensityPart}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Ensure the distance is a multiple of pool length.
 * If someone writes 75 in a 50m pool, make it 100, etc.
 */
function normalizeToPool(distance: number, pool: number): number {
  if (distance <= 0) return pool;
  const remainder = distance % pool;
  if (remainder === 0) return distance;
  return distance + (pool - remainder);
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
//
// Each template is written for a 25m baseline pool using common
// coaching patterns from real workouts: warmup + preset + multi-part main + cooldown.
// Distances are automatically normalized for 50m pools and scaled by reps.

/**
 * AEROBIC TEMPLATE
 *
 * Rough baseline (25m pool, intermediate profile, no explicit target):
 * - Warmup ~600
 * - Preset ~500
 * - Main ~1400
 * - Cooldown ~300
 * ≈ 2800m before scaling.
 */
const AEROBIC_TEMPLATE: TemplateLine[] = [
  // Warmup
  {
    section: 'warmup',
    baseReps: 1,
    distance: 300,
    stroke: 'choice',
    intensity: 'easy',
    comment: 'Easy swim, long strokes'
  },
  {
    section: 'warmup',
    baseReps: 4,
    distance: 50,
    stroke: 'drill',
    sendOff: '1:00',
    intensity: 'aerobic',
    comment: 'Technique focus, 1 stroke per 50 if you want'
  },
  {
    section: 'warmup',
    baseReps: 4,
    distance: 25,
    stroke: 'FR',
    sendOff: '0:30',
    intensity: 'build',
    comment: 'Build 1–4, finish near race tempo'
  },

  // Preset – light kick + pull
  {
    section: 'preset',
    baseReps: 6,
    distance: 50,
    stroke: 'kick',
    sendOff: '1:00',
    intensity: 'moderate',
    comment: 'Kick with board or streamline; keep it moving'
  },
  {
    section: 'preset',
    baseReps: 4,
    distance: 50,
    stroke: 'pull',
    sendOff: '1:00',
    intensity: 'aerobic',
    comment: 'Pull with buoy, focus on distance per stroke'
  },

  // Main – steady aerobic 100s + moderate 200s
  {
    section: 'main',
    baseReps: 6,
    distance: 100,
    stroke: 'FR',
    sendOff: '1:40',
    intensity: 'aerobic',
    comment: 'Steady aerobic, hold consistent pace'
  },
  {
    section: 'main',
    baseReps: 4,
    distance: 200,
    stroke: 'FR',
    sendOff: '3:30',
    intensity: 'moderate',
    comment: 'Longer repeats, smooth & controlled'
  },

  // Cooldown
  {
    section: 'cooldown',
    baseReps: 1,
    distance: 200,
    stroke: 'choice',
    intensity: 'easy',
    comment: 'Easy swim, flush out'
  },
  {
    section: 'cooldown',
    baseReps: 4,
    distance: 25,
    stroke: 'choice',
    intensity: 'easy'
  }
];

/**
 * THRESHOLD TEMPLATE
 *
 * Baseline (25m pool, intermediate):
 * - Warmup ~700
 * - Preset ~600
 * - Main ~1600 (multiple threshold blocks)
 * - Cooldown ~300
 * ≈ 3200m before scaling.
 */
const THRESHOLD_TEMPLATE: TemplateLine[] = [
  // Warmup
  {
    section: 'warmup',
    baseReps: 1,
    distance: 300,
    stroke: 'choice',
    intensity: 'easy',
    comment: 'Easy swim, loosen up'
  },
  {
    section: 'warmup',
    baseReps: 4,
    distance: 50,
    stroke: 'drill',
    sendOff: '1:00',
    intensity: 'aerobic',
    comment: 'Technique, long strokes'
  },
  {
    section: 'warmup',
    baseReps: 4,
    distance: 25,
    stroke: 'FR',
    sendOff: '0:30',
    intensity: 'build',
    comment: 'Build 1–4 to strong'
  },
  {
    section: 'warmup',
    baseReps: 4,
    distance: 25,
    stroke: 'kick',
    sendOff: '0:40',
    intensity: 'moderate',
    comment: 'Short kick to wake legs'
  },

  // Preset – prep for threshold
  {
    section: 'preset',
    baseReps: 6,
    distance: 50,
    stroke: 'FR',
    sendOff: '0:55',
    intensity: 'moderate',
    comment: 'Prep for threshold pace, focus on rhythm'
  },
  {
    section: 'preset',
    baseReps: 4,
    distance: 50,
    stroke: 'FR',
    sendOff: '1:00',
    intensity: 'build',
    comment: 'Descend or build within each 50'
  },
  {
    section: 'preset',
    baseReps: 1,
    distance: 100,
    stroke: 'choice',
    intensity: 'easy',
    comment: 'Easy before main set'
  },

  // Main – multiple threshold pieces + some 50s
  {
    section: 'main',
    baseReps: 8,
    distance: 100,
    stroke: 'FR',
    sendOff: '1:30',
    intensity: 'thresh',
    comment: 'Block 1 – straight threshold 100s'
  },
  {
    section: 'main',
    baseReps: 4,
    distance: 50,
    stroke: 'FR',
    sendOff: '0:50',
    intensity: 'fast',
    comment: 'Fast 50s to sharpen speed'
  },
  {
    section: 'main',
    baseReps: 4,
    distance: 100,
    stroke: 'FR',
    sendOff: '1:35',
    intensity: 'thresh',
    comment: 'Block 2 – hold pace under fatigue'
  },
  {
    section: 'main',
    baseReps: 4,
    distance: 50,
    stroke: 'choice',
    sendOff: '1:00',
    intensity: 'easy',
    comment: 'Easy active recovery'
  },

  // Cooldown
  {
    section: 'cooldown',
    baseReps: 1,
    distance: 200,
    stroke: 'choice',
    intensity: 'easy',
    comment: 'Long easy swim'
  },
  {
    section: 'cooldown',
    baseReps: 4,
    distance: 25,
    stroke: 'choice',
    intensity: 'easy'
  }
];

/**
 * SPRINT TEMPLATE
 *
 * Baseline (25m pool, intermediate):
 * - Warmup ~600
 * - Preset ~400
 * - Main ~1200 (lots of 25s + some 50s/kick)
 * - Cooldown ~400
 * ≈ 2600m before scaling.
 */
const SPRINT_TEMPLATE: TemplateLine[] = [
  // Warmup
  {
    section: 'warmup',
    baseReps: 1,
    distance: 300,
    stroke: 'choice',
    intensity: 'easy',
    comment: 'Easy swim, mix strokes'
  },
  {
    section: 'warmup',
    baseReps: 4,
    distance: 50,
    stroke: 'drill',
    sendOff: '1:00',
    intensity: 'aerobic',
    comment: 'Drill focus – streamline, catch, finish'
  },
  {
    section: 'warmup',
    baseReps: 4,
    distance: 25,
    stroke: 'FR',
    sendOff: '0:30',
    intensity: 'build',
    comment: 'Build 1–4, faster into the wall'
  },

  // Preset – speed prep
  {
    section: 'preset',
    baseReps: 8,
    distance: 25,
    stroke: 'kick',
    sendOff: '0:40',
    intensity: 'moderate',
    comment: 'Kick with high tempo, good streamline'
  },
  {
    section: 'preset',
    baseReps: 4,
    distance: 50,
    stroke: 'FR',
    sendOff: '0:55',
    intensity: 'build',
    comment: 'Build 1–4, last 15m strong'
  },

  // Main – short sprints with equal easy volume
  {
    section: 'main',
    baseReps: 12,
    distance: 25,
    stroke: 'FR',
    sendOff: '0:40',
    intensity: 'sprint',
    comment: 'All-out 25s, focus on start + first 10m'
  },
  {
    section: 'main',
    baseReps: 12,
    distance: 25,
    stroke: 'FR',
    sendOff: '0:50',
    intensity: 'easy',
    comment: 'Equal easy swimming for active recovery'
  },
  {
    section: 'main',
    baseReps: 8,
    distance: 50,
    stroke: 'kick',
    sendOff: '1:10',
    intensity: 'fast',
    comment: 'Fast kick 50s – walls + underwaters'
  },
  {
    section: 'main',
    baseReps: 4,
    distance: 50,
    stroke: 'FR',
    sendOff: '1:00',
    intensity: 'sprint',
    comment: '50s from a push, race effort'
  },

  // Cooldown
  {
    section: 'cooldown',
    baseReps: 1,
    distance: 200,
    stroke: 'choice',
    intensity: 'easy',
    comment: 'Easy choice, relax the stroke'
  },
  {
    section: 'cooldown',
    baseReps: 8,
    distance: 25,
    stroke: 'choice',
    intensity: 'easy'
  }
];

/**
 * TECHNIQUE TEMPLATE
 *
 * Baseline (25m pool, intermediate):
 * - Warmup ~600
 * - Preset ~800 (drill + kick + more drill)
 * - Main ~1000 (aerobic FR + drill)
 * - Cooldown ~400
 * ≈ 2800m before scaling.
 */
const TECHNIQUE_TEMPLATE: TemplateLine[] = [
  // Warmup
  {
    section: 'warmup',
    baseReps: 1,
    distance: 300,
    stroke: 'choice',
    intensity: 'easy',
    comment: 'Easy swim, focus on body line'
  },
  {
    section: 'warmup',
    baseReps: 4,
    distance: 50,
    stroke: 'drill',
    sendOff: '1:05',
    intensity: 'aerobic',
    comment: 'Simple drills: catch-up, fingertip drag, etc.'
  },
  {
    section: 'warmup',
    baseReps: 4,
    distance: 25,
    stroke: 'FR',
    sendOff: '0:30',
    intensity: 'build',
    comment: 'Build 1–4, hold good form'
  },

  // Preset – technique block: drill + kick + drill + short drill
  {
    section: 'preset',
    baseReps: 4,
    distance: 50,
    stroke: 'drill',
    sendOff: '1:10',
    intensity: 'aerobic',
    comment: 'Drill only, no rush'
  },
  {
    section: 'preset',
    baseReps: 4,
    distance: 50,
    stroke: 'kick',
    sendOff: '1:10',
    intensity: 'moderate',
    comment: 'Kick on side or on back, stable head'
  },
  {
    section: 'preset',
    baseReps: 4,
    distance: 50,
    stroke: 'drill',
    sendOff: '1:10',
    intensity: 'aerobic',
    comment: 'Second drill focus – maybe breathing or rotation'
  },
  {
    section: 'preset',
    baseReps: 8,
    distance: 25,
    stroke: 'drill',
    sendOff: '0:45',
    intensity: 'aerobic',
    comment: 'Short drill 25s, very precise'
  },

  // Main – mostly aerobic FR but technique-focused
  {
    section: 'main',
    baseReps: 8,
    distance: 100,
    stroke: 'FR',
    sendOff: '2:00',
    intensity: 'aerobic',
    comment: '100s, keep stroke count low, good form'
  },
  {
    section: 'main',
    baseReps: 4,
    distance: 50,
    stroke: 'drill',
    sendOff: '1:00',
    intensity: 'aerobic',
    comment: 'Finish with pure drills'
  },

  // Cooldown
  {
    section: 'cooldown',
    baseReps: 1,
    distance: 200,
    stroke: 'choice',
    intensity: 'easy',
    comment: 'Easy swim, flush everything out'
  },
  {
    section: 'cooldown',
    baseReps: 8,
    distance: 25,
    stroke: 'choice',
    intensity: 'easy'
  }
];

const TEMPLATES: Record<Focus, TemplateLine[]> = {
  aerobic: AEROBIC_TEMPLATE,
  threshold: THRESHOLD_TEMPLATE,
  sprint: SPRINT_TEMPLATE,
  technique: TECHNIQUE_TEMPLATE
};
