import { query } from './pool';

/**
 * Shape of a workout as exposed to the rest of the app / API.
 * This uses camelCase to be friendly for TypeScript/Swift clients.
 */
export interface WorkoutRecord {
  id: string;
  title: string | null;
  poolLengthMeters: number | null;
  plannedDurationMinutes: number | null;
  focus: string | null;
  profile: string | null;
  shorthand: string;
  totalDistanceMeters: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Shape of the raw DB row as returned by Postgres.
 * This matches the column names in the workouts table.
 */
interface WorkoutRow {
  id: string;
  title: string | null;
  pool_length_meters: number | null;
  planned_duration_minutes: number | null;
  focus: string | null;
  profile: string | null;
  shorthand: string;
  total_distance_meters: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateWorkoutInput {
  title?: string;
  poolLengthMeters?: number;
  plannedDurationMinutes?: number;
  focus?: string;
  profile?: string;
  shorthand: string;
  totalDistanceMeters?: number;
}

/**
 * Map a raw DB row (snake_case) into a WorkoutRecord (camelCase).
 */
function mapRow(row: WorkoutRow): WorkoutRecord {
  return {
    id: row.id,
    title: row.title,
    poolLengthMeters: row.pool_length_meters,
    plannedDurationMinutes: row.planned_duration_minutes,
    focus: row.focus,
    profile: row.profile,
    shorthand: row.shorthand,
    totalDistanceMeters: row.total_distance_meters,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Insert a new workout and return the created record.
 */
export async function createWorkout(input: CreateWorkoutInput): Promise<WorkoutRecord> {
  const result = await query<WorkoutRow>(
    `
    INSERT INTO workouts (
      title,
      pool_length_meters,
      planned_duration_minutes,
      focus,
      profile,
      shorthand,
      total_distance_meters
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
      id,
      title,
      pool_length_meters,
      planned_duration_minutes,
      focus,
      profile,
      shorthand,
      total_distance_meters,
      created_at,
      updated_at
    `,
    [
      input.title ?? null,
      input.poolLengthMeters ?? null,
      input.plannedDurationMinutes ?? null,
      input.focus ?? null,
      input.profile ?? null,
      input.shorthand,
      input.totalDistanceMeters ?? null
    ]
  );

  const row = result.rows[0];
  return mapRow(row);
}

/**
 * Fetch a single workout by ID.
 */
export async function getWorkoutById(id: string): Promise<WorkoutRecord | null> {
  const result = await query<WorkoutRow>(
    `
    SELECT
      id,
      title,
      pool_length_meters,
      planned_duration_minutes,
      focus,
      profile,
      shorthand,
      total_distance_meters,
      created_at,
      updated_at
    FROM workouts
    WHERE id = $1
    `,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRow(result.rows[0]);
}

/**
 * List workouts, most recent first.
 */
export async function listWorkouts(limit = 50): Promise<WorkoutRecord[]> {
  const result = await query<WorkoutRow>(
    `
    SELECT
      id,
      title,
      pool_length_meters,
      planned_duration_minutes,
      focus,
      profile,
      shorthand,
      total_distance_meters,
      created_at,
      updated_at
    FROM workouts
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [limit]
  );

  return result.rows.map(mapRow);
} 