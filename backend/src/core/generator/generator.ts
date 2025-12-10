export type Focus = 'aerobic' | 'threshold' | 'sprint' | 'technique';
export type Profile = 'novice' | 'intermediate' | 'elite';

export interface GenerateConstraints {
  poolLengthMeters: number;
  targetDistanceMeters?: number;
  targetDurationMinutes?: number;
  focus: Focus;
  profile: Profile;
  title?: string;
}

interface TemplateLine {
  section: 'warmup' | 'preset' | 'main' | 'cooldown';
  baseReps: number;
  distance: number;
  stroke: string;
  sendOff?: string;
  intensity?: string;
  comment?: string;
}

export function generateWorkoutDSL(goal: GenerateConstraints): string {
  const pool = goal.poolLengthMeters;

  const template = TEMPLATES[goal.focus];
  const baseTotal = computeTemplateDistance(template, pool);

  const targetTotal = chooseTargetDistance(goal, baseTotal);
  const scale = targetTotal / baseTotal;

  const sections: Record<'warmup' | 'preset' | 'main' | 'cooldown', string[]> = {
    warmup: [],
    preset: [],
    main: [],
    cooldown: []
  };

  for (const line of template) {
    const sectionLines = sections[line.section];

    if (line.comment) {
      sectionLines.push(`# ${line.comment}`);
    }

    const effectiveDistance = normalizeToPool(line.distance, pool);

    let scaledReps = Math.round(line.baseReps * scale);
    if (scaledReps < 1) scaledReps = 1;

    const maxReps = line.baseReps * 3;
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

  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  return lines.join('\n');
}

function computeTemplateDistance(template: TemplateLine[], pool: number): number {
  let total = 0;
  for (const line of template) {
    const d = normalizeToPool(line.distance, pool);
    total += line.baseReps * d;
  }
  return total;
}

function chooseTargetDistance(goal: GenerateConstraints, baseTotal: number): number {
  let target = goal.targetDistanceMeters;
  if (!target || target <= 0) {
    const profileFactor =
      goal.profile === 'novice' ? 0.75 :
      goal.profile === 'elite' ? 1.25 :
      1.0;

    target = Math.round(baseTotal * profileFactor);
  }

  target = clamp(target, 1500, 6000);
  return target;
}

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

function normalizeToPool(distance: number, pool: number): number {
  if (distance <= 0) return pool;
  const remainder = distance % pool;
  if (remainder === 0) return distance;
  return distance + (pool - remainder);
}

const AEROBIC_TEMPLATE: TemplateLine[] = [
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

const THRESHOLD_TEMPLATE: TemplateLine[] = [
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

const SPRINT_TEMPLATE: TemplateLine[] = [
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

const TECHNIQUE_TEMPLATE: TemplateLine[] = [
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
