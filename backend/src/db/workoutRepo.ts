import { QueryResultRow } from 'pg';
import { query } from './pool';

export interface WorkoutRow extends QueryResultRow {
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

interface CreateWorkoutParams {
  title?: string;
  poolLengthMeters?: number;
  plannedDurationMinutes?: number;
  focus?: string;
  profile?: string;
  shorthand: string;
  totalDistanceMeters?: number;
}

interface UpdateWorkoutParams {
  title?: string;
  poolLengthMeters?: number;
  plannedDurationMinutes?: number;
  focus?: string;
  profile?: string;
  shorthand: string;
  totalDistanceMeters?: number;
}

export async function createWorkout(params: CreateWorkoutParams): Promise<WorkoutRow> {
  const {
    title,
    poolLengthMeters,
    plannedDurationMinutes,
    focus,
    profile,
    shorthand,
    totalDistanceMeters
  } = params;

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
      pool_length_meters       AS "poolLengthMeters",
      planned_duration_minutes AS "plannedDurationMinutes",
      focus,
      profile,
      shorthand,
      total_distance_meters    AS "totalDistanceMeters",
      created_at               AS "createdAt",
      updated_at               AS "updatedAt"
    `,
    [
      title ?? null,
      poolLengthMeters ?? null,
      plannedDurationMinutes ?? null,
      focus ?? null,
      profile ?? null,
      shorthand,
      totalDistanceMeters ?? null
    ]
  );

  return result.rows[0];
}

export async function updateWorkoutById(
  id: string,
  params: UpdateWorkoutParams
): Promise<WorkoutRow | null> {
  const {
    title,
    poolLengthMeters,
    plannedDurationMinutes,
    focus,
    profile,
    shorthand,
    totalDistanceMeters
  } = params;

  const result = await query<WorkoutRow>(
    `
    UPDATE workouts
    SET
      title                   = $2,
      pool_length_meters      = $3,
      planned_duration_minutes= $4,
      focus                   = $5,
      profile                 = $6,
      shorthand               = $7,
      total_distance_meters   = $8,
      updated_at              = now()
    WHERE id = $1
    RETURNING
      id,
      title,
      pool_length_meters       AS "poolLengthMeters",
      planned_duration_minutes AS "plannedDurationMinutes",
      focus,
      profile,
      shorthand,
      total_distance_meters    AS "totalDistanceMeters",
      created_at               AS "createdAt",
      updated_at               AS "updatedAt"
    `,
    [
      id,
      title ?? null,
      poolLengthMeters ?? null,
      plannedDurationMinutes ?? null,
      focus ?? null,
      profile ?? null,
      shorthand,
      totalDistanceMeters ?? null
    ]
  );

  return result.rows[0] ?? null;
}

export async function getWorkoutById(id: string): Promise<WorkoutRow | null> {
  const result = await query<WorkoutRow>(
    `
    SELECT
      id,
      title,
      pool_length_meters       AS "poolLengthMeters",
      planned_duration_minutes AS "plannedDurationMinutes",
      focus,
      profile,
      shorthand,
      total_distance_meters    AS "totalDistanceMeters",
      created_at               AS "createdAt",
      updated_at               AS "updatedAt"
    FROM workouts
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function listWorkouts(): Promise<WorkoutRow[]> {
  const result = await query<WorkoutRow>(
    `
    SELECT
      id,
      title,
      pool_length_meters       AS "poolLengthMeters",
      planned_duration_minutes AS "plannedDurationMinutes",
      focus,
      profile,
      shorthand,
      total_distance_meters    AS "totalDistanceMeters",
      created_at               AS "createdAt",
      updated_at               AS "updatedAt"
    FROM workouts
    ORDER BY created_at DESC
    `
  );

  return result.rows;
}

export async function deleteWorkoutById(id: string): Promise<boolean> {
  const result = await query(
    `
    DELETE FROM workouts
    WHERE id = $1
    RETURNING id
    `,
    [id]
  );

  const rowCount = result.rowCount ?? 0;
  return rowCount > 0;
}
