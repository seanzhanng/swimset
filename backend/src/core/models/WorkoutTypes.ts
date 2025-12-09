/**
 * Core domain types for SwimSet workouts.
 *
 * These are deliberately framework-agnostic:
 * - No Express, DB, or PDF dependencies.
 * - Used by the interpreter, generator, routes, and PDF renderer.
 */

/**
 * Rough stroke categories.
 * You can extend this over time with more specific tags.
 */
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

/**
 * Named workout sections.
 * Common ones are listed, but any custom string is allowed.
 */
export type SectionName =
  | 'warmup'
  | 'pre-set'
  | 'main'
  | 'post-set'
  | 'cooldown'
  | string;

/**
 * Intensity labels used by coaches.
 * We allow arbitrary strings to keep the DSL flexible.
 */
export type Intensity =
  | 'easy'
  | 'moderate'
  | 'thresh'
  | 'sprint'
  | 'aerobic'
  | 'fast'
  | string;

/**
 * High-level workout metadata parsed from header lines.
 */
export interface WorkoutHeader {
  poolLengthMeters?: number;
  plannedDurationMinutes?: number;
  title?: string;
  focus?: string; // e.g., 'aerobic', 'threshold'
  profile?: string; // e.g., 'novice', 'intermediate', 'elite'
}

/**
 * A single interpreted set line from the DSL.
 * Example DSL lines:
 *   "4x50 FR @1:00 easy"
 *   "200 FR moderate"
 */
export interface SetInterval {
  section: SectionName;
  reps: number; // default = 1 in interpreter
  distanceMeters: number;
  stroke: Stroke;
  sendOffSeconds?: number; // e.g., "1:40" -> 100
  intensity?: Intensity;
  raw: string; // original DSL line
  lineNumber: number; // 1-based line index in the input text
}

/**
 * Aggregated totals computed from all sets.
 */
export interface WorkoutTotals {
  totalDistanceMeters: number;
  distanceBySection: Record<SectionName, number>;
  distanceByIntensity: Record<string, number>;
  estimatedMinutes?: number;
}

/**
 * Parsing error for a specific line.
 */
export interface ParseError {
  lineNumber: number;
  message: string;
}

/**
 * Result of interpreting a full DSL workout script.
 */
export interface InterpretedWorkout {
  header: WorkoutHeader;
  sets: SetInterval[];
  totals: WorkoutTotals;
  errors: ParseError[];
  warnings: string[];
}

/**
 * Constraints used to auto-generate a workout.
 * This closely mirrors your earlier design and will be
 * the request body for POST /generate.
 */
export interface GenerateConstraints {
  poolLengthMeters: number; // 25 or 50
  targetDistanceMeters?: number;
  targetDurationMinutes?: number;
  focus: 'aerobic' | 'threshold' | 'sprint' | 'technique';
  profile: 'novice' | 'intermediate' | 'elite';
  title?: string;
}