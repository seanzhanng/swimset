export type Stroke =
  | 'FR'
  | 'BK'
  | 'BR'
  | 'FL'
  | 'IM'
  | 'kick'
  | 'drill'
  | 'pull'
  | 'choice'
  | string;

export type SectionName =
  | 'warmup'
  | 'pre-set'
  | 'main'
  | 'post-set'
  | 'cooldown'
  | string;

export type Intensity =
  | 'easy'
  | 'moderate'
  | 'thresh'
  | 'sprint'
  | 'aerobic'
  | 'fast'
  | string;

export interface WorkoutHeader {
  poolLengthMeters?: number;
  plannedDurationMinutes?: number;
  title?: string;
  focus?: string;
  profile?: string;
}

export interface SetInterval {
  section: SectionName;
  reps: number;
  distanceMeters: number;
  stroke: Stroke;
  sendOffSeconds?: number;
  intensity?: Intensity;
  raw: string;
  lineNumber: number;
}

export interface WorkoutTotals {
  totalDistanceMeters: number;
  distanceBySection: Record<SectionName, number>;
  distanceByIntensity: Record<string, number>;
  estimatedMinutes?: number;
}

export interface ParseError {
  lineNumber: number;
  message: string;
}

export interface InterpretedWorkout {
  header: WorkoutHeader;
  sets: SetInterval[];
  totals: WorkoutTotals;
  errors: ParseError[];
  warnings: string[];
}

export interface GenerateConstraints {
  poolLengthMeters: number;
  targetDistanceMeters?: number;
  targetDurationMinutes?: number;
  focus: 'aerobic' | 'threshold' | 'sprint' | 'technique';
  profile: 'novice' | 'intermediate' | 'elite';
  title?: string;
}